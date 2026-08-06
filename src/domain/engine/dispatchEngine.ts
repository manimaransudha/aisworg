// Ch.33 minimal instance — trivial "whoever's assigned" strategy (Post-MVP
// Build Sequence Phase 3 "Done when"). Capability Fulfilment (Ch.12,
// seuCapabilitiesDB + capabilityFulfilmentsDB) is the eligible-Participant
// pool Ch.33 §7/§3 says Dispatch consumes; today it's 1:1 per SEU Capability,
// so there's nothing to optimise yet. A real Dispatch Strategy framework
// (Ch.33 §9: cost/load/locality/etc, Pack-contributed) is future scope once
// more than one Participant can fulfil the same Capability.
//
// No autonomous Participant runtime exists yet (Build Plan §5), so once a
// Work Item is dispatched, execution is simulated synchronously in the same
// call — the human/API actor requesting the transition stands in for the
// assigned Participant reporting completion. Ch.32 WI-005 still holds: Work
// Item completion here does not itself change engineering state — the caller
// (executionEngine) applies the actual Deliverable transition afterwards.
import { seuCapabilitiesDB } from "../../dblayer/seuCapabilitiesDB.js";
import { capabilityFulfilmentsDB } from "../../dblayer/capabilityFulfilmentsDB.js";
import { workItemsDB } from "../../dblayer/workItemsDB.js";
import { participantsDB } from "../../dblayer/participantsDB.js";
import { eventBus } from "./eventBus.js";
import type { WorkItemRow } from "../../dblayer/seuTypes.js";

const SOLE_ELIGIBLE_PARTICIPANT = "sole-eligible-participant";
const NO_CAPABILITY_DECLARED = "no-producing-capability-declared";

export interface DispatchResult {
  dispatched: boolean;
  participantId?: string;
  deferredReason?: "no_producing_capability_fulfilled" | "no_eligible_participant";
}

export const dispatchEngine = {
  async dispatch(input: {
    workItem: WorkItemRow;
    seuId: string;
    producingCapabilityId: string | null;
    correlationId: string;
  }): Promise<DispatchResult> {
    // No Capability declared for this Deliverable at all: nothing for
    // Dispatch to gate on, so the Work Item proceeds unassigned rather than
    // deferring forever on a requirement that was never declared.
    if (!input.producingCapabilityId) {
      await workItemsDB.assign(input.workItem.id, null, NO_CAPABILITY_DECLARED);
      return this.execute(input.workItem.id, input.correlationId, undefined);
    }

    const { data: seuCapabilities } = await seuCapabilitiesDB.findBySeuId(input.seuId);
    const seuCapability = (seuCapabilities ?? []).find((c) => c.capability_id === input.producingCapabilityId);
    const fulfilment = seuCapability ? await capabilityFulfilmentsDB.findActiveBySeuCapabilityId(seuCapability.id) : { data: null };
    const participantId = fulfilment.data?.participant_id ?? null;

    if (!participantId) {
      await eventBus.publish({
        eventType: "DispatchDeferred",
        originatingObjectType: "WorkItem",
        originatingObjectId: input.workItem.id,
        correlationId: input.correlationId,
        payload: { reason: "no_eligible_participant" },
      });
      return { dispatched: false, deferredReason: "no_eligible_participant" };
    }

    await workItemsDB.assign(input.workItem.id, participantId, SOLE_ELIGIBLE_PARTICIPANT);

    // Participant Lifecycle Governance — Plan, Build order step 3. Direct
    // dblayer write + direct eventBus.publish, not routes/seu/core/
    // participants.ts's governed transitionParticipant — this is an
    // automatic system-driven state sync off dispatch's own simulated
    // execution, the same "engine writes state, engine publishes its own
    // events, engine never calls back into core" shape workItemsDB's own
    // updateStatus calls in this file already use for Work Item state.
    // Available->Assigned and the repeat-cycle Idle->Assigned both mean
    // "now Assigned" (core/participants.ts's own CH13_EVENT_BY_TRANSITION
    // maps both to the same event), so this doesn't need to branch on the
    // Participant's prior state to know which event to fire.
    await participantsDB.updateStatus(participantId, "Assigned");
    await eventBus.publish({
      eventType: "ParticipantAssigned",
      originatingObjectType: "Participant",
      originatingObjectId: participantId,
      correlationId: input.correlationId,
      payload: { workItemId: input.workItem.id },
    });

    await eventBus.publish({
      eventType: "ParticipantSelected",
      originatingObjectType: "WorkItem",
      originatingObjectId: input.workItem.id,
      correlationId: input.correlationId,
      payload: { participantId, strategy: SOLE_ELIGIBLE_PARTICIPANT },
    });
    await eventBus.publish({
      eventType: "WorkItemDispatched",
      originatingObjectType: "WorkItem",
      originatingObjectId: input.workItem.id,
      correlationId: input.correlationId,
      payload: { participantId },
    });

    return this.execute(input.workItem.id, input.correlationId, participantId);
  },

  async execute(workItemId: string, correlationId: string, participantId: string | undefined): Promise<DispatchResult> {
    await workItemsDB.updateStatus(workItemId, "Executing");
    await eventBus.publish({ eventType: "WorkItemStarted", originatingObjectType: "WorkItem", originatingObjectId: workItemId, correlationId, payload: {} });
    // Assigned -> Executing has no Ch.13 §16-named event at all (the
    // chapter's own event list has no "started executing" event), so
    // nothing is published here beyond the Work Item's own WorkItemStarted
    // — see core/participants.ts's CH13_EVENT_BY_TRANSITION comment.
    if (participantId) await participantsDB.updateStatus(participantId, "Executing");

    await workItemsDB.updateStatus(workItemId, "Completed");
    await eventBus.publish({ eventType: "WorkItemCompleted", originatingObjectType: "WorkItem", originatingObjectId: workItemId, correlationId, payload: {} });

    await workItemsDB.updateStatus(workItemId, "Disposed");
    await eventBus.publish({ eventType: "WorkItemDisposed", originatingObjectType: "WorkItem", originatingObjectId: workItemId, correlationId, payload: {} });

    // Idle, not Available (Ch.13 §9): still held by an open Capability
    // Fulfilment, just between Work Items — Available is Capability
    // Fulfilment's own eligibility state, never re-entered once a
    // Participant starts doing real work.
    if (participantId) {
      await participantsDB.updateStatus(participantId, "Idle");
      await eventBus.publish({
        eventType: "ParticipantIdle",
        originatingObjectType: "Participant",
        originatingObjectId: participantId,
        correlationId,
        payload: { workItemId },
      });
    }

    return { dispatched: true, participantId };
  },
};
