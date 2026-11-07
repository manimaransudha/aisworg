import { unravelPolicies, type PoliciesUnraveled, type PolicyRule } from "./unravelPolicies.js";
import { groupBy } from "./shared.js";
import type { ConflictResolutions, DetectionContext, EbmConflict } from "./types.js";

export function policyCodeKey(code: string, deliverable: string, step: string, field: string): string {
  return `policy::${code}::${deliverable}::${step}::${field}`;
}

export function policyStepKey(deliverable: string, step: string): string {
  return `policyStep::${deliverable}::${step}`;
}

// Two Policies with the same code: conditions that test the same field for the same Deliverable at the same step conflict when the operator or value differ.
function sameCodeConflicts(rules: PolicyRule[], resolutions: ConflictResolutions): EbmConflict[] {
  const conflicts: EbmConflict[] = [];
  for (const [key, group] of groupBy(rules.filter((r) => r.field !== null), (r) => policyCodeKey(r.policyCode, r.deliverable, r.step, r.field!))) {
    if (new Set(group.map((r) => r.rule)).size < 2) continue;
    conflicts.push({
      table: "policies",
      key,
      kind: "policy-same-code",
      message: `Policy ${group[0].policyCode} tests "${group[0].field}" for ${group[0].deliverable} at ${group[0].step} with different rules.`,
      options: group.map((r) => ({ sourceKind: "pack", sourceId: r.packId, sourceLabel: r.packCode, value: JSON.parse(r.rule!) })),
      resolution: resolutions[key] ?? null,
      resolvable: true,
    });
  }
  return conflicts;
}

// Two Policies with different codes that apply different rules to the same Deliverable at the same step.
function acrossCodeConflicts(rules: PolicyRule[], resolutions: ConflictResolutions): EbmConflict[] {
  const conflicts: EbmConflict[] = [];
  for (const [key, group] of groupBy(rules.filter((r) => r.field !== null), (r) => policyStepKey(r.deliverable, r.step))) {
    const byCode = groupBy(group, (r) => r.policyCode);
    if (byCode.size < 2 || new Set(group.map((r) => `${r.field}|${r.rule}`)).size < 2) continue;
    conflicts.push({
      table: "policies",
      key,
      kind: "policy-across-codes",
      message: `${byCode.size} Policies apply different rules to ${group[0].deliverable} at ${group[0].step}.`,
      options: [...byCode.values()].map((list) => ({ sourceKind: "pack" as const, sourceId: list[0].packId, sourceLabel: `${list[0].policyCode} (${list[0].packCode})`, value: { policyCode: list[0].policyCode, rules: [...new Set(list.map((r) => r.rule))].map((r) => JSON.parse(r!)) } })),
      resolution: resolutions[key] ?? null,
      resolvable: true,
    });
  }
  return conflicts;
}

// A condition that has only a statement is verified by a person. It is never compared and is shown as a notice.
function humanVerifiedNotices(rules: PolicyRule[]): EbmConflict[] {
  const notices: EbmConflict[] = [];
  for (const [step, group] of groupBy(rules.filter((r) => r.field === null), (r) => policyStepKey(r.deliverable, r.step))) {
    notices.push({
      table: "policies",
      key: `humanVerified::${step}`,
      kind: "policy-human-verified",
      message: `These Policies for ${group[0].deliverable} at ${group[0].step} are verified by a person and have no machine rule.`,
      options: group.map((r) => ({ sourceKind: "pack" as const, sourceId: r.packId, sourceLabel: `${r.policyCode} (${r.packCode})`, value: r.statement })),
      resolution: null,
      resolvable: false,
      notice: true,
    });
  }
  return notices;
}

// The part of the Policies detector that works on gathered rules, so it can be tested without a database.
export function detectPolicyConflictsFrom(facts: PoliciesUnraveled, resolutions: ConflictResolutions = {}): EbmConflict[] {
  return [...sameCodeConflicts(facts.rules, resolutions), ...acrossCodeConflicts(facts.rules, resolutions), ...humanVerifiedNotices(facts.rules)];
}

export async function detectPolicyConflicts(context: DetectionContext, resolutions: ConflictResolutions = {}): Promise<EbmConflict[]> {
  const facts = await unravelPolicies({ composedPacks: context.composedPacks }, context.viewerTenantId);
  return detectPolicyConflictsFrom(facts, resolutions);
}
