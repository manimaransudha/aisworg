import { servicesDB } from "../../../dblayer/servicesDB.js";
import { capabilitiesDB } from "../../../dblayer/capabilitiesDB.js";
import type { ServiceLevelExpectation } from "../../../dblayer/seuTypes.js";

export interface ServiceListItem {
  id: string;
  name: string;
  contractDescription: string;
  serviceLevel: ServiceLevelExpectation[];
  status: string;
  version: string;
  providingCapabilityCode: string;
  providingCapabilityName: string;
}

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
