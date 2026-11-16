import { qualityGatesDB } from "../../dblayer/qualityGatesDB.js";
import { qualityGateEvaluationsDB } from "../../dblayer/qualityGateEvaluationsDB.js";
import { qualityGateWaiversDB } from "../../dblayer/qualityGateWaiversDB.js";
import { seusDB } from "../../dblayer/seusDB.js";
import { ebmsDB } from "../../dblayer/ebmsDB.js";
import { deliverablesDB } from "../../dblayer/deliverablesDB.js";
import { eventBus } from "./eventBus.js";
import type { QualityGateDecisionOutcome, QualityGateOutcomeRow, QualityGateRow, TransitionEntityType } from "../../dblayer/seuTypes.js";
import { findQualityGateCriterion } from "../../qualitygates/index.js";
import { ontologyDB } from "../../dblayer/ontologyDB.js";
import { qualityGateOutcomesDB } from "../../dblayer/qualityGateOutcomesDB.js";
import { QUALITY_GATE_DECISION_OUTCOME_CONCEPT, QUALITY_GATE_OUTCOME_CONCEPT } from "../../dblayer/constants.js";
import { calculateConfidenceLevel, composeQualityGateOutcome, generateQualityGateRationale } from "./qualityGateOutcomeComposition.js";

export const RESOLVED_ATTENTION_STATUSES = new Set(["Resolved", "Closed"]);

export type QualityGateEvaluationResult =
  | { outcome: "NotApplicable" }
  | { outcome: "Passed"; gate: QualityGateRow; evaluationId: string }
  | { outcome: "Blocked"; gate: QualityGateRow; reason: string; evaluationId: string }
  | { outcome: "Waived"; gate: QualityGateRow; reason: string; evaluationId: string };

// The result of one gate. evaluate and evaluateByIds return one per gate they evaluated.
export type QualityGateGateResult = Extract<QualityGateEvaluationResult, { gate: QualityGateRow }>;
export type QualityGateBlockedResult = Extract<QualityGateGateResult, { outcome: "Blocked" }>;
export type QualityGateWaivedResult = Extract<QualityGateGateResult, { outcome: "Waived" }>;

// The decision over the results of every gate evaluated for one hop, made by qualityGateEngine.decide.
export interface QualityGateDecision {
  outcome: QualityGateDecisionOutcome;
  confidenceLevel: number;
  rationale: string;
  evaluationIds: string[];
  blocked: QualityGateBlockedResult[];
  waived: QualityGateWaivedResult[];
}

// The code checks a value against its Ontology concept. The tables carry no constraint on these values.
async function assertOntologyCode(conceptType: string, code: string, tenantId: string): Promise<void> {
  const { data: concept } = await ontologyDB.findConcept(conceptType, code, { isRoot: false, tenantId });
  if (!concept) throw new Error(`"${code}" is not a ${conceptType} concept`);
}

// Used by evaluate and evaluateByIds only, so it is not part of the engine's surface.
async function evaluateGate(
  gate: QualityGateRow,
  input: { entityType: TransitionEntityType; entityId: string; seuId: string | null; context?: Record<string, unknown>; authorId: string; authorBadge: string; tenantId: string }
): Promise<QualityGateEvaluationResult> {
  const criteriaType = (gate.criteria as { type?: string }).type;
  const criterion = findQualityGateCriterion(criteriaType);
  if (!criterion) return qualityGateEngine.blockOrWaive(gate, input, `unrecognised Quality Gate criteria type: ${criteriaType}`, { criteriaType });

  const result = await criterion({ gate, entityType: input.entityType, entityId: input.entityId, seuId: input.seuId, context: input.context ?? {} });
  if (!result.satisfied) return qualityGateEngine.blockOrWaive(gate, input, result.reason, result.detail);
  return qualityGateEngine.recordAndPass(gate, input);
}

