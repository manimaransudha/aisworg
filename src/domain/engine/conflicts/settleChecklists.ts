import { unravelChecklists, type ChecklistsUnraveled } from "./unravelChecklists.js";
import type { RecordedConflict, ChecklistItem } from "../../../dblayer/seuTypes.js";
import type { LeftOut } from "./settleShared.js";
import type { DetectionContext } from "./types.js";

// A checklist the SEU takes, with every item the Pack gives it.
export interface SettledChecklist {
  pack: string;
  checklist: string;
  description: string | null;
  items: ChecklistItem[];
}

export interface ChecklistsSettled {
  // Checklists are a union, so there is no conflict. The field is kept so every table is saved the same way.
  conflicts: RecordedConflict[];
  result: SettledChecklist[];
  // Checklists are a union, so nothing is left out.
  leftOut: LeftOut[];
}

// Checklists are a union: the SEU takes every checklist of every Pack, with every item.
export function settleChecklistsFrom(facts: ChecklistsUnraveled): ChecklistsSettled {
  return { conflicts: [], leftOut: [], result: facts.checklists.map((c) => ({ pack: c.packCode, checklist: c.name, description: c.description, items: c.items })) };
}

export async function settleChecklists(context: DetectionContext): Promise<ChecklistsSettled> {
  return settleChecklistsFrom(unravelChecklists({ composedPacks: context.composedPacks }));
}
