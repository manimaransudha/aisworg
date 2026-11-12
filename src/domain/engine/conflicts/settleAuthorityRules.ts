import { unravelAuthorityRules, type AuthorityRulesUnraveled } from "./unravelAuthorityRules.js";
import { authorityRuleKey, detectAuthorityRuleConflictsFrom } from "./authorityRules.js";
import { openKeys, pickedValues, recordConflicts, leftOutOf, type LeftOut, sameValue, sortedUnion } from "./settleShared.js";
import type { RecordedConflict } from "../../../dblayer/seuTypes.js";
import type { ConflictResolutions, DetectionContext } from "./types.js";

// The roles that may move something through a step, for the SEU.
export interface SettledAuthorityRule {
  step: string;
  roles: string[];
  // The Packs that name these roles. The platform's own definition of the step is not a Pack.
  packs: string[];
}

export interface AuthorityRulesSettled {
  conflicts: RecordedConflict[];
  result: SettledAuthorityRule[];
  // What the EBM does not take, and why.
  leftOut: LeftOut[];
}

// A step with no conflict takes the roles its sources agree on. A step with a conflict takes the roles of the sets the user picked, together. A step whose conflict is still open is left out.
export function settleAuthorityRulesFrom(facts: AuthorityRulesUnraveled, resolutions: ConflictResolutions = {}): AuthorityRulesSettled {
  const detected = detectAuthorityRuleConflictsFrom(facts, resolutions);
  const open = openKeys(detected);
  const conflicts = recordConflicts(detected);
  const steps = [...new Set(facts.rules.map((r) => r.step))].filter((step) => !open.has(authorityRuleKey(step)));
  const result = steps.map((step) => {
    const picked = pickedValues(resolutions[authorityRuleKey(step)]);
    const taken = facts.rules.filter((r) => r.step === step && (!picked || picked.some((p) => sameValue(p, r.roles))));
    const roleSets = picked ? (picked as string[][]) : taken.map((r) => r.roles);
    const packs = [...new Set(taken.map((r) => r.packCode).filter((code): code is string => code !== null))].sort();
    return { step, roles: sortedUnion(roleSets), packs };
  });
  return { conflicts, result, leftOut: leftOutOf(detected) };
}

export async function settleAuthorityRules(context: DetectionContext, resolutions: ConflictResolutions = {}): Promise<AuthorityRulesSettled> {
  return settleAuthorityRulesFrom(await unravelAuthorityRules({ composedPacks: context.composedPacks }), resolutions);
}