// Stores one gate evaluation. The outcome is checked against its Ontology concept, and a failed insert is an error.
async function storeEvaluation(input: Parameters<typeof qualityGateEvaluationsDB.create>[0], tenantId: string) {
  await assertOntologyCode(QUALITY_GATE_OUTCOME_CONCEPT, input.outcome, tenantId);
  const { data, error } = await qualityGateEvaluationsDB.create(input);
  if (error || !data) throw error ?? new Error(`failed to record the Quality Gate evaluation of gate ${input.qualityGateId}`);
  return data;
}

// Every gate is evaluated and recorded, whatever the outcome of the others.
async function evaluateAll(gates: QualityGateRow[], input: Parameters<typeof evaluateGate>[1]): Promise<QualityGateGateResult[]> {
  const results: QualityGateGateResult[] = [];
  for (const gate of gates) {
    const result = await evaluateGate(gate, input);
    if (result.outcome !== "NotApplicable") results.push(result);
  }
  return results;
}

export const qualityGateEngine = {
  async evaluate(input: {
    entityType: TransitionEntityType;
    entityId: string;
    seuId: string;
    fromState: string;
    toState: string;
    context?: Record<string, unknown>;
    authorId: string;
    authorBadge: string;
    tenantId: string;
  }): Promise<QualityGateGateResult[]> {
    // The gates of an SEU are the ones its active EBM names. An SEU with no active EBM has none.
    const { data: seu } = await seusDB.findById(input.seuId);
    if (!seu?.active_ebm_id) return [];
    const { data: ebm } = await ebmsDB.findById(seu.active_ebm_id);
    const { data: candidateGates } = await qualityGatesDB.findByIds(ebm?.applicable_quality_gate_ids ?? []);
    let gates: QualityGateRow[] = (candidateGates ?? []).filter(
      (g) => g.entity_type === input.entityType && g.from_state === input.fromState && g.to_state === input.toState
    );
    if (gates.length === 0) return [];

    const named = gates.some((g) => g.applicability_deliverable_names.length > 0);
    if (named && input.entityType === "Deliverable") {
      const { data: deliverable } = await deliverablesDB.findById(input.entityId);
      const code = deliverable?.code;
      gates = gates.filter((g) => g.applicability_deliverable_names.length === 0 || (code && g.applicability_deliverable_names.includes(code)));
    }
    if (gates.length === 0) return [];

    return evaluateAll(gates, input);
  },

  async evaluateByIds(
    gateIds: string[],
    input: { entityType: TransitionEntityType; entityId: string; seuId: string | null; context?: Record<string, unknown>; authorId: string; authorBadge: string; tenantId: string }
  ): Promise<QualityGateGateResult[]> {
    if (gateIds.length === 0) return [];
    const { data: gates } = await qualityGatesDB.findByIds(gateIds);
    return evaluateAll(gates ?? [], input);
  },

  // The decision over the results of evaluate or evaluateByIds. The outcome comes from composeQualityGateOutcome and the confidence
  // level from calculateConfidenceLevel. The caller acts on the decision.
  decideQualityGate(results: QualityGateGateResult[]): QualityGateDecision {
    const items = results.map((r) => ({ gateName: r.gate.name, outcome: r.outcome }));
    const composed = composeQualityGateOutcome(items);
    const confidenceLevel = calculateConfidenceLevel(composed, items);
    return {
      outcome: composed.outcome,
      confidenceLevel,
      rationale: generateQualityGateRationale(composed, items, confidenceLevel),
      evaluationIds: results.map((r) => r.evaluationId),
      blocked: results.filter((r): r is QualityGateBlockedResult => r.outcome === "Blocked"),
      waived: results.filter((r): r is QualityGateWaivedResult => r.outcome === "Waived"),
    };
  },

  // Stores the decision of one Deliverable hop. The outcome is checked against its Ontology concept first.
  async recordDecision(
    decision: QualityGateDecision,
    input: { seuId: string; deliverableId: string; tenantId: string; actorId: string; actorBadge: string }
  ): Promise<QualityGateOutcomeRow> {
    await assertOntologyCode(QUALITY_GATE_DECISION_OUTCOME_CONCEPT, decision.outcome, input.tenantId);
    const { data, error } = await qualityGateOutcomesDB.create({
      seu_id: input.seuId,
      deliverable_id: input.deliverableId,
      tenant_id: input.tenantId,
      actor_id: input.actorId,
      actor_badge: input.actorBadge,
      evaluation_ids: decision.evaluationIds,
      outcome: decision.outcome,
      confidence_level: decision.confidenceLevel,
      rationale: decision.rationale,
    });
    if (error || !data) throw error ?? new Error("failed to record the Quality Gate outcome");
    return data;
  },

  async blockOrWaive(
    gate: QualityGateRow,
    input: { seuId: string | null; entityType: TransitionEntityType; entityId: string; authorId: string; authorBadge: string; tenantId: string },
    reason: string,
    detail: Record<string, unknown>
  ): Promise<QualityGateEvaluationResult> {
    const { data: waiver } = await qualityGateWaiversDB.findActive(gate.id, input.entityType, input.entityId);
    if (waiver) return this.recordAndWaive(gate, input, reason, waiver.id);
    return this.recordAndBlock(gate, input, reason, detail);
  },

  async recordAndPass(
    gate: QualityGateRow,
    input: { seuId: string | null; entityType: TransitionEntityType; entityId: string; authorId: string; authorBadge: string; tenantId: string }
  ): Promise<QualityGateEvaluationResult> {
    const evaluation = await storeEvaluation({ qualityGateId: gate.id, seuId: input.seuId, entityType: input.entityType, entityId: input.entityId, outcome: "Passed", authorId: input.authorId, authorBadge: input.authorBadge }, input.tenantId);
    await eventBus.publish({
      eventType: "QualityGatePassed",
      originatingObjectType: "QualityGate",
      originatingObjectId: gate.id,
      seuId: input.seuId,
      correlationId: eventBus.newCorrelationId(),
      actorId: input.authorId,
      authorityBadge: input.authorBadge,
      tenantId: input.tenantId,
      payload: { entityType: input.entityType, entityId: input.entityId },
    });
    return { outcome: "Passed", gate, evaluationId: evaluation.id };
  },

  async recordAndBlock(
    gate: QualityGateRow,
    input: { seuId: string | null; entityType: TransitionEntityType; entityId: string; authorId: string; authorBadge: string; tenantId: string },
    reason: string,
    detail: Record<string, unknown>
  ): Promise<QualityGateEvaluationResult> {
    const evaluation = await storeEvaluation({ qualityGateId: gate.id, seuId: input.seuId, entityType: input.entityType, entityId: input.entityId, outcome: "Blocked", detail, authorId: input.authorId, authorBadge: input.authorBadge }, input.tenantId);
    await eventBus.publish({
      eventType: "QualityGateBlocked",
      originatingObjectType: "QualityGate",
      originatingObjectId: gate.id,
      seuId: input.seuId,
      correlationId: eventBus.newCorrelationId(),
      actorId: input.authorId,
      authorityBadge: input.authorBadge,
      tenantId: input.tenantId,
      payload: { entityType: input.entityType, entityId: input.entityId, reason },
    });
    return { outcome: "Blocked", gate, reason, evaluationId: evaluation.id };
  },

  async recordAndWaive(
    gate: QualityGateRow,
    input: { seuId: string | null; entityType: TransitionEntityType; entityId: string; authorId: string; authorBadge: string; tenantId: string },
    reason: string,
    waiverId: string
  ): Promise<QualityGateEvaluationResult> {
    const evaluation = await storeEvaluation({ qualityGateId: gate.id, seuId: input.seuId, entityType: input.entityType, entityId: input.entityId, outcome: "Waived", detail: { reason, waiverId }, authorId: input.authorId, authorBadge: input.authorBadge }, input.tenantId);
    await eventBus.publish({
      eventType: "QualityGateWaived",
      originatingObjectType: "QualityGate",
      originatingObjectId: gate.id,
      seuId: input.seuId,
      correlationId: eventBus.newCorrelationId(),
      actorId: input.authorId,
      authorityBadge: input.authorBadge,
      tenantId: input.tenantId,
      payload: { entityType: input.entityType, entityId: input.entityId, reason, waiverId },
    });
    return { outcome: "Waived", gate, reason, evaluationId: evaluation.id };
  },
};
