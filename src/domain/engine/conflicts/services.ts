import { CONFLICT_NO_VALUE } from "../../../dblayer/constants.js";
import { unravelServices, type ServiceCandidate, type ServicesUnraveled } from "./unravelServices.js";
import type { ComposedPacks } from "./composedPacks.js";
import type { ConflictOption, ConflictResolutions, DetectionContext, EbmConflict } from "./types.js";

export const SERVICE_CHOICE_MESSAGE = "You may be packing several work streams into one bucket. Create a different Profile for each work stream, or choose the Service this Deliverable belongs to.";

export function serviceChoiceKey(deliverableCode: string): string {
  return `serviceChoice::${deliverableCode}`;
}

export function serviceLevelKey(serviceCode: string, levelCode: string): string {
  return `${serviceCode}.serviceLevel[code=${levelCode}]`;
}

// The Services each Pack lists, with the levels it gives them.
export interface PackServiceList {
  source: { id: string; code: string; label: string };
  services: Array<{ code: string; serviceLevel: Array<{ code: string; target: number }> }>;
}

export function packServiceListsOf(composedPacks: ComposedPacks): PackServiceList[] {
  return composedPacks.packs.map((pack) => ({
    source: { id: pack.id, code: pack.code, label: pack.code },
    services: (pack.contributions?.services ?? []).map((svc) => ({ code: svc.code, serviceLevel: (svc.serviceLevel ?? []).map((l) => ({ code: l.code, target: l.target })) })),
  }));
}

// The Service each catalogue Deliverable ends with: the only candidate, or the user's pick. Deliverables still undecided are absent.
export function chosenServices(candidatesByDeliverable: Record<string, ServiceCandidate[]>, resolutions: ConflictResolutions): Record<string, string> {
  const chosen: Record<string, string> = {};
  for (const [deliverableCode, candidates] of Object.entries(candidatesByDeliverable)) {
    if (candidates.length === 1) chosen[deliverableCode] = candidates[0].code;
    else if (typeof resolutions[serviceChoiceKey(deliverableCode)] === "string") chosen[deliverableCode] = resolutions[serviceChoiceKey(deliverableCode)] as string;
  }
  return chosen;
}

interface OwnLevel {
  value: number;
  sourceKind: ConflictOption["sourceKind"];
  sourceId: string | null;
  sourceLabel: string;
}

// The Deliverable's Service levels: the Service Definition's default, the Template's value, else the Profile's value, in that order of precedence.
export function ownLevels(facts: ServicesUnraveled, serviceCode: string): Record<string, OwnLevel> {
  const levels: Record<string, OwnLevel> = {};
  const defaults = Object.values(facts.candidates).flat().find((c) => c.code === serviceCode)?.defaultLevels ?? {};
  for (const [code, value] of Object.entries(defaults)) levels[code] = { value, sourceKind: "definition", sourceId: null, sourceLabel: `Service Definition ${serviceCode}` };
  for (const [code, setting] of Object.entries(facts.levelSettings[serviceCode] ?? {})) levels[code] = { value: setting.value, sourceKind: setting.setBy, sourceId: setting.sourceId, sourceLabel: setting.sourceLabel };
  return levels;
}

interface PackLevel {
  value: number;
  sourceId: string;
  sourceLabel: string;
}

// The levels the composed Packs define for a Service, or null when no Pack lists it. Packs are assumed to agree, so the first definition of a level stands.
function packLevels(packLists: PackServiceList[], serviceCode: string): Record<string, PackLevel> | null {
  const levels: Record<string, PackLevel> = {};
  let listed = false;
  for (const pack of packLists) {
    for (const service of pack.services) {
      if (service.code !== serviceCode) continue;
      listed = true;
      for (const level of service.serviceLevel) if (!(level.code in levels)) levels[level.code] = { value: level.target, sourceId: pack.source.id, sourceLabel: pack.source.label };
    }
  }
  return listed ? levels : null;
}

type LevelDifferenceKind = "level-different" | "level-added";

// The one comparison of the Services table: the Deliverable's levels (A) against the Packs' levels (B). A level in A and not in B is no conflict. A level in both with different values, or in B and not in A, is.
function compareLevels(own: Record<string, OwnLevel>, theirs: Record<string, { value: number }>): Array<{ levelCode: string; kind: LevelDifferenceKind }> {
  const differences: Array<{ levelCode: string; kind: LevelDifferenceKind }> = [];
  for (const levelCode of new Set([...Object.keys(own), ...Object.keys(theirs)])) {
    const mine = own[levelCode];
    const other = theirs[levelCode];
    if (mine && (!other || mine.value === other.value)) continue;
    differences.push({ levelCode, kind: !mine ? "level-added" : "level-different" });
  }
  return differences;
}

