import type { ComposedPacks } from "./composedPacks.js";

// An engineering capital entry of a composed Pack.
export interface EngineeringCapitalRow {
  packId: string;
  packCode: string;
  type: string;
  // The link, trimmed. Empty when the entry has none.
  url: string;
}

export interface EngineeringCapitalUnraveled {
  entries: EngineeringCapitalRow[];
}

// Gathers the engineering capital of the composed Packs. It decides nothing.
export function unravelEngineeringCapital(input: { composedPacks: ComposedPacks }): EngineeringCapitalUnraveled {
  const entries: EngineeringCapitalRow[] = [];
  for (const pack of input.composedPacks.packs) {
    for (const entry of pack.contributions?.engineeringCapital ?? []) entries.push({ packId: pack.id, packCode: pack.code, type: entry.type ?? "", url: (entry.url ?? "").trim() });
  }
  return { entries };
}
