import { templatesDB } from "../../../dblayer/templatesDB.js";
import { packsDB } from "../../../dblayer/packsDB.js";
import { getProfilePackCodes } from "../../../routes/seu/core/profiles.js";
import { resolveComposedPacksTransitively } from "../profileCompositionUnravel.js";
import { dependencyConflictsOf } from "./dependencies.js";
import type { EbmConflict } from "./types.js";
import type { PackRow, ProfileRow, TemplateRow } from "../../../dblayer/seuTypes.js";

// Step 0 of the conflict detection. Every detector receives this list, and the Dependencies tab shows its dependency conflicts.
export interface ComposedPacks {
  // Every Pack of the composition: the Packs the Templates and Profiles name, the platform's Mandatory Packs, and the Packs their dependencies bring.
  packs: PackRow[];
  // The codes of the Packs named directly, before dependencies were followed.
  directPackCodes: string[];
  warnings: string[];
  // The dependency conflicts found while flattening: a required Pack that is missing, or an incompatible Pack that is present.
  dependencyConflicts: EbmConflict[];
}

// Flattens the Packs of the Templates and Profiles into one list. It reads nothing else.
export async function flattenComposedPacks(input: { templates: TemplateRow[]; profiles: ProfileRow[] }, viewerTenantId: string): Promise<ComposedPacks> {
  const rootPackCodes: string[] = [];
  for (const template of input.templates) {
    const { data: mandatoryCodes } = await templatesDB.getMandatoryPackCodes(template.id);
    rootPackCodes.push(...(mandatoryCodes ?? []));
    const { data: platformMandatoryPacks } = await packsDB.findActiveMandatoryVisibleTo(template.tenant_id);
    rootPackCodes.push(...(platformMandatoryPacks ?? []).map((p) => p.code));
  }
  for (const profile of input.profiles) rootPackCodes.push(...(await getProfilePackCodes(profile.id)));

  const { resolved, warnings } = await resolveComposedPacksTransitively(rootPackCodes, viewerTenantId);
  const packs = [...resolved.values()];
  return { packs, directPackCodes: [...new Set(rootPackCodes)], warnings, dependencyConflicts: dependencyConflictsOf(packs) };
}
