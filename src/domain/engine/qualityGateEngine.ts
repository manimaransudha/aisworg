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
import { obligationsDB } from "../../dblayer/obligationsDB.js";
import { evidenceDB } from "../../dblayer/evidenceDB.js";
import { decisionsDB } from "../../dblayer/decisionsDB.js";
import { reviewsDB } from "../../dblayer/reviewsDB.js";
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
  | { outcome: "Blocked"; gate: QualityGateRow; reason: string };

export type QualityGateListEvaluationResult = { outcome: "Passed" | "NotApplicable" } | { outcome: "Blocked"; gate: QualityGateRow; reason: string };

export const qualityGateEngine = {
  async evaluate(input: {
    entityType: TransitionEntityType;
    entityId: string;
    seuId: string;
    fromState: string;
    toState: string;
  }): Promise<QualityGateEvaluationResult> {
    const { data: gate } = await qualityGatesDB.find(input.entityType, input.fromState, input.toState);
    if (!gate) return { outcome: "NotApplicable" };
    return this.evaluateGate(gate, input);
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
  // single-gate check already has.
  async evaluateByIds(
    gateIds: string[],
    input: { entityType: TransitionEntityType; entityId: string; seuId: string }
  ): Promise<QualityGateListEvaluationResult> {
    if (gateIds.length === 0) return { outcome: "NotApplicable" };
    const { data: gates } = await qualityGatesDB.findByIds(gateIds);
    for (const gate of gates ?? []) {
      const result = await this.evaluateGate(gate, input);
      if (result.outcome === "Blocked") return result;
    }
    return { outcome: "Passed" };
  },

  async evaluateGate(
    gate: QualityGateRow,
    input: { entityType: TransitionEntityType; entityId: string; seuId: string }
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
        return this.recordAndBlock(gate, input, `${unresolved.length} unresolved Obligation(s) (${unresolved.map((o) => o.title).join(", ")})`, {
          unresolvedObligationIds: unresolved.map((o) => o.id),
        });
      }
      return this.recordAndPass(gate, input);
    }

    if (criteriaType === "requires_accepted_evidence_or_approved_decision") {
      const [{ data: evidence }, { data: decisions }] = await Promise.all([
        evidenceDB.findByRelatedObject(input.entityType, input.entityId),
        decisionsDB.findByRelatedObject(input.entityType, input.entityId),
      ]);
      const qualifyingEvidence = (evidence ?? []).filter((e) => QUALIFYING_EVIDENCE_STATUSES.has(e.status));
      const qualifyingDecisions = (decisions ?? []).filter((d) => QUALIFYING_DECISION_STATUSES.has(d.status));

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
        return this.recordAndBlock(gate, input, "no accepted Evidence or approved Decision found for this entity", {});
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
        return this.recordAndBlock(gate, input, requiredCategory ? `no Accepted, passing "${requiredCategory}" Review found for this entity` : "no Accepted, passing Review found for this entity", { requiredCategory });
      }
      return this.recordAndPass(gate, input);
    }

    // Unrecognised criteria type fails closed, same discipline as
    // transitionEngine's policy-condition evaluation.
    return this.recordAndBlock(gate, input, `unrecognised Quality Gate criteria type: ${criteriaType}`, { criteriaType });
  },

  async recordAndPass(gate: QualityGateRow, input: { seuId: string; entityType: TransitionEntityType; entityId: string }): Promise<QualityGateEvaluationResult> {
    await qualityGateEvaluationsDB.create({ qualityGateId: gate.id, seuId: input.seuId, entityType: input.entityType, entityId: input.entityId, outcome: "Passed" });
    // Ch.26 §15: the Quality Gate subsystem itself should publish this — a
    // real gap found in Phase 7's audit (evaluations were only ever written
    // to quality_gate_evaluations, never announced on the event bus).
    await eventBus.publish({
      eventType: "QualityGatePassed",
      originatingObjectType: "QualityGate",
      originatingObjectId: gate.id,
      correlationId: eventBus.newCorrelationId(),
      payload: { entityType: input.entityType, entityId: input.entityId, seuId: input.seuId },
    });
    return { outcome: "Passed", gate };
  },

  async recordAndBlock(
    gate: QualityGateRow,
    input: { seuId: string; entityType: TransitionEntityType; entityId: string },
    reason: string,
    detail: Record<string, unknown>
  ): Promise<QualityGateEvaluationResult> {
    await qualityGateEvaluationsDB.create({ qualityGateId: gate.id, seuId: input.seuId, entityType: input.entityType, entityId: input.entityId, outcome: "Blocked", detail });
    await eventBus.publish({
      eventType: "QualityGateBlocked",
      originatingObjectType: "QualityGate",
      originatingObjectId: gate.id,
      correlationId: eventBus.newCorrelationId(),
      payload: { entityType: input.entityType, entityId: input.entityId, seuId: input.seuId, reason },
    });
    return { outcome: "Blocked", gate, reason };
  },
};
