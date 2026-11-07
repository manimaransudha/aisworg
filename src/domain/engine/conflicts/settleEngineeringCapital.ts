import { unravelEngineeringCapital, type EngineeringCapitalUnraveled } from "./unravelEngineeringCapital.js";
import { detectEngineeringCapitalConflictsFrom, engineeringCapitalKey, engineeringCapitalMissingLinkKey } from "./engineeringCapital.js";
import { openKeys, pickedValues, recordConflicts, leftOutOf, type LeftOut, sameValue } from "./settleShared.js";
import type { RecordedConflict } from "../../../dblayer/seuTypes.js";
import type { ConflictResolutions, DetectionContext } from "./types.js";

// An engineering capital entry the SEU takes, with the Packs that give it. An entry with no link, which the user included, has a null link.
export interface SettledEngineeringCapital {
  type: string;
  url: string | null;
  packs: string[];
}

export interface EngineeringCapitalSettled {
  conflicts: RecordedConflict[];
  result: SettledEngineeringCapital[];
  // What the EBM does not take, and why.
  leftOut: LeftOut[];
}

export const INCLUDE = "include";

// The same link from several Packs is one entry. Different links of a type conflict, and the user's pick keeps the links picked; the links of a type whose conflict is still open are left out.
// An entry with no link is kept only when the user included it.
export function settleEngineeringCapitalFrom(facts: EngineeringCapitalUnraveled, resolutions: ConflictResolutions = {}): EngineeringCapitalSettled {
  const detected = detectEngineeringCapitalConflictsFrom(facts, resolutions);
  const open = openKeys(detected);
  const conflicts = recordConflicts(detected);
  const merged = new Map<string, SettledEngineeringCapital>();
  for (const entry of facts.entries) {
    if (entry.url === "") {
      if (resolutions[engineeringCapitalMissingLinkKey(entry.packCode, entry.type)] !== INCLUDE) continue;
    } else {
      if (open.has(engineeringCapitalKey(entry.type))) continue;
      const picked = pickedValues(resolutions[engineeringCapitalKey(entry.type)]);
      if (picked && !picked.some((p) => sameValue(p, { type: entry.type, url: entry.url }))) continue;
    }
    const id = JSON.stringify([entry.type, entry.url]);
    const existing = merged.get(id);
    if (existing) { if (!existing.packs.includes(entry.packCode)) existing.packs.push(entry.packCode); continue; }
    merged.set(id, { type: entry.type, url: entry.url === "" ? null : entry.url, packs: [entry.packCode] });
  }
  return { conflicts, result: [...merged.values()], leftOut: leftOutOf(detected) };
}

export async function settleEngineeringCapital(context: DetectionContext, resolutions: ConflictResolutions = {}): Promise<EngineeringCapitalSettled> {
  return settleEngineeringCapitalFrom(unravelEngineeringCapital({ composedPacks: context.composedPacks }), resolutions);
}
