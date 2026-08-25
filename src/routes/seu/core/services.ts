import { servicesDB } from "../../../dblayer/servicesDB.js";
import { capabilitiesDB } from "../../../dblayer/capabilitiesDB.js";
import type { ServiceLevelItem } from "../../../dblayer/seuTypes.js";

export interface ServiceListItem {
  id: string;
  name: string;
  contractDescription: string;
  serviceLevel: ServiceLevelItem[];
  status: string;
  version: string;
  providingCapabilityCode: string;
  providingCapabilityName: string;
}

// Post-MVP Phase 2 (Ch.11 §7-§8): Services and their declared Service Level
// made visible — previously seeded (2 Services on the one Pack) but never
// surfaced anywhere, and never actually referenced by a real dependency edge.
export async function listServices(): Promise<ServiceListItem[]> {
  const [{ data: services }, { data: capabilities }] = await Promise.all([servicesDB.findAll(), capabilitiesDB.findAll()]);
  const capById = new Map((capabilities ?? []).map((c) => [c.id, c]));
  return (services ?? []).map((s) => {
    const cap = capById.get(s.providing_capability_id);
    return {
      id: s.id,
      name: s.name,
      contractDescription: s.contract_description,
      serviceLevel: s.service_level,
      status: s.status,
      version: s.version,
      providingCapabilityCode: cap?.code ?? "unknown",
      providingCapabilityName: cap?.name ?? "unknown",
    };
  });
}
