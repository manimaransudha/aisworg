import { policyDefinitionsDB } from "../../../dblayer/policyDefinitionsDB.js";
import type { ComposedPacks } from "./composedPacks.js";

// What one condition of a Policy says about one Deliverable at one step.
export interface PolicyRule {
  policyCode: string;
  packId: string;
  packCode: string;
  deliverable: string;
  // The step, as "Entity|from|to".
  step: string;
  // The field the condition tests, or null when the condition has only a statement.
  field: string | null;
  // The operator and value the condition applies to the field, as one JSON text, or null when the condition has only a statement.
  rule: string | null;
  statement: string;
  // Whether the Policy governs a transition or the eligibility of a Participant.
  scope: string;
  // The governing condition of the rule, as authored, or null.
  governingCondition: Record<string, unknown> | null;
}

export interface PoliciesUnraveled {
  rules: PolicyRule[];
}

// Gathers the rules of the Policies that the composed Packs list. It decides nothing.
export async function unravelPolicies(input: { composedPacks: ComposedPacks }, viewerTenantId: string): Promise<PoliciesUnraveled> {
  const codes = [...new Set(input.composedPacks.packs.flatMap((pack) => pack.contributions?.policies ?? []))];
  const { data: definitions } = codes.length > 0 ? await policyDefinitionsDB.findActiveByCodesVisibleTo(codes, viewerTenantId) : { data: [] };
  const definitionByCode = new Map((definitions ?? []).map((d) => [d.code, d]));

  const rules: PolicyRule[] = [];
  for (const pack of input.composedPacks.packs) {
    for (const code of pack.contributions?.policies ?? []) {
      const definition = definitionByCode.get(code);
      if (!definition) continue;
      for (const condition of definition.conditions ?? []) {
        for (const applicability of condition.applicabilityDeliverables ?? []) {
          const governing = applicability.governingCondition;
          const field = governing && typeof governing.field === "string" && governing.type !== "always_true" ? governing.field : null;
          const operator = governing?.type === "field_in" ? "in" : String(governing?.operator ?? "");
          const value = governing?.type === "field_in" ? governing.values : governing?.value;
          // An eligibility Policy names no transition, so it has one rule with no step.
          for (const step of applicability.transitions?.length ? applicability.transitions : [""]) {
            rules.push({ policyCode: code, packId: pack.id, packCode: pack.code, deliverable: applicability.name, step, field, rule: field ? JSON.stringify({ operator, value }) : null, statement: condition.statement, scope: definition.scope ?? "Transition", governingCondition: governing ?? null });
          }
        }
      }
    }
  }
  return { rules };
}
