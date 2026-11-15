import { commandsDB } from "../../dblayer/commandsDB.js";
import { seusDB } from "../../dblayer/seusDB.js";
import { deliverablesDB } from "../../dblayer/deliverablesDB.js";
import { transitionDefinitionsDB } from "../../dblayer/transitionDefinitionsDB.js";
import { executionEngine } from "./executionEngine.js";
import { dependencyDefinitionEngine } from "./dependencyDefinitionEngine.js";
import { resolveSeuOwningScope } from "./deliverableSource.js";
import { requestProducingCapabilities } from "./capabilityOnReady.js";
import { transitionDeliverable } from "../../routes/seu/core/deliverables.js";
import { RESOLVED_OBLIGATION_STATUSES, RESOLVED_ATTENTION_STATUSES } from "./qualityGateEngine.js";
import { getSystemActor, commandTypeFor, DELIVERABLE_PRODUCING_STATE, PRODUCE_COMMAND_VERB } from "../../dblayer/constants.js";
import { logger } from "../../utils/logger.js";
import type { EventHandler } from "./eventBus.js";
import type { EventRow, DeliverableRow, SeuRow } from "../../dblayer/seuTypes.js";
import { seuCapabilitiesDB } from "../../dblayer/seuCapabilitiesDB.js";
import { obligationsDB } from "../../dblayer/obligationsDB.js";
import { createObligation } from "../../routes/seu/core/obligations.js";
import { raiseAttentionItem } from "../../routes/seu/core/attentionItems.js";
import { capabilityFulfilmentsDB } from "../../dblayer/capabilityFulfilmentsDB.js";

export const deliverableKickoffHandler: EventHandler = async (event: EventRow) => {
  if (!event.seu_id) throw new Error(`${event.event_type} event ${event.id} carries no seuId`);

  const { data: seu } = await seusDB.findById(event.seu_id);
  if (!seu) {
    logger.error(`[deliverableKickoffHandler] SEU not found: ${event.seu_id}`);
    return;
  }
  if (seu.lifecycle_state !== "Operational") return;

  if (event.event_type === "ObligationTransitioned") {
    const payload = event.payload as { toState?: string } | null;
    if (!payload?.toState || !RESOLVED_OBLIGATION_STATUSES.has(payload.toState)) return;
  }
  if (event.event_type === "AttentionItemTransitioned") {
    const payload = event.payload as { toState?: string } | null;
    if (!payload?.toState || !RESOLVED_ATTENTION_STATUSES.has(payload.toState)) return;
  }

  const systemActor = await getSystemActor(seu.id);

  if (event.event_type === "SEUOperational") return processSeuOperational(seu, systemActor);
  if (event.event_type === "DeliverableTransitioned") return processDeliverableTransitioned(event, seu, systemActor);
  if (event.event_type === "CapabilityFulfilled") return processCapabilityFulfilled(event, seu, systemActor);
  if (event.event_type === "CapabilityUnavailable") return processCapabilityUnavailable(event, seu, systemActor);
  if (event.event_type === "DispatchRejected") return processDispatchRejected(event, seu, systemActor);
  if (event.event_type === "ObligationTransitioned") return processObligationTransitioned(event, seu, systemActor);
  if (event.event_type === "AttentionItemTransitioned") return processAttentionItemTransitioned(event, seu, systemActor);
  throw new Error(`deliverableKickoffHandler does not handle event type ${event.event_type} (event ${event.id})`);
};

type SystemActor = Awaited<ReturnType<typeof getSystemActor>>;

