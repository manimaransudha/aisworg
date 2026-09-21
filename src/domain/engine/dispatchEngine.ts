// Ch.33 — this session's redesign. Cases (Ch.33 §14 events):
//   1. No producing Capability declared, or the eligible-Participant pool is
//      empty -> Obligation + Action-Required Attention Item -> DispatchRejected.
//   2. Candidates ARE Available, but no Dispatch Strategy (Ch.33 §9,
//      dispatchStrategies.ts) matches any of them -> ParticipantUnavailable
//      (same Obligation + Attention treatment as case 1) — structural, needs
//      a human (relax the strategy, or add a qualifying Participant).
//   3. A Dispatch Strategy matches an Available candidate -> assign,
//      ParticipantSelected + WorkItemDispatched (+ RedispatchCompleted if
//      this call is itself a retry). Participant takes over, no consumer.
//   4. Pool has entries, none currently Available at all (transient) ->
//      DispatchDeferred. Consumed by redispatchRequest.ts ->
//      RedispatchRequested -> redispatch.ts, which tracks attempts against
//      the Profile's N/M Configuration Parameters and calls back into
//      dispatch() with isRedispatch: true.
import { capabilityFulfilmentPoolsDB } from "../../dblayer/capabilityFulfilmentPoolsDB.js";
import { workItemsDB } from "../../dblayer/workItemsDB.js";
import { participantsDB } from "../../dblayer/participantsDB.js";
import { commandsDB } from "../../dblayer/commandsDB.js";
import { servicesDB } from "../../dblayer/servicesDB.js";
import { eventBus } from "./eventBus.js";
import { createObligation } from "../../routes/seu/core/obligations.js";
import { raiseAttentionItem } from "../../routes/seu/core/attentionItems.js";
import { loadAvailableCandidates, selectParticipant } from "./dispatchStrategies.js";
import type { CommandRow, ServiceRow, WorkItemRow } from "../../dblayer/seuTypes.js";

// The stall SLA is declared per Capability on its Service's Service Level
// (Ch.11 §8, Resolution 9). NOT hardcoded: a Capability whose Service
// declares none has no target, so its Work Items never stall-escalate.
// CR-064 — service_level is now the nested {label, target} list a Pack
// author declares (e.g. label "Onsite turnaround," target "1 day"), not a
// flat object — matches on any item whose label mentions "turnaround".
// `target` is only recognised here if it's a bare number of seconds; a
// human duration string ("3 days") doesn't parse.
function resolveTurnaroundSeconds(services: ServiceRow[]): number | null {
  for (const service of services) {
    const item = (service.service_level ?? []).find((i) => /turnaround/i.test(i.label));
    if (!item) continue;
    const t = item.target;
    if (Number.isFinite(Number(t)) && Number(t) > 0) return Number(t);
  }
  return null;
}

async function rejectDispatch(input: { workItem: WorkItemRow; command: CommandRow | null; seuId: string; correlationId: string }, eventType: "DispatchRejected" | "ParticipantUnavailable", reason: string): Promise<void> {
  console.log(`[dispatchEngine] rejectDispatch seuId=${input.seuId} entityType=${input.command?.entity_type} entityId=${input.command?.entity_id} fromState=${input.command?.from_state} toState=${input.command?.to_state} reason=${reason} workItemId=${input.workItem.id}`);
  // Ch.32 §8 — this Work Item was never assigned and never will be; straight
  // to Disposed (Cancelled is just a route there, no distinct behaviour of
  // its own). Retained for traceability, per the chapter's own words — a
  // retry after the Obligation resolves mints an entirely new Work Item,
  // never reuses this one.
  await workItemsDB.updateStatus(input.workItem.id, "Disposed");
  if (input.command) {
    // Terminal, not in-flight (commandsDB.findInFlight): a human resolving
    // the Obligation below must be able to re-attempt this exact hop, which
    // a Command stuck at Generated/Dispatched/Deferred forever would block.
    await commandsDB.updateStatus(input.command.id, "Failed");
    await createObligation({
      relatedObjectType: input.command.entity_type,
      relatedObjectId: input.command.entity_id,
      category: "Operational",
      title: `Dispatch could not find a Participant for Work Item ${input.workItem.id} (${reason})`,
      description: `Command ${input.command.id} (${input.command.from_state} -> ${input.command.to_state}): ${reason}.`,
    });
    await raiseAttentionItem({
      seuId: input.seuId,
      category: "Action Required",
      priority: "High",
      title: `Work Item ${input.workItem.id} could not be dispatched (${reason})`,
      description: `Command ${input.command.id} (${input.command.from_state} -> ${input.command.to_state}) needs a Participant, and none is available (${reason}). Resolve the Obligation once addressed.`,
      relatedObjectType: input.command.entity_type,
      relatedObjectId: input.command.entity_id,
    });
  }
  await eventBus.publish({
    eventType,
    originatingObjectType: "WorkItem",
    originatingObjectId: input.workItem.id,
    seuId: input.seuId,
    correlationId: input.correlationId,
    payload: { reason },
  });
}

