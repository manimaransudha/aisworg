import { participantsDB } from "../../../dblayer/participantsDB.js";
import { capabilityFulfilmentsDB } from "../../../dblayer/capabilityFulfilmentsDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEntity, publishTransition } from "../../../domain/engine/entityTransition.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { assertCanonicalCategory } from "./ontology.js";
import { resolveAuthor } from "./attentionItems.js";
import type { ParticipantRow, ParticipantType } from "../../../dblayer/seuTypes.js";

export type TransitionParticipantResult =
  | { ok: true; participant: ParticipantRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" | "policy_blocked" | "no_transition_definition" | "not_submitted" | "quality_gate_blocked"; detail: string };

// A Participant is born through participantsDB.create, which reads the state of the birth row. The birth event is
// published last.
export async function createParticipant(input: {
  seuId: string;
  type: ParticipantType;
  displayName: string;
  participantMasterId?: string | null;
  actorId: string;
  authorBadge: string;
}): Promise<ParticipantRow> {
  const { data: birth, error: birthError } = await transitionDefinitionsDB.findBirth("Participant");
  if (birthError) throw birthError;
  if (!birth) throw new Error("no birth Transition Definition for Participant");
  if (!birth.event_type) throw new Error("the Participant birth Transition Definition names no event");

  const { data: participant, error } = await participantsDB.create({
    seuId: input.seuId,
    type: input.type,
    displayName: input.displayName,
    participantId: input.participantMasterId ?? null,
  });
  if (error || !participant) throw error ?? new Error("failed to create participant");

  await eventBus.publish({
    eventType: birth.event_type,
    originatingObjectType: "Participant",
    originatingObjectId: participant.id,
    seuId: participant.seu_id,
    correlationId: eventBus.newCorrelationId(),
    actorId: input.actorId,
    authorityBadge: input.authorBadge,
    payload: { participantType: input.type },
  });

  return participant;
}

// One governed Participant hop: the row's event, then ParticipantTransitioned as the last statement. The engine's hops
// (dispatch, work item completion) and transitionParticipant all go through here.
export async function applyParticipantHop(input: {
  participantId: string;
  targetState: string;
  actorId: string;
  payload?: Record<string, unknown>;
  correlationId?: string;
}): Promise<TransitionParticipantResult> {
  if (!input.actorId) throw new Error("actorId is required to transition a Participant");
  const result = await transitionEntity({ entityType: "Participant", entityId: input.participantId, targetState: input.targetState, actorId: input.actorId });
  if (!result.ok) {
    if (result.reason === "not_found") return { ok: false, reason: "not_found", detail: `Participant not found: ${input.participantId}` };
    return result;
  }

  const published = await publishTransition(result, { payload: input.payload ? { ...result.event.payload, ...input.payload } : undefined, correlationId: input.correlationId });
  await eventBus.publish({
    eventType: "ParticipantTransitioned",
    originatingObjectType: "Participant",
    originatingObjectId: input.participantId,
    seuId: result.event.seuId,
    correlationId: published.correlation_id,
    payload: result.event.payload,
    actorId: input.actorId,
    authorityBadge: result.event.authorityBadge,
  });

  return { ok: true, participant: result.row as ParticipantRow, appliedTransition: result.appliedTransition };
}

export async function transitionParticipant(input: { participantId: string; targetState: string; actorId: string }): Promise<TransitionParticipantResult> {
  return applyParticipantHop(input);
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
  actorId: string;
  authorBadge: string;
}): Promise<ReplaceParticipantResult> {
  const { data: oldParticipant } = await participantsDB.findById(input.oldParticipantId);
  if (!oldParticipant) return { ok: false, reason: "not_found", detail: `Participant not found: ${input.oldParticipantId}` };
  if (!input.actorId) throw new Error("actorId is required to replace a Participant");

  const { data: fulfilment } = await capabilityFulfilmentsDB.findActiveByParticipantId(oldParticipant.id);
  if (!fulfilment) return { ok: false, reason: "no_active_fulfilment", detail: `Participant ${oldParticipant.id} has no active Capability Fulfilment to hand off` };

  if (oldParticipant.state !== "Released") {
    const toReleased = await transitionParticipant({ participantId: oldParticipant.id, targetState: "Released", actorId: input.actorId });
    if (!toReleased.ok) return toReleased;
  }
  const toArchived = await transitionParticipant({ participantId: oldParticipant.id, targetState: "Archived", actorId: input.actorId });
  if (!toArchived.ok) return toArchived;

  await assertCanonicalCategory("participant-types", input.newParticipantType);

  const newParticipant = await createParticipant({
    seuId: oldParticipant.seu_id,
    type: input.newParticipantType,
    displayName: input.newDisplayName,
    participantMasterId: input.newParticipantMasterId ?? null,
    actorId: input.actorId,
    authorBadge: input.authorBadge,
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