// Tries each governed next transition of each of the given Deliverables.
async function attemptGovernedTransitions(deliverables: DeliverableRow[], systemActor: SystemActor): Promise<void> {
  for (const deliverable of deliverables) {
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
}

// The SEU has just become Operational. Only the start nodes are attempted; every other Deliverable waits for the
// Deliverables it depends on.
async function processSeuOperational(seu: SeuRow, systemActor: SystemActor): Promise<void> {
  const { data: deliverables } = await deliverablesDB.findBySeuId(seu.id);
  const startNodes: DeliverableRow[] = [];
  for (const deliverable of deliverables ?? []) {
    if (await dependencyDefinitionEngine.isStartNode(seu.id, "Deliverable", deliverable.name)) startNodes.push(deliverable);
  }
  await requestProducingCapabilities(seu.id, startNodes);
  await attemptGovernedTransitions(startNodes, systemActor);
}

async function processAttentionItemTransitioned(event: EventRow, seu: SeuRow, systemActor: SystemActor): Promise<void> {
  const resolved = event.payload as { relatedObjectType?: string | null; relatedObjectId?: string | null } | null;
  if (!resolved || resolved.relatedObjectType === undefined || resolved.relatedObjectId === undefined) throw new Error(`AttentionItemTransitioned event ${event.id} carries no relatedObjectType or relatedObjectId`);
  // Only an Attention Item raised for a Deliverable concerns that Deliverable.
  if (resolved.relatedObjectType !== "Deliverable" || !resolved.relatedObjectId) return;
  const { data: deliverable } = await deliverablesDB.findById(resolved.relatedObjectId);
  if (!deliverable || deliverable.seu_id !== seu.id) throw new Error(`AttentionItemTransitioned event ${event.id}: Deliverable ${resolved.relatedObjectId} not found in SEU ${seu.id}`);
  await attemptGovernedTransitions([deliverable], systemActor);
}

async function processObligationTransitioned(event: EventRow, seu: SeuRow, systemActor: SystemActor): Promise<void> {
  const resolved = event.payload as { relatedObjectType?: string; relatedObjectId?: string } | null;
  if (!resolved?.relatedObjectType || !resolved.relatedObjectId) throw new Error(`ObligationTransitioned event ${event.id} carries no relatedObjectType or relatedObjectId`);
  // Only an Obligation raised against a Deliverable holds that Deliverable.
  if (resolved.relatedObjectType !== "Deliverable") return;
  const { data: deliverable } = await deliverablesDB.findById(resolved.relatedObjectId);
  if (!deliverable || deliverable.seu_id !== seu.id) throw new Error(`ObligationTransitioned event ${event.id}: Deliverable ${resolved.relatedObjectId} not found in SEU ${seu.id}`);
  await attemptGovernedTransitions([deliverable], systemActor);
  // A resolved blocking Obligation lifts the block on a producing Command that was held back while it was open.
  if (deliverable.producing_capability_id) await reissueProducingCommand(seu.id, deliverable, event, systemActor);
}

async function processCapabilityUnavailable(event: EventRow, seu: SeuRow, systemActor: SystemActor): Promise<void> {
  // The producing Capability of an In Progress Deliverable has no eligible Participant. The Deliverable is held by a
  // blocking Obligation, with an AttentionItem for the UI, until the Capability is fulfilled and the Obligation resolves.
  // Only the Deliverables this Capability produces are considered. No Deliverable is attempted: nothing moves forward.
  const unavailable = event.payload as { capabilityId?: string } | null;
  if (!unavailable?.capabilityId) throw new Error(`CapabilityUnavailable event ${event.id} carries no capabilityId`);
  const { data: seuCapability } = await seuCapabilitiesDB.findBySeuIdAndCapabilityId(seu.id, unavailable.capabilityId);
  if (!seuCapability) throw new Error(`CapabilityUnavailable event ${event.id}: SEU ${seu.id} does not require Capability ${unavailable.capabilityId}`);
  const { data: capabilities } = await seuCapabilitiesDB.findBySeuId(seu.id);
  const capabilityCode = (capabilities ?? []).find((c) => c.id === seuCapability.id)?.capability_code ?? unavailable.capabilityId;
  const { data: deliverables } = await deliverablesDB.findBySeuId(seu.id);
  for (const deliverable of (deliverables ?? []).filter((d) => d.producing_capability_id === unavailable.capabilityId)) {
    if (deliverable.lifecycle_state !== DELIVERABLE_PRODUCING_STATE) continue;
    await blockDeliverableForUnavailableCapability(seu.id, deliverable, capabilityCode, event, systemActor);
  }
}

// A Capability has been fulfilled. Only the Deliverables it produces are attempted, and only those that are ready. A
// Deliverable already In Progress whose producing Capability has just been fulfilled gets its producing Command,
// unless one is still in flight or already produced. A Failed one (empty pool) does not count.
async function processCapabilityFulfilled(event: EventRow, seu: SeuRow, systemActor: SystemActor): Promise<void> {
  const fulfilled = event.payload as { capabilityId?: string } | null;
  if (!fulfilled?.capabilityId) throw new Error(`CapabilityFulfilled event ${event.id} carries no capabilityId`);
  const { data } = await deliverablesDB.findBySeuId(seu.id);
  const producedByCapability = (data ?? []).filter((d) => d.producing_capability_id === fulfilled.capabilityId);
  const ready: DeliverableRow[] = [];
  for (const deliverable of producedByCapability) {
    const { ready: isReady } = await dependencyDefinitionEngine.isTargetReady(seu.id, "Deliverable", deliverable.name, DELIVERABLE_PRODUCING_STATE);
    if (isReady) ready.push(deliverable);
  }
  await attemptGovernedTransitions(ready, systemActor);
  for (const deliverable of producedByCapability) {
    await reissueProducingCommand(seu.id, deliverable, event, systemActor);
  }
}

async function processDispatchRejected(event: EventRow, seu: SeuRow, systemActor: SystemActor): Promise<void> {
  const rejected = event.payload as { commandId?: string | null; relatedObjectType?: string | null; relatedObjectId?: string | null } | null;
  if (!rejected || rejected.relatedObjectType === undefined || rejected.relatedObjectId === undefined) throw new Error(`DispatchRejected event ${event.id} carries no relatedObjectType or relatedObjectId`);
  // A dispatch is made for the Command of one entity. Only a Command of a Deliverable concerns a Deliverable.
  if (rejected.relatedObjectType !== "Deliverable" || !rejected.relatedObjectId) return;
  const { data: deliverable } = await deliverablesDB.findById(rejected.relatedObjectId);
  if (!deliverable || deliverable.seu_id !== seu.id) throw new Error(`DispatchRejected event ${event.id}: Deliverable ${rejected.relatedObjectId} not found in SEU ${seu.id}`);
  await attemptGovernedTransitions([deliverable], systemActor);
  // Dispatch reads the pool snapshot persisted with the Command. A fulfilment that landed after that snapshot was
  // taken but before the rejection was consumed as CapabilityFulfilled while this Command was still in flight, so
  // it re-issued nothing. The rejection is the trigger that closes that window: the Command is now Failed, and the
  // Deliverable gets a new one whose pool is taken from the fulfilments that exist now. A rejection that names no
  // Command (redispatch exhausted) re-issues nothing.
  if (!rejected.commandId || !deliverable.producing_capability_id) return;
  await reissueProducingCommand(seu.id, deliverable, event, systemActor);
}

// A Deliverable has moved. Only the Deliverables that depend on it at its new state are attempted. When it moved to
// the producing state, its producing Command is issued.
async function processDeliverableTransitioned(event: EventRow, seu: SeuRow, systemActor: SystemActor): Promise<void> {
  const payload = event.payload as { deliverableName?: string; toState?: string; commandId?: string } | null;
  if (!payload?.deliverableName || !payload.toState) throw new Error(`DeliverableTransitioned event ${event.id} carries no deliverableName or toState`);
  const scope = await resolveSeuOwningScope(seu);
  const { data: successors } = await deliverablesDB.findSuccessors(seu.id, scope.dependencyDefinitionIds, "Deliverable", payload.deliverableName, payload.toState);
  const ready: DeliverableRow[] = [];
  for (const successor of successors ?? []) {
    const { ready: isReady } = await dependencyDefinitionEngine.isTargetReady(seu.id, "Deliverable", successor.name, DELIVERABLE_PRODUCING_STATE);
    if (isReady) ready.push(successor);
  }
  await requestProducingCapabilities(seu.id, ready);
  await attemptGovernedTransitions(ready, systemActor);
  if (payload.toState !== DELIVERABLE_PRODUCING_STATE) return;
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
    if (await hasOpenBlockingObligation(produced.id)) return;
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
}

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
  if (await hasOpenBlockingObligation(deliverable.id)) return;
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

async function hasOpenBlockingObligation(deliverableId: string): Promise<boolean> {
  const { data: obligations } = await obligationsDB.findByRelatedObject("Deliverable", deliverableId);
  return (obligations ?? []).some((o) => o.blocked_from_state && o.blocked_to_state && !RESOLVED_OBLIGATION_STATUSES.has(o.status));
}

async function blockDeliverableForUnavailableCapability(
  seuId: string,
  deliverable: DeliverableRow,
  capabilityCode: string,
  event: EventRow,
  systemActor: Awaited<ReturnType<typeof getSystemActor>>
): Promise<void> {
  const title = `Capability "${capabilityCode}" is unavailable for Deliverable "${deliverable.name}"`;
  const { data: obligations } = await obligationsDB.findByRelatedObject("Deliverable", deliverable.id);
  const alreadyOpen = (obligations ?? []).some((o) => o.title === title && o.blocked_from_state && !RESOLVED_OBLIGATION_STATUSES.has(o.status));
  if (!alreadyOpen) {
    await createObligation({
      relatedObjectType: "Deliverable",
      relatedObjectId: deliverable.id,
      category: "Operational",
      title,
      description: `No eligible Participant was found for Capability "${capabilityCode}". The Deliverable cannot be produced until the Capability is fulfilled. Resolve the Obligation once addressed.`,
      blockedFromState: DELIVERABLE_PRODUCING_STATE,
      blockedToState: DELIVERABLE_PRODUCING_STATE,
      actorId: systemActor.actorId,
      authorBadge: systemActor.authorBadge,
    });
  }
  await raiseAttentionItem({
    seuId,
    category: "Action Required",
    priority: "High",
    title,
    description: `Capability "${capabilityCode}" is not fulfilled. The Deliverable is held until it is.`,
    relatedObjectType: "Deliverable",
    relatedObjectId: deliverable.id,
    triggeringEventId: event.id,
    ...systemActor,
  });
}
