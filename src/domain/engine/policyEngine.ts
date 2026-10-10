import { seusDB } from "../../dblayer/seusDB.js";
import { ebmsDB } from "../../dblayer/ebmsDB.js";
import { policiesDB } from "../../dblayer/policiesDB.js";
import { deliverablesDB } from "../../dblayer/deliverablesDB.js";
import { evaluateCondition, type GoverningCondition } from "./governingCondition.js";
import { eventBus } from "./eventBus.js";
import type { TransitionEntityType } from "../../dblayer/seuTypes.js";

export type PolicyEvaluationResult =
  | { outcome: "NotApplicable"; satisfiedPolicyIds: []; deviatedPolicyIds: [] }
  | { outcome: "Passed"; satisfiedPolicyIds: string[]; deviatedPolicyIds: string[] }
  | { outcome: "Blocked"; policyCode: string; satisfiedPolicyIds: string[]; deviatedPolicyIds: string[] };

export const policyEngine = {
  async evaluate(input: {
    entityType: TransitionEntityType;
    seuId: string | null;
    entityId?: string | null;
    fromState: string;
    toState: string;
    context?: Record<string, unknown>;
    authorId: string;
    authorBadge: string;
  }): Promise<PolicyEvaluationResult> {
    if (!input.seuId) return { outcome: "NotApplicable", satisfiedPolicyIds: [], deviatedPolicyIds: [] };
    const { data: seu } = await seusDB.findById(input.seuId);
    if (!seu?.active_ebm_id) return { outcome: "NotApplicable", satisfiedPolicyIds: [], deviatedPolicyIds: [] };
    const { data: ebm } = await ebmsDB.findById(seu.active_ebm_id);
    if (!ebm) return { outcome: "NotApplicable", satisfiedPolicyIds: [], deviatedPolicyIds: [] };
    const relevantPolicyIds = input.entityType === "SEU" ? ebm.seu_scoped_policy_ids : ebm.applicable_policy_ids;
    if (relevantPolicyIds.length === 0) return { outcome: "NotApplicable", satisfiedPolicyIds: [], deviatedPolicyIds: [] };

    const { data: candidatePolicies } = await policiesDB.findByIds(relevantPolicyIds);
    const governedTransition = `${input.entityType}|${input.fromState}|${input.toState}`;
    let policies = (candidatePolicies ?? []).filter((p) => p.governed_transition === governedTransition);
    if (policies.length === 0) return { outcome: "NotApplicable", satisfiedPolicyIds: [], deviatedPolicyIds: [] };

    const named = policies.some((p) => p.applicability_deliverable_names.length > 0);
    if (named && input.entityType === "Deliverable" && input.entityId) {
      const { data: deliverable } = await deliverablesDB.findById(input.entityId);
      const name = deliverable?.name;
      policies = policies.filter((p) => p.applicability_deliverable_names.length === 0 || (name && p.applicability_deliverable_names.includes(name)));
    }
    if (policies.length === 0) return { outcome: "NotApplicable", satisfiedPolicyIds: [], deviatedPolicyIds: [] };

    const satisfiedPolicyIds: string[] = [];
    const deviatedPolicyIds: string[] = [];
    for (const policy of policies) {
      const satisfied = evaluateCondition(policy.condition as GoverningCondition, input.context ?? {});
      const payload = { policyCode: policy.code, entityType: input.entityType, fromState: input.fromState, toState: input.toState };
      if (satisfied) {
        satisfiedPolicyIds.push(policy.id);
        await eventBus.publish({
          eventType: "PolicyApplied",
          originatingObjectType: "Policy",
          originatingObjectId: policy.id,
          seuId: input.seuId,
          correlationId: eventBus.newCorrelationId(),
          actorId: input.authorId,
          authorityBadge: input.authorBadge,
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
        actorId: input.authorId,
        authorityBadge: input.authorBadge,
        payload: { ...payload, constraintType: policy.constraint_type },
      });
      if (policy.constraint_type === "Policy") {
        return { outcome: "Blocked", policyCode: policy.code, satisfiedPolicyIds, deviatedPolicyIds };
      }
      deviatedPolicyIds.push(policy.id);
      await eventBus.publish({
        eventType: "StandardPolicyDeviation",
        originatingObjectType: "Policy",
        originatingObjectId: policy.id,
        seuId: input.seuId,
        correlationId: eventBus.newCorrelationId(),
        actorId: input.authorId,
        authorityBadge: input.authorBadge,
        payload,
      });
    }
    return { outcome: "Passed", satisfiedPolicyIds, deviatedPolicyIds };
  },
};
