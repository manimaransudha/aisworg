import { unravelObligationDefinitions, type ObligationDefinitionsUnraveled } from "./unravelObligationDefinitions.js";
import { detectObligationDefinitionConflictsFrom, obligationStepKey } from "./obligationDefinitions.js";
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

// Definitions with the same fields are one definition. A conflict takes the definitions the user picked. A conflict that is still open gives no result. One whose conflict is still open is left out.
export function settleObligationDefinitionsFrom(facts: ObligationDefinitionsUnraveled, resolutions: ConflictResolutions = {}): ObligationDefinitionsSettled {
  const detected = detectObligationDefinitionConflictsFrom(facts, resolutions);
  const open = openKeys(detected);
  const conflicts = recordConflicts(detected);
  const groups = new Map<string, ObligationDefinitionsUnraveled["definitions"]>();
  for (const definition of facts.definitions) groups.set(obligationStepKey(definition.deliverable, definition.step), [...(groups.get(obligationStepKey(definition.deliverable, definition.step)) ?? []), definition]);

  const result: SettledObligationDefinitions[] = [];
  for (const [key, group] of groups) {
    if (open.has(key)) continue;
    const picked = pickedValues(resolutions[key]);
    const distinct = group.map((d) => d.fields).filter((fields, i, all) => all.findIndex((f) => sameValue(f, fields)) === i);
    const taken = picked ? distinct.filter((fields) => picked.some((p) => sameValue(p, fields))) : distinct;
    const definitions = taken.map((fields) => ({
      fields,
      packs: group.filter((d) => sameValue(d.fields, fields)).map((d) => ({ id: d.packId, code: d.packCode })).filter((pack, i, all) => all.findIndex((p) => p.id === pack.id) === i),
    }));
    result.push({ deliverable: group[0].deliverable, step: group[0].step, definitions });
  }
  return { conflicts, result, leftOut: leftOutOf(detected) };
}

export async function settleObligationDefinitions(context: DetectionContext, resolutions: ConflictResolutions = {}): Promise<ObligationDefinitionsSettled> {
  return settleObligationDefinitionsFrom(unravelObligationDefinitions({ composedPacks: context.composedPacks }), resolutions);
}
