import { catalogueFor, resolveDeliverableSource } from "../deliverableSource.js";
import { serviceDefinitionsDB } from "../../../dblayer/serviceDefinitionsDB.js";
import type { ComposedPacks } from "./composedPacks.js";
import type { ProfileRow, TemplateRow } from "../../../dblayer/seuTypes.js";

// List A: the Capability that a Service of a catalogue Deliverable names. A Deliverable with several candidate Services has one entry for each.
export interface DeliverableCapability {
  deliverableCode: string;
  serviceCode: string;
  capabilityCode: string;
}

// List B: a Capability that a Pack names in its capability list.
export interface PackNamedCapability {
  capabilityCode: string;
  packId: string;
  packCode: string;
}

export interface CapabilitiesUnraveled {
  listA: DeliverableCapability[];
  listB: PackNamedCapability[];
}

// Gathers the two lists of the Capabilities table. It decides nothing.
export async function unravelCapabilities(input: { templates: TemplateRow[]; profiles: ProfileRow[]; composedPacks: ComposedPacks }, viewerTenantId: string): Promise<CapabilitiesUnraveled> {
  const deliverableCodes = new Set<string>();
  for (const profile of input.profiles) {
    const template = input.templates.find((t) => t.id === profile.base_template_id);
    if (!template) continue;
    const source = await resolveDeliverableSource(template, profile);
    for (const entry of catalogueFor(template, profile, source)) deliverableCodes.add(entry.code);
  }

  const listA: DeliverableCapability[] = [];
  if (deliverableCodes.size > 0) {
    const { data: services } = await serviceDefinitionsDB.findActiveByOutputsVisibleTo([...deliverableCodes], viewerTenantId);
    for (const service of services ?? []) {
      for (const output of service.outputs ?? []) {
        if (deliverableCodes.has(output)) listA.push({ deliverableCode: output, serviceCode: service.code, capabilityCode: service.capability_code });
      }
    }
  }

  const listB: PackNamedCapability[] = input.composedPacks.packs.flatMap((pack) => (pack.contributions?.capabilities ?? []).map((c) => ({ capabilityCode: c.code, packId: pack.id, packCode: pack.code })));

  return { listA, listB };
}
