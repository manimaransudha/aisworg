import { policiesDB } from "../../dblayer/policiesDB.js";
import { policyDefinitionsDB } from "../../dblayer/policyDefinitionsDB.js";
import type { ConstraintType, PolicyCondition, PolicyScope } from "../../dblayer/seuTypes.js";

// Which governed transitions a Policy Definition condition materialises into (CR-128). The Pack install and the transition engine both use it.
export function governedTransitionsFor(scope: PolicyScope, applicabilityDeliverables: PolicyCondition["applicabilityDeliverables"]): Array<{ governedTransition: string | null; deliverableNames: string[]; governingCondition: Record<string, unknown> | null }> {
  if (scope === "Eligibility") {
    if (!applicabilityDeliverables.length) return [{ governedTransition: null, deliverableNames: [], governingCondition: null }];
    return applicabilityDeliverables.map((row) => ({ governedTransition: null, deliverableNames: [row.name], governingCondition: row.governingCondition }));
  }
  if (!applicabilityDeliverables.length) return [{ governedTransition: "Deliverable|Approved|Baselined", deliverableNames: [], governingCondition: null }];
  // A row with an empty name applies to every Deliverable.
  return applicabilityDeliverables.flatMap((row) => {
    const deliverableNames = row.name ? [row.name] : [];
    return row.transitions.length
      ? row.transitions.map((t) => ({ governedTransition: t, deliverableNames, governingCondition: row.governingCondition }))
      : [{ governedTransition: "Deliverable|Approved|Baselined", deliverableNames, governingCondition: row.governingCondition }];
  });
}

// One Policy as the engine checks it, read from a materialised `policies` row or from a Policy Definition.
export interface PolicyCheck {
  id: string;
  code: string;
  constraint_type: ConstraintType;
  condition: Record<string, unknown>;
}

const MATERIALISED_CODE_SEPARATOR = "::";

// A transition row lists ids from either table. A definition id counts only when no materialised row of the same code is listed,
// and only for the conditions that govern this hop. A definition with no condition for the hop contributes no check.
export async function loadPolicyChecks(ids: string[], hop: string): Promise<PolicyCheck[]> {
  const { data: policies, error } = await policiesDB.findByIds(ids);
  if (error) throw error;
  const materialised = policies ?? [];
  const checks: PolicyCheck[] = materialised.map((p) => ({ id: p.id, code: p.code, constraint_type: p.constraint_type, condition: p.condition }));
  const foundIds = new Set(materialised.map((p) => p.id));
  const materialisedCodes = new Set(materialised.map((p) => p.code.split(MATERIALISED_CODE_SEPARATOR)[0]));
  const definitionIds = ids.filter((id) => !foundIds.has(id));
  if (definitionIds.length === 0) return checks;
  const { data: definitions, error: definitionError } = await policyDefinitionsDB.findByIds(definitionIds);
  if (definitionError) throw definitionError;
  for (const definition of definitions ?? []) {
    if (materialisedCodes.has(definition.code)) continue;
    const scope: PolicyScope = definition.scope ?? "Transition";
    for (const condition of definition.conditions ?? []) {
      for (const row of governedTransitionsFor(scope, condition.applicabilityDeliverables ?? [])) {
        if (row.governedTransition !== hop) continue;
        checks.push({ id: definition.id, code: definition.code, constraint_type: definition.constraint_type, condition: row.governingCondition ?? { type: "always_true" } });
      }
    }
  }
  return checks;
}
