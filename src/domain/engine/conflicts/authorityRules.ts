import { unravelAuthorityRules, type AuthorityRulesUnraveled } from "./unravelAuthorityRules.js";
import { groupBy } from "./shared.js";
import type { ConflictResolutions, DetectionContext, EbmConflict } from "./types.js";

export function authorityRuleKey(step: string): string {
  return `authorityRule::${step}`;
}

// Authority rules at the same step conflict when they name different roles, whether they come from two Packs or from a Pack and the platform's definition.
export function detectAuthorityRuleConflictsFrom(facts: AuthorityRulesUnraveled, resolutions: ConflictResolutions = {}): EbmConflict[] {
  const conflicts: EbmConflict[] = [];
  for (const [key, group] of groupBy(facts.rules, (r) => authorityRuleKey(r.step))) {
    if (new Set(group.map((r) => r.roles.join("|"))).size < 2) continue;
    conflicts.push({
      table: "authorityRules",
      key,
      kind: "authority-different-roles",
      message: `The authority rules name different roles for the step ${group[0].step}.`,
      options: group.map((r) => (r.packId === null
        ? { sourceKind: "definition" as const, sourceId: null, sourceLabel: `Platform definition of ${r.step}`, value: r.roles }
        : { sourceKind: "pack" as const, sourceId: r.packId, sourceLabel: r.packCode!, value: r.roles })),
      resolution: resolutions[key] ?? null,
      resolvable: true,
    });
  }
  return conflicts;
}

export async function detectAuthorityRuleConflicts(context: DetectionContext, resolutions: ConflictResolutions = {}): Promise<EbmConflict[]> {
  return detectAuthorityRuleConflictsFrom(await unravelAuthorityRules({ composedPacks: context.composedPacks }), resolutions);
}
