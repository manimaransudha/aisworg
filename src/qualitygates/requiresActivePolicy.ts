import { policiesDB } from "../dblayer/policiesDB.js";
import { policyDefinitionsDB } from "../dblayer/policyDefinitionsDB.js";
import { policyChecksFromDefinitions } from "../domain/engine/policyChecks.js";
import { evaluateCondition, type GoverningCondition } from "../domain/engine/governingCondition.js";
import { QUALITY_GATE_CRITERIA_REQUIRES_ACTIVE_POLICY } from "../dblayer/constants.js";
import type { QualityGateCriterionInput, QualityGateCriterionResult } from "./index.js";

// Every Policy the gate names exists and its condition holds for the entity.
export async function requiresActivePolicy(input: QualityGateCriterionInput): Promise<QualityGateCriterionResult> {
  const criteria = input.gate.criteria as { policyIds?: string[]; policyDefinitionIds?: string[] };
  const policyDefinitionIds = criteria.policyDefinitionIds ?? [];
  if (policyDefinitionIds.length > 0) {
    // A gate of an EBM names the Policy Definitions the EBM took.
    const { data: definitions, error } = await policyDefinitionsDB.findByIds(policyDefinitionIds);
    if (error) throw error;
    if (!definitions || definitions.length !== policyDefinitionIds.length) return { satisfied: false, reason: "one or more referenced Policies do not exist", detail: { policyDefinitionIds } };
    for (const check of policyChecksFromDefinitions(definitions, null, undefined)) {
      if (!evaluateCondition(check.condition as GoverningCondition, input.context)) {
        return { satisfied: false, reason: `Policy "${check.code}" is not satisfied for this entity`, detail: { policyId: check.id, policyCode: check.code } };
      }
    }
    return { satisfied: true };
  }
  const policyIds = criteria.policyIds ?? [];
  if (policyIds.length === 0) return { satisfied: false, reason: `${QUALITY_GATE_CRITERIA_REQUIRES_ACTIVE_POLICY} criteria has no policyIds configured`, detail: {} };
  const { data: policies } = await policiesDB.findByIds(policyIds);
  if (!policies || policies.length !== policyIds.length) return { satisfied: false, reason: "one or more referenced Policies do not exist", detail: { policyIds } };
  for (const policy of policies) {
    if (!evaluateCondition(policy.condition as GoverningCondition, input.context)) {
      return { satisfied: false, reason: `Policy "${policy.code}" is not satisfied for this entity`, detail: { policyId: policy.id, policyCode: policy.code } };
    }
  }
  return { satisfied: true };
}
