import { unravelReviewGates, type ReviewGatesUnraveled } from "./unravelReviewGates.js";
import { detectReviewGateConflictsFrom, reviewGateKey } from "./reviewGates.js";
import { openKeys, pickedValues, recordConflicts, leftOutOf, type LeftOut, sameValue, sortedUnion } from "./settleShared.js";
import type { RecordedConflict } from "../../../dblayer/seuTypes.js";
import type { ConflictResolutions, DetectionContext } from "./types.js";

// The review gates the SEU takes at one step, for every Deliverable. The checklists are a union of the checklists of every gate there.
export interface SettledReviewGates {
  step: string;
  gates: Array<Record<string, unknown>>;
  checklistIds: string[];
  recommendedChecklistIds: string[];
}

export interface ReviewGatesSettled {
  conflicts: RecordedConflict[];
  result: SettledReviewGates[];
  // What the EBM does not take, and why.
  leftOut: LeftOut[];
}

// Gates with the same fields are one gate. A conflict takes the gates the user picked. A conflict that is still open gives no result. One whose conflict is still open is left out.
export function settleReviewGatesFrom(facts: ReviewGatesUnraveled, resolutions: ConflictResolutions = {}): ReviewGatesSettled {
  const detected = detectReviewGateConflictsFrom(facts, resolutions);
  const open = openKeys(detected);
  const conflicts = recordConflicts(detected);
  const groups = new Map<string, ReviewGatesUnraveled["gates"]>();
  for (const gate of facts.gates) groups.set(reviewGateKey(gate.step), [...(groups.get(reviewGateKey(gate.step)) ?? []), gate]);

  const result: SettledReviewGates[] = [];
  for (const [key, group] of groups) {
    if (open.has(key)) continue;
    const picked = pickedValues(resolutions[key]);
    const distinct = group.map((g) => g.fields).filter((fields, i, all) => all.findIndex((f) => sameValue(f, fields)) === i);
    result.push({
      step: group[0].step,
      gates: picked ? distinct.filter((fields) => picked.some((p) => sameValue(p, fields))) : distinct,
      checklistIds: sortedUnion(group.map((g) => g.checklistIds)),
      recommendedChecklistIds: sortedUnion(group.map((g) => g.recommendedChecklistIds)),
    });
  }
  return { conflicts, result, leftOut: leftOutOf(detected) };
}

export async function settleReviewGates(context: DetectionContext, resolutions: ConflictResolutions = {}): Promise<ReviewGatesSettled> {
  return settleReviewGatesFrom(unravelReviewGates({ composedPacks: context.composedPacks }), resolutions);
}
