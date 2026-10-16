import { commandsDB } from "../../dblayer/commandsDB.js";
import { seusDB } from "../../dblayer/seusDB.js";
import { deliverablesDB } from "../../dblayer/deliverablesDB.js";
import { transitionDefinitionsDB } from "../../dblayer/transitionDefinitionsDB.js";
import { executionEngine } from "./executionEngine.js";
import { transitionDeliverable } from "../../routes/seu/core/deliverables.js";
import { RESOLVED_OBLIGATION_STATUSES, RESOLVED_ATTENTION_STATUSES } from "./qualityGateEngine.js";
import { getSystemActor, commandTypeFor, DELIVERABLE_PRODUCING_STATE, PRODUCE_COMMAND_VERB } from "../../dblayer/constants.js";
import { logger } from "../../utils/logger.js";
import type { EventHandler } from "./eventBus.js";
import type { EventRow, DeliverableRow } from "../../dblayer/seuTypes.js";
import { seuCapabilitiesDB } from "../../dblayer/seuCapabilitiesDB.js";
import { capabilityFulfilmentsDB } from "../../dblayer/capabilityFulfilmentsDB.js";

export const deliverableKickoffHandler: EventHandler = async (event: EventRow) => {
  if (!event.seu_id) return;

  if (event.event_type === "ObligationTransitioned") {
    const payload = event.payload as { toState?: string } | null;
    if (!payload?.toState || !RESOLVED_OBLIGATION_STATUSES.has(payload.toState)) return;
  }
  if (event.event_type === "AttentionItemTransitioned") {
    const payload = event.payload as { toState?: string } | null;
    if (!payload?.toState || !RESOLVED_ATTENTION_STATUSES.has(payload.toState)) return;
  }

  const { data: seu } = await seusDB.findById(event.seu_id);
  if (!seu) {
    logger.error(`[deliverableKickoffHandler] SEU not found: ${event.seu_id}`);
    return;
  }
  if (seu.lifecycle_state !== "Operational") return;

  const systemActor = await getSystemActor(seu.id);
  const { data: deliverables } = await deliverablesDB.findBySeuId(seu.id);
  for (const deliverable of deliverables ?? []) {
    const { data: nextTransitions } = await transitionDefinitionsDB.findPossibleNextTransitions("Deliverable", deliverable.lifecycle_state);
    for (const next of (nextTransitions ?? []).filter((t) => t.trigger === "governed")) {
      await transitionDeliverable({
        deliverableId: deliverable.id,
        targetState: next.toState,
        actorId: systemActor.actorId,
        requestedBy: systemActor.actorId,
      });
    }
  }

  if (event.event_type === "CapabilityFulfilled") {
    // A Deliverable already In Progress whose producing Capability has just been fulfilled gets its producing
    // Command, unless one is still in flight or already produced. A Failed one (empty pool) does not count.
    const fulfilled = event.payload as { capabilityId?: string } | null;
    if (!fulfilled?.capabilityId) throw new Error(`CapabilityFulfilled event ${event.id} carries no capabilityId`);
    for (const deliverable of deliverables ?? []) {
      if (deliverable.producing_capability_id !== fulfilled.capabilityId) continue;
      await reissueProducingCommand(seu.id, deliverable, event, systemActor);
    }
    return;
  }

  if (event.event_type === "DispatchRejected") {
    // Dispatch reads the pool snapshot persisted with the Command. A fulfilment that landed after that snapshot was
    // taken but before the rejection was consumed as CapabilityFulfilled while this Command was still in flight, so
    // it re-issued nothing. The rejection is the trigger that closes that window: the Command is now Failed, and the
    // Deliverable gets a new one whose pool is taken from the fulfilments that exist now.
    const rejected = event.payload as { commandId?: string | null; reason?: string } | null;
    if (!rejected?.commandId) return;
    const { data: rejectedCommand } = await commandsDB.findById(rejected.commandId);
    if (!rejectedCommand || rejectedCommand.entity_type !== "Deliverable") return;
    const deliverable = (deliverables ?? []).find((d) => d.id === rejectedCommand.entity_id);
    if (!deliverable?.producing_capability_id) return;
    await reissueProducingCommand(seu.id, deliverable, event, systemActor);
    return;
  }

  if (event.event_type !== "DeliverableTransitioned") return;
  const payload = event.payload as { toState?: string; commandId?: string } | null;
  if (payload?.toState !== DELIVERABLE_PRODUCING_STATE) return;
  if (!payload.commandId) throw new Error(`DeliverableTransitioned event ${event.id} carries no commandId`);
  const { data: transitionCommand } = await commandsDB.findById(payload.commandId);
  if (!transitionCommand) throw new Error(`Command ${payload.commandId} not found for DeliverableTransitioned event ${event.id}`);
  const { data: produced } = await deliverablesDB.findById(event.originating_object_id);
  if (!produced) {
    logger.error(`[deliverableKickoffHandler] Deliverable not found: ${event.originating_object_id}`);
    return;
  }
  await withDeliverableLock(produced.id, async () => {
    if (await hasLiveProducingCommand(seu.id, produced.id)) return;
    await executionEngine.execute({
      seuId: seu.id,
      entityType: "Deliverable",
      entityId: produced.id,
      fromState: DELIVERABLE_PRODUCING_STATE,
      toState: DELIVERABLE_PRODUCING_STATE,
      commandType: commandTypeFor("Deliverable", PRODUCE_COMMAND_VERB),
      producingCapabilityId: produced.producing_capability_id,
      requestedBy: systemActor.actorId,
      actorId: systemActor.actorId,
      actingBadgeType: event.authority_badge,
      correlationId: event.correlation_id,
      governanceOutcomeId: transitionCommand.governance_outcome_id,
    });
  });
};

