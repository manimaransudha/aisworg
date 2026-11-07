import { capabilityDefinitionsDB } from "../../../dblayer/capabilityDefinitionsDB.js";
import { unravelCapabilities, type CapabilitiesUnraveled } from "./unravelCapabilities.js";
import { detectCapabilityConflictsFrom } from "./capabilities.js";
import { serviceChoiceKey } from "./services.js";
import { recordConflicts, leftOutOf, type LeftOut } from "./settleShared.js";
import type { RecordedConflict } from "../../../dblayer/seuTypes.js";
import type { ConflictResolutions, DetectionContext } from "./types.js";

// A Capability the SEU takes, with the Deliverables whose Service names it. A Capability a Pack names and the user included has no Deliverable.
export interface SettledCapability {
  capability: string;
  deliverables: string[];
  source: "service" | "pack";
  // The id of the Active Capability Definition of this code when the EBM was composed. The SEU follows this id and never looks one up.
  definitionId: string | null;
}

export interface CapabilitiesSettled {
  conflicts: RecordedConflict[];
  result: SettledCapability[];
  // What the EBM does not take, and why.
  leftOut: LeftOut[];
}

export const INCLUDE = "include";

// The SEU takes the Capability of each Deliverable's Service, and the Capabilities from the Packs that the user included.
export function settleCapabilitiesFrom(facts: CapabilitiesUnraveled, resolutions: ConflictResolutions = {}, definitionIdByCode: Record<string, string> = {}): CapabilitiesSettled {
  const detected = detectCapabilityConflictsFrom(facts, resolutions);

  const servicesByDeliverable = new Map<string, Map<string, string>>();
  for (const entry of facts.listA) {
    const services = servicesByDeliverable.get(entry.deliverableCode) ?? new Map<string, string>();
    services.set(entry.serviceCode, entry.capabilityCode);
    servicesByDeliverable.set(entry.deliverableCode, services);
  }
  const deliverablesByCapability = new Map<string, Set<string>>();
  for (const [deliverable, services] of servicesByDeliverable) {
    const pick = resolutions[serviceChoiceKey(deliverable)];
    const chosenService = services.size === 1 ? [...services.keys()][0] : typeof pick === "string" && services.has(pick) ? pick : null;
    if (!chosenService) continue;
    const capability = services.get(chosenService)!;
    deliverablesByCapability.set(capability, (deliverablesByCapability.get(capability) ?? new Set<string>()).add(deliverable));
  }
  const result: SettledCapability[] = [...deliverablesByCapability].map(([capability, deliverables]) => ({ capability, deliverables: [...deliverables].sort(), source: "service" as const, definitionId: definitionIdByCode[capability] ?? null }));

  const fromPacks = new Set<string>();
  for (const conflict of detected) {
    if (conflict.resolution !== INCLUDE) continue;
    const capability = (conflict.options[0].value as { capabilityCode: string }).capabilityCode;
    if (!deliverablesByCapability.has(capability)) fromPacks.add(capability);
  }
  for (const capability of [...fromPacks].sort()) result.push({ capability, deliverables: [], source: "pack", definitionId: definitionIdByCode[capability] ?? null });

  // The Capability of a Service that is not the Service of a decided Deliverable is not taken.
  const leftOut = leftOutOf(detected);
  for (const [deliverable, services] of servicesByDeliverable) {
    const pick = resolutions[serviceChoiceKey(deliverable)];
    const chosenService = services.size === 1 ? [...services.keys()][0] : typeof pick === "string" && services.has(pick) ? pick : null;
    if (!chosenService) continue;
    for (const [service, capability] of services) if (service !== chosenService) leftOut.push({ item: `Capability ${capability} (Service ${service})`, reason: `Service ${service} is not the Service of ${deliverable}. ${chosenService} is.` });
  }
  return { conflicts: recordConflicts(detected), result, leftOut };
}

export async function settleCapabilities(context: DetectionContext, resolutions: ConflictResolutions = {}): Promise<CapabilitiesSettled> {
  const facts = await unravelCapabilities({ templates: context.templates, profiles: context.profiles, composedPacks: context.composedPacks }, context.viewerTenantId);
  // The EBM records the Active Capability Definition of each Capability it takes.
  const codes = [...new Set(settleCapabilitiesFrom(facts, resolutions).result.map((r) => r.capability))];
  const { data: definitions } = codes.length > 0 ? await capabilityDefinitionsDB.findActiveByCodesVisibleTo(codes, context.viewerTenantId) : { data: [] };
  return settleCapabilitiesFrom(facts, resolutions, Object.fromEntries((definitions ?? []).map((d) => [d.code, d.id])));
}
