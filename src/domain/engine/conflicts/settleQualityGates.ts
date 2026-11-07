import { unravelQualityGates, type QualityGatesUnraveled } from "./unravelQualityGates.js";
import { detectQualityGateConflictsFrom, qualityGateKey } from "./qualityGates.js";
import { openKeys, pickedValues, recordConflicts, leftOutOf, type LeftOut, sameValue, sortedUnion } from "./settleShared.js";
import type { RecordedConflict } from "../../../dblayer/seuTypes.js";
import type { ConflictResolutions, DetectionContext } from "./types.js";

// The quality gates the SEU takes for one Deliverable at one step. The checklists are a union of the checklists of every gate there.
export interface SettledQualityGates {
  // "" for the gates that name no Deliverable.
  deliverable: string;
  step: string;
  gates: Array<Record<string, unknown>>;
  checklistIds: string[];
  recommendedChecklistIds: string[];
}

export interface QualityGatesSettled {
  conflicts: RecordedConflict[];
  result: SettledQualityGates[];
  // What the EBM does not take, and why.
  leftOut: LeftOut[];
}

// Gates with the same fields are one gate. A conflict takes the gates the user picked. A conflict that is still open gives no result. One whose conflict is still open is left out.
export function settleQualityGatesFrom(facts: QualityGatesUnraveled, resolutions: ConflictResolutions = {}): QualityGatesSettled {
  const detected = detectQualityGateConflictsFrom(facts, resolutions);
  const open = openKeys(detected);
  const conflicts = recordConflicts(detected);
  const groups = new Map<string, QualityGatesUnraveled["gates"]>();
  for (const gate of facts.gates) groups.set(qualityGateKey(gate.step, gate.deliverable), [...(groups.get(qualityGateKey(gate.step, gate.deliverable)) ?? []), gate]);

  const result: SettledQualityGates[] = [];
  for (const [key, group] of groups) {
    if (open.has(key)) continue;
    const picked = pickedValues(resolutions[key]);
    const distinct = group.map((g) => g.fields).filter((fields, i, all) => all.findIndex((f) => sameValue(f, fields)) === i);
    result.push({
      deliverable: group[0].deliverable,
      step: group[0].step,
      gates: picked ? distinct.filter((fields) => picked.some((p) => sameValue(p, fields))) : distinct,
      checklistIds: sortedUnion(group.map((g) => g.checklistIds)),
      recommendedChecklistIds: sortedUnion(group.map((g) => g.recommendedChecklistIds)),
    });
  }
  return { conflicts, result, leftOut: leftOutOf(detected) };
}

export async function settleQualityGates(context: DetectionContext, resolutions: ConflictResolutions = {}): Promise<QualityGatesSettled> {
  return settleQualityGatesFrom(unravelQualityGates({ composedPacks: context.composedPacks }), resolutions);
}