// Step 1: a Deliverable with several candidate Services needs the user to pick one.
function serviceChoiceConflicts(facts: ServicesUnraveled, resolutions: ConflictResolutions): EbmConflict[] {
  const conflicts: EbmConflict[] = [];
  for (const [deliverableCode, candidates] of Object.entries(facts.candidates)) {
    if (candidates.length < 2) continue;
    const key = serviceChoiceKey(deliverableCode);
    conflicts.push({
      table: "services",
      key,
      kind: "service-choice",
      message: `${SERVICE_CHOICE_MESSAGE} Deliverable: ${deliverableCode}.`,
      options: candidates.map((c) => ({ sourceKind: "definition", sourceId: null, sourceLabel: `${c.name} (${c.code})`, value: c.code })),
      resolution: resolutions[key] ?? null,
      resolvable: true,
    });
  }
  return conflicts;
}

// Commented out (owner): dead code, no caller. To be cleaned up later.
// // The Services table's check for Services a Pack lists: the level codes (as "service.level") that differ, for Services that are one of the Deliverables' Services.
// // A Service that is not one of the Deliverables' Services is not compared. The Capabilities table calls this for a Pack that adds a Capability.
// export function levelDifferencesForPackServices(facts: ServicesUnraveled, resolutions: ConflictResolutions, packServices: PackServiceList["services"]): string[] {
//   const chosen = new Set(Object.values(chosenServices(facts.candidates, resolutions)));
//   const differences: string[] = [];
//   for (const service of packServices) {
//     if (!chosen.has(service.code)) continue;
//     const theirs = Object.fromEntries(service.serviceLevel.map((l) => [l.code, { value: l.target }]));
//     for (const difference of compareLevels(ownLevels(facts, service.code), theirs)) differences.push(`${service.code}.${difference.levelCode}`);
//   }
//   return differences;
// }

// The Deliverable's Service against the aggregate of what the Packs list for it. A Service no Pack lists is not compared.
function serviceLevelConflicts(facts: ServicesUnraveled, packLists: PackServiceList[], resolutions: ConflictResolutions): EbmConflict[] {
  const conflicts: EbmConflict[] = [];
  for (const serviceCode of new Set(Object.values(chosenServices(facts.candidates, resolutions)))) {
    const theirs = packLevels(packLists, serviceCode);
    if (!theirs) continue;
    const own = ownLevels(facts, serviceCode);
    for (const { levelCode, kind } of compareLevels(own, theirs)) {
      const key = serviceLevelKey(serviceCode, levelCode);
      const message = kind === "level-added" ? `The Packs add the level "${levelCode}" to ${serviceCode}.` : `The Packs and the Deliverable's Service give different values for "${levelCode}" of ${serviceCode}.`;
      // Every possible outcome is an option. When one side has no value for the level, "no value" is the other outcome.
      const ownOption: ConflictOption = own[levelCode]
        ? { sourceKind: own[levelCode].sourceKind, sourceId: own[levelCode].sourceId, sourceLabel: own[levelCode].sourceLabel, value: own[levelCode].value }
        : { sourceKind: "definition", sourceId: null, sourceLabel: `Service ${serviceCode} without "${levelCode}"`, value: CONFLICT_NO_VALUE };
      const packOption: ConflictOption = theirs[levelCode]
        ? { sourceKind: "pack", sourceId: theirs[levelCode].sourceId, sourceLabel: theirs[levelCode].sourceLabel, value: theirs[levelCode].value }
        : { sourceKind: "pack", sourceId: null, sourceLabel: `The Packs without "${levelCode}"`, value: CONFLICT_NO_VALUE };
      const options: ConflictOption[] = [ownOption, packOption];
      conflicts.push({ table: "services", key, kind, message, options, resolution: resolutions[key] ?? null, resolvable: true });
    }
  }
  return conflicts;
}

// The part of the Services detector that works on gathered facts, so it can be tested without a database.
export function detectServiceConflictsFrom(facts: ServicesUnraveled, packLists: PackServiceList[], resolutions: ConflictResolutions = {}): EbmConflict[] {
  return [...serviceChoiceConflicts(facts, resolutions), ...serviceLevelConflicts(facts, packLists, resolutions)];
}

export async function detectServiceConflicts(context: DetectionContext, resolutions: ConflictResolutions = {}): Promise<EbmConflict[]> {
  const facts = await unravelServices({ templates: context.templates, profiles: context.profiles }, context.viewerTenantId);
  return detectServiceConflictsFrom(facts, packServiceListsOf(context.composedPacks), resolutions);
}