// Issues a new producing Command for an In Progress Deliverable that has none in flight or Completed and whose
// producing Capability has an active fulfilment now. The new Command carries a pool taken from those fulfilments.
async function reissueProducingCommand(
  seuId: string,
  deliverable: DeliverableRow,
  event: EventRow,
  systemActor: Awaited<ReturnType<typeof getSystemActor>>
): Promise<void> {
  await withDeliverableLock(deliverable.id, () => reissueProducingCommandLocked(seuId, deliverable, event, systemActor));
}

// Handlers for one Deliverable run concurrently; the live-Command check and the Command insert must not interleave.
const deliverableLocks = new Map<string, Promise<unknown>>();
async function withDeliverableLock(deliverableId: string, work: () => Promise<void>): Promise<void> {
  const previous = deliverableLocks.get(deliverableId) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(work);
  deliverableLocks.set(deliverableId, current);
  try {
    await current;
  } finally {
    if (deliverableLocks.get(deliverableId) === current) deliverableLocks.delete(deliverableId);
  }
}

async function hasLiveProducingCommand(seuId: string, deliverableId: string): Promise<boolean> {
  const { data: commands } = await commandsDB.findBySeuId(seuId);
  return (commands ?? []).some((c) => c.entity_id === deliverableId && c.from_state === DELIVERABLE_PRODUCING_STATE && c.to_state === DELIVERABLE_PRODUCING_STATE && c.status !== "Failed");
}

async function reissueProducingCommandLocked(
  seuId: string,
  deliverable: DeliverableRow,
  event: EventRow,
  systemActor: Awaited<ReturnType<typeof getSystemActor>>
): Promise<void> {
  if (deliverable.lifecycle_state !== DELIVERABLE_PRODUCING_STATE || !deliverable.producing_capability_id) return;
  const { data: commands } = await commandsDB.findBySeuId(seuId);
  const own = (commands ?? []).filter((c) => c.entity_id === deliverable.id);
  if (own.some((c) => c.from_state === DELIVERABLE_PRODUCING_STATE && c.to_state === DELIVERABLE_PRODUCING_STATE && c.status !== "Failed")) return;
  const { data: seuCapability } = await seuCapabilitiesDB.findBySeuIdAndCapabilityId(seuId, deliverable.producing_capability_id);
  const { data: fulfilments } = seuCapability ? await capabilityFulfilmentsDB.findActiveManyBySeuCapabilityId(seuCapability.id) : { data: [] };
  if ((fulfilments ?? []).length === 0) return;
  const transitionCommand = own.find((c) => c.to_state === DELIVERABLE_PRODUCING_STATE && c.from_state !== DELIVERABLE_PRODUCING_STATE);
  if (!transitionCommand) throw new Error(`Deliverable ${deliverable.id} is In Progress but has no transition Command to take its governance outcome from`);
  await executionEngine.execute({
    seuId,
    entityType: "Deliverable",
    entityId: deliverable.id,
    fromState: DELIVERABLE_PRODUCING_STATE,
    toState: DELIVERABLE_PRODUCING_STATE,
    commandType: commandTypeFor("Deliverable", PRODUCE_COMMAND_VERB),
    producingCapabilityId: deliverable.producing_capability_id,
    requestedBy: systemActor.actorId,
    actorId: systemActor.actorId,
    actingBadgeType: transitionCommand.acting_badge_type,
    correlationId: event.correlation_id,
    governanceOutcomeId: transitionCommand.governance_outcome_id,
  });
}