export const dispatchEngine = {
  async dispatch(input: {
    workItem: WorkItemRow;
    seuId: string;
    producingCapabilityId: string | null;
    // Ch.12 §9 / CR-109 §6.2 — the capability_fulfilment_pools snapshot
    // executionEngine.execute() already took of the real eligible-Participant
    // pool for this Command's producing Capability. Read, never re-resolved
    // live here (CR-109 §5's "connective tissue" principle) — null exactly
    // when producingCapabilityId is null (no Capability declared at all).
    eligibleParticipantPoolId: string | null;
    // Participant Integration — Plan step 4: an explicit target completion time
    // the assigner supplied, overriding the SLA-derived default. Null/absent =
    // use the default.
    targetCompletionAt?: Date | null;
    correlationId: string;
    // Ch.33 §14 Redispatch — true when redispatch.ts is calling this as a
    // retry, so a successful outcome also publishes RedispatchCompleted.
    isRedispatch?: boolean;
    // Ch.33 §9 — the Profile's own dispatchStrategyPreference, resolved by
    // the caller (workItemGeneratedHandler / redispatch.ts, off the SEU's
    // EBM) and tried here in order. Empty/absent -> Capability Match alone.
    strategies?: Array<{ strategy: string; order: number }>;
  }): Promise<void> {
    const command = (await commandsDB.findById(input.workItem.command_id)).data ?? null;

    // Case 1a: no Capability declared for this Deliverable at all.
    if (!input.producingCapabilityId) {
      await rejectDispatch({ ...input, command }, "DispatchRejected", "no_producing_capability_declared");
      return;
    }

    const pool = input.eligibleParticipantPoolId ? await capabilityFulfilmentPoolsDB.findById(input.eligibleParticipantPoolId) : { data: null };
    const candidateIds = pool.data?.participant_ids ?? [];

    // Case 1b: the eligible-Participant pool is empty.
    if (candidateIds.length === 0) {
      await rejectDispatch({ ...input, command }, "DispatchRejected", "empty_eligible_pool");
      return;
    }

    const available = await loadAvailableCandidates(candidateIds);

    // Case 4: qualified candidates exist, none currently Available (transient).
    if (available.length === 0) {
      if (command) await commandsDB.updateStatus(command.id, "Deferred");
      await eventBus.publish({
        eventType: "DispatchDeferred",
        originatingObjectType: "WorkItem",
        originatingObjectId: input.workItem.id,
        seuId: input.seuId,
        correlationId: input.correlationId,
        payload: { reason: "no_available_participant" },
      });
      return;
    }

    // Case 2: candidates ARE Available, but no Dispatch Strategy (Ch.33 §9)
    // matched any of them — structural (needs a human: relax the strategy,
    // or add a properly-qualified Participant), not transient.
    const selection = await selectParticipant(available, input.strategies ?? [], input.seuId);
    if (!selection) {
      await rejectDispatch({ ...input, command }, "ParticipantUnavailable", "no_candidate_matched_dispatch_strategy");
      return;
    }
    const { participantId, strategy } = selection;

    // Case 3: assign.
    if (command) await commandsDB.updateStatus(command.id, "Dispatched");
    await workItemsDB.assign(input.workItem.id, participantId, strategy);

    // Participant Integration — Plan step 4: the assignment-out contract's
    // deadline, a commitment fixed at assignment (not re-derived later). The
    // assigner's explicit target wins; otherwise the default is the producing
    // Capability's declared turnaround SLA. No override and no SLA -> no target
    // -> never stall-escalated.
    if (input.targetCompletionAt) {
      await workItemsDB.setTargetCompletionAt(input.workItem.id, input.targetCompletionAt);
    } else {
      const { data: services } = await servicesDB.findByCapabilityId(input.producingCapabilityId);
      const slaSeconds = resolveTurnaroundSeconds(services ?? []);
      if (slaSeconds != null) {
        await workItemsDB.setTargetCompletion(input.workItem.id, slaSeconds);
      }
    }

    // Participant Lifecycle Governance — Plan, Build order step 3. Direct
    // dblayer write + direct eventBus.publish (never core's transitionParticipant,
    // per the engine-never-calls-core boundary). Available->Assigned and the
    // repeat-cycle Idle->Assigned both mean "now Assigned," so no branch on
    // prior Participant state is needed.
    await participantsDB.updateStatus(participantId, "Assigned");
    await eventBus.publish({
      eventType: "ParticipantAssigned",
      originatingObjectType: "Participant",
      originatingObjectId: participantId,
      seuId: input.seuId,
      correlationId: input.correlationId,
      payload: { workItemId: input.workItem.id },
    });

    // Outstanding: dispatched and waiting for the participant's result callback.
    await workItemsDB.updateStatus(input.workItem.id, "Dispatched");
    await eventBus.publish({
      eventType: "ParticipantSelected",
      originatingObjectType: "WorkItem",
      originatingObjectId: input.workItem.id,
      seuId: input.seuId,
      correlationId: input.correlationId,
      payload: { participantId, strategy },
    });
    await eventBus.publish({
      eventType: "WorkItemDispatched",
      originatingObjectType: "WorkItem",
      originatingObjectId: input.workItem.id,
      seuId: input.seuId,
      correlationId: input.correlationId,
      payload: { participantId },
    });
    if (input.isRedispatch) {
      await eventBus.publish({
        eventType: "RedispatchCompleted",
        originatingObjectType: "WorkItem",
        originatingObjectId: input.workItem.id,
        seuId: input.seuId,
        correlationId: input.correlationId,
        payload: { participantId },
      });
    }
  },
};
