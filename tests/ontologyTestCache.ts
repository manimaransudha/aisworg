import { query } from "../src/utils/db.js";
import { ontologyDB, type OntologyViewer } from "../src/dblayer/ontologyDB.js";
import { getPlatformTenantId, ATHENS_TENANT_NAME, BABYLON_TENANT_NAME, TEST_PLATFORM_TENANT_NAME } from "../src/dblayer/constants.js";
import { getTestPlatformActor } from "../src/dblayer/seed/seedTestIdentity.js";
import type { OntologyConceptRow } from "../src/dblayer/seuTypes.js";

// Test-only Ontology cache. It is separate from the production cache in ontologyDB: it replaces the finders of the ontologyDB object in this
// process, so the production code that calls them is unchanged. It holds the Ontology rows of Platform and of every test tenant (a tenant authored by
// the test-platform participant, or Athens, Babylon and test-platform) merged into one set, so a test tenant sees the shared test vocabulary.
// A viewer that is root, and every row the cache does not hold, is answered by the production finder against the database.
// The write functions are wrapped so that a row a test writes is in the cache straight away.

const rows = new Map<string, OntologyConceptRow>();
let installed = false;

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

// Platform plus every test tenant: a tenant authored by the test-platform participant, or Athens, Babylon and test-platform.
export async function testScopeTenantIds(): Promise<string[]> {
  const platformTenantId = await getPlatformTenantId();
  const actor = await getTestPlatformActor();
  const { rows: tenants } = await query<{ id: string }>(
    "SELECT id FROM tenants WHERE author_id = $1 OR name = ANY($2::text[])",
    [actor.actorId, [ATHENS_TENANT_NAME, BABYLON_TENANT_NAME, TEST_PLATFORM_TENANT_NAME]]
  );
  return [...new Set([platformTenantId, ...tenants.map((t) => t.id)])];
}

export async function reloadTestOntologyCache(): Promise<void> {
  const tenantIds = await testScopeTenantIds();
  const { rows: loaded } = await query<OntologyConceptRow>("SELECT * FROM ontology_concepts WHERE tenant_id = ANY($1::uuid[])", [tenantIds]);
  rows.clear();
  for (const row of loaded) rows.set(row.id, row);
}

// For a test that deletes concepts with raw SQL: the matching rows leave the cache with them.
export function forgetTestOntologyConcepts(conceptType: string, codes: string[]): void {
  for (const row of all()) if (row.concept_type === conceptType && codes.includes(row.code)) rows.delete(row.id);
}

const all = (): OntologyConceptRow[] => [...rows.values()];

export async function installTestOntologyCache(): Promise<void> {
  if (installed) return;
  installed = true;
  await reloadTestOntologyCache();
  const original = { ...ontologyDB };

  ontologyDB.findConcept = async (conceptType, code, viewer: OntologyViewer) => {
    if (viewer.isRoot) return original.findConcept(conceptType, code, viewer);
    const matches = all().filter((r) => r.concept_type === conceptType && r.code === code && r.status === "Active");
    const hit = matches.find((r) => r.tenant_id === viewer.tenantId) ?? matches[0];
    return hit ? { data: hit } : original.findConcept(conceptType, code, viewer);
  };

  ontologyDB.findConceptsByType = async (conceptType, viewer, opts) => {
    if (viewer.isRoot) return original.findConceptsByType(conceptType, viewer, opts);
    const matches = all().filter((r) => r.concept_type === conceptType && (opts?.includeInactive || r.status === "Active"));
    return { data: matches.sort((a, b) => byText(a.code, b.code) || (opts?.includeInactive ? byText(b.version, a.version) : 0)) };
  };

  ontologyDB.listDistinctConceptTypes = async (viewer) => {
    if (viewer.isRoot) return original.listDistinctConceptTypes(viewer);
    return { data: [...new Set(all().map((r) => r.concept_type))].sort(byText) };
  };

  ontologyDB.findConceptTypeUiGroupings = async (viewer) => {
    if (viewer.isRoot) return original.findConceptTypeUiGroupings(viewer);
    const pairs = new Map<string, { concept_type: string; ui_grouping: string }>();
    for (const r of all()) if (r.ui_grouping !== null && r.status === "Active") pairs.set(`${r.concept_type}\u0000${r.ui_grouping}`, { concept_type: r.concept_type, ui_grouping: r.ui_grouping });
    return { data: [...pairs.values()].sort((a, b) => byText(a.concept_type, b.concept_type) || byText(a.ui_grouping, b.ui_grouping)) };
  };

  ontologyDB.findAllActiveConcepts = async (viewer) => {
    if (viewer.isRoot) return original.findAllActiveConcepts(viewer);
    const active = all().filter((r) => r.status === "Active").sort((a, b) => byText(a.concept_type, b.concept_type) || byText(a.code, b.code));
    return { data: active.map((r) => ({ concept_type: r.concept_type, code: r.code, default_label: r.default_label, text_type: r.text_type, ui_grouping: r.ui_grouping, tenant_id: r.tenant_id })) };
  };

  ontologyDB.findDistinctUiGroupings = async (viewer) => {
    if (viewer.isRoot) return original.findDistinctUiGroupings(viewer);
    return { data: [...new Set(all().filter((r) => r.ui_grouping !== null && r.status === "Active").map((r) => r.ui_grouping as string))].sort(byText) };
  };

  ontologyDB.findDraftConcepts = async (viewer) => {
    if (viewer.isRoot) return original.findDraftConcepts(viewer);
    return { data: all().filter((r) => r.status === "Draft").sort((a, b) => byText(a.created_at, b.created_at)) };
  };

  ontologyDB.findActiveConcept = async (conceptType, code, tenantId) => {
    const hit = all().find((r) => r.tenant_id === tenantId && r.concept_type === conceptType && r.code === code && r.status === "Active");
    return hit ? { data: hit } : original.findActiveConcept(conceptType, code, tenantId);
  };

  ontologyDB.findConceptById = async (id) => {
    const hit = rows.get(id);
    return hit ? { data: hit } : original.findConceptById(id);
  };

  ontologyDB.findLatestVersion = async (conceptType, code, tenantId) => {
    const hit = all().filter((r) => r.tenant_id === tenantId && r.concept_type === conceptType && r.code === code).sort((a, b) => byText(b.created_at, a.created_at))[0];
    return hit ? { data: hit } : original.findLatestVersion(conceptType, code, tenantId);
  };

  ontologyDB.findConceptByCodeAndVersion = async (conceptType, code, tenantId, version) => {
    const hit = all().find((r) => r.tenant_id === tenantId && r.concept_type === conceptType && r.code === code && r.version === version);
    return hit ? { data: hit } : original.findConceptByCodeAndVersion(conceptType, code, tenantId, version);
  };

  ontologyDB.insertConceptVersion = async (input) => {
    const result = await original.insertConceptVersion(input);
    if (result.data) rows.set(result.data.id, result.data);
    return result;
  };

  ontologyDB.bulkInsertConceptVersions = async (input) => {
    const result = await original.bulkInsertConceptVersions(input);
    for (const row of result.data ?? []) rows.set(row.id, row);
    return result;
  };

  ontologyDB.updateConceptStatus = async (id, status) => {
    const result = await original.updateConceptStatus(id, status);
    if (result.data) rows.set(result.data.id, result.data);
    return result;
  };

  ontologyDB.updateConceptMeta = async (id, updates) => {
    const result = await original.updateConceptMeta(id, updates);
    if (result.data) rows.set(result.data.id, result.data);
    return result;
  };
}
