import { unravelQualityGatesFor, type QualityGatesUnraveled } from "./unravelQualityGates.js";
import { groupBy } from "./shared.js";
import type { ConflictResolutions, DetectionContext, EbmConflict } from "./types.js";

// Gates with different codes are different items, so a conflict needs the same code at the same step and Deliverable.
export function qualityGateKey(step: string, deliverable: string, code: string): string {
  return `qualityGate::${step}::${deliverable}::${code}`;
}

// Gates with the same code for the same Deliverable at the same step conflict when any field differs. A gate that names no Deliverable is compared with the other such gates at the step.
export function detectQualityGateConflictsFrom(facts: QualityGatesUnraveled, resolutions: ConflictResolutions = {}): EbmConflict[] {
  const conflicts: EbmConflict[] = [];
  for (const [key, group] of groupBy(facts.gates, (g) => qualityGateKey(g.step, g.deliverable, String(g.fields.code ?? "")))) {
    if (new Set(group.map((g) => JSON.stringify(g.fields))).size < 2) continue;
    conflicts.push({
      table: "qualityGates",
      key,
      kind: "quality-gate-different",
      message: `Quality gates differ for ${group[0].deliverable === "" ? "the gates that name no Deliverable" : group[0].deliverable} at ${group[0].step}.`,
      options: group.map((g) => ({ sourceKind: "pack" as const, sourceId: g.packId, sourceLabel: g.packCode, value: g.fields })),
      resolution: resolutions[key] ?? null,
      resolvable: true,
    });
  }
  return conflicts;
}

export async function detectQualityGateConflicts(context: DetectionContext, resolutions: ConflictResolutions = {}): Promise<EbmConflict[]> {
  return detectQualityGateConflictsFrom(await unravelQualityGatesFor({ templates: context.templates, profiles: context.profiles, composedPacks: context.composedPacks }, context.viewerTenantId), resolutions);
}
