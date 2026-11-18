import { qualityGateEvaluationsDB } from "../../dblayer/qualityGateEvaluationsDB.js";
import { seusDB } from "../../dblayer/seusDB.js";
import { ebmsDB } from "../../dblayer/ebmsDB.js";
import { deliverablesDB } from "../../dblayer/deliverablesDB.js";
import { eventBus } from "./eventBus.js";
import { rateGateWaivers } from "./waiverConfidence.js";
import { qualityGateDefinitionsDB } from "../../dblayer/qualityGateDefinitionsDB.js";
import { reviewGatesDB } from "../../dblayer/reviewGatesDB.js";
import { settledOf } from "./ebmSettled.js";
import type { EvaluatedQualityGate, QualityGateDecisionOutcome, QualityGateDefinitionRow, QualityGateOutcomeCondition, QualityGateOutcomeRow, TransitionEntityType } from "../../dblayer/seuTypes.js";
import { findQualityGateCriterion } from "../../qualitygates/index.js";
import { ontologyDB } from "../../dblayer/ontologyDB.js";
import { qualityGateOutcomesDB } from "../../dblayer/qualityGateOutcomesDB.js";
import { QUALITY_GATE_CRITERIA_REQUIRES_ACCEPTED_EVIDENCE_OR_APPROVED_DECISION, QUALITY_GATE_CRITERIA_REQUIRES_ACCEPTED_REVIEW, QUALITY_GATE_CRITERIA_REQUIRES_ACTIVE_POLICY, QUALITY_GATE_DECISION_OUTCOME_CONCEPT, QUALITY_GATE_OUTCOME_CONCEPT, WAIVER_ENTITY_TYPE, WAIVER_SCOPE_GATE } from "../../dblayer/constants.js";
import { calculateConfidenceLevel, composeQualityGateOutcome, generateQualityGateRationale, type QualityGateOutcomeEntity, type QualityGateOutcomeInputItem, type Waivable } from "./qualityGateOutcomeComposition.js";

export const RESOLVED_ATTENTION_STATUSES = new Set(["Resolved", "Closed"]);

export type QualityGateEvaluationResult =
  | { outcome: "NotApplicable" }
  | { outcome: "Passed"; gate: EvaluatedQualityGate; evaluationId: string }
  | { outcome: "Blocked"; gate: EvaluatedQualityGate; reason: string; evaluationId: string };

// The result of one Quality Gate line item. evaluate and evaluateByIds return one per gate they evaluated.
export type QualityGateGateResult = Extract<QualityGateEvaluationResult, { gate: EvaluatedQualityGate }>;
export type QualityGateBlockedResult = Extract<QualityGateGateResult, { outcome: "Blocked" }>;
export type QualityGatePassedResult = Extract<QualityGateGateResult, { outcome: "Passed" }>;

// A condition the other checks of a hop add to the decision, next to the Quality Gate line items. It is Passed or Blocked. `waivable` names what a waiver
// has to name to cover a Blocked condition; a condition with null is covered by no waiver.
export interface QualityGateCondition {
  name: string;
  reason: string;
  outcome: "Passed" | "Blocked";
  waivable: Waivable | Waivable[] | null;
}

// The decision over the conditions of one hop, made by qualityGateEngine.decideQualityGate. `conditions` holds the conditions given, then the Quality Gate
// line items, each settled by the composition: Waived carries the id of the waiver that covered the condition.
export interface QualityGateDecision {
  outcome: QualityGateDecisionOutcome;
  conditions: QualityGateOutcomeCondition[];
  confidenceLevel: number;
  rationale: string;
  evaluationIds: string[];
  // The Quality Gate line items that are Blocked and not covered by a waiver, and the ones a waiver covers.
  blocked: QualityGateBlockedResult[];
  waived: QualityGateBlockedResult[];
  // The Quality Gate line items that are Passed.
  passed: QualityGatePassedResult[];
}

// The code checks a value against its Ontology concept. The tables carry no constraint on these values.
async function assertOntologyCode(conceptType: string, code: string, tenantId: string): Promise<void> {
  const { data: concept } = await ontologyDB.findConcept(conceptType, code, { isRoot: false, tenantId });
  if (!concept) throw new Error(`"${code}" is not a ${conceptType} concept`);
}

// Used by evaluate and evaluateByIds only, so it is not part of the engine's surface.
type EbmReference = { id: string; version: number };

