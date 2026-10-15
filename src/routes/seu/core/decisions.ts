import { decisionsDB } from "../../../dblayer/decisionsDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEngine, gateRejection } from "../../../domain/engine/transitionEngine.js";
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
    participantId: authorId,
    authorityBadge: authorBadge,
  });
  if (error || !decision) throw error ?? new Error("failed to create decision");

  await eventBus.publish({
    eventType: "DecisionIdentified",
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

export async function transitionDecision(input: { decisionId: string; targetState: string; actorRole: string; actorId: string }): Promise<TransitionDecisionResult> {
  const { data: decision } = await decisionsDB.findById(input.decisionId);
  if (!decision) return { ok: false, reason: "not_found" };

  const fromState = decision.status;

  const gate = await transitionEngine.evaluateGoverned({
    entityType: "Decision",
    fromState,
    toState: input.targetState,
    actorRole: input.actorRole,
    actorId: input.actorId,
    entityId: decision.id,
    context: { decision },
    gateEntityId: decision.id,
    gateSeuId: decision.seu_id,
  });
  if (!gate.allowed) return gateRejection(gate, "Decision", fromState, input.targetState);
  const { authorId } = gate;

  const { data: updated, error } = await decisionsDB.updateStatus(decision.id, input.targetState, { participantId: authorId, authorityBadge: gate.authorityBadge });
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
