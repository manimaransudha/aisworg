import { query } from "../src/utils/db.js";
import { testScopeTenantIds } from "./ontologyTestCache.js";
import { capabilityDefinitionsDB } from "../src/dblayer/capabilityDefinitionsDB.js";
import { getPlatformTenantId } from "../src/dblayer/constants.js";

// Test-only index of which tenant owns a definition: (entity kind, id, code, tenant) for Platform and every test tenant. It holds no row data. A test
// asks it for the tenant of a Pack, Template, Profile or definition and passes that tenant to the production function, whose own query then finds the
// row. A code the index does not hold is read once from the database and added, so a row a test or a helper created is found from then on.

export type EntityKind = "Pack" | "Template" | "Profile" | "PolicyDefinition" | "CapabilityDefinition" | "ServiceDefinition" | "DeliverableDefinition";

const TABLE: Record<EntityKind, string> = {
  Pack: "packs",
  Template: "templates",
  Profile: "profiles",
  PolicyDefinition: "policy_definitions",
  CapabilityDefinition: "capability_definitions",
  ServiceDefinition: "service_definitions",
  DeliverableDefinition: "deliverable_definitions",
};

interface Entry { id: string; code: string; tenantId: string }

const entries = new Map<EntityKind, Map<string, Entry>>();
for (const kind of Object.keys(TABLE) as EntityKind[]) entries.set(kind, new Map());

export async function loadEntityTenantCache(): Promise<void> {
  const tenantIds = await testScopeTenantIds();
  for (const kind of Object.keys(TABLE) as EntityKind[]) {
    const { rows } = await query<{ id: string; code: string; tenant_id: string }>(`SELECT id, code, tenant_id FROM ${TABLE[kind]} WHERE tenant_id = ANY($1::uuid[])`, [tenantIds]);
    const byId = entries.get(kind)!;
    byId.clear();
    for (const r of rows) byId.set(r.id, { id: r.id, code: r.code, tenantId: r.tenant_id });
  }
}

// For a helper that creates a row: the row is in the index at once.
export function rememberEntity(kind: EntityKind, row: { id: string; code: string; tenant_id: string }): void {
  entries.get(kind)!.set(row.id, { id: row.id, code: row.code, tenantId: row.tenant_id });
}

export function forgetEntity(kind: EntityKind, id: string): void {
  entries.get(kind)!.delete(id);
}

function tenantsOfCodeInIndex(kind: EntityKind, code: string): string[] {
  return [...new Set([...entries.get(kind)!.values()].filter((e) => e.code === code).map((e) => e.tenantId))];
}

// The tenant that owns the code. A code in the index is answered from it; a code that is not is read from the database in the test scope and added.
// Throws when no tenant owns it, or when more than one does and the test must name the tenant itself.
export async function tenantOfCode(kind: EntityKind, code: string): Promise<string> {
  let tenants = tenantsOfCodeInIndex(kind, code);
  if (tenants.length === 0) {
    const scope = await testScopeTenantIds();
    const { rows } = await query<{ id: string; code: string; tenant_id: string }>(`SELECT id, code, tenant_id FROM ${TABLE[kind]} WHERE code = $1 AND tenant_id = ANY($2::uuid[])`, [code, scope]);
    for (const r of rows) rememberEntity(kind, r);
    tenants = tenantsOfCodeInIndex(kind, code);
  }
  if (tenants.length === 0) throw new Error(`entityTenantCache: no ${kind} with code "${code}" in Platform or a test tenant`);
  if (tenants.length > 1) throw new Error(`entityTenantCache: ${kind} "${code}" exists in ${tenants.length} tenants (${tenants.join(", ")}); name the tenant`);
  return tenants[0];
}

export async function tenantOfId(kind: EntityKind, id: string): Promise<string> {
  const hit = entries.get(kind)!.get(id);
  if (hit) return hit.tenantId;
  const { rows } = await query<{ id: string; code: string; tenant_id: string }>(`SELECT id, code, tenant_id FROM ${TABLE[kind]} WHERE id = $1`, [id]);
  if (rows.length === 0) throw new Error(`entityTenantCache: no ${kind} with id ${id}`);
  rememberEntity(kind, rows[0]);
  return rows[0].tenant_id;
}

// The distinct codes the tenant holds for the kind, in code order. Each version and status is its own row; the production finder picks the Active one.
export function codesOfTenant(kind: EntityKind, tenantId: string): string[] {
  return [...new Set([...entries.get(kind)!.values()].filter((e) => e.tenantId === tenantId).map((e) => e.code))].sort();
}

// The ids the tenant holds for the kind, in code order (each version and status is its own row).
export function idsOfTenant(kind: EntityKind, tenantId: string): string[] {
  return [...entries.get(kind)!.values()].filter((e) => e.tenantId === tenantId).sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)).map((e) => e.id);
}

// The Active Capability Definitions of the Platform tenant, in code order: the cache lists the codes and the production finder returns the Active row of each.
export async function activeCapabilityDefinitionIds(): Promise<string[]> {
  const platformTenantId = await getPlatformTenantId();
  const ids: string[] = [];
  for (const code of codesOfTenant("CapabilityDefinition", platformTenantId)) {
    const { data } = await capabilityDefinitionsDB.findActiveByCode(code, platformTenantId);
    if (data) ids.push(data.id);
  }
  return ids;
}