async function evaluateGate(
  gate: EvaluatedQualityGate,
  input: { entityType: TransitionEntityType; entityId: string; seuId: string | null; fromState: string; toState: string; authorId: string; authorBadge: string; tenantId: string; ebm: EbmReference | null }
): Promise<QualityGateEvaluationResult> {
  // Every evaluation row names the EBM the SEU had when the gate was evaluated (Chapter 26 §14).
  const withEbm = (detail: Record<string, unknown>) => ({ ...detail, ebmId: input.ebm?.id ?? null, ebmVersion: input.ebm?.version ?? null });
  const criteriaType = (gate.criteria as { type?: string }).type;
  const criterion = findQualityGateCriterion(criteriaType);
  if (!criterion) return qualityGateEngine.recordAndBlock(gate, input, `unrecognised Quality Gate criteria type: ${criteriaType}`, withEbm({ criteriaType }));

  const result = await criterion({ gate, entityType: input.entityType, entityId: input.entityId, seuId: input.seuId, fromState: input.fromState, toState: input.toState, authorId: input.authorId, authorBadge: input.authorBadge });
  if (!result.satisfied) return qualityGateEngine.recordAndBlock(gate, input, result.reason, withEbm(result.detail));
  return qualityGateEngine.recordAndPass(gate, input, withEbm(result.detail));
}

// Stores one gate evaluation. The outcome is checked against its Ontology concept, and a failed insert is an error.
async function storeEvaluation(input: Parameters<typeof qualityGateEvaluationsDB.create>[0], tenantId: string) {
  await assertOntologyCode(QUALITY_GATE_OUTCOME_CONCEPT, input.outcome, tenantId);
  const { data, error } = await qualityGateEvaluationsDB.create(input);
  if (error || !data) throw error ?? new Error(`failed to record the Quality Gate evaluation of gate ${input.qualityGateId}`);
  return data;
}

// Every gate is evaluated and recorded, whatever the outcome of the others.
async function evaluateAll(gates: EvaluatedQualityGate[], input: Parameters<typeof evaluateGate>[1]): Promise<QualityGateGateResult[]> {
  const results: QualityGateGateResult[] = [];
  for (const gate of gates) {
    const result = await evaluateGate(gate, input);
    if (result.outcome !== "NotApplicable") results.push(result);
  }
  return results;
}

// The criteria of a gate of an EBM: the type is the Definition's, and the rest is what the Pack listed for the gate and the EBM settled. A Policy the gate requires has to be one the EBM took.
function criteriaOf(
  definition: QualityGateDefinitionRow,
  fields: Record<string, unknown>,
  deliverable: string,
  settledPolicies: Array<{ policyCode: string; policyDefinitionId?: string }>,
  reviewGates: Array<{ id: string; code: string }>
): Record<string, unknown> {
  if (definition.criteria_type === QUALITY_GATE_CRITERIA_REQUIRES_ACTIVE_POLICY) {
    const codes = (fields.requiredPolicyCodes as string[] | undefined) ?? [];
    const ids = codes.map((code) => settledPolicies.find((p) => p.policyCode === code)?.policyDefinitionId);
    return { type: definition.criteria_type, policyDefinitionIds: ids.some((id) => !id) ? [] : [...new Set(ids as string[])] };
  }
  if (definition.criteria_type === QUALITY_GATE_CRITERIA_REQUIRES_ACCEPTED_REVIEW) {
    return { type: definition.criteria_type, reviewGateId: deliverable ? reviewGates.find((g) => g.code === deliverable)?.id : undefined };
  }
  if (definition.criteria_type === QUALITY_GATE_CRITERIA_REQUIRES_ACCEPTED_EVIDENCE_OR_APPROVED_DECISION) {
    return { type: definition.criteria_type, evidenceCategory: definition.evidence_category };
  }
  return { type: definition.criteria_type };
}

