// Ch.33 minimal instance — trivial "whoever's assigned" strategy (Post-MVP
// Build Sequence Phase 3 "Done when"). Capability Fulfilment (Ch.12,
// seuCapabilitiesDB + capabilityFulfilmentsDB) is the eligible-Participant
// pool Ch.33 §7/§3 says Dispatch consumes; today it's 1:1 per SEU Capability,
// so there's nothing to optimise yet. A real Dispatch Strategy framework
// (Ch.33 §9: cost/load/locality/etc, Pack-contributed) is future scope once
// more than one Participant can fulfil the same Capability.
//
// Participant Integration & Attestation — Plan, step 1 (Model A): dispatch no
// longer simulates execution synchronously. It selects the Participant,
// assigns the Work Item, marks it Dispatched (outstanding), and returns. The
// Work Item then *waits* for an out-of-process result callback — the platform
// is deliberately blind to what the Participant does in its own environment
// (Book 1: govern behaviour, not competence). Completion (apply the
// transition, dispose the Work Item, return the Participant to Idle) happens
// in routes/seu/core/workItems.ts's completeWorkItem, driven by the callback,
// not here — the engine layer never applies a governed Deliverable transition
// (that is core's job).
import { seuCapabilitiesDB } from "../../dblayer/seuCapabilitiesDB.js";
import { capabilityFulfilmentsDB } from "../../dblayer/capabilityFulfilmentsDB.js";
import { workItemsDB } from "../../dblayer/workItemsDB.js";
import { participantsDB } from "../../dblayer/participantsDB.js";
import { servicesDB } from "../../dblayer/servicesDB.js";
import { eventBus } from "./eventBus.js";
import type { ServiceRow, WorkItemRow } from "../../dblayer/seuTypes.js";

// The stall SLA is declared per Capability on its Service's Service Level
// (`turnaround_time`, seconds — Ch.11 §8, Resolution 9). NOT hardcoded: a
// Capability whose Service declares none has no target, so its Work Items never
// stall-escalate.
function resolveTurnaroundSeconds(services: ServiceRow[]): number | null {
  for (const service of services) {
    const t = (service.service_level ?? {}).turnaround_time;
    if (typeof t === "number" && t > 0) return t;
    if (typeof t === "string" && t.trim() !== "" && Number.isFinite(Number(t)) && Number(t) > 0) return Number(t);
  }
  return null;
}

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
    // Participant Integration — Plan step 4: an explicit target completion time
    // the assigner supplied, overriding the SLA-derived default. Null/absent =
    // use the default.
    targetCompletionAt?: Date | null;
    correlationId: string;
  }): Promise<DispatchResult> {
    // No Capability declared for this Deliverable at all: nothing for Dispatch
    // to gate on, so the Work Item is dispatched unassigned and left
    // outstanding, to be completed by a callback the same way an assigned one
    // is — rather than deferring forever on a requirement that was never
    // declared.
    if (!input.producingCapabilityId) {
      await workItemsDB.assign(input.workItem.id, null, NO_CAPABILITY_DECLARED);
      await workItemsDB.updateStatus(input.workItem.id, "Dispatched");
      await eventBus.publish({
        eventType: "WorkItemDispatched",
        originatingObjectType: "WorkItem",
        originatingObjectId: input.workItem.id,
        seuId: input.seuId,
        correlationId: input.correlationId,
        payload: { participantId: null },
      });
      return { dispatched: true, participantId: undefined };
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
        seuId: input.seuId,
        correlationId: input.correlationId,
        payload: { reason: "no_eligible_participant" },
      });
      return { dispatched: false, deferredReason: "no_eligible_participant" };
    }

    await workItemsDB.assign(input.workItem.id, participantId, SOLE_ELIGIBLE_PARTICIPANT);

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
      payload: { participantId, strategy: SOLE_ELIGIBLE_PARTICIPANT },
    });
    await eventBus.publish({
      eventType: "WorkItemDispatched",
      originatingObjectType: "WorkItem",
      originatingObjectId: input.workItem.id,
      seuId: input.seuId,
      correlationId: input.correlationId,
      payload: { participantId },
    });

    return { dispatched: true, participantId };
  },
};
