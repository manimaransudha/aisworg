import { CONFLICT_NO_VALUE } from "../../../dblayer/constants.js";
import { unravelServices, type ServicesUnraveled } from "./unravelServices.js";
import { chosenServices, detectServiceConflictsFrom, ownLevels, packServiceListsOf, serviceLevelKey, type PackServiceList } from "./services.js";
import { openKeys, recordConflicts, leftOutOf, type LeftOut } from "./settleShared.js";
import type { RecordedConflict } from "../../../dblayer/seuTypes.js";
import type { ConflictResolutions, DetectionContext } from "./types.js";

// What the SEU takes for one catalogue Deliverable: its Service and the final value of each level of that Service.
export interface SettledService {
  deliverable: string;
  // The Deliverable's name, from its Active Deliverable Definition when the EBM was composed.
  name: string | null;
  service: string;
  levels: Record<string, number>;
}

// What the EBM saves for the Services table: every conflict with the user's pick, so it can be audited and reported, and the final result the SEU takes.
export interface ServicesSettled {
  conflicts: RecordedConflict[];
  result: SettledService[];
  // What the EBM does not take, and why.
  leftOut: LeftOut[];
}

// The final levels of a Service: its own levels, with each level conflict settled by the user's pick. A pick of a value sets the level, and a pick of "no value" drops it.
function finalLevels(facts: ServicesUnraveled, serviceCode: string, resolutions: ConflictResolutions, open: Set<string>): Record<string, number> {
  const own = ownLevels(facts, serviceCode);
  const levels: Record<string, number> = Object.fromEntries(Object.entries(own).map(([code, level]) => [code, level.value]));
  const levelCodes = new Set<string>(Object.keys(levels));
  for (const key of Object.keys(resolutions)) {
    const prefix = `${serviceCode}.serviceLevel[code=`;
    if (key.startsWith(prefix) && key.endsWith("]")) levelCodes.add(key.slice(prefix.length, -1));
  }
  for (const levelCode of levelCodes) {
    const pick = resolutions[serviceLevelKey(serviceCode, levelCode)];
    if (open.has(serviceLevelKey(serviceCode, levelCode))) { delete levels[levelCode]; continue; }
    if (pick === undefined) continue;
    if (pick === CONFLICT_NO_VALUE) delete levels[levelCode];
    else if (typeof pick === "number") levels[levelCode] = pick;
  }
  for (const levelCode of facts.notRequiredLevels?.[serviceCode] ?? []) delete levels[levelCode];
  return levels;
}

// Builds the Services result from gathered facts, so it can be tested without a database. A level whose conflict is still open is left out, and a Deliverable whose Service is not decided yet is left out.
export function settleServicesFrom(facts: ServicesUnraveled, packLists: PackServiceList[], resolutions: ConflictResolutions = {}): ServicesSettled {
  const detected = detectServiceConflictsFrom(facts, packLists, resolutions);
  const open = openKeys(detected);
  const conflicts = recordConflicts(detected);

  const chosen = chosenServices(facts.candidates, resolutions);
  const result: SettledService[] = facts.deliverableCodes
    .filter((deliverable) => chosen[deliverable] !== undefined)
    .map((deliverable) => ({ deliverable, name: facts.deliverableNames[deliverable] ?? null, service: chosen[deliverable], levels: finalLevels(facts, chosen[deliverable], resolutions, open) }));
  // The Services the Packs list that no catalogue Deliverable can use are not taken either.
  const candidateCodes = new Set(Object.values(facts.candidates).flat().map((c) => c.code));
  const leftOut = leftOutOf(detected);
  for (const pack of packLists) {
    for (const service of pack.services) {
      if (!candidateCodes.has(service.code)) leftOut.push({ item: `Service ${service.code} (Pack ${pack.source.code})`, reason: "No Deliverable of the catalogue is made by this Service." });
    }
  }
  return { conflicts, result, leftOut };
}

export async function settleServices(context: DetectionContext, resolutions: ConflictResolutions = {}): Promise<ServicesSettled> {
  const facts = await unravelServices({ templates: context.templates, profiles: context.profiles }, context.viewerTenantId);
  return settleServicesFrom(facts, packServiceListsOf(context.composedPacks), resolutions);
}
