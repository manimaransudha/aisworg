import { decisionsDB } from "../../../dblayer/decisionsDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEntity, publishTransition } from "../../../domain/engine/entityTransition.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";
import { assertCanonicalCategory } from "./ontology.js";
import { resolveAuthor } from "./attentionItems.js";
import type { DecisionAlternative, DecisionRelatedObjectGroup, DecisionRow } from "../../../dblayer/seuTypes.js";

export async function createDecision(input: {
  seuId: string;
  actorId: string;
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

  // A Decision references supporting Evidence or Knowledge, or both (Ch.19 DM-002, DM-003).
  if ((input.evidenceIds ?? []).length === 0 && (input.knowledgeIds ?? []).length === 0) {
    throw new Error("a Decision must reference at least one Evidence item or Knowledge item");
  }

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

  const authorBadge = await badgeAuthorityEngine.resolveAuthorBadge(input.actorId, "decision_identify");
  const { authorId } = await resolveAuthor(input.seuId, input.actorId);

  const { data: birth, error: birthError } = await transitionDefinitionsDB.findBirth("Decision");
  if (birthError) throw birthError;
  if (!birth) throw new Error("no birth Transition Definition for Decision");
  if (!birth.event_type) throw new Error("the Decision birth Transition Definition names no event");

  const { data: decision, error } = await decisionsDB.create({
    status: birth.to_state,
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
    participantId: authorId,
    authorityBadge: authorBadge,
  });
  if (error || !decision) throw error ?? new Error("failed to create decision");

  await eventBus.publish({
    eventType: birth.event_type,
    originatingObjectType: "Decision",
    originatingObjectId: decision.id,
    seuId: decision.seu_id,
    correlationId: eventBus.newCorrelationId(),
    payload: { originatingType: input.originatingType ?? null, originatingId: input.originatingId ?? null, relatedObjects: input.relatedObjects, category: input.category },
    actorId: input.actorId,
    authorityBadge: authorBadge,
  });

  return decision;
}

export async function listDecisionsBySeu(seuId: string): Promise<DecisionRow[]> {
  const { data } = await decisionsDB.findBySeuId(seuId);
  return data ?? [];
}

export type TransitionDecisionResult =
  | { ok: true; decision: DecisionRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "quality_gate_blocked"; detail: string }
  | { ok: false; reason: "policy_blocked" | "no_transition_definition" | "not_submitted"; detail: string };

export async function transitionDecision(input: { decisionId: string; targetState: string; actorId: string; context?: Record<string, unknown> }): Promise<TransitionDecisionResult> {
  const result = await transitionEntity({ entityType: "Decision", entityId: input.decisionId, targetState: input.targetState, actorId: input.actorId, context: input.context });
  if (!result.ok) return result;

  const published = await publishTransition(result);
  await eventBus.publish({
    eventType: "DecisionTransitioned",
    originatingObjectType: "Decision",
    originatingObjectId: input.decisionId,
    seuId: result.event.seuId,
    correlationId: published.correlation_id,
    payload: result.event.payload,
    actorId: input.actorId,
    authorityBadge: result.event.authorityBadge,
  });

  return { ok: true, decision: result.row as DecisionRow, appliedTransition: result.appliedTransition };
}
