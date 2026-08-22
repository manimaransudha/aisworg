// Ch.26 minimal instance — evaluates whether a declared Quality Gate permits
// a governed transition. A gate is scoped to one specific (entityType,
// fromState, toState) triple, same granularity as transition_definitions
// (Ch.29), so extending which transitions get gated is a quality_gates row,
// not a code change. MVP implements two declarative criteria types:
//   - "no_unresolved_obligations" (Phase 4 — Ch.23 §11's own worked example)
//   - "requires_accepted_evidence_or_approved_decision" (Phase 5 — Ch.17's
//     Trust Pipeline ADR: "Deliverable State Transitions occur only after
//     sufficient evidence and approved decisions")
// Richer criteria (Review-based, per Ch.26 §9) are future scope.
import { qualityGatesDB } from "../../dblayer/qualityGatesDB.js";
import { qualityGateEvaluationsDB } from "../../dblayer/qualityGateEvaluationsDB.js";
import { qualityGateWaiversDB } from "../../dblayer/qualityGateWaiversDB.js";
import { obligationsDB } from "../../dblayer/obligationsDB.js";
import { evidenceDB } from "../../dblayer/evidenceDB.js";
import { decisionsDB } from "../../dblayer/decisionsDB.js";
import { reviewsDB } from "../../dblayer/reviewsDB.js";
import { policiesDB } from "../../dblayer/policiesDB.js";
import { evaluateCondition, type PolicyCondition } from "./policyCondition.js";
import { eventBus } from "./eventBus.js";
import type { QualityGateRow, TransitionEntityType } from "../../dblayer/seuTypes.js";

// Ch.23 §12: an Obligation stops blocking once it's at least Verified —
// Closed/Archived are further administrative steps past the point governance
// cares.
const RESOLVED_OBLIGATION_STATUSES = new Set(["Verified", "Closed", "Archived"]);

// Ch.17 §9: Evidence counts once it's reached Accepted or is actively
// Referenced; Archived means retired from active use, so a newly-requested
// transition shouldn't lean on it. Ch.19 §9: only Approved/Applied Decisions
// influence a Deliverable transition — Superseded/Archived are no longer the
// current decision.
const QUALIFYING_EVIDENCE_STATUSES = new Set(["Accepted", "Referenced"]);
const QUALIFYING_DECISION_STATUSES = new Set(["Approved", "Applied"]);

