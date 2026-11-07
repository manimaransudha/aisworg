import { unravelAuthorityRules, type AuthorityRulesUnraveled } from "./unravelAuthorityRules.js";
import { authorityRuleKey, detectAuthorityRuleConflictsFrom } from "./authorityRules.js";
import { openKeys, pickedValues, recordConflicts, leftOutOf, type LeftOut, sortedUnion } from "./settleShared.js";
import type { RecordedConflict } from "../../../dblayer/seuTypes.js";
import type { ConflictResolutions, DetectionContext } from "./types.js";

// The roles that may move something through a step, for the SEU.
export interface SettledAuthorityRule {
  step: string;
  roles: string[];
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
    const roleSets = picked ? (picked as string[][]) : facts.rules.filter((r) => r.step === step).map((r) => r.roles);
    return { step, roles: sortedUnion(roleSets) };
  });
  return { conflicts, result, leftOut: leftOutOf(detected) };
}

export async function settleAuthorityRules(context: DetectionContext, resolutions: ConflictResolutions = {}): Promise<AuthorityRulesSettled> {
  return settleAuthorityRulesFrom(await unravelAuthorityRules({ composedPacks: context.composedPacks }), resolutions);
}
