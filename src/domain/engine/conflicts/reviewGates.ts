import { unravelReviewGates, type ReviewGatesUnraveled } from "./unravelReviewGates.js";
import { groupBy } from "./shared.js";
import type { ConflictResolutions, DetectionContext, EbmConflict } from "./types.js";

export function reviewGateKey(step: string): string {
  return `reviewGate::${step}`;
}

// Review gates at the same step conflict when any field differs. The checklists are a union and are not compared.
export function detectReviewGateConflictsFrom(facts: ReviewGatesUnraveled, resolutions: ConflictResolutions = {}): EbmConflict[] {
  const conflicts: EbmConflict[] = [];
  for (const [key, group] of groupBy(facts.gates, (g) => reviewGateKey(g.step))) {
    if (new Set(group.map((g) => JSON.stringify(g.fields))).size < 2) continue;
    conflicts.push({
      table: "reviewGates",
      key,
      kind: "review-gate-different-rules",
      message: `Review gates differ at ${group[0].step}.`,
      options: group.map((g) => ({ sourceKind: "pack" as const, sourceId: g.packId, sourceLabel: g.packCode, value: g.fields })),
      resolution: resolutions[key] ?? null,
      resolvable: true,
    });
  }
  return conflicts;
}

export async function detectReviewGateConflicts(context: DetectionContext, resolutions: ConflictResolutions = {}): Promise<EbmConflict[]> {
  return detectReviewGateConflictsFrom(unravelReviewGates({ composedPacks: context.composedPacks }), resolutions);
}
