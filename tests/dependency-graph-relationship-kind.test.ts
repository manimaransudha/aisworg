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
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { deliverableDefinitionsDB } from "../src/dblayer/deliverableDefinitionsDB.js";
import { PLATFORM_TENANT_ID } from "../src/dblayer/constants.js";
import { createAuthoringDraft, saveAuthoringDraft, publishAuthoringDraft } from "../src/routes/seu/core/sdkAuthoring.js";

const createdTemplateIds: string[] = [];
const createdDeliverableDefinitionIds: string[] = [];
const createdOntologyConceptCodes: string[] = [];

after(async () => {
  if (createdOntologyConceptCodes.length) {
    await pool.query("DELETE FROM ontology_concepts WHERE concept_type = 'deliverable-name' AND code = ANY($1::text[])", [createdOntologyConceptCodes]);
  }
  if (createdDeliverableDefinitionIds.length) {
    await pool.query("UPDATE deliverable_definitions SET parent_deliverable_definition_id = NULL WHERE id = ANY($1::uuid[])", [createdDeliverableDefinitionIds]);
    await pool.query("DELETE FROM events WHERE originating_object_type = 'DeliverableDefinition' AND originating_object_id = ANY($1::uuid[])", [createdDeliverableDefinitionIds]);
    await pool.query("DELETE FROM deliverable_definitions WHERE id = ANY($1::uuid[])", [createdDeliverableDefinitionIds]);
  }
  if (createdTemplateIds.length) {
    await pool.query("DELETE FROM template_packs WHERE template_id = ANY($1::uuid[])", [createdTemplateIds]);
    await pool.query("DELETE FROM template_capabilities WHERE template_id = ANY($1::uuid[])", [createdTemplateIds]);
    await pool.query("DELETE FROM dependency_definitions WHERE owning_entity_type = 'Template' AND owning_entity_id = ANY($1::uuid[])", [createdTemplateIds]);
    await pool.query("DELETE FROM events WHERE originating_object_type = 'Template' AND originating_object_id = ANY($1::uuid[])", [createdTemplateIds]);
    await pool.query("DELETE FROM templates WHERE id = ANY($1::uuid[])", [createdTemplateIds]);
  }
  await pool.end();
});

const ROOT_ACTOR_ID = "1";
const DEMO_TENANT_ID = "22222222-2222-2222-2222-222222222222";
const REAL_TEMPLATE_CODE = "mobile-application"; // real, seeded template-categories concept

