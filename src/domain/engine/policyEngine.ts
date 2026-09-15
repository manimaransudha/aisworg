// CR-104 — Policy's own live evaluation path. Before this, Policy had no
// live lookup at all: `required_policy_ids` (transitionEngine.evaluate) is
// populated for zero real production transitions, and Policy's own
// `governed_transition` column (set at Pack-publish time, packs.ts) was
// never queried by anything. Mirrors qualityGateEngine.evaluate exactly:
// reads this SEU's own EBM's materialised applicable_policy_ids
// (compositionCompleted.ts, computed once at commissioning from the
// composed Packs' own originating_pack_id — never a bare cross-composition
// match), narrows to this exact transition's governed_transition string,
// evaluates each Policy's condition against the given context. A "Policy"
// constraint_type blocks on failure; a "Standard" one deviates
// non-blockingly (StandardPolicyDeviation), same semantics
// transitionEngine.evaluate's own required_policy_ids check already has.
import { seusDB } from "../../dblayer/seusDB.js";
import { ebmsDB } from "../../dblayer/ebmsDB.js";
import { policiesDB } from "../../dblayer/policiesDB.js";
import { deliverablesDB } from "../../dblayer/deliverablesDB.js";
import { evaluateCondition, type GoverningCondition } from "./governingCondition.js";
import { eventBus } from "./eventBus.js";
import type { TransitionEntityType } from "../../dblayer/seuTypes.js";

export type PolicyEvaluationResult = { outcome: "NotApplicable" | "Passed" } | { outcome: "Blocked"; policyCode: string };

export const policyEngine = {
  async evaluate(input: {
    entityType: TransitionEntityType;
    seuId: string | null;
    // Migration 211 (owner: "the policy can be available to any number of
    // deliverables as well") — needed to resolve the actual Deliverable's own
    // name for Applicability Deliverable Names filtering, below. Optional:
    // every non-Deliverable caller (SEU's own commissioning checks) simply
    // never has a named-policy candidate to filter in the first place.
    entityId?: string | null;
    fromState: string;
    toState: string;
    context?: Record<string, unknown>;
  }): Promise<PolicyEvaluationResult> {
    if (!input.seuId) return { outcome: "NotApplicable" };
    const { data: seu } = await seusDB.findById(input.seuId);
    if (!seu?.active_ebm_id) return { outcome: "NotApplicable" };
    const { data: ebm } = await ebmsDB.findById(seu.active_ebm_id);
    if (!ebm) return { outcome: "NotApplicable" };
    // CR-104 — the SEU's own lifecycle transition reads a distinct,
    // separately-materialised field: commissioning.ts was never meant to
    // reach into applicable_policy_ids (entity-scoped governance for owned
    // Deliverables/AttentionItems/etc) — it has its own, seu_scoped_policy_ids.
    const relevantPolicyIds = input.entityType === "SEU" ? ebm.seu_scoped_policy_ids : ebm.applicable_policy_ids;
    if (relevantPolicyIds.length === 0) return { outcome: "NotApplicable" };

    const { data: candidatePolicies } = await policiesDB.findByIds(relevantPolicyIds);
    const governedTransition = `${input.entityType}|${input.fromState}|${input.toState}`;
    let policies = (candidatePolicies ?? []).filter((p) => p.governed_transition === governedTransition);
    if (policies.length === 0) return { outcome: "NotApplicable" };

    // Migration 211 — same mechanism qualityGateEngine.ts already has for
    // quality_gates.applicability_deliverable_names: a real runtime filter
    // against the actual Deliverable's own name, not a declaration-only
    // field. Empty = matches every Deliverable name (unchanged behaviour for
    // every Policy that never names one).
    const named = policies.some((p) => p.applicability_deliverable_names.length > 0);
    if (named && input.entityType === "Deliverable" && input.entityId) {
      const { data: deliverable } = await deliverablesDB.findById(input.entityId);
      const name = deliverable?.name;
      policies = policies.filter((p) => p.applicability_deliverable_names.length === 0 || (name && p.applicability_deliverable_names.includes(name)));
    }
    if (policies.length === 0) return { outcome: "NotApplicable" };

    for (const policy of policies) {
      const satisfied = evaluateCondition(policy.condition as GoverningCondition, input.context ?? {});
      const payload = { policyCode: policy.code, entityType: input.entityType, fromState: input.fromState, toState: input.toState };
      // Ch.24 §15 — PolicyApplied/PolicyViolated: the platform's own generic
      // vocabulary for "a policy was checked as part of a governed
      // transition," alongside (not instead of) StandardPolicyDeviation
      // below, which telemetry.ts already reads specifically for sustained-
      // pattern detection.
      if (satisfied) {
        await eventBus.publish({
          eventType: "PolicyApplied",
          originatingObjectType: "Policy",
          originatingObjectId: policy.id,
          seuId: input.seuId,
          correlationId: eventBus.newCorrelationId(),
          payload,
        });
        continue;
      }
      await eventBus.publish({
        eventType: "PolicyViolated",
        originatingObjectType: "Policy",
        originatingObjectId: policy.id,
        seuId: input.seuId,
        correlationId: eventBus.newCorrelationId(),
        payload: { ...payload, constraintType: policy.constraint_type },
      });
      if (policy.constraint_type === "Policy") {
        return { outcome: "Blocked", policyCode: policy.code };
      }
      // Standard (non-blocking) deviations proceed, same discipline
      // transitionEngine.evaluate's own required_policy_ids check uses.
      await eventBus.publish({
        eventType: "StandardPolicyDeviation",
        originatingObjectType: "Policy",
        originatingObjectId: policy.id,
        seuId: input.seuId,
        correlationId: eventBus.newCorrelationId(),
        payload,
      });
    }
    return { outcome: "Passed" };
  },
};
