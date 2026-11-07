import { seusDB } from "../../dblayer/seusDB.js";
import { ebmsDB } from "../../dblayer/ebmsDB.js";

// What the SEU reads off its active EBM: the settled result the user's picks led to. Nothing reads the EBM's pool.
export interface EbmSettledView {
  profileConfiguration?: { result?: Array<{ parameter: string; value: unknown }> };
  competencies?: { result?: Array<{ dimension: string; value: string }> };
  checklists?: { result?: Array<{ pack: string; checklist: string; items: Array<{ statement: string }> }> };
  engineeringCapital?: { result?: Array<{ type: string; url: string | null; packs: string[] }> };
  obligationDefinitions?: { result?: Array<{ deliverable: string; step: string; definitions: Array<{ fields: Record<string, unknown>; packs: Array<{ id: string; code: string }> }> }> };
  services?: { result?: Array<{ deliverable: string; name: string | null; service: string }> };
  policies?: { result?: Array<{ policyCode: string; scope: string; governingCondition: Record<string, unknown> | null }> };
}

// The settled result of the SEU's active EBM, or null when the SEU has no active EBM.
export async function loadSettled(seuId: string): Promise<EbmSettledView | null> {
  const { data: seu } = await seusDB.findById(seuId);
  if (!seu?.active_ebm_id) return null;
  const { data: ebm } = await ebmsDB.findById(seu.active_ebm_id);
  return settledOf(ebm?.behaviors);
}

export function settledOf(behaviors: unknown): EbmSettledView | null {
  const settled = (behaviors as { settled?: EbmSettledView } | null)?.settled;
  if (!settled) throw new Error("the EBM records no settled result; recompose it");
  return settled;
}

// A configuration parameter of the Profile, or undefined when the Profile does not set it.
export function configurationParameter(settled: EbmSettledView | null, parameter: string): unknown {
  return settled?.profileConfiguration?.result?.find((r) => r.parameter === parameter)?.value;
}

// The competencies the SEU requires, by dimension.
export function competencyRequirementsOf(settled: EbmSettledView | null): Record<string, string[]> {
  const required: Record<string, string[]> = {};
  for (const { dimension, value } of settled?.competencies?.result ?? []) (required[dimension] ??= []).push(value);
  return required;
}

// A Policy that a Participant has to satisfy to be eligible, with the condition to evaluate against the Participant's behaviour context.
export interface EligibilityPolicy {
  code: string;
  condition: Record<string, unknown>;
}

// The eligibility Policies the SEU takes, one for each Policy code and condition.
export function eligibilityPoliciesOf(settled: EbmSettledView | null): EligibilityPolicy[] {
  const found = new Map<string, EligibilityPolicy>();
  for (const policy of settled?.policies?.result ?? []) {
    if (policy.scope !== "Eligibility") continue;
    const condition = policy.governingCondition ?? { type: "always_true" };
    found.set(JSON.stringify([policy.policyCode, condition]), { code: policy.policyCode, condition });
  }
  return [...found.values()];
}
