import { withAction } from "./resolve.js";
import type { RecordedConflict } from "../../../dblayer/seuTypes.js";
import type { EbmConflict } from "./types.js";

// A conflict as the EBM saves it: what was found, the options with their sources, and the user's pick.
export function recordConflicts(conflicts: EbmConflict[]): RecordedConflict[] {
  return conflicts.map(withAction).map((c) => ({
    table: c.table, key: c.key, kind: c.kind, action: c.action, message: c.message, notice: c.notice === true, resolvable: c.resolvable,
    options: c.options.map((o) => ({ sourceKind: o.sourceKind, sourceLabel: o.sourceLabel, value: o.value })), resolution: c.resolution,
  }));
}

export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// The values the user picked for a pick-any conflict, or null when there is no pick.
export function pickedValues(pick: unknown): unknown[] | null {
  return Array.isArray(pick) ? pick : null;
}

// The keys of the conflicts that are still open. No result is generated for them: they stay in the conflict list until the user resolves them.
export function openKeys(conflicts: EbmConflict[]): Set<string> {
  return new Set(conflicts.filter((c) => !c.notice && (c.resolution === null || c.resolution === undefined)).map((c) => c.key));
}

// Something the EBM does not take, and why.
export interface LeftOut {
  item: string;
  reason: string;
}

const show = (value: unknown): string => (typeof value === "object" && value !== null ? JSON.stringify(value) : String(value));

// What a conflict leaves out. An open conflict leaves out everything it covers until it is resolved. A resolved one leaves out the options the user did not take.
export function leftOutOf(conflicts: EbmConflict[]): LeftOut[] {
  const out: LeftOut[] = [];
  for (const conflict of conflicts) {
    if (conflict.notice) continue;
    const pick = conflict.resolution;
    if (pick === null || pick === undefined) {
      out.push({ item: conflict.message, reason: "Not decided yet. It stays out of the result until the conflict is resolved." });
      continue;
    }
    const action = withAction(conflict).action;
    for (const option of conflict.options) {
      const taken = action === "pick-any" ? Array.isArray(pick) && pick.some((p) => sameValue(p, option.value)) : action === "include-or-exclude" ? pick === "include" : sameValue(pick, option.value);
      if (taken) continue;
      out.push({
        item: `${option.sourceLabel}: ${show(option.value)}`,
        reason: action === "include-or-exclude" ? "You chose to exclude it." : action === "pick-any" ? "You did not pick it." : `You picked ${show(pick)} instead.`,
      });
    }
  }
  return out;
}

export function sortedUnion(lists: string[][]): string[] {
  return [...new Set(lists.flat())].sort();
}
