import { unravelReviewGates, type ReviewGatesUnraveled } from "./unravelReviewGates.js";
import { detectReviewGateConflictsFrom, reviewGateCode, reviewGateKey } from "./reviewGates.js";
import { openKeys, pickedValues, recordConflicts, leftOutOf, type LeftOut, sameValue, sortedUnion } from "./settleShared.js";
import type { RecordedConflict } from "../../../dblayer/seuTypes.js";
import type { ConflictResolutions, DetectionContext } from "./types.js";

// The review gates the SEU takes at one step, for every Deliverable. The checklists are a union of the checklists of every gate there.
export interface SettledReviewGates {
  step: string;
  gates: Array<Record<string, unknown>>;
  checklistIds: string[];
  recommendedChecklistIds: string[];
  // The Packs whose gates the SEU takes at this step.
  packs: string[];
}

export interface ReviewGatesSettled {
  conflicts: RecordedConflict[];
  result: SettledReviewGates[];
  // What the EBM does not take, and why.
  leftOut: LeftOut[];
}

// Gates with the same fields are one gate, and gates with different codes are different gates. A conflict between gates of one code takes the gates the user picked. A conflict that is still open leaves out the gates of that code.
export function settleReviewGatesFrom(facts: ReviewGatesUnraveled, resolutions: ConflictResolutions = {}): ReviewGatesSettled {
  const detected = detectReviewGateConflictsFrom(facts, resolutions);
  const open = openKeys(detected);
  const conflicts = recordConflicts(detected);
  // The gates of each step, and within a step the gates of each code. A code whose conflict is still open gives no gates.
  const steps = new Map<string, Map<string, ReviewGatesUnraveled["gates"]>>();
  for (const gate of facts.gates) {
    const key = reviewGateKey(gate.step, reviewGateCode(gate.fields));
    const byCode = steps.get(gate.step) ?? new Map<string, ReviewGatesUnraveled["gates"]>();
    byCode.set(key, [...(byCode.get(key) ?? []), gate]);
    steps.set(gate.step, byCode);
  }

  const result: SettledReviewGates[] = [];
  for (const [step, byCode] of steps) {
    const taken: ReviewGatesUnraveled["gates"] = [];
    const gates: Array<Record<string, unknown>> = [];
    const packs = new Set<string>();
    for (const [key, group] of byCode) {
      if (open.has(key)) continue;
      const picked = pickedValues(resolutions[key]);
      const distinct = group.map((g) => g.fields).filter((fields, i, all) => all.findIndex((f) => sameValue(f, fields)) === i);
      const chosen = picked ? distinct.filter((fields) => picked.some((p) => sameValue(p, fields))) : distinct;
      gates.push(...chosen);
      group.filter((g) => chosen.some((fields) => sameValue(fields, g.fields))).forEach((g) => packs.add(g.packCode));
      taken.push(...group);
    }
    if (taken.length === 0) continue;
    result.push({ step, gates, checklistIds: sortedUnion(taken.map((g) => g.checklistIds)), recommendedChecklistIds: sortedUnion(taken.map((g) => g.recommendedChecklistIds)), packs: [...packs].sort() });
  }
  return { conflicts, result, leftOut: leftOutOf(detected) };
}

export async function settleReviewGates(context: DetectionContext, resolutions: ConflictResolutions = {}): Promise<ReviewGatesSettled> {
  return settleReviewGatesFrom(unravelReviewGates({ composedPacks: context.composedPacks }), resolutions);
}
