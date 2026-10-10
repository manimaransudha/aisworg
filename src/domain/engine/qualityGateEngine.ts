import { qualityGatesDB } from "../../dblayer/qualityGatesDB.js";
import { qualityGateEvaluationsDB } from "../../dblayer/qualityGateEvaluationsDB.js";
import { qualityGateWaiversDB } from "../../dblayer/qualityGateWaiversDB.js";
import { obligationsDB } from "../../dblayer/obligationsDB.js";
import { evidenceDB } from "../../dblayer/evidenceDB.js";
import { decisionsDB } from "../../dblayer/decisionsDB.js";
import { reviewsDB } from "../../dblayer/reviewsDB.js";
import { policiesDB } from "../../dblayer/policiesDB.js";
import { seusDB } from "../../dblayer/seusDB.js";
import { ebmsDB } from "../../dblayer/ebmsDB.js";
import { deliverablesDB } from "../../dblayer/deliverablesDB.js";
import { evaluateCondition, type GoverningCondition } from "./governingCondition.js";
import { eventBus } from "./eventBus.js";
import type { QualityGateRow, TransitionEntityType } from "../../dblayer/seuTypes.js";

export const RESOLVED_OBLIGATION_STATUSES = new Set(["Verified", "Closed", "Archived"]);

export const RESOLVED_ATTENTION_STATUSES = new Set(["Resolved", "Closed"]);

const QUALIFYING_EVIDENCE_STATUSES = new Set(["Accepted", "Referenced"]);
const QUALIFYING_DECISION_STATUSES = new Set(["Approved", "Applied"]);

const QUALIFYING_REVIEW_OUTCOMES = new Set(["Passed", "Passed with Recommendations"]);

export type QualityGateEvaluationResult =
  | { outcome: "NotApplicable" }
  | { outcome: "Passed"; gate: QualityGateRow }
  | { outcome: "Blocked"; gate: QualityGateRow; reason: string }
  | { outcome: "Waived"; gate: QualityGateRow; reason: string };

export type QualityGateListEvaluationResult =
  | { outcome: "Passed" | "NotApplicable" }
  | { outcome: "Blocked"; gate: QualityGateRow; reason: string }
  | { outcome: "Waived"; gate: QualityGateRow; reason: string };