export const qualityGateEngine = {
  async evaluate(input: {
    entityType: TransitionEntityType;
    entityId: string;
    seuId: string;
    fromState: string;
    toState: string;
    authorId: string;
    authorBadge: string;
    tenantId: string;
  }): Promise<QualityGateGateResult[]> {
    // The gates of an SEU are the ones its active EBM names. An SEU with no active EBM has none.
    const { data: seu } = await seusDB.findById(input.seuId);
    if (!seu?.active_ebm_id) return [];
    const { data: ebm } = await ebmsDB.findById(seu.active_ebm_id);
    if (!ebm) return [];
    // The EBM settled, for each Deliverable and step, the gates the SEU takes. The gate of a step is built from its Quality Gate Definition and the settled row.
    const settled = settledOf(ebm.behaviors);
    const hop = `${input.entityType}|${input.fromState}|${input.toState}`;
    let rows = (settled?.qualityGates?.result ?? []).filter((r) => r.step === hop);
    if (rows.length === 0) return [];

    // A gate that names a Deliverable applies to that Deliverable only. Other entities have no Deliverable name.
    if (input.entityType === "Deliverable") {
      const { data: deliverable } = await deliverablesDB.findById(input.entityId);
      const code = deliverable?.code;
      rows = rows.filter((r) => r.deliverable === "" || (code && r.deliverable === code));
      if (rows.length === 0) return [];
    }

    const { data: definitions, error: definitionsError } = await qualityGateDefinitionsDB.findByIds(ebm.applicable_quality_gate_ids);
    if (definitionsError) throw definitionsError;
    const definitionByCode = new Map((definitions ?? []).map((d) => [d.code, d]));
    const { data: reviewGates } = await reviewGatesDB.findActiveVisibleTo(input.tenantId);
    const gates: EvaluatedQualityGate[] = [];
    for (const row of rows) {
      for (const fields of row.gates) {
        const definition = definitionByCode.get(String(fields.code));
        if (!definition) throw new Error(`the EBM ${ebm.id} names no Quality Gate Definition for gate "${String(fields.code)}"`);
        gates.push({
          id: definition.id, code: definition.code, name: definition.name, category: definition.category, originating_pack_id: null,
          criteria: criteriaOf(definition, fields, row.deliverable, settled?.policies?.result ?? [], reviewGates ?? []),
        });
      }
    }
    return evaluateAll(gates, { ...input, ebm: { id: ebm.id, version: ebm.version } });
  },

  async evaluateByIds(
    gateIds: string[],
    input: { entityType: TransitionEntityType; entityId: string; seuId: string | null; fromState: string; toState: string; authorId: string; authorBadge: string; tenantId: string }
  ): Promise<QualityGateGateResult[]> {
    if (gateIds.length === 0) return [];
    // A gate a Transition Definition names is a Quality Gate Definition. It names no Pack listing, so the criteria are the Definition's own.
    const { data: definitions, error } = await qualityGateDefinitionsDB.findByIds(gateIds);
    if (error) throw error;
    const missing = gateIds.filter((id) => !(definitions ?? []).some((d) => d.id === id));
    if (missing.length > 0) throw new Error(`the Transition Definition names no Quality Gate Definition for id(s) ${missing.join(", ")}`);
    const gates: EvaluatedQualityGate[] = (definitions ?? []).map((definition) => ({
      id: definition.id, code: definition.code, name: definition.name, category: definition.category, originating_pack_id: null,
      criteria: criteriaOf(definition, {}, "", [], []),
    }));
    // The EBM of the SEU, when the entity is in an SEU that has one.
    const { data: seu } = input.seuId ? await seusDB.findById(input.seuId) : { data: null };
    const { data: ebm } = seu?.active_ebm_id ? await ebmsDB.findById(seu.active_ebm_id) : { data: null };
    return evaluateAll(gates, { ...input, ebm: ebm ? { id: ebm.id, version: ebm.version } : null });
  },

  // The decision over the results of evaluate or evaluateByIds and the conditions of the other checks of the hop. Every condition goes to
  // composeQualityGateOutcome, which decides which Blocked conditions a waiver covers. The outcome comes from it and the confidence level from
  // calculateConfidenceLevel. The caller acts on the decision.
  async decideQualityGate(results: QualityGateGateResult[], conditions: QualityGateCondition[], entity: QualityGateOutcomeEntity): Promise<QualityGateDecision> {
    const items: QualityGateOutcomeInputItem[] = [
      ...conditions.map((c) => ({ gateName: c.name, outcome: c.outcome, waivable: c.waivable })),
      ...results.map((r) => ({ gateName: r.gate.name, outcome: r.outcome, waivable: { scope: WAIVER_SCOPE_GATE, qualityGateId: r.gate.id } as Waivable })),
    ];
    const composed = await composeQualityGateOutcome(items, entity);
    const settledGates = composed.items.slice(conditions.length);
    const confidenceLevel = calculateConfidenceLevel(composed, await rateGateWaivers(
      settledGates.flatMap((i, n) => (i.waiver ? [{ gateId: results[n]!.gate.id, waiverId: i.waiver.waiverId }] : []))
    ));
    const reasons = [...conditions.map((c) => c.reason), ...results.map((r) => (r.outcome === "Blocked" ? r.reason : ""))];
    const settledResults = composed.items.slice(conditions.length);
    return {
      outcome: composed.outcome,
      conditions: composed.items.map((i, n) => ({ name: i.gateName, outcome: i.waiver ? i.waiver.outcome : i.outcome, waiverId: i.waiver?.waiverId ?? null, reason: reasons[n], waivable: i.waivable })),
      confidenceLevel,
      rationale: generateQualityGateRationale(composed, confidenceLevel) + (conditions.some((c) => c.outcome === "Blocked") ? ` Other checks: ${conditions.filter((c) => c.outcome === "Blocked").map((c) => `${c.name} (${c.reason})`).join("; ")}.` : ""),
      evaluationIds: results.map((r) => r.evaluationId),
      blocked: results.filter((r, n): r is QualityGateBlockedResult => r.outcome === "Blocked" && !settledResults[n].waiver),
      waived: results.filter((r, n): r is QualityGateBlockedResult => r.outcome === "Blocked" && !!settledResults[n].waiver),
      passed: results.filter((r): r is QualityGatePassedResult => r.outcome === "Passed"),
    };
  },

  // Stores the decision of one Deliverable hop. The outcome is checked against its Ontology concept first.
  async recordDecision(
    decision: QualityGateDecision,
    input: { seuId: string; deliverableId: string; fromState: string; toState: string; tenantId: string; actorId: string; actorBadge: string }
  ): Promise<QualityGateOutcomeRow> {
    await assertOntologyCode(QUALITY_GATE_DECISION_OUTCOME_CONCEPT, decision.outcome, input.tenantId);
    const { data, error } = await qualityGateOutcomesDB.create({
      seu_id: input.seuId,
      deliverable_id: input.deliverableId,
      tenant_id: input.tenantId,
      from_state: input.fromState,
      to_state: input.toState,
      actor_id: input.actorId,
      actor_badge: input.actorBadge,
      evaluation_ids: decision.evaluationIds,
      conditions: decision.conditions.map((c) => ({ name: c.name, outcome: c.outcome, waiverId: c.waiverId, reason: c.reason, waivable: c.waivable })),
      outcome: decision.outcome,
      confidence_level: decision.confidenceLevel,
      rationale: decision.rationale,
    });
    if (error || !data) throw error ?? new Error("failed to record the Quality Gate outcome");
    // Once the decision is stored, QualityGatePassed is published for each Quality Gate line item that Passed, QualityGateBlocked for each one the decision
    // leaves Blocked, and QualityGateWaived for each condition a waiver covers. Nothing follows the publishes but the return.
    for (const r of decision.passed) {
      await eventBus.publish({
        eventType: "QualityGatePassed",
        originatingObjectType: "QualityGate",
        originatingObjectId: r.gate.id,
        seuId: input.seuId,
        correlationId: eventBus.newCorrelationId(),
        actorId: input.actorId,
        authorityBadge: input.actorBadge,
        tenantId: input.tenantId,
        payload: { entityType: "Deliverable", entityId: input.deliverableId },
      });
    }
    for (const r of decision.blocked) {
      await eventBus.publish({
        eventType: "QualityGateBlocked",
        originatingObjectType: "QualityGate",
        originatingObjectId: r.gate.id,
        seuId: input.seuId,
        correlationId: eventBus.newCorrelationId(),
        actorId: input.actorId,
        authorityBadge: input.actorBadge,
        tenantId: input.tenantId,
        payload: { entityType: "Deliverable", entityId: input.deliverableId, reason: r.reason },
      });
    }
    // QualityGateWaived is published for each condition a waiver covers.
    if (decision.outcome === "Waived") {
      for (const c of decision.conditions.filter((cond) => cond.waiverId)) {
        await eventBus.publish({
          eventType: "QualityGateWaived",
          originatingObjectType: WAIVER_ENTITY_TYPE,
          originatingObjectId: c.waiverId!,
          seuId: input.seuId,
          correlationId: eventBus.newCorrelationId(),
          actorId: input.actorId,
          authorityBadge: input.actorBadge,
          tenantId: input.tenantId,
          payload: { entityType: "Deliverable", entityId: input.deliverableId, condition: c.name },
        });
      }
    }
    return data;
  },

  async recordAndPass(
    gate: EvaluatedQualityGate,
    input: { seuId: string | null; entityType: TransitionEntityType; entityId: string; fromState: string; toState: string; authorId: string; authorBadge: string; tenantId: string },
    detail: Record<string, unknown>
  ): Promise<QualityGateEvaluationResult> {
    const evaluation = await storeEvaluation({ qualityGateId: gate.id, seuId: input.seuId, entityType: input.entityType, entityId: input.entityId, fromState: input.fromState, toState: input.toState, outcome: "Passed", detail, authorId: input.authorId, authorBadge: input.authorBadge }, input.tenantId);
    return { outcome: "Passed", gate, evaluationId: evaluation.id };
  },

  async recordAndBlock(
    gate: EvaluatedQualityGate,
    input: { seuId: string | null; entityType: TransitionEntityType; entityId: string; fromState: string; toState: string; authorId: string; authorBadge: string; tenantId: string },
    reason: string,
    detail: Record<string, unknown>
  ): Promise<QualityGateEvaluationResult> {
    const evaluation = await storeEvaluation({ qualityGateId: gate.id, seuId: input.seuId, entityType: input.entityType, entityId: input.entityId, fromState: input.fromState, toState: input.toState, outcome: "Blocked", detail, authorId: input.authorId, authorBadge: input.authorBadge }, input.tenantId);
    return { outcome: "Blocked", gate, reason, evaluationId: evaluation.id };
  },
};
