// CR-049 Phase 2 — Ch.15 §12's Derivation/Implementation/Decomposition
// relationship kinds on a Template's dependencyGraph. Proves, against the
// real dev database:
//   1. A plain 'dependency' edge is unrestricted on Template Inheritance —
//      unchanged behaviour (no regression from before this CR).
//   2. Implementation/Decomposition edges are locked: dropping one on a
//      derived Template blocks publish.
//   3. They may be RENAMED — either end swapped for the tenant's own
//      Deliverable Definition, provided its lineage traces back to the
//      parent's own name for that slot (isRenameOf, core/templates.ts).
//   4. Renaming to an unrelated name (no lineage) still blocks publish.
//   5. Derivation-kind edges are freely editable — no lock at all.
//
// CR-087 — deliverableCatalogue[].code (was .name) and dependencyGraph's
// toCode/fromCode (were toName/fromName) updated throughout: entry.code is
// now asserted against the real deliverable-name Ontology vocabulary
// (validateTemplateSeed), so the literal "Architecture"/"Data Architecture"
// strings this file used are replaced with real codes
// (solution-architecture-document/database-schema-data-model). The
// dynamically-generated phase2-* codes are unaffected — they become real
// deliverable-name concepts that publishDeliverableDefinition registers
// in the Ontology before the Definition is published and before any Template references them.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { userDB } from "../src/dblayer/userDB.js";
import { tenantsDB } from "../src/dblayer/tenantsDB.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { deliverableDefinitionsDB } from "../src/dblayer/deliverableDefinitionsDB.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import type { SchemaDefinitionEntityKind } from "../src/dblayer/seuTypes.js";
import { getPlatformTenantId } from "../src/dblayer/constants.js";
const PLATFORM_TENANT_ID = await getPlatformTenantId();
import { createAuthoringDraft, saveAuthoringDraft } from "../src/routes/seu/core/sdkAuthoring.js";
import { syncConceptFromEntity } from "../src/routes/seu/core/ontology.js";
import { ensureTestFixturePacks, advanceAuthoringDraftToActive } from "./testFixtures.js";

const createdTemplateIds: string[] = [];
const createdDeliverableDefinitionIds: string[] = [];
const createdOntologyConceptCodes: string[] = [];

before(async () => {
  await ensureTestFixturePacks();
});

after(async () => {
  if (createdOntologyConceptCodes.length) {
    await pool.query("DELETE FROM ontology_concepts WHERE concept_type = 'deliverable-name' AND code = ANY($1::text[])", [createdOntologyConceptCodes]);
  }
  if (createdDeliverableDefinitionIds.length) {
    await pool.query("UPDATE deliverable_definitions SET parent_deliverable_definition_id = NULL WHERE id = ANY($1::uuid[])", [createdDeliverableDefinitionIds]);
    await pool.query("DELETE FROM version_events WHERE entity_type = 'DeliverableDefinition' AND entity_id = ANY($1::uuid[])", [createdDeliverableDefinitionIds]);
    await pool.query("DELETE FROM events WHERE originating_object_type = 'DeliverableDefinition' AND originating_object_id = ANY($1::uuid[])", [createdDeliverableDefinitionIds]);
    await pool.query("DELETE FROM deliverable_definitions WHERE id = ANY($1::uuid[])", [createdDeliverableDefinitionIds]);
  }
  if (createdTemplateIds.length) {
    await pool.query("DELETE FROM template_packs WHERE template_id = ANY($1::uuid[])", [createdTemplateIds]);
    await pool.query("DELETE FROM template_capabilities WHERE template_id = ANY($1::uuid[])", [createdTemplateIds]);
    await pool.query("DELETE FROM dependency_definitions WHERE owning_entity_type = 'Template' AND owning_entity_id = ANY($1::uuid[])", [createdTemplateIds]);
    await pool.query("DELETE FROM version_events WHERE entity_type = 'Template' AND entity_id = ANY($1::uuid[])", [createdTemplateIds]);
    await pool.query("DELETE FROM events WHERE originating_object_type = 'Template' AND originating_object_id = ANY($1::uuid[])", [createdTemplateIds]);
    await pool.query("DELETE FROM templates WHERE id = ANY($1::uuid[])", [createdTemplateIds]);
  }
});

