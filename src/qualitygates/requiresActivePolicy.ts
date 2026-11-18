import { policiesDB } from "../dblayer/policiesDB.js";
import { policyDefinitionsDB } from "../dblayer/policyDefinitionsDB.js";
import { policyChecksFromDefinitions, type PolicyCheck } from "../domain/engine/policyChecks.js";
import { policyEngine } from "../domain/engine/policyEngine.js";
import { QUALITY_GATE_CRITERIA_REQUIRES_ACTIVE_POLICY } from "../dblayer/constants.js";
import type { QualityGateCriterionInput, QualityGateCriterionResult } from "./index.js";

// Every Policy the gate names exists and the policy engine finds the entity in line with it. Whether a failed Policy blocks and a failed Standard does not is the
// policy engine's rule (Policy evaluation), not the gate's: the criterion reports what the engine returns.
export async function requiresActivePolicy(input: QualityGateCriterionInput): Promise<QualityGateCriterionResult> {
  const criteria = input.gate.criteria as { policyIds?: string[]; policyDefinitionIds?: string[] };
  const policyDefinitionIds = criteria.policyDefinitionIds ?? [];
  const policyIds = criteria.policyIds ?? [];
  if (policyDefinitionIds.length === 0 && policyIds.length === 0) return { satisfied: false, reason: `${QUALITY_GATE_CRITERIA_REQUIRES_ACTIVE_POLICY} criteria has no policyIds configured`, detail: {} };
  const named = policyDefinitionIds.length > 0 ? { policyDefinitionIds } : { policyIds };

  let checks: PolicyCheck[];
  if (policyDefinitionIds.length > 0) {
    // A gate of an EBM names the Policy Definitions the EBM took.
    const { data: definitions, error } = await policyDefinitionsDB.findByIds(policyDefinitionIds);
    if (error) throw error;
    if (!definitions || definitions.length !== policyDefinitionIds.length) return { satisfied: false, reason: "one or more referenced Policies do not exist", detail: named };
    checks = policyChecksFromDefinitions(definitions, null, undefined);
  } else {
    const { data: policies } = await policiesDB.findByIds(policyIds);
    if (!policies || policies.length !== policyIds.length) return { satisfied: false, reason: "one or more referenced Policies do not exist", detail: named };
    checks = policies.map((p) => ({ id: p.id, code: p.code, constraint_type: p.constraint_type, condition: p.condition }));
  }
  if (!input.seuId) return { satisfied: false, reason: "the policy engine evaluates an entity of an SEU, and this entity has none", detail: named };

  const result = await policyEngine.evaluateChecks(checks, {
    entityType: input.entityType, seuId: input.seuId, entityId: input.entityId, fromState: input.fromState, toState: input.toState, authorId: input.authorId, authorBadge: input.authorBadge,
  });
  if (result.outcome === "Blocked") {
    return { satisfied: false, reason: `Policy "${result.policyCode}" is not satisfied for this entity`, detail: { ...named, policyCode: result.policyCode, policyId: checks.find((c) => c.code === result.policyCode)?.id } };
  }
  return { satisfied: true, detail: { ...named, deviatedPolicyIds: result.deviatedPolicyIds } };
}