function uniqueVersion(): string {
  return `0.0.${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

async function advanceToActive(kind: "Template" | "Deliverable", id: string, actorId: string, actorRole: string): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  for (let i = 0; i < 10; i++) {
    const result = await publishAuthoringDraft({ kind, id, actorId, actorRole });
    if (!result.ok) return result;
    if (result.status === "Active") return { ok: true };
  }
  return { ok: false, errors: ["did not reach Active within 10 hops"] };
}

async function publishDeliverableDefinition(code: string, tenantId: string, parentDeliverableDefinitionId?: string): Promise<string> {
  createdOntologyConceptCodes.push(code);
  const created = await createAuthoringDraft({
    kind: "Deliverable",
    actorId: ROOT_ACTOR_ID,
    tenantId,
    parentDeliverableDefinitionId,
    content: { code, description: "Phase 2 test fixture", definitionVersion: "1.0.0" },
  });
  assert.equal(created.ok, true, !created.ok ? created.errors.join("; ") : undefined);
  if (!created.ok) throw new Error("unreachable");
  createdDeliverableDefinitionIds.push(created.draftId);
  const published = await advanceToActive("Deliverable", created.draftId, ROOT_ACTOR_ID, "general");
  assert.equal(published.ok, true, !published.ok ? published.errors.join("; ") : undefined);
  return created.draftId;
}

function templateContent(code: string, version: string, catalogue: Array<{ name: string; category: string }>, dependencyGraph: Array<Record<string, unknown>>): Record<string, unknown> {
  return {
    code,
    templateVersion: version,
    name: "Dependency Graph Relationship Kind Test Template",
    engineeringPackCodes: [{ packCode: "platform-core-engineering" }], // real, seeded mandatory Pack (ensureWebAppTemplateFixture's own)
    deliverableCatalogue: catalogue,
    dependencyGraph,
  };
}

async function publishParentTemplate(dependencyGraph: Array<Record<string, unknown>>): Promise<{ id: string; version: string }> {
  const version = uniqueVersion();
  const catalogue = [
    { name: "Architecture", category: "Architecture" },
    { name: "Data Architecture", category: "Architecture" },
  ];
  const created = await createAuthoringDraft({ kind: "Template", actorId: ROOT_ACTOR_ID, content: templateContent(REAL_TEMPLATE_CODE, version, catalogue, dependencyGraph) });
  assert.equal(created.ok, true, !created.ok ? created.errors.join("; ") : undefined);
  if (!created.ok) throw new Error("unreachable");
  createdTemplateIds.push(created.draftId);
  const published = await advanceToActive("Template", created.draftId, ROOT_ACTOR_ID, "general");
  assert.equal(published.ok, true, !published.ok ? published.errors.join("; ") : undefined);
  return { id: created.draftId, version };
}

const DECOMPOSITION_EDGE = { toName: "Data Architecture", fromType: "Deliverable", fromName: "Architecture", requiredState: "Approved", relationshipKind: "decomposition" };

test("CR-049 Phase 2: a plain 'dependency' edge is unrestricted on Template Inheritance — unchanged behaviour", async () => {
  const plainEdge = { toName: "Data Architecture", fromType: "Deliverable", fromName: "Architecture", requiredState: "Approved", relationshipKind: "dependency" };
  const parent = await publishParentTemplate([plainEdge]);

  // Derived Template drops the edge entirely — must NOT be rejected, since
  // plain dependency edges carry no inheritance-preservation rule (today's
  // existing, unchanged behaviour).
  const childCreated = await createAuthoringDraft({
    kind: "Template",
    actorId: ROOT_ACTOR_ID,
    tenantId: DEMO_TENANT_ID,
    parentTemplateId: parent.id,
    content: templateContent(REAL_TEMPLATE_CODE, uniqueVersion(), [{ name: "Architecture", category: "Architecture" }], []),
  });
  assert.equal(childCreated.ok, true, !childCreated.ok ? childCreated.errors.join("; ") : undefined);
  if (!childCreated.ok) return;
  createdTemplateIds.push(childCreated.draftId);
  const childPublished = await advanceToActive("Template", childCreated.draftId, ROOT_ACTOR_ID, "general");
  assert.equal(childPublished.ok, true, !childPublished.ok ? childPublished.errors.join("; ") : undefined);
});

test("CR-049 Phase 2: a Decomposition edge is locked — dropping it on a derived Template blocks publish", async () => {
  const parent = await publishParentTemplate([DECOMPOSITION_EDGE]);

  const childCreated = await createAuthoringDraft({
    kind: "Template",
    actorId: ROOT_ACTOR_ID,
    tenantId: DEMO_TENANT_ID,
    parentTemplateId: parent.id,
    content: templateContent(REAL_TEMPLATE_CODE, uniqueVersion(), [{ name: "Architecture", category: "Architecture" }, { name: "Data Architecture", category: "Architecture" }], []),
  });
  assert.equal(childCreated.ok, true, !childCreated.ok ? childCreated.errors.join("; ") : undefined);
  if (!childCreated.ok) return;
  createdTemplateIds.push(childCreated.draftId);

  const childPublished = await advanceToActive("Template", childCreated.draftId, ROOT_ACTOR_ID, "general");
  assert.equal(childPublished.ok, false, "dropping an inherited Decomposition edge must block publish");
  assert.match((!childPublished.ok && childPublished.errors.join(";")) || "", /decomposition/);
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
  // the fixed "Architecture"/"Data Architecture" literals the other tests use.
  const parentVersion = uniqueVersion();
  const parentCreated = await createAuthoringDraft({
    kind: "Template",
    actorId: ROOT_ACTOR_ID,
    content: templateContent(REAL_TEMPLATE_CODE, parentVersion, [{ name: archCode, category: "Architecture" }, { name: dataArchCode, category: "Architecture" }], [
      { toName: dataArchCode, fromType: "Deliverable", fromName: archCode, requiredState: "Approved", relationshipKind: "decomposition" },
    ]),
  });
  assert.equal(parentCreated.ok, true, !parentCreated.ok ? parentCreated.errors.join("; ") : undefined);
  if (!parentCreated.ok) return;
  createdTemplateIds.push(parentCreated.draftId);
  const parentPublished = await advanceToActive("Template", parentCreated.draftId, ROOT_ACTOR_ID, "general");
  assert.equal(parentPublished.ok, true, !parentPublished.ok ? parentPublished.errors.join("; ") : undefined);

  const tenantArchCode = `phase2-tenant-architecture-${randomUUID()}`;
  const tenantDataArchCode = `phase2-tenant-data-architecture-${randomUUID()}`;
  await publishDeliverableDefinition(tenantArchCode, DEMO_TENANT_ID, platformArchId);
  await publishDeliverableDefinition(tenantDataArchCode, DEMO_TENANT_ID, platformDataArchId);

  const childCreated = await createAuthoringDraft({
    kind: "Template",
    actorId: ROOT_ACTOR_ID,
    tenantId: DEMO_TENANT_ID,
    parentTemplateId: parentCreated.draftId,
    content: templateContent(REAL_TEMPLATE_CODE, uniqueVersion(), [{ name: tenantArchCode, category: "Architecture" }, { name: tenantDataArchCode, category: "Architecture" }], [
      { toName: tenantDataArchCode, fromType: "Deliverable", fromName: tenantArchCode, requiredState: "Approved", relationshipKind: "decomposition" },
    ]),
  });
  assert.equal(childCreated.ok, true, !childCreated.ok ? childCreated.errors.join("; ") : undefined);
  if (!childCreated.ok) return;
  createdTemplateIds.push(childCreated.draftId);

  const childPublished = await advanceToActive("Template", childCreated.draftId, ROOT_ACTOR_ID, "general");
  assert.equal(childPublished.ok, true, !childPublished.ok ? childPublished.errors.join("; ") : "a legitimate rename (tracing back through Phase 1 lineage) must be accepted");
});

test("CR-049 Phase 2: renaming a locked edge to an UNRELATED Deliverable Definition (no lineage) still blocks publish", async () => {
  const parent = await publishParentTemplate([DECOMPOSITION_EDGE]);

  // A tenant Deliverable Definition with NO parent_deliverable_definition_id
  // at all — not derived from Platform's "Architecture" in any way.
  const unrelatedCode = `phase2-unrelated-${randomUUID()}`;
  await publishDeliverableDefinition(unrelatedCode, DEMO_TENANT_ID);

  const childCreated = await createAuthoringDraft({
    kind: "Template",
    actorId: ROOT_ACTOR_ID,
    tenantId: DEMO_TENANT_ID,
    parentTemplateId: parent.id,
    content: templateContent(REAL_TEMPLATE_CODE, uniqueVersion(), [{ name: unrelatedCode, category: "Architecture" }, { name: "Data Architecture", category: "Architecture" }], [
      { toName: "Data Architecture", fromType: "Deliverable", fromName: unrelatedCode, requiredState: "Approved", relationshipKind: "decomposition" },
    ]),
  });
  assert.equal(childCreated.ok, true, !childCreated.ok ? childCreated.errors.join("; ") : undefined);
  if (!childCreated.ok) return;
  createdTemplateIds.push(childCreated.draftId);

  const childPublished = await advanceToActive("Template", childCreated.draftId, ROOT_ACTOR_ID, "general");
  assert.equal(childPublished.ok, false, "an unrelated name with no lineage back to the parent's own must NOT count as a valid rename");
  assert.match((!childPublished.ok && childPublished.errors.join(";")) || "", /decomposition/);
});

test("CR-049 Phase 2: a Derivation edge is freely editable on Template Inheritance — no lock at all", async () => {
  const derivationEdge = { toName: "Data Architecture", fromType: "Deliverable", fromName: "Architecture", requiredState: "Approved", relationshipKind: "derivation" };
  const parent = await publishParentTemplate([derivationEdge]);

  // Derived Template drops the Derivation edge entirely — must succeed,
  // unlike the Decomposition case above.
  const childCreated = await createAuthoringDraft({
    kind: "Template",
    actorId: ROOT_ACTOR_ID,
    tenantId: DEMO_TENANT_ID,
    parentTemplateId: parent.id,
    content: templateContent(REAL_TEMPLATE_CODE, uniqueVersion(), [{ name: "Architecture", category: "Architecture" }], []),
  });
  assert.equal(childCreated.ok, true, !childCreated.ok ? childCreated.errors.join("; ") : undefined);
  if (!childCreated.ok) return;
  createdTemplateIds.push(childCreated.draftId);
  const childPublished = await advanceToActive("Template", childCreated.draftId, ROOT_ACTOR_ID, "general");
  assert.equal(childPublished.ok, true, !childPublished.ok ? childPublished.errors.join("; ") : undefined);
});
