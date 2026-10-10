import { participantsDB } from "../../../dblayer/participantsDB.js";
import { capabilityFulfilmentsDB } from "../../../dblayer/capabilityFulfilmentsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { assertCanonicalCategory } from "./ontology.js";
import { resolveAuthor } from "./attentionItems.js";
import type { ParticipantRow, ParticipantType } from "../../../dblayer/seuTypes.js";

export type TransitionParticipantResult =
  | { ok: true; participant: ParticipantRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" | "authority_denied" | "policy_blocked" | "no_transition_definition" | "not_submitted" | "quality_gate_blocked"; detail: string };

const CH13_EVENT_BY_TRANSITION: Record<string, string> = {
  "Created->Available": "ParticipantActivated",
  "Available->Assigned": "ParticipantAssigned",
  "Idle->Assigned": "ParticipantAssigned",
  "Executing->Idle": "ParticipantIdle",
  "Idle->Released": "ParticipantReleased",
  "Released->Archived": "ParticipantArchived",
};

export async function transitionParticipant(input: { participantId: string; targetState: string; actorRole: string; actorId?: string }): Promise<TransitionParticipantResult> {
  const { data: participant } = await participantsDB.findById(input.participantId);
  if (!participant) return { ok: false, reason: "not_found", detail: `Participant not found: ${input.participantId}` };

  const fromState = participant.state;

  if (!input.actorId) throw new Error("actorId is required to transition a Participant");
  const gate = await transitionEngine.evaluate({
    entityType: "Participant",
    fromState,
    toState: input.targetState,
    actorRole: input.actorRole,
    actorId: input.actorId,
    seuId: participant.seu_id,
    entityId: participant.id,
    context: { participant },
  });
  if (!gate.allowed) {
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Participant ${fromState} -> ${input.targetState}` };
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
    if (gate.reason === "quality_gate_blocked") return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${gate.gateName}" blocked: ${gate.detail}` };
    if (gate.reason === "not_submitted") return { ok: false, reason: "not_submitted", detail: `must be submitted first (requires badge ${gate.submitBadge})` };
    return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
  }

  const { data: updated, error } = await participantsDB.updateStatus(participant.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update participant state");

  const eventType = CH13_EVENT_BY_TRANSITION[`${fromState}->${input.targetState}`];
  if (eventType) {
    await eventBus.publish({
      eventType,
      originatingObjectType: "Participant",
      originatingObjectId: participant.id,
      seuId: participant.seu_id,
      correlationId: eventBus.newCorrelationId(),
      payload: { fromState, toState: input.targetState },
      actorId: input.actorId,
      authorityBadge: gate.authorityBadge ?? "root",
    });
  }

  return { ok: true, participant: updated, appliedTransition: { fromState, toState: input.targetState } };
}

export type ReplaceParticipantResult =
  | { ok: true; oldParticipant: ParticipantRow; newParticipant: ParticipantRow }
  | { ok: false; reason: "no_active_fulfilment"; detail: string }
  | Exclude<TransitionParticipantResult, { ok: true }>;

export async function replaceParticipant(input: {
  oldParticipantId: string;
  newParticipantType: ParticipantType;
  newDisplayName: string;
  newParticipantMasterId?: string | null;
  actorRole: string;
  actorId?: string;
  authorBadge: string;
}): Promise<ReplaceParticipantResult> {
  const { data: oldParticipant } = await participantsDB.findById(input.oldParticipantId);
  if (!oldParticipant) return { ok: false, reason: "not_found", detail: `Participant not found: ${input.oldParticipantId}` };
  if (!input.actorId) throw new Error("actorId is required to replace a Participant");

  const { data: fulfilment } = await capabilityFulfilmentsDB.findActiveByParticipantId(oldParticipant.id);
  if (!fulfilment) return { ok: false, reason: "no_active_fulfilment", detail: `Participant ${oldParticipant.id} has no active Capability Fulfilment to hand off` };

  if (oldParticipant.state !== "Released") {
    const toReleased = await transitionParticipant({ participantId: oldParticipant.id, targetState: "Released", actorRole: input.actorRole, actorId: input.actorId });
    if (!toReleased.ok) return toReleased;
  }
  const toArchived = await transitionParticipant({ participantId: oldParticipant.id, targetState: "Archived", actorRole: input.actorRole, actorId: input.actorId });
  if (!toArchived.ok) return toArchived;

  await assertCanonicalCategory("participant-types", input.newParticipantType);

  const { data: newParticipant, error } = await participantsDB.create({
    seuId: oldParticipant.seu_id,
    type: input.newParticipantType,
    displayName: input.newDisplayName,
    participantId: input.newParticipantMasterId ?? null,
  });
  if (error || !newParticipant) throw error ?? new Error("failed to create replacement participant");

  await eventBus.publish({
    eventType: "ParticipantCreated",
    originatingObjectType: "Participant",
    originatingObjectId: newParticipant.id,
    seuId: oldParticipant.seu_id,
    correlationId: eventBus.newCorrelationId(),
    actorId: input.actorId,
    authorityBadge: input.authorBadge,
    payload: { participantType: input.newParticipantType },
  });

  await capabilityFulfilmentsDB.revoke(fulfilment.id);
  const { authorId } = await resolveAuthor(oldParticipant.seu_id, input.actorId);
  const { data: newFulfilment, error: fulfilmentErr } = await capabilityFulfilmentsDB.create({
    seuCapabilityId: fulfilment.seu_capability_id,
    participantId: newParticipant.id,
    fulfilmentStrategy: input.newParticipantType,
    authorId,
    authorBadge: input.authorBadge,
  });
  if (fulfilmentErr || !newFulfilment) throw fulfilmentErr ?? new Error("failed to establish replacement capability fulfilment");

  await eventBus.publish({
    eventType: "ParticipantReplaced",
    originatingObjectType: "Participant",
    originatingObjectId: newParticipant.id,
    seuId: oldParticipant.seu_id,
    correlationId: eventBus.newCorrelationId(),
    actorId: input.actorId,
    authorityBadge: input.authorBadge,
    payload: { oldParticipantId: oldParticipant.id, newParticipantId: newParticipant.id, seuCapabilityId: fulfilment.seu_capability_id },
  });

  return { ok: true, oldParticipant: toArchived.participant, newParticipant };
}
