import { unravelEngineeringCapital, type EngineeringCapitalUnraveled } from "./unravelEngineeringCapital.js";
import { groupBy } from "./shared.js";
import type { ConflictResolutions, DetectionContext, EbmConflict } from "./types.js";

export function engineeringCapitalKey(type: string): string {
  return `engineeringCapital::${type}`;
}

export function engineeringCapitalMissingLinkKey(packCode: string, type: string): string {
  return `engineeringCapitalMissingLink::${packCode}::${type}`;
}

// An entry with no link is a conflict. Entries of the same type with different links are a conflict. The same link from several Packs is not.
export function detectEngineeringCapitalConflictsFrom(facts: EngineeringCapitalUnraveled, resolutions: ConflictResolutions = {}): EbmConflict[] {
  const conflicts: EbmConflict[] = [];

  for (const [key, group] of groupBy(facts.entries.filter((e) => e.url === ""), (e) => engineeringCapitalMissingLinkKey(e.packCode, e.type))) {
    conflicts.push({
      table: "engineeringCapital",
      key,
      kind: "engineering-capital-missing-link",
      message: `Pack ${group[0].packCode} gives an entry of type "${group[0].type}" with no link.`,
      options: [{ sourceKind: "pack", sourceId: group[0].packId, sourceLabel: group[0].packCode, value: { type: group[0].type, url: null } }],
      resolution: resolutions[key] ?? null,
      resolvable: true,
    });
  }

  for (const [type, group] of groupBy(facts.entries.filter((e) => e.url !== ""), (e) => e.type)) {
    if (new Set(group.map((e) => e.url)).size < 2) continue;
    const key = engineeringCapitalKey(type);
    conflicts.push({
      table: "engineeringCapital",
      key,
      kind: "engineering-capital-different-links",
      message: `The Packs give different links for "${type}".`,
      options: group.map((e) => ({ sourceKind: "pack" as const, sourceId: e.packId, sourceLabel: e.packCode, value: { type, url: e.url } })),
      resolution: resolutions[key] ?? null,
      resolvable: true,
    });
  }
  return conflicts;
}

export async function detectEngineeringCapitalConflicts(context: DetectionContext, resolutions: ConflictResolutions = {}): Promise<EbmConflict[]> {
  return detectEngineeringCapitalConflictsFrom(unravelEngineeringCapital({ composedPacks: context.composedPacks }), resolutions);
}
