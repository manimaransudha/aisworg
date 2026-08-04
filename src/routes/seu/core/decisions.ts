// Ch.19 Decision Model — Post-MVP Phase 5. Lifecycle transitions reuse the
// same generic transitionEngine every other entity type already uses
// (Ch.29 §10), extended to a seventh entity type.
import { decisionsDB } from "../../../dblayer/decisionsDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { qualityGateEngine } from "../../../domain/engine/qualityGateEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import type { DecisionRow, TransitionEntityType } from "../../../dblayer/seuTypes.js";

// related_object_type/id are polymorphic (Open Design Questions.md #3) — see
// core/obligations.ts's own doc comment for the same reasoning.
export async function createDecision(input: {
  seuId: string;
  relatedObjectType: TransitionEntityType;
  relatedObjectId: string;
  knowledgeId?: string | null;
  evidenceId?: string | null;
  category: string;
  title: string;
  engineeringQuestion?: string | null;
  selectedAlternative?: string | null;
  rationale?: string | null;
}): Promise<DecisionRow> {
  if (input.relatedObjectType === "Deliverable") {
    const { data: deliverable } = await deliverablesDB.findById(input.relatedObjectId);
    if (!deliverable) throw new Error(`deliverable not found: ${input.relatedObjectId}`);
    if (deliverable.seu_id !== input.seuId) throw new Error(`deliverable ${input.relatedObjectId} does not belong to SEU ${input.seuId}`);
  }

  const { data: decision, error } = await decisionsDB.create({
    seuId: input.seuId,
    relatedObjectType: input.relatedObjectType,
    relatedObjectId: input.relatedObjectId,
    knowledgeId: input.knowledgeId,
    evidenceId: input.evidenceId,
    category: input.category,
    title: input.title,
    engineeringQuestion: input.engineeringQuestion,
    selectedAlternative: input.selectedAlternative,
    rationale: input.rationale,
  });
  if (error || !decision) throw error ?? new Error("failed to create decision");

  await eventBus.publish({
    eventType: "DecisionIdentified",
    originatingObjectType: "Decision",
    originatingObjectId: decision.id,
    correlationId: eventBus.newCorrelationId(),
    payload: { relatedObjectType: input.relatedObjectType, relatedObjectId: input.relatedObjectId, category: input.category },
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
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition"; detail: string };

export async function transitionDecision(input: { decisionId: string; targetState: string; actorRole: string }): Promise<TransitionDecisionResult> {
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

  const gate = await transitionEngine.evaluate({
    entityType: "Decision",
    fromState,
    toState: input.targetState,
    actorRole: input.actorRole,
    context: { decision },
  });
  if (!gate.allowed) {
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Decision ${fromState} -> ${input.targetState}` };
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires role ${gate.requiredRole}, actor has ${gate.actorRole}` };
    return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
  }

  const { data: updated, error } = await decisionsDB.updateStatus(decision.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update decision status");

  await eventBus.publish({
    eventType: "DecisionTransitioned",
    originatingObjectType: "Decision",
    originatingObjectId: decision.id,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState },
  });

  return { ok: true, decision: updated, appliedTransition: { fromState, toState: input.targetState } };
}
