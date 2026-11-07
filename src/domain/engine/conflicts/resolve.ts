import { CONFLICT_ACTION_BY_KIND, CONFLICT_ACTION_INCLUDE_OR_EXCLUDE, CONFLICT_ACTION_NONE, CONFLICT_ACTION_PICK_ANY, CONFLICT_ACTION_PICK_ONE } from "../../../dblayer/constants.js";
import type { ActionedConflict, EbmConflict } from "./types.js";

export const DECISION_INCLUDE = "include";
export const DECISION_EXCLUDE = "exclude";

// The action for a conflict, from the map of kinds to actions. A kind with no entry is read-only, so an unknown kind is never resolved by accident.
export function withAction(conflict: EbmConflict): ActionedConflict {
  return { ...conflict, action: CONFLICT_ACTION_BY_KIND[conflict.kind] ?? CONFLICT_ACTION_NONE };
}

// What the user submitted: the options picked (by position in the conflict's options) or an include or exclude decision.
export interface ConflictPick {
  optionIndexes?: number[];
  decision?: string;
}

export type ResolveResult = { ok: true; value: unknown } | { ok: false; error: string };

// Checks a pick against the action that applies to the conflict and returns the value to store under the conflict's key.
// pick-one stores the picked option's value, pick-any stores the list of picked values, include-or-exclude stores the decision.
export function resolveConflict(conflict: ActionedConflict, pick: ConflictPick): ResolveResult {
  if (!conflict.resolvable || conflict.action === CONFLICT_ACTION_NONE) return { ok: false, error: "This conflict cannot be resolved here." };
  if (conflict.action === CONFLICT_ACTION_INCLUDE_OR_EXCLUDE) {
    if (pick.decision !== DECISION_INCLUDE && pick.decision !== DECISION_EXCLUDE) return { ok: false, error: "Choose to include or exclude." };
    return { ok: true, value: pick.decision };
  }
  const indexes = [...new Set(pick.optionIndexes ?? [])];
  if (indexes.length === 0) return { ok: false, error: "Pick an option." };
  if (indexes.some((i) => !Number.isInteger(i) || i < 0 || i >= conflict.options.length)) return { ok: false, error: "That option does not exist." };
  if (conflict.action === CONFLICT_ACTION_PICK_ONE) {
    if (indexes.length !== 1) return { ok: false, error: "Pick exactly one option." };
    return { ok: true, value: conflict.options[indexes[0]].value };
  }
  if (conflict.action === CONFLICT_ACTION_PICK_ANY) return { ok: true, value: indexes.sort((a, b) => a - b).map((i) => conflict.options[i].value) };
  return { ok: false, error: "This conflict cannot be resolved here." };
}
