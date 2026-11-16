import { policiesDB } from "../../dblayer/policiesDB.js";
import { policyDefinitionsDB } from "../../dblayer/policyDefinitionsDB.js";
import type { ConstraintType, PolicyCondition, PolicyDefinitionRow, PolicyScope } from "../../dblayer/seuTypes.js";

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

// The code of the `policies` row that Pack activation writes for one condition and one governed transition of a Policy Definition. A Policy that has one condition and one
// governed transition keeps its own code. Any other Policy fans out into one row for each condition and governed transition.
export function materializedPolicyCode(policyCode: string, conditionIndex: number, fansOut: boolean, row: { governedTransition: string | null; deliverableNames: string[] }): string {
  return fansOut ? [policyCode, conditionIndex, row.governedTransition ?? "none", row.deliverableNames[0] ?? ""].join(MATERIALISED_CODE_SEPARATOR) : policyCode;
}

// The checks of one hop (of every hop when `hop` is null), read from Policy Definitions: one check for each condition and governed transition of a Definition that governs the hop. `deliverableCode` is the code of
// the Deliverable under evaluation, null for a Deliverable with no code, and undefined when the entity is not a Deliverable. A condition that names a Deliverable applies to that Deliverable only.
// The check carries the code a materialised row would have, so the condition it came from can be found again from the code.
export function policyChecksFromDefinitions(definitions: PolicyDefinitionRow[], hop: string | null, deliverableCode: string | null | undefined): PolicyCheck[] {
  const checks: PolicyCheck[] = [];
  for (const definition of definitions) {
    const scope: PolicyScope = definition.scope ?? "Transition";
    const conditions = definition.conditions ?? [];
    for (const [conditionIndex, condition] of conditions.entries()) {
      const rows = governedTransitionsFor(scope, condition.applicabilityDeliverables ?? []);
      const fansOut = conditions.length > 1 || rows.length > 1;
      for (const row of rows) {
        if (hop !== null && row.governedTransition !== hop) continue;
        if (deliverableCode !== undefined && row.deliverableNames.length > 0 && !(deliverableCode && row.deliverableNames.includes(deliverableCode))) continue;
        checks.push({ id: definition.id, code: materializedPolicyCode(definition.code, conditionIndex, fansOut, row), constraint_type: definition.constraint_type, condition: row.governingCondition ?? { type: "always_true" } });
      }
    }
  }
  return checks;
}

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
