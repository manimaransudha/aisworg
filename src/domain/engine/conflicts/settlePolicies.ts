import { unravelPolicies, type PoliciesUnraveled, type PolicyRule } from "./unravelPolicies.js";
import { detectPolicyConflictsFrom, policyCodeKey, policyStepKey } from "./policies.js";
import { openKeys, pickedValues, recordConflicts, leftOutOf, type LeftOut } from "./settleShared.js";
import type { RecordedConflict } from "../../../dblayer/seuTypes.js";
import type { ConflictResolutions, DetectionContext } from "./types.js";

// A rule of a Policy the SEU takes, for one Deliverable at one step, with the Packs that give it.
export interface SettledPolicyRule {
  policyCode: string;
  deliverable: string;
  step: string;
  // The field the rule tests, or null for a condition with only a statement, which a person verifies.
  field: string | null;
  rule: { operator: string; value: unknown } | null;
  statement: string;
  // Whether the Policy governs a transition or the eligibility of a Participant.
  scope: string;
  // The governing condition as authored, which an eligibility check evaluates against a Participant.
  governingCondition: Record<string, unknown> | null;
  packs: string[];
}

export interface PoliciesSettled {
  conflicts: RecordedConflict[];
  result: SettledPolicyRule[];
  // What the EBM does not take, and why.
  leftOut: LeftOut[];
}

// A pick on a conflict between rules of one Policy keeps the picked rule. A pick between Policies keeps the rules of the picked Policies.
// A rule in a conflict that is still open is left out. The conditions that only have a statement are all kept. Identical rules from several Packs are one rule.
export function settlePoliciesFrom(facts: PoliciesUnraveled, resolutions: ConflictResolutions = {}): PoliciesSettled {
  const detected = detectPolicyConflictsFrom(facts, resolutions);
  const open = openKeys(detected);
  const conflicts = recordConflicts(detected);

  const kept = facts.rules.filter((r: PolicyRule) => {
    if (r.field === null) return true;
    if (open.has(policyCodeKey(r.policyCode, r.deliverable, r.step, r.field)) || open.has(policyStepKey(r.deliverable, r.step))) return false;
    const samePick = resolutions[policyCodeKey(r.policyCode, r.deliverable, r.step, r.field)];
    if (samePick !== undefined && JSON.stringify(samePick) !== r.rule) return false;
    const acrossPick = pickedValues(resolutions[policyStepKey(r.deliverable, r.step)]);
    if (acrossPick !== null && !acrossPick.some((v) => (v as { policyCode?: string })?.policyCode === r.policyCode)) return false;
    return true;
  });

  const merged = new Map<string, SettledPolicyRule>();
  for (const r of kept) {
    const id = JSON.stringify([r.policyCode, r.deliverable, r.step, r.field, r.rule, r.statement, r.scope]);
    const existing = merged.get(id);
    if (existing) { if (!existing.packs.includes(r.packCode)) existing.packs.push(r.packCode); continue; }
    merged.set(id, { policyCode: r.policyCode, deliverable: r.deliverable, step: r.step, field: r.field, rule: r.rule ? JSON.parse(r.rule) : null, statement: r.statement, scope: r.scope, governingCondition: r.governingCondition, packs: [r.packCode] });
  }
  return { conflicts, result: [...merged.values()], leftOut: leftOutOf(detected) };
}

export async function settlePolicies(context: DetectionContext, resolutions: ConflictResolutions = {}): Promise<PoliciesSettled> {
  return settlePoliciesFrom(await unravelPolicies({ composedPacks: context.composedPacks }, context.viewerTenantId), resolutions);
}
