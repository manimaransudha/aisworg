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

    await workItemsDB.updateStatus(workItemId, "Completed");
    await eventBus.publish({ eventType: "WorkItemCompleted", originatingObjectType: "WorkItem", originatingObjectId: workItemId, correlationId, payload: {} });

    await workItemsDB.updateStatus(workItemId, "Disposed");
    await eventBus.publish({ eventType: "WorkItemDisposed", originatingObjectType: "WorkItem", originatingObjectId: workItemId, correlationId, payload: {} });

    return { dispatched: true, participantId };
  },
};
