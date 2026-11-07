import type { ComposedPacks } from "./composedPacks.js";
import type { ChecklistItem } from "../../../dblayer/seuTypes.js";

// A checklist of a composed Pack.
export interface ChecklistRow {
  packId: string;
  packCode: string;
  name: string;
  description: string | null;
  items: ChecklistItem[];
}

export interface ChecklistsUnraveled {
  checklists: ChecklistRow[];
}

// Gathers the checklists of the composed Packs. It decides nothing.
export function unravelChecklists(input: { composedPacks: ComposedPacks }): ChecklistsUnraveled {
  const checklists: ChecklistRow[] = [];
  for (const pack of input.composedPacks.packs) {
    for (const checklist of pack.contributions?.checklists ?? []) checklists.push({ packId: pack.id, packCode: pack.code, name: checklist.name, description: checklist.description ?? null, items: checklist.items ?? [] });
  }
  return { checklists };
}
