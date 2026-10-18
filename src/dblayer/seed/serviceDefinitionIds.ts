import { serviceDefinitionsDB } from "../serviceDefinitionsDB.js";
import type { PackSeedInput } from "../../routes/seu/core/packs.js";

// Loads the Active Service Definitions visible to a tenant once, as a code -> id map. The tenant's own definition wins
// over a Platform one with the same code, matching findActiveByCodeVisibleTo.
export async function loadServiceDefinitionIdByCode(tenantId: string): Promise<Map<string, string>> {
  const { data, error } = await serviceDefinitionsDB.findAllVisibleTo(tenantId);
  if (error || !data) throw error ?? new Error("could not load Service Definitions");
  const idByCode = new Map<string, string>();
  for (const row of data.filter((d) => d.status === "Active")) {
    if (!idByCode.has(row.code) || row.tenant_id === tenantId) idByCode.set(row.code, row.id);
  }
  return idByCode;
}

// Stamps each contributionServices entry with the id of the Service Definition its code names, so the Pack records the
// exact definition version it composes. The seed JSON stays code-only.
export function stampServiceDefinitionIds<T extends Pick<PackSeedInput, "code" | "contributions">>(seed: T, idByCode: Map<string, string>): T {
  for (const svc of seed.contributions.services ?? []) {
    const id = idByCode.get(svc.code);
    if (!id) throw new Error(`Pack "${seed.code}": service "${svc.code}" has no Active Service Definition to record`);
    svc.serviceDefinitionId = id;
  }
  return seed;
}