// Review Model (Ch.25 §11): a Review satisfies a gate only when its lifecycle is
// Accepted AND its outcome is a passing one. Rework Required/Failed never
// satisfy; Deferred/Not Applicable do not satisfy a *required* Review.
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
  // CR-058 — a transition may now have several active gates (one per
  // category, owner: "one gate per category"). All must pass; short-circuits
  // and reports the first one that blocks or is waived, same "first
  // blocking gate wins" semantics evaluateByIds already had for explicit
  // gate-id references — now shared by both paths.
  async evaluate(input: {
    entityType: TransitionEntityType;
    entityId: string;
    seuId: string | null;
    fromState: string;
    toState: string;
    context?: Record<string, unknown>;
  }): Promise<QualityGateListEvaluationResult> {
    const { data: gates } = await qualityGatesDB.findAllActive(input.entityType, input.fromState, input.toState);
    if (!gates || gates.length === 0) return { outcome: "NotApplicable" };
    for (const gate of gates) {
      const result = await this.evaluateGate(gate, input);
      if (result.outcome === "Blocked" || result.outcome === "Waived") return result;
    }
    return { outcome: "Passed" };
  },

  // SDK UI Layer Plan, Transition Definition section, "Mechanism — resolved"
  // — explicit gate references (transition_definitions.required_quality_gate_ids)
  // replace the coincidental (entityType, fromState, toState) match above,
  // for any transition_definitions row that declares them. Called from
  // transitionEngine.evaluate itself, generically, for any entity type — not
  // a per-entity-type qualityGateEngine.evaluate call the way the 9 existing
  // entity types' own core/*.ts functions still do it (unchanged, still
  // live). All gates must pass; short-circuits and reports the first one
  // that blocks, same "first blocking gate wins" semantics evaluate's own
  // multi-gate check above shares.
  async evaluateByIds(
    gateIds: string[],
    input: { entityType: TransitionEntityType; entityId: string; seuId: string | null; context?: Record<string, unknown> }
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
    input: { entityType: TransitionEntityType; entityId: string; seuId: string | null; context?: Record<string, unknown> }
  ): Promise<QualityGateEvaluationResult> {
    const criteriaType = (gate.criteria as { type?: string }).type;

    // Post-completion fix (Open Design Questions.md #3): both criteria types
    // below used to resolve Obligations/Evidence/Decisions by a Deliverable-
    // only deliverable_id FK — meaning a Quality Gate on any other entity
    // type could never mean anything, even though quality_gates.entity_type
    // was never actually restricted to 'Deliverable'. Obligation/Evidence/
    // Decision now carry a polymorphic (related_object_type, related_object_id)
    // pair instead, resolved generically here against whatever entity this
    // evaluation is actually for — no entity-type-specific branch needed.
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
      // CR-058 — an optional `category` narrows this the same way
      // requires_accepted_review already did (checked directly against
      // qualifying Evidence's own category / qualifying Decision's own
      // category — one shared param, whichever entity type qualifies).
      const requiredCategory = (gate.criteria as { category?: string }).category;
      const [{ data: evidence }, { data: decisions }] = await Promise.all([
        evidenceDB.findByRelatedObject(input.entityType, input.entityId),
        decisionsDB.findByRelatedObject(input.entityType, input.entityId),
      ]);
      const qualifyingEvidence = (evidence ?? []).filter((e) => QUALIFYING_EVIDENCE_STATUSES.has(e.status) && (!requiredCategory || e.category === requiredCategory));
      const qualifyingDecisions = (decisions ?? []).filter((d) => QUALIFYING_DECISION_STATUSES.has(d.status) && (!requiredCategory || d.category === requiredCategory));

      // Participant Integration & Attestation — Plan step 2, refined 2026-08-11:
      // the acceptance attestation is deliberately NOT accepted as satisfying
      // this gate. Baselining is a genuine second bar above Approval: an
      // attestation certifies the commit that reached Approved, but a later CR
      // can change that code, so auto-baselining off the approval attestation
      // would certify a stale artifact. Baselining still requires its own fresh
      // accepted Evidence or approved Decision. (This refines Resolution 7 —
      // the attestation's role is provenance + the empty-centre presence check,
      // not gate satisfaction.)
      if (qualifyingEvidence.length === 0 && qualifyingDecisions.length === 0) {
        return this.blockOrWaive(
          gate,
          input,
          requiredCategory ? `no accepted Evidence or approved Decision of category "${requiredCategory}" found for this entity` : "no accepted Evidence or approved Decision found for this entity",
          { requiredCategory }
        );
      }
      return this.recordAndPass(gate, input);
    }

    // Review Model — Plan (Phase 14, Ch.25 §11): Governance consumes the Review
    // outcome. This gate blocks a transition until an Accepted Review with a
    // passing outcome exists for the entity. An optional `category` narrows it
    // to a specific Review category (e.g. "Architecture"). Reviews are
    // polymorphic, so this works for any gated entity type.
    if (criteriaType === "requires_accepted_review") {
      const requiredCategory = (gate.criteria as { category?: string }).category;
      const { data: reviews } = await reviewsDB.findByRelatedObject(input.entityType, input.entityId);
      const qualifying = (reviews ?? []).filter(
        (r) => r.status === "Accepted" && r.outcome != null && QUALIFYING_REVIEW_OUTCOMES.has(r.outcome) && (!requiredCategory || r.category === requiredCategory)
      );
      if (qualifying.length === 0) {
        return this.blockOrWaive(gate, input, requiredCategory ? `no Accepted, passing "${requiredCategory}" Review found for this entity` : "no Accepted, passing Review found for this entity", { requiredCategory });
      }
      return this.recordAndPass(gate, input);
    }

    // CR-058 — Ch.26 §9 ¶2: "a Quality Gate may still choose to treat
    // adherence as blocking for that specific gate... even though the
    // underlying Policy does not block by default elsewhere." That's exactly
    // what this criteria type is: unlike transitionEngine's own Policy
    // handling (which only blocks for constraint_type "Policy", letting
    // "Standard" deviate non-blockingly), a Policy explicitly referenced by
    // a Quality Gate always blocks on non-satisfaction, regardless of its
    // own constraint_type — the gate IS the explicit override the chapter
    // describes.
    if (criteriaType === "requires_active_policy") {
      const policyCode = (gate.criteria as { policyCode?: string }).policyCode;
      if (!policyCode) return this.blockOrWaive(gate, input, "requires_active_policy criteria has no policyCode configured", {});
      const { data: policy } = await policiesDB.findByCode(policyCode);
      if (!policy) return this.blockOrWaive(gate, input, `referenced Policy "${policyCode}" does not exist`, { policyCode });
      const satisfied = evaluateCondition(policy.condition as PolicyCondition, input.context ?? {});
      if (!satisfied) {
        return this.blockOrWaive(gate, input, `Policy "${policyCode}" is not satisfied for this entity`, { policyCode });
      }
      return this.recordAndPass(gate, input);
    }

    // Unrecognised criteria type fails closed, same discipline as
    // transitionEngine's policy-condition evaluation.
    return this.blockOrWaive(gate, input, `unrecognised Quality Gate criteria type: ${criteriaType}`, { criteriaType });
  },

  // CR-058 §13 — checked before a would-be block is finalized: an active,
  // unexpired waiver for this exact (gate, entity) pair turns a Blocked
  // outcome into a real, recorded Waived one instead. Waivers are granted
  // per entity instance, never per gate definition globally (core/
  // qualityGateWaivers.ts) — the same criteria failure can be waived for one
  // Deliverable without silently waiving it for every other entity the gate
  // also applies to.
  async blockOrWaive(
    gate: QualityGateRow,
    input: { seuId: string | null; entityType: TransitionEntityType; entityId: string },
    reason: string,
    detail: Record<string, unknown>
  ): Promise<QualityGateEvaluationResult> {
    const { data: waiver } = await qualityGateWaiversDB.findActive(gate.id, input.entityType, input.entityId);
    if (waiver) return this.recordAndWaive(gate, input, reason, waiver.id);
    return this.recordAndBlock(gate, input, reason, detail);
  },

  async recordAndPass(gate: QualityGateRow, input: { seuId: string | null; entityType: TransitionEntityType; entityId: string }): Promise<QualityGateEvaluationResult> {
    await qualityGateEvaluationsDB.create({ qualityGateId: gate.id, seuId: input.seuId, entityType: input.entityType, entityId: input.entityId, outcome: "Passed" });
    // Ch.26 §15: the Quality Gate subsystem itself should publish this — a
    // real gap found in Phase 7's audit (evaluations were only ever written
    // to quality_gate_evaluations, never announced on the event bus).
    await eventBus.publish({
      eventType: "QualityGatePassed",
      originatingObjectType: "QualityGate",
      originatingObjectId: gate.id,
      seuId: input.seuId,
      correlationId: eventBus.newCorrelationId(),
      payload: { entityType: input.entityType, entityId: input.entityId },
    });
    return { outcome: "Passed", gate };
  },

  async recordAndBlock(
    gate: QualityGateRow,
    input: { seuId: string | null; entityType: TransitionEntityType; entityId: string },
    reason: string,
    detail: Record<string, unknown>
  ): Promise<QualityGateEvaluationResult> {
    await qualityGateEvaluationsDB.create({ qualityGateId: gate.id, seuId: input.seuId, entityType: input.entityType, entityId: input.entityId, outcome: "Blocked", detail });
    await eventBus.publish({
      eventType: "QualityGateBlocked",
      originatingObjectType: "QualityGate",
      originatingObjectId: gate.id,
      seuId: input.seuId,
      correlationId: eventBus.newCorrelationId(),
      payload: { entityType: input.entityType, entityId: input.entityId, reason },
    });
    return { outcome: "Blocked", gate, reason };
  },

  async recordAndWaive(
    gate: QualityGateRow,
    input: { seuId: string | null; entityType: TransitionEntityType; entityId: string },
    reason: string,
    waiverId: string
  ): Promise<QualityGateEvaluationResult> {
    await qualityGateEvaluationsDB.create({ qualityGateId: gate.id, seuId: input.seuId, entityType: input.entityType, entityId: input.entityId, outcome: "Waived", detail: { reason, waiverId } });
    await eventBus.publish({
      eventType: "QualityGateWaived",
      originatingObjectType: "QualityGate",
      originatingObjectId: gate.id,
      seuId: input.seuId,
      correlationId: eventBus.newCorrelationId(),
      payload: { entityType: input.entityType, entityId: input.entityId, reason, waiverId },
    });
    return { outcome: "Waived", gate, reason };
  },
};
