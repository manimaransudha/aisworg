import { unravelObligationDefinitions, type ObligationDefinitionsUnraveled } from "./unravelObligationDefinitions.js";
import { detectObligationDefinitionConflictsFrom, obligationCode, obligationStepKey } from "./obligationDefinitions.js";
import { openKeys, pickedValues, recordConflicts, leftOutOf, type LeftOut, sameValue } from "./settleShared.js";
import type { RecordedConflict } from "../../../dblayer/seuTypes.js";
import type { ConflictResolutions, DetectionContext } from "./types.js";

// The Obligation definitions the SEU takes for one Deliverable at one step.
export interface SettledObligationDefinitions {
  deliverable: string;
  step: string;
  // Each definition, with the Packs that give it.
  definitions: Array<{ fields: Record<string, unknown>; packs: Array<{ id: string; code: string }> }>;
}

export interface ObligationDefinitionsSettled {
  conflicts: RecordedConflict[];
  result: SettledObligationDefinitions[];
  // What the EBM does not take, and why.
  leftOut: LeftOut[];
}

// Definitions with the same fields are one definition, and definitions with different codes are different Obligations. A conflict between definitions of one code takes the definitions the user picked. A conflict that is still open leaves out the definitions of that code.
export function settleObligationDefinitionsFrom(facts: ObligationDefinitionsUnraveled, resolutions: ConflictResolutions = {}): ObligationDefinitionsSettled {
  const detected = detectObligationDefinitionConflictsFrom(facts, resolutions);
  const open = openKeys(detected);
  const conflicts = recordConflicts(detected);
  // The definitions of each Deliverable and step, and within one the definitions of each code. A code whose conflict is still open gives no definitions.
  const steps = new Map<string, { deliverable: string; step: string; byCode: Map<string, ObligationDefinitionsUnraveled["definitions"]> }>();
  for (const definition of facts.definitions) {
    const stepId = `${definition.deliverable}::${definition.step}`;
    const key = obligationStepKey(definition.deliverable, definition.step, obligationCode(definition.fields));
    const entry = steps.get(stepId) ?? { deliverable: definition.deliverable, step: definition.step, byCode: new Map<string, ObligationDefinitionsUnraveled["definitions"]>() };
    entry.byCode.set(key, [...(entry.byCode.get(key) ?? []), definition]);
    steps.set(stepId, entry);
  }

  const result: SettledObligationDefinitions[] = [];
  for (const { deliverable, step, byCode } of steps.values()) {
    const definitions: SettledObligationDefinitions["definitions"] = [];
    for (const [key, group] of byCode) {
      if (open.has(key)) continue;
      const picked = pickedValues(resolutions[key]);
      const distinct = group.map((d) => d.fields).filter((fields, i, all) => all.findIndex((f) => sameValue(f, fields)) === i);
      const taken = picked ? distinct.filter((fields) => picked.some((p) => sameValue(p, fields))) : distinct;
      definitions.push(...taken.map((fields) => ({
        fields,
        packs: group.filter((d) => sameValue(d.fields, fields)).map((d) => ({ id: d.packId, code: d.packCode })).filter((pack, i, all) => all.findIndex((p) => p.id === pack.id) === i),
      })));
    }
    if (definitions.length === 0) continue;
    result.push({ deliverable, step, definitions });
  }
  return { conflicts, result, leftOut: leftOutOf(detected) };
}

export async function settleObligationDefinitions(context: DetectionContext, resolutions: ConflictResolutions = {}): Promise<ObligationDefinitionsSettled> {
  return settleObligationDefinitionsFrom(unravelObligationDefinitions({ composedPacks: context.composedPacks }), resolutions);
}
