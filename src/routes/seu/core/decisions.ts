// Ch.19 Decision Model — Post-MVP Phase 5. Lifecycle transitions reuse the
// same generic transitionEngine every other entity type already uses
// (Ch.29 §10), extended to a seventh entity type. Restructured this session
// (Ch.19 model cleanup, migration 231) — see that migration's own header.
import { decisionsDB } from "../../../dblayer/decisionsDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { participantsDB } from "../../../dblayer/participantsDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { qualityGateEngine } from "../../../domain/engine/qualityGateEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { assertCanonicalCategory } from "./ontology.js";
import type { DecisionAlternative, DecisionRelatedObjectGroup, DecisionRow } from "../../../dblayer/seuTypes.js";

// participant_id on decisions.* points at the per-SEU engagement
// (participants.id), not users.id directly — same resolution
// core/participantHome.ts's completeMyWorkItem already does. Returns null
// for an actor with no Participant identity on this SEU (e.g. an
// admin/root user acting directly) — participant_id then stays unset,
// which is honest, not an error.
async function resolveParticipantId(userId: number, seuId: string): Promise<string | null> {
  const { data: master } = await participantsMasterDB.findByUserId(userId);
  if (!master) return null;
  const { data: engagements } = await participantsDB.findByParticipantMasterId(master.id);
  return (engagements ?? []).find((p) => p.seu_id === seuId)?.id ?? null;
}

export async function createDecision(input: {
  seuId: string;
  userId?: number | null;
  originatingType?: string | null;
  originatingId?: string | null;
  relatedObjects: DecisionRelatedObjectGroup[];
  relatedSeu?: DecisionRelatedObjectGroup[];
  knowledgeIds?: string[];
  evidenceIds?: string[];
  category: string;
  title: string;
  engineeringQuestion?: string | null;
  alternatives?: DecisionAlternative[];
}): Promise<DecisionRow> {
  await assertCanonicalCategory("category:decision", input.category);

  for (const group of input.relatedObjects) {
    if (group.related_object_type !== "Deliverable") continue;
    for (const id of group.related_object_ids) {
      const { data: deliverable } = await deliverablesDB.findById(id);
      if (!deliverable) throw new Error(`deliverable not found: ${id}`);
      if (deliverable.seu_id !== input.seuId) throw new Error(`deliverable ${id} does not belong to SEU ${input.seuId}`);
    }
  }

  for (const alternative of input.alternatives ?? []) {
    await assertCanonicalCategory("decision-alternative-status", alternative.status);
  }

  const participantId = input.userId != null ? await resolveParticipantId(input.userId, input.seuId) : null;

  const { data: decision, error } = await decisionsDB.create({
    seuId: input.seuId,
    originatingType: input.originatingType ?? null,
    originatingId: input.originatingId ?? null,
    relatedObjects: input.relatedObjects,
    relatedSeu: input.relatedSeu ?? [],
    knowledgeIds: input.knowledgeIds ?? [],
    evidenceIds: input.evidenceIds ?? [],
    category: input.category,
    title: input.title,
    engineeringQuestion: input.engineeringQuestion,
    alternatives: input.alternatives ?? [],
    participantId,
    // Creation is ungoverned (no transition_definitions row produces
    // "Identified" — same as every other entity's own row-1 creation), so
    // there is no badge to record here; authority_badge starts real once
    // the first governed transition runs.
    authorityBadge: null,
  });
  if (error || !decision) throw error ?? new Error("failed to create decision");

  await eventBus.publish({
    eventType: "DecisionIdentified",
    originatingObjectType: "Decision",
    originatingObjectId: decision.id,
    seuId: decision.seu_id,
    correlationId: eventBus.newCorrelationId(),
    payload: { originatingType: input.originatingType ?? null, originatingId: input.originatingId ?? null, relatedObjects: input.relatedObjects, category: input.category },
    actorId: input.userId != null ? String(input.userId) : null,
  });

  return decision;
}

export async function listDecisionsBySeu(seuId: string): Promise<DecisionRow[]> {
  const { data } = await decisionsDB.findBySeuId(seuId);
  return data ?? [];
}

export interface DecisionWithNextStates {
  decision: DecisionRow;
  possibleNextStates: string[];
}

export async function listDecisionsWithNextStates(seuId: string): Promise<DecisionWithNextStates[]> {
  const items = await listDecisionsBySeu(seuId);
  return Promise.all(
    items.map(async (decision) => {
      const { data: possibleNextStates } = await transitionDefinitionsDB.findPossibleNextStates("Decision", decision.status);
      return { decision, possibleNextStates: possibleNextStates ?? [] };
    })
  );
}

export type TransitionDecisionResult =
  | { ok: true; decision: DecisionRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "quality_gate_blocked"; detail: string }
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition" | "not_submitted"; detail: string };

export async function transitionDecision(input: { decisionId: string; targetState: string; actorRole: string; actorId?: string }): Promise<TransitionDecisionResult> {
  const { data: decision } = await decisionsDB.findById(input.decisionId);
  if (!decision) return { ok: false, reason: "not_found" };

  const fromState = decision.status;

  const qualityGateResult = await qualityGateEngine.evaluate({
    entityType: "Decision",
    entityId: decision.id,
    seuId: decision.seu_id,
    fromState,
    toState: input.targetState,
  });
  if (qualityGateResult.outcome === "Blocked") {
    return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${qualityGateResult.gate.name}" blocked: ${qualityGateResult.reason}` };
  }

  // entityId now passed — was missing, the same latent submit_verb gap
  // every other entity's Version Feature Plan pass found and fixed (no
  // Decision row declares submit_verb today, but the gate would silently
  // no-op without it if one ever does).
  const gate = await transitionEngine.evaluate({
    entityType: "Decision",
    fromState,
    toState: input.targetState,
    actorRole: input.actorRole,
    actorId: input.actorId,
    entityId: decision.id,
    context: { decision },
  });
  if (!gate.allowed) {
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Decision ${fromState} -> ${input.targetState}` };
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
    if (gate.reason === "quality_gate_blocked") return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${gate.gateName}" blocked: ${gate.detail}` };
    if (gate.reason === "not_submitted") return { ok: false, reason: "not_submitted", detail: `must be submitted first (requires badge ${gate.submitBadge})` };
    return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
  }

  // participant_id/authority_badge updated on every governed transition —
  // the row always reflects the most recent actor; full per-hop history
  // stays in events (actorId/authorityBadge on the publish below).
  const participantId = input.actorId != null && !Number.isNaN(Number(input.actorId)) ? await resolveParticipantId(Number(input.actorId), decision.seu_id) : null;

  const { data: updated, error } = await decisionsDB.updateStatus(decision.id, input.targetState, { participantId, authorityBadge: gate.authorityBadge });
  if (error || !updated) throw error ?? new Error("failed to update decision status");

  await eventBus.publish({
    eventType: gate.eventType ?? "DecisionTransitioned",
    originatingObjectType: "Decision",
    originatingObjectId: decision.id,
    seuId: decision.seu_id,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState },
    actorId: input.actorId ?? null,
    authorityBadge: gate.authorityBadge,
  });

  return { ok: true, decision: updated, appliedTransition: { fromState, toState: input.targetState } };
}