const { actorId: ROOT_ACTOR_ID } = await userDB.getSuperuserId();
const { data: demoTenant, error: demoTenantErr } = await tenantsDB.findByCode("demo");
if (demoTenantErr) throw demoTenantErr;
if (!demoTenant) throw new Error("demo tenant not provisioned");
const DEMO_TENANT_ID = demoTenant.id;
const REAL_TEMPLATE_CODE = "test-dependency-graph-template"; // test-only template-categories concept, so activating a new version never supersedes a seeded Template

// Real deliverable-name Ontology codes (migration 048) standing in for this
// file's own "Architecture"/"Data Architecture" fixture pair.
const ARCH_CODE = "solution-architecture-document";
const DATA_ARCH_CODE = "database-schema-data-model";

function uniqueVersion(): string {
  return `0.0.${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

// CR-114 follow-on — createAuthoringDraft's schemaDefinitionId is now
// mandatory (no DB-layer findLatest fallback); every call site here must
// resolve and pass a real schema_definitions row for the kind it's authoring.
const schemaDefinitionIdCache = new Map<SchemaDefinitionEntityKind, string>();
async function schemaDefinitionIdFor(kind: SchemaDefinitionEntityKind): Promise<string> {
  const cached = schemaDefinitionIdCache.get(kind);
  if (cached) return cached;
  const { data } = await schemaDefinitionsDB.findLatest(kind);
  if (!data) throw new Error(`no schema_definitions grammar for ${kind}`);
  schemaDefinitionIdCache.set(kind, data.id);
  return data.id;
}

async function advanceToActive(kind: "Template" | "Deliverable", id: string, actorId: string): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  return advanceAuthoringDraftToActive(kind, id, actorId);
}

async function publishDeliverableDefinition(code: string, tenantId: string, parentDeliverableDefinitionId?: string): Promise<string> {
  // A Deliverable Definition code is a composable Ontology value: it must exist in the Ontology before the Definition is Published.
  createdOntologyConceptCodes.push(code);
  await syncConceptFromEntity("deliverable-name", code, code, "Phase 2 test fixture", tenantId, ROOT_ACTOR_ID);
  const created = await createAuthoringDraft({
    kind: "Deliverable", schemaDefinitionId: await schemaDefinitionIdFor("Deliverable"),
    actorId: ROOT_ACTOR_ID,
    authorBadge: "root",
    tenantId,
    parentDeliverableDefinitionId,
    content: { code, description: "Phase 2 test fixture", definitionVersion: "1.0.0" },
  });
  assert.equal(created.ok, true, !created.ok ? created.errors.join("; ") : "assertion failed");
  if (!created.ok) throw new Error("unreachable");
  createdDeliverableDefinitionIds.push(created.draftId);
  const published = await advanceToActive("Deliverable", created.draftId, ROOT_ACTOR_ID);
  assert.equal(published.ok, true, !published.ok ? published.errors.join("; ") : "assertion failed");
  return created.draftId;
}

function templateContent(code: string, version: string, catalogue: Array<{ code: string; category: string }>, dependencyGraph: Array<Record<string, unknown>>): Record<string, unknown> {
  return {
    code,
    templateVersion: version,
    name: "Dependency Graph Relationship Kind Test Template",
    engineeringPackCodes: [{ packCode: "test-testing-qa" }], // real (migration 119), test-only twin — never the real production Pack (see testFixtures.ts's header). NOT test-development: that twin (and test-requirements-analysis/test-architecture-solution-design) are deliberately never published — see seedTestFixturePacks.ts's own header.
    deliverableCatalogue: catalogue,
    dependencyGraph,
  };
}

async function publishParentTemplate(dependencyGraph: Array<Record<string, unknown>>): Promise<{ id: string; version: string }> {
  const version = uniqueVersion();
  const catalogue = [
    { code: ARCH_CODE, category: "Architecture" },
    { code: DATA_ARCH_CODE, category: "Architecture" },
  ];
  const created = await createAuthoringDraft({ kind: "Template", authorBadge: "template_define", schemaDefinitionId: await schemaDefinitionIdFor("Template"), actorId: ROOT_ACTOR_ID, content: templateContent(REAL_TEMPLATE_CODE, version, catalogue, dependencyGraph) });
  assert.equal(created.ok, true, !created.ok ? created.errors.join("; ") : "assertion failed");
  if (!created.ok) throw new Error("unreachable");
  createdTemplateIds.push(created.draftId);
  const published = await advanceToActive("Template", created.draftId, ROOT_ACTOR_ID);
  assert.equal(published.ok, true, !published.ok ? published.errors.join("; ") : "assertion failed");
  return { id: created.draftId, version };
}

const DECOMPOSITION_EDGE = { toCode: DATA_ARCH_CODE, fromType: "Deliverable", fromCode: ARCH_CODE, requiredState: "Approved", relationshipKind: "decomposition" };

test("CR-049 Phase 2: a plain 'dependency' edge is unrestricted on Template Inheritance — unchanged behaviour", async () => {
  const plainEdge = { toCode: DATA_ARCH_CODE, fromType: "Deliverable", fromCode: ARCH_CODE, requiredState: "Approved", relationshipKind: "dependency" };
  const parent = await publishParentTemplate([plainEdge]);

  // Derived Template drops the edge entirely — must NOT be rejected, since
  // plain dependency edges carry no inheritance-preservation rule (today's
  // existing, unchanged behaviour).
  const childCreated = await createAuthoringDraft({
    kind: "Template", authorBadge: "template_define", schemaDefinitionId: await schemaDefinitionIdFor("Template"),
    actorId: ROOT_ACTOR_ID,
    tenantId: DEMO_TENANT_ID,
    parentTemplateId: parent.id,
    content: templateContent(REAL_TEMPLATE_CODE, uniqueVersion(), [{ code: ARCH_CODE, category: "Architecture" }], []),
  });
  assert.equal(childCreated.ok, true, !childCreated.ok ? childCreated.errors.join("; ") : "assertion failed");
  if (!childCreated.ok) return;
  createdTemplateIds.push(childCreated.draftId);
  const childPublished = await advanceToActive("Template", childCreated.draftId, ROOT_ACTOR_ID);
  assert.equal(childPublished.ok, true, !childPublished.ok ? childPublished.errors.join("; ") : "assertion failed");
});

test("CR-049 Phase 2: a Decomposition edge is locked — dropping it on a derived Template refuses the save", async () => {
  const parent = await publishParentTemplate([DECOMPOSITION_EDGE]);

  const version = uniqueVersion();
  const catalogue = [{ code: ARCH_CODE, category: "Architecture" }, { code: DATA_ARCH_CODE, category: "Architecture" }];
  const childCreated = await createAuthoringDraft({
    kind: "Template", authorBadge: "template_define", schemaDefinitionId: await schemaDefinitionIdFor("Template"),
    actorId: ROOT_ACTOR_ID,
    tenantId: DEMO_TENANT_ID,
    parentTemplateId: parent.id,
    content: templateContent(REAL_TEMPLATE_CODE, version, catalogue, [DECOMPOSITION_EDGE]),
  });
  assert.equal(childCreated.ok, true, !childCreated.ok ? childCreated.errors.join("; ") : "assertion failed");
  if (!childCreated.ok) return;
  createdTemplateIds.push(childCreated.draftId);

  // The locked-edge rule is an On save check (CR-128): save is refused and the stored content is unchanged.
  const saved = await saveAuthoringDraft({ actorId: ROOT_ACTOR_ID, kind: "Template", id: childCreated.draftId, content: templateContent(REAL_TEMPLATE_CODE, version, catalogue, []) });
  assert.equal(saved.ok, false, "dropping an inherited Decomposition edge must refuse the save");
  assert.match((!saved.ok && saved.errors.join(";")) || "", /decomposition/);
});

test("CR-049 Phase 2: a Decomposition edge may be renamed to the tenant's own Deliverable Definition, provided its lineage traces back to the parent's name", async () => {
  const parent = await publishParentTemplate([DECOMPOSITION_EDGE]);

  // Real Phase 1 lineage: Platform root Definitions "Architecture"/"Data
  // Architecture" (may already exist from other test runs against this
  // shared dev database — findActiveByCode-based isRenameOf only needs SOME
  // Active row at that code+tenant, so publishing again under a fresh
  // version is fine and harmless either way). Tenant specialises both.
  const archCode = `phase2-architecture-${randomUUID()}`;
  const dataArchCode = `phase2-data-architecture-${randomUUID()}`;
  const platformArchId = await publishDeliverableDefinition(archCode, PLATFORM_TENANT_ID);
  const platformDataArchId = await publishDeliverableDefinition(dataArchCode, PLATFORM_TENANT_ID);

  // The parent Template's own edge must reference these exact codes for the
  // lineage chain to resolve — publish a fresh parent using them instead of
  // the fixed ARCH_CODE/DATA_ARCH_CODE constants the other tests use.
  const parentVersion = uniqueVersion();
  const parentCreated = await createAuthoringDraft({
    kind: "Template", authorBadge: "template_define", schemaDefinitionId: await schemaDefinitionIdFor("Template"),
    actorId: ROOT_ACTOR_ID,
    content: templateContent(REAL_TEMPLATE_CODE, parentVersion, [{ code: archCode, category: "Architecture" }, { code: dataArchCode, category: "Architecture" }], [
      { toCode: dataArchCode, fromType: "Deliverable", fromCode: archCode, requiredState: "Approved", relationshipKind: "decomposition" },
    ]),
  });
  assert.equal(parentCreated.ok, true, !parentCreated.ok ? parentCreated.errors.join("; ") : "assertion failed");
  if (!parentCreated.ok) return;
  createdTemplateIds.push(parentCreated.draftId);
  const parentPublished = await advanceToActive("Template", parentCreated.draftId, ROOT_ACTOR_ID);
  assert.equal(parentPublished.ok, true, !parentPublished.ok ? parentPublished.errors.join("; ") : "assertion failed");

  const tenantArchCode = `phase2-tenant-architecture-${randomUUID()}`;
  const tenantDataArchCode = `phase2-tenant-data-architecture-${randomUUID()}`;
  await publishDeliverableDefinition(tenantArchCode, DEMO_TENANT_ID, platformArchId);
  await publishDeliverableDefinition(tenantDataArchCode, DEMO_TENANT_ID, platformDataArchId);

  const childCreated = await createAuthoringDraft({
    kind: "Template", authorBadge: "template_define", schemaDefinitionId: await schemaDefinitionIdFor("Template"),
    actorId: ROOT_ACTOR_ID,
    tenantId: DEMO_TENANT_ID,
    parentTemplateId: parentCreated.draftId,
    content: templateContent(REAL_TEMPLATE_CODE, uniqueVersion(), [{ code: tenantArchCode, category: "Architecture" }, { code: tenantDataArchCode, category: "Architecture" }], [
      { toCode: tenantDataArchCode, fromType: "Deliverable", fromCode: tenantArchCode, requiredState: "Approved", relationshipKind: "decomposition" },
    ]),
  });
  assert.equal(childCreated.ok, true, !childCreated.ok ? childCreated.errors.join("; ") : "assertion failed");
  if (!childCreated.ok) return;
  createdTemplateIds.push(childCreated.draftId);

  const childPublished = await advanceToActive("Template", childCreated.draftId, ROOT_ACTOR_ID);
  assert.equal(childPublished.ok, true, !childPublished.ok ? childPublished.errors.join("; ") : "a legitimate rename (tracing back through Phase 1 lineage) must be accepted");
});

test("CR-049 Phase 2: renaming a locked edge to an UNRELATED Deliverable Definition (no lineage) still refuses the save", async () => {
  const parent = await publishParentTemplate([DECOMPOSITION_EDGE]);

  // A tenant Deliverable Definition with NO parent_deliverable_definition_id
  // at all — not derived from Platform's "Architecture" in any way.
  const unrelatedCode = `phase2-unrelated-${randomUUID()}`;
  await publishDeliverableDefinition(unrelatedCode, DEMO_TENANT_ID);

  const version = uniqueVersion();
  const childCreated = await createAuthoringDraft({
    kind: "Template", authorBadge: "template_define", schemaDefinitionId: await schemaDefinitionIdFor("Template"),
    actorId: ROOT_ACTOR_ID,
    tenantId: DEMO_TENANT_ID,
    parentTemplateId: parent.id,
    content: templateContent(REAL_TEMPLATE_CODE, version, [{ code: ARCH_CODE, category: "Architecture" }, { code: DATA_ARCH_CODE, category: "Architecture" }], [DECOMPOSITION_EDGE]),
  });
  assert.equal(childCreated.ok, true, !childCreated.ok ? childCreated.errors.join("; ") : "assertion failed");
  if (!childCreated.ok) return;
  createdTemplateIds.push(childCreated.draftId);

  // The locked-edge rule is an On save check (CR-128): the rename has no lineage back to the parent's name, so the save is refused.
  const saved = await saveAuthoringDraft({
    actorId: ROOT_ACTOR_ID, kind: "Template", id: childCreated.draftId,
    content: templateContent(REAL_TEMPLATE_CODE, version, [{ code: unrelatedCode, category: "Architecture" }, { code: DATA_ARCH_CODE, category: "Architecture" }], [
      { toCode: DATA_ARCH_CODE, fromType: "Deliverable", fromCode: unrelatedCode, requiredState: "Approved", relationshipKind: "decomposition" },
    ]),
  });
  assert.equal(saved.ok, false, "an unrelated name with no lineage back to the parent's own must NOT count as a valid rename");
  assert.match((!saved.ok && saved.errors.join(";")) || "", /decomposition/);
});

test("CR-049 Phase 2: a Derivation edge is freely editable on Template Inheritance — no lock at all", async () => {
  const derivationEdge = { toCode: DATA_ARCH_CODE, fromType: "Deliverable", fromCode: ARCH_CODE, requiredState: "Approved", relationshipKind: "derivation" };
  const parent = await publishParentTemplate([derivationEdge]);

  // Derived Template drops the Derivation edge entirely — must succeed,
  // unlike the Decomposition case above.
  const childCreated = await createAuthoringDraft({
    kind: "Template", authorBadge: "template_define", schemaDefinitionId: await schemaDefinitionIdFor("Template"),
    actorId: ROOT_ACTOR_ID,
    tenantId: DEMO_TENANT_ID,
    parentTemplateId: parent.id,
    content: templateContent(REAL_TEMPLATE_CODE, uniqueVersion(), [{ code: ARCH_CODE, category: "Architecture" }], []),
  });
  assert.equal(childCreated.ok, true, !childCreated.ok ? childCreated.errors.join("; ") : "assertion failed");
  if (!childCreated.ok) return;
  createdTemplateIds.push(childCreated.draftId);
  const childPublished = await advanceToActive("Template", childCreated.draftId, ROOT_ACTOR_ID);
  assert.equal(childPublished.ok, true, !childPublished.ok ? childPublished.errors.join("; ") : "assertion failed");
});
