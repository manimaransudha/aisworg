import { decisionsDB } from "../../../dblayer/decisionsDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { participantsDB } from "../../../dblayer/participantsDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { qualityGateEngine } from "../../../domain/engine/qualityGateEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { assertCanonicalCategory } from "./ontology.js";
import { resolveAuthor, resolveSystemActor } from "./attentionItems.js";
import type { DecisionAlternative, DecisionRelatedObjectGroup, DecisionRow } from "../../../dblayer/seuTypes.js";

async function resolveParticipantId(userId: string, seuId: string): Promise<string | null> {
  const { data: master } = await participantsMasterDB.findById(userId);
  if (!master) return null;
  const { data: engagements } = await participantsDB.findByParticipantMasterId(master.id);
  return (engagements ?? []).find((p) => p.seu_id === seuId)?.id ?? null;
}

export async function createDecision(input: {
  seuId: string;
  userId?: string | null;
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
    authorityBadge: null,
  });
  if (error || !decision) throw error ?? new Error("failed to create decision");

  const decisionSystemActor = input.userId == null ? await resolveSystemActor(input.seuId) : null;
  await eventBus.publish({
    eventType: "DecisionIdentified",
    originatingObjectType: "Decision",
    originatingObjectId: decision.id,
    seuId: decision.seu_id,
    correlationId: eventBus.newCorrelationId(),
    payload: { originatingType: input.originatingType ?? null, originatingId: input.originatingId ?? null, relatedObjects: input.relatedObjects, category: input.category },
    actorId: input.userId != null ? String(input.userId) : decisionSystemActor!.actorId,
    authorityBadge: decisionSystemActor?.authorBadge ?? "system",
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

  if (!input.actorId) throw new Error("actorId is required to transition a Decision");
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

  if (!gate.authorityBadge) throw new Error(`no authority badge resolved for Decision ${fromState} -> ${input.targetState} — Transition Definition declares no verb`);
  const { authorId } = await resolveAuthor(decision.seu_id, input.actorId);
  const qualityGateResult = await qualityGateEngine.evaluate({
    entityType: "Decision",
    entityId: decision.id,
    seuId: decision.seu_id,
    fromState,
    toState: input.targetState,
    authorId,
    authorBadge: gate.authorityBadge,
  });
  if (qualityGateResult.outcome === "Blocked") {
    return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${qualityGateResult.gate.name}" blocked: ${qualityGateResult.reason}` };
  }

  const participantId = await resolveParticipantId(input.actorId, decision.seu_id);

  const { data: updated, error } = await decisionsDB.updateStatus(decision.id, input.targetState, { participantId, authorityBadge: gate.authorityBadge });
  if (error || !updated) throw error ?? new Error("failed to update decision status");

  await eventBus.publish({
    eventType: gate.eventType ?? "DecisionTransitioned",
    originatingObjectType: "Decision",
    originatingObjectId: decision.id,
    seuId: decision.seu_id,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState },
    actorId: input.actorId,
    authorityBadge: gate.authorityBadge,
  });

  return { ok: true, decision: updated, appliedTransition: { fromState, toState: input.targetState } };
}
