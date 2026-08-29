// Participant Lifecycle Governance — Plan (design/mvp-build-plan/Participant
// Lifecycle Governance — Plan.md), Build order step 1/2. `Participant` is a
// brand-new TransitionEntityType, added after transitionEngine.evaluate
// itself gained a generic Quality Gate check (SDK UI Layer Plan) — unlike
// the 9 entity types that predate that generalisation, there's no legacy
// coincidental-(entityType,fromState,toState) quality_gates row to preserve
// here, so this calls transitionEngine.evaluate directly, no separate
// qualityGateEngine.evaluate pre-check.
import { participantsDB } from "../../../dblayer/participantsDB.js";
import { capabilityFulfilmentsDB } from "../../../dblayer/capabilityFulfilmentsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import type { ParticipantRow, ParticipantType } from "../../../dblayer/seuTypes.js";

export type TransitionParticipantResult =
  | { ok: true; participant: ParticipantRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" | "authority_denied" | "policy_blocked" | "no_transition_definition" | "not_submitted" | "quality_gate_blocked"; detail: string };

// Ch.13 §16's event list doesn't map one-to-one onto §9's seven-edge graph:
// ParticipantCreated fires separately (fulfilCapability, not a transition);
// Available->Assigned and Idle->Assigned both mean "now Assigned," so both
// fire ParticipantAssigned; Assigned->Executing has no chapter-named event
// at all — Ch.13 §16 never lists a "started executing" event, so none is
// invented here. ParticipantReplaced (step 4) and ParticipantUnavailable
// (held, no graph edge to hang it on — see the plan's own note) aren't
// transition-driven, so they're not in this table.
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
      actorId: input.actorId ?? null,
      authorityBadge: gate.authorityBadge,
    });
  }

  return { ok: true, participant: updated, appliedTransition: { fromState, toState: input.targetState } };
}

export type ReplaceParticipantResult =
  | { ok: true; oldParticipant: ParticipantRow; newParticipant: ParticipantRow }
  | { ok: false; reason: "no_active_fulfilment"; detail: string }
  | Exclude<TransitionParticipantResult, { ok: true }>;

// Ch.13 §13 (Participant Replacement), PM-001 — Build order step 4. "The
// platform shall permit replacement of any Participant": Available,
// Assigned, Executing and Idle each have a real edge into Released (seeded
// alongside step 1's graph, specifically for this — the chapter is explicit
// that replacement isn't limited to an Idle Participant), so the old
// Participant is driven to Released from whatever state it's actually in,
// then Released -> Archived — two real, governed transitionParticipant
// calls, not a bypass. Preserves everything Ch.13 §13 lists (Deliverable
// state, Knowledge, Decisions, Evidence, Traceability, Outstanding
// Obligations): none of those reference participant_id at all (PM-003,
// confirmed in the design doc's own review), so there is nothing to
// re-point for them — only capability_fulfilments does, and that's exactly
// what this function re-points.
export async function replaceParticipant(input: {
  oldParticipantId: string;
  newParticipantType: ParticipantType;
  newDisplayName: string;
  newUserId?: number | null;
  actorRole: string;
  actorId?: string;
}): Promise<ReplaceParticipantResult> {
  const { data: oldParticipant } = await participantsDB.findById(input.oldParticipantId);
  if (!oldParticipant) return { ok: false, reason: "not_found", detail: `Participant not found: ${input.oldParticipantId}` };

  const { data: fulfilment } = await capabilityFulfilmentsDB.findActiveByParticipantId(oldParticipant.id);
  if (!fulfilment) return { ok: false, reason: "no_active_fulfilment", detail: `Participant ${oldParticipant.id} has no active Capability Fulfilment to hand off` };

  if (oldParticipant.state !== "Released") {
    const toReleased = await transitionParticipant({ participantId: oldParticipant.id, targetState: "Released", actorRole: input.actorRole, actorId: input.actorId });
    if (!toReleased.ok) return toReleased;
  }
  const toArchived = await transitionParticipant({ participantId: oldParticipant.id, targetState: "Archived", actorRole: input.actorRole, actorId: input.actorId });
  if (!toArchived.ok) return toArchived;

  const { data: newParticipant, error } = await participantsDB.create({
    seuId: oldParticipant.seu_id,
    type: input.newParticipantType,
    displayName: input.newDisplayName,
    userId: input.newUserId ?? null,
  });
  if (error || !newParticipant) throw error ?? new Error("failed to create replacement participant");

  await eventBus.publish({
    eventType: "ParticipantCreated",
    originatingObjectType: "Participant",
    originatingObjectId: newParticipant.id,
    seuId: oldParticipant.seu_id,
    correlationId: eventBus.newCorrelationId(),
    payload: { participantType: input.newParticipantType },
  });

  // Same primitive (revoked_at) every other "active" fulfilment query
  // already filters on — end the old row, start a fresh one for the new
  // Participant, rather than re-pointing participant_id in place (which
  // would conflate two different Participants' tenure into a single row's
  // established_at/revoked_at history).
  await capabilityFulfilmentsDB.revoke(fulfilment.id);
  const { data: newFulfilment, error: fulfilmentErr } = await capabilityFulfilmentsDB.create({
    seuCapabilityId: fulfilment.seu_capability_id,
    participantId: newParticipant.id,
    fulfilmentStrategy: input.newParticipantType,
  });
  if (fulfilmentErr || !newFulfilment) throw fulfilmentErr ?? new Error("failed to establish replacement capability fulfilment");

  await eventBus.publish({
    eventType: "ParticipantReplaced",
    originatingObjectType: "Participant",
    originatingObjectId: newParticipant.id,
    seuId: oldParticipant.seu_id,
    correlationId: eventBus.newCorrelationId(),
    payload: { oldParticipantId: oldParticipant.id, newParticipantId: newParticipant.id, seuCapabilityId: fulfilment.seu_capability_id },
  });

  return { ok: true, oldParticipant: toArchived.participant, newParticipant };
}
