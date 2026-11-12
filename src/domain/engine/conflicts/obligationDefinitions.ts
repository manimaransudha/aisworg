import { unravelObligationDefinitions, type ObligationDefinitionsUnraveled } from "./unravelObligationDefinitions.js";
import { groupBy } from "./shared.js";
import type { ConflictResolutions, DetectionContext, EbmConflict } from "./types.js";

// The code of an Obligation definition. Definitions with different codes are different Obligations.
export function obligationCode(fields: Record<string, unknown>): string {
  return typeof fields.code === "string" ? fields.code : "";
}

export function obligationStepKey(deliverable: string, step: string, code: string): string {
  return `obligationStep::${deliverable}::${step}::${code}`;
}

// Obligation definitions with the same code that apply to the same Deliverable at the same step conflict when any other field differs. Definitions with different codes are different Obligations, so they do not conflict.
export function detectObligationDefinitionConflictsFrom(facts: ObligationDefinitionsUnraveled, resolutions: ConflictResolutions = {}): EbmConflict[] {
  const conflicts: EbmConflict[] = [];
  for (const [key, group] of groupBy(facts.definitions, (d) => obligationStepKey(d.deliverable, d.step, obligationCode(d.fields)))) {
    if (new Set(group.map((d) => JSON.stringify(d.fields))).size < 2) continue;
    conflicts.push({
      table: "obligationDefinitions",
      key,
      kind: "obligation-different",
      message: `Obligation definitions with the code "${obligationCode(group[0].fields)}" differ for ${group[0].deliverable} at ${group[0].step}.`,
      options: group.map((d) => ({ sourceKind: "pack" as const, sourceId: d.packId, sourceLabel: d.packCode, value: d.fields })),
      resolution: resolutions[key] ?? null,
      resolvable: true,
    });
  }
  return conflicts;
}

export async function detectObligationDefinitionConflicts(context: DetectionContext, resolutions: ConflictResolutions = {}): Promise<EbmConflict[]> {
  return detectObligationDefinitionConflictsFrom(unravelObligationDefinitions({ composedPacks: context.composedPacks }), resolutions);
}