export const qualityGateEngine = {
  async evaluate(input: {
    entityType: TransitionEntityType;
    entityId: string;
    seuId: string | null;
    fromState: string;
    toState: string;
    context?: Record<string, unknown>;
    authorId: string;
    authorBadge: string;
  }): Promise<QualityGateListEvaluationResult> {
    let gates: QualityGateRow[];
    if (!input.seuId) {
      const { data } = await qualityGatesDB.findAllActive(input.entityType, input.fromState, input.toState);
      gates = data ?? [];
    } else {
      const { data: seu } = await seusDB.findById(input.seuId);
      if (!seu?.active_ebm_id) {
        const { data } = await qualityGatesDB.findAllActive(input.entityType, input.fromState, input.toState);
        gates = data ?? [];
      } else {
        const { data: ebm } = await ebmsDB.findById(seu.active_ebm_id);
        const { data: candidateGates } = await qualityGatesDB.findByIds(ebm?.applicable_quality_gate_ids ?? []);
        gates = (candidateGates ?? []).filter(
          (g) => g.entity_type === input.entityType && g.from_state === input.fromState && g.to_state === input.toState
        );
      }
    }
    if (gates.length === 0) return { outcome: "NotApplicable" };

    const named = gates.some((g) => g.applicability_deliverable_names.length > 0);
    if (named && input.entityType === "Deliverable") {
      const { data: deliverable } = await deliverablesDB.findById(input.entityId);
      const name = deliverable?.name;
      gates = gates.filter((g) => g.applicability_deliverable_names.length === 0 || (name && g.applicability_deliverable_names.includes(name)));
    }
    if (gates.length === 0) return { outcome: "NotApplicable" };

    for (const gate of gates) {
      const result = await this.evaluateGate(gate, input);
      if (result.outcome === "Blocked" || result.outcome === "Waived") return result;
    }
    return { outcome: "Passed" };
  },

  async evaluateByIds(
    gateIds: string[],
    input: { entityType: TransitionEntityType; entityId: string; seuId: string | null; context?: Record<string, unknown>; authorId: string; authorBadge: string }
  ): Promise<QualityGateListEvaluationResult> {
    if (gateIds.length === 0) return { outcome: "NotApplicable" };
    const { data: gates } = await qualityGatesDB.findByIds(gateIds);
    for (const gate of gates ?? []) {
      const result = await this.evaluateGate(gate, input);
      if (result.outcome === "Blocked" || result.outcome === "Waived") return result;
    }
    return { outcome: "Passed" };
  },

  async evaluateGate(
    gate: QualityGateRow,
    input: { entityType: TransitionEntityType; entityId: string; seuId: string | null; context?: Record<string, unknown>; authorId: string; authorBadge: string }
  ): Promise<QualityGateEvaluationResult> {
    const criteriaType = (gate.criteria as { type?: string }).type;

    if (criteriaType === "no_unresolved_obligations") {
      const { data: obligations } = await obligationsDB.findByRelatedObject(input.entityType, input.entityId);
      const unresolved = (obligations ?? []).filter((o) => !RESOLVED_OBLIGATION_STATUSES.has(o.status));
      if (unresolved.length > 0) {
        return this.blockOrWaive(gate, input, `${unresolved.length} unresolved Obligation(s) (${unresolved.map((o) => o.title).join(", ")})`, {
          unresolvedObligationIds: unresolved.map((o) => o.id),
        });
      }
      return this.recordAndPass(gate, input);
    }

    if (criteriaType === "requires_accepted_evidence_or_approved_decision") {
      const requiredCategory = gate.category;
      const [{ data: evidence }, { data: decisions }] = await Promise.all([
        evidenceDB.findByRelatedObject(input.entityType, input.entityId),
        decisionsDB.findByRelatedObject(input.entityType, input.entityId),
      ]);
      const qualifyingEvidence = (evidence ?? []).filter((e) => QUALIFYING_EVIDENCE_STATUSES.has(e.status) && e.category === requiredCategory);
      const qualifyingDecisions = (decisions ?? []).filter((d) => QUALIFYING_DECISION_STATUSES.has(d.status));

      if (qualifyingEvidence.length === 0 && qualifyingDecisions.length === 0) {
        return this.blockOrWaive(gate, input, `no accepted Evidence of category "${requiredCategory}" or approved Decision found for this entity`, { requiredCategory });
      }
      return this.recordAndPass(gate, input);
    }

    if (criteriaType === "requires_accepted_review") {
      const reviewGateId = (gate.criteria as { reviewGateId?: string }).reviewGateId;
      if (!reviewGateId) return this.blockOrWaive(gate, input, "requires_accepted_review criteria has no reviewGateId configured", {});
      const { data: reviews } = await reviewsDB.findByRelatedObject(input.entityType, input.entityId);
      const qualifying = (reviews ?? []).filter(
        (r) => r.status === "Accepted" && r.outcome != null && QUALIFYING_REVIEW_OUTCOMES.has(r.outcome) && r.review_gate_id === reviewGateId
      );
      if (qualifying.length === 0) {
        return this.blockOrWaive(gate, input, "no Accepted, passing Review found for this entity against the required Review Gate", { reviewGateId });
      }
      return this.recordAndPass(gate, input);
    }

    if (criteriaType === "requires_active_policy") {
      const policyIds = (gate.criteria as { policyIds?: string[] }).policyIds ?? [];
      if (policyIds.length === 0) return this.blockOrWaive(gate, input, "requires_active_policy criteria has no policyIds configured", {});
      const { data: policies } = await policiesDB.findByIds(policyIds);
      if (!policies || policies.length !== policyIds.length) {
        return this.blockOrWaive(gate, input, "one or more referenced Policies do not exist", { policyIds });
      }
      for (const policy of policies) {
        const satisfied = evaluateCondition(policy.condition as GoverningCondition, input.context ?? {});
        if (!satisfied) {
          return this.blockOrWaive(gate, input, `Policy "${policy.code}" is not satisfied for this entity`, { policyId: policy.id, policyCode: policy.code });
        }
      }
      return this.recordAndPass(gate, input);
    }

    return this.blockOrWaive(gate, input, `unrecognised Quality Gate criteria type: ${criteriaType}`, { criteriaType });
  },

  async blockOrWaive(
    gate: QualityGateRow,
    input: { seuId: string | null; entityType: TransitionEntityType; entityId: string; authorId: string; authorBadge: string },
    reason: string,
    detail: Record<string, unknown>
  ): Promise<QualityGateEvaluationResult> {
    const { data: waiver } = await qualityGateWaiversDB.findActive(gate.id, input.entityType, input.entityId);
    if (waiver) return this.recordAndWaive(gate, input, reason, waiver.id);
    return this.recordAndBlock(gate, input, reason, detail);
  },

  async recordAndPass(
    gate: QualityGateRow,
    input: { seuId: string | null; entityType: TransitionEntityType; entityId: string; authorId: string; authorBadge: string }
  ): Promise<QualityGateEvaluationResult> {
    await qualityGateEvaluationsDB.create({ qualityGateId: gate.id, seuId: input.seuId, entityType: input.entityType, entityId: input.entityId, outcome: "Passed", authorId: input.authorId, authorBadge: input.authorBadge });
    await eventBus.publish({
      eventType: "QualityGatePassed",
      originatingObjectType: "QualityGate",
      originatingObjectId: gate.id,
      seuId: input.seuId,
      correlationId: eventBus.newCorrelationId(),
      actorId: input.authorId,
      authorityBadge: input.authorBadge,
      payload: { entityType: input.entityType, entityId: input.entityId },
    });
    return { outcome: "Passed", gate };
  },

  async recordAndBlock(
    gate: QualityGateRow,
    input: { seuId: string | null; entityType: TransitionEntityType; entityId: string; authorId: string; authorBadge: string },
    reason: string,
    detail: Record<string, unknown>
  ): Promise<QualityGateEvaluationResult> {
    await qualityGateEvaluationsDB.create({ qualityGateId: gate.id, seuId: input.seuId, entityType: input.entityType, entityId: input.entityId, outcome: "Blocked", detail, authorId: input.authorId, authorBadge: input.authorBadge });
    await eventBus.publish({
      eventType: "QualityGateBlocked",
      originatingObjectType: "QualityGate",
      originatingObjectId: gate.id,
      seuId: input.seuId,
      correlationId: eventBus.newCorrelationId(),
      actorId: input.authorId,
      authorityBadge: input.authorBadge,
      payload: { entityType: input.entityType, entityId: input.entityId, reason },
    });
    return { outcome: "Blocked", gate, reason };
  },

  async recordAndWaive(
    gate: QualityGateRow,
    input: { seuId: string | null; entityType: TransitionEntityType; entityId: string; authorId: string; authorBadge: string },
    reason: string,
    waiverId: string
  ): Promise<QualityGateEvaluationResult> {
    await qualityGateEvaluationsDB.create({ qualityGateId: gate.id, seuId: input.seuId, entityType: input.entityType, entityId: input.entityId, outcome: "Waived", detail: { reason, waiverId }, authorId: input.authorId, authorBadge: input.authorBadge });
    await eventBus.publish({
      eventType: "QualityGateWaived",
      originatingObjectType: "QualityGate",
      originatingObjectId: gate.id,
      seuId: input.seuId,
      correlationId: eventBus.newCorrelationId(),
      actorId: input.authorId,
      authorityBadge: input.authorBadge,
      payload: { entityType: input.entityType, entityId: input.entityId, reason, waiverId },
    });
    return { outcome: "Waived", gate, reason };
  },
};
