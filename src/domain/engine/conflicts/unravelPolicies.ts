import { policyDefinitionsDB } from "../../../dblayer/policyDefinitionsDB.js";
// Commented out (owner): composition does not read the materialised `policies` rows.
// import { policiesDB } from "../../../dblayer/policiesDB.js";
import { catalogueFor, resolveDeliverableSource } from "../deliverableSource.js";
import { governedTransitionsFor } from "../policyChecks.js";
import { POLICY_SCOPE_ELIGIBILITY } from "../../../dblayer/constants.js";
import type { ComposedPacks } from "./composedPacks.js";
import type { ProfileRow, TemplateRow } from "../../../dblayer/seuTypes.js";

// What one condition of a Policy says about one Deliverable at one step.
export interface PolicyRule {
  policyCode: string;
  // The Policy Definition the rule was read from.
  policyDefinitionId: string;
  packId: string;
  packCode: string;
  // Commented out (owner): the EBM keeps Policy Definition ids and does not read the `policies` rows.
  // policyRowId: string | null;
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

// Gathers the rules of the Policies that the composed Packs list. A rule for a Deliverable is kept only when that Deliverable is in the Deliverable Catalogue of the Profile or Template. An Eligibility Policy names no Deliverable and is always kept.
export async function unravelPolicies(input: { templates: TemplateRow[]; profiles: ProfileRow[]; composedPacks: ComposedPacks }, viewerTenantId: string): Promise<PoliciesUnraveled> {
  const deliverableCodes = new Set<string>();
  for (const profile of input.profiles) {
    const template = input.templates.find((t) => t.id === profile.base_template_id);
    if (!template) continue;
    const source = await resolveDeliverableSource(template, profile);
    for (const entry of catalogueFor(template, profile, source)) deliverableCodes.add(entry.code);
  }

  const codes = [...new Set(input.composedPacks.packs.flatMap((pack) => pack.contributions?.policies ?? []))];
  const { data: definitions } = codes.length > 0 ? await policyDefinitionsDB.findActiveByCodesVisibleTo(codes, viewerTenantId) : { data: [] };
  const definitionByCode = new Map((definitions ?? []).map((d) => [d.code, d]));

  // Commented out (owner): composition does not read the materialised `policies` rows, and the EBM keeps the Policy Definition ids.
  // const { data: policyRows, error: policyRowsError } = await policiesDB.findByPackIds(input.composedPacks.packs.map((pack) => pack.id));
  // if (policyRowsError) throw policyRowsError;
  // const policyRowId = new Map((policyRows ?? []).map((r) => [`${r.originating_pack_id}::${r.code}`, r.id]));

  const rules: PolicyRule[] = [];
  for (const pack of input.composedPacks.packs) {
    for (const code of pack.contributions?.policies ?? []) {
      const definition = definitionByCode.get(code);
      if (!definition) continue;
      const scope = definition.scope ?? "Transition";
      const conditions = definition.conditions ?? [];
      for (const [conditionIndex, condition] of conditions.entries()) {
        const governedRows = governedTransitionsFor(scope, condition.applicabilityDeliverables ?? []);
        const fansOut = conditions.length > 1 || governedRows.length > 1;
        // The governed steps and Deliverables are read as the Pack install and the transition engine read them (governedTransitionsFor).
        for (const governed of governedRows) {
          // const rowId = policyRowId.get(`${pack.id}::${materializedPolicyCode(code, conditionIndex, fansOut, governed)}`) ?? null;
          const governing = governed.governingCondition;
          const field = governing && typeof governing.field === "string" && governing.type !== "always_true" ? governing.field : null;
          const operator = governing?.type === "field_in" ? "in" : String(governing?.operator ?? "");
          const value = governing?.type === "field_in" ? governing.values : governing?.value;
          // A rule with no Deliverable covers every Deliverable of the Deliverable Catalogue. A named Deliverable is kept only when it is in the Catalogue. An Eligibility Policy names no Deliverable of the Catalogue and keeps its name. A rule for a step of the SEU itself ("SEU|from|to") governs the SEU and is kept once, with no Deliverable.
          const deliverables = scope === POLICY_SCOPE_ELIGIBILITY ? (governed.deliverableNames.length ? governed.deliverableNames : [""]) : governed.governedTransition?.startsWith("SEU|") ? [""] : governed.deliverableNames.length ? governed.deliverableNames.filter((n) => deliverableCodes.has(n)) : [...deliverableCodes].sort();
          for (const deliverable of deliverables) {
            rules.push({ policyCode: code, policyDefinitionId: definition.id, packId: pack.id, packCode: pack.code, deliverable, step: governed.governedTransition ?? "", field, rule: field ? JSON.stringify({ operator, value }) : null, statement: condition.statement, scope, governingCondition: governing });
          }
        }
      }
    }
  }
  return { rules };
}
