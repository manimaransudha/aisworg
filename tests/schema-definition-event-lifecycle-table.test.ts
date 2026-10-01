// CR-115 — Version Feature Plan.md, point 1 discipline: an executable check
// of Ch.39 §15's SchemaDefinition table, same shape as
// policy-definition-event-lifecycle-table.test.ts / objective-event-lifecycle-table.test.ts.
// SchemaDefinition's own five hops: three 'governed'/verb-null auto-advance
// steps (Created->Validated->Tested->Packaged, no badge, no button) fired by
// createSchemaVersion's autoAdvanceToPackaged, plus two real 'manual',
// badge-gated decisions (Packaged->Published / Packaged->PublicationRejected)
// fired by publishSchemaVersion/rejectSchemaVersion. No version_event on any
// row — SchemaDefinition's own version/schema columns are the versioning
// mechanism (createSchemaVersion is additive-only), so the Version Feature
// Plan's version_event wiring does not apply here.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";

import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { routeAuthorityDB } from "../src/dblayer/routeAuthorityDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import { participantsMasterDB } from "../src/dblayer/participantsMasterDB.js";
import { createSchemaVersion, publishSchemaVersion, rejectSchemaVersion } from "../src/routes/seu/core/schemaRegistry.js";
import { TESTER_ALL_ID, ROOT_ACTOR_ID } from "./testFixtures.js";

// TESTER_ALL_ID ("1001") holds every noun_verb grant seeded for tests, so it
// is authorised for schemadefinition_publish/schemadefinition_reject without
// needing root. A plain id with no grants proves the denial path.
const NO_BADGE_ACTOR_ID = "999999";

interface SchemaDefinitionTableRow {
  row: number;
  description: string;
  fromState: string;
  toState: string;
  trigger: "governed" | "manual";
  verb: string | null;
  eventType: string;
}

const SCHEMA_DEFINITION_TABLE: SchemaDefinitionTableRow[] = [
  { row: 1, description: "Validate", fromState: "Created", toState: "Validated", trigger: "governed", verb: null, eventType: "SDKElementSchemaValidated" },
  { row: 2, description: "Test", fromState: "Validated", toState: "Tested", trigger: "governed", verb: null, eventType: "SDKElementSchemaTested" },
  { row: 3, description: "Package", fromState: "Tested", toState: "Packaged", trigger: "governed", verb: null, eventType: "SDKElementSchemaPackaged" },
  { row: 4, description: "Publish", fromState: "Packaged", toState: "Published", trigger: "manual", verb: "publish", eventType: "SDKElementSchemaPublished" },
  { row: 5, description: "Reject", fromState: "Packaged", toState: "PublicationRejected", trigger: "manual", verb: "reject", eventType: "SDKElementSchemaPublicationRejected" },
];

async function freshCreatedSchema(): Promise<{ id: string; entityKind: string }> {
  const entityKind = "Capability";
  const { data: existing } = await schemaDefinitionsDB.findAllVersions(entityKind);
  const nextVersion = (existing ?? []).reduce((max, e) => Math.max(max, e.version), 0) + 1;
  const { data: root } = await participantsMasterDB.findById(ROOT_ACTOR_ID);
  if (!root) throw new Error("No participants_master row for user_id 1 -- log in as root first.");
  const { data: created, error } = await schemaDefinitionsDB.create({
    entityKind,
    version: nextVersion,
    schema: { type: "object", properties: { code: { type: "string" } } },
    authorId: root.id,
    authorBadge: "root",
  });
  if (error || !created) throw error ?? new Error("failed to create bare schema_definitions row");
  return { id: created.id, entityKind };
}

test("DEFINITION: every SchemaDefinition transition_definitions row matches Ch.39 §15's trigger/verb/event_type", async () => {
  for (const row of SCHEMA_DEFINITION_TABLE) {
    const { data: def } = await transitionDefinitionsDB.find("SchemaDefinition", row.fromState, row.toState);
    assert.ok(def, `no transition_definitions row for SchemaDefinition ${row.fromState} -> ${row.toState} (table row ${row.row}: ${row.description})`);
    assert.equal(def!.trigger, row.trigger, `row ${row.row} (${row.description}): trigger`);
    assert.equal(def!.verb, row.verb, `row ${row.row} (${row.description}): verb`);
    assert.equal(def!.event_type, row.eventType, `row ${row.row} (${row.description}): event_type`);
    assert.equal(def!.version_event, null, `row ${row.row} (${row.description}): version_event should be null`);
    assert.equal(def!.submit_verb, null, `row ${row.row} (${row.description}): submit_verb should be null`);
  }
});

test("DEFINITION: route_authority (CR-110) gates both publish/reject routes root-only", async () => {
  const { data: rows } = await routeAuthorityDB.findAll();
  for (const path of ["/aisworg/seu/sdk/schema-registry/:id/publish", "/aisworg/seu/sdk/schema-registry/:id/reject"]) {
    const match = (rows ?? []).find((r) => r.method === "POST" && r.path === path);
    assert.ok(match, `no route_authority row for POST ${path}`);
    assert.deepEqual(match!.roles, ["root"], `POST ${path}: roles`);
    assert.deepEqual(match!.badges, [], `POST ${path}: badges`);
    assert.equal(match!.match_mode, "all", `POST ${path}: match_mode`);
  }
});

test("DRIVEN: createSchemaVersion auto-advances a new row Created -> Validated -> Tested -> Packaged, one event per hop", async () => {
  const result = await createSchemaVersion({ entityKind: "Capability", schemaJson: JSON.stringify({ type: "object", properties: { code: { type: "string" } } }) });
  assert.equal(result.ok, true, !result.ok ? result.errors.join("; ") : undefined);
  if (!result.ok) return;

  assert.equal(result.schema.lifecycle_state, "Packaged");
  // Created is entity-direct authoring, not a governed transition — no
  // badge accrues to it even once the row is later advanced.
  assert.equal(result.schema.author_badge, null);

  const { data: events } = await eventsDB.findByOriginatingObject("SchemaDefinition", result.schema.id);
  const eventTypes = (events ?? []).map((e) => e.event_type);
  assert.deepEqual(eventTypes, ["SDKElementSchemaValidated", "SDKElementSchemaTested", "SDKElementSchemaPackaged"]);
});

test("DRIVEN: publishSchemaVersion moves a Packaged row to Published, records the badge, and publishes the event", async () => {
  const created = await freshCreatedSchema();
  const packaged = await createSchemaVersion({ entityKind: created.entityKind, schemaJson: JSON.stringify({ type: "object", properties: {} }) });
  assert.equal(packaged.ok, true);
  if (!packaged.ok) return;

  const published = await publishSchemaVersion(packaged.schema.id, TESTER_ALL_ID);
  assert.equal(published.ok, true, published.ok ? undefined : published.error);
  if (!published.ok) return;

  assert.equal(published.schema.lifecycle_state, "Published");
  assert.equal(published.schema.author_badge, "schemadefinition_publish");

  const { data: events } = await eventsDB.findByOriginatingObject("SchemaDefinition", packaged.schema.id);
  const eventTypes = (events ?? []).map((e) => e.event_type);
  assert.deepEqual(eventTypes, ["SDKElementSchemaValidated", "SDKElementSchemaTested", "SDKElementSchemaPackaged", "SDKElementSchemaPublished"]);
});

test("DRIVEN: rejectSchemaVersion moves a Packaged row to PublicationRejected and records the reject badge", async () => {
  const created = await freshCreatedSchema();
  const packaged = await createSchemaVersion({ entityKind: created.entityKind, schemaJson: JSON.stringify({ type: "object", properties: {} }) });
  assert.equal(packaged.ok, true);
  if (!packaged.ok) return;

  const rejected = await rejectSchemaVersion(packaged.schema.id, TESTER_ALL_ID);
  assert.equal(rejected.ok, true, rejected.ok ? undefined : rejected.error);
  if (!rejected.ok) return;

  assert.equal(rejected.schema.lifecycle_state, "PublicationRejected");
  assert.equal(rejected.schema.author_badge, "schemadefinition_reject");
});

test("GUARD: publish/reject only fires from Packaged — a row already at Published cannot be re-decided", async () => {
  const created = await freshCreatedSchema();
  const packaged = await createSchemaVersion({ entityKind: created.entityKind, schemaJson: JSON.stringify({ type: "object", properties: {} }) });
  assert.equal(packaged.ok, true);
  if (!packaged.ok) return;

  const published = await publishSchemaVersion(packaged.schema.id, TESTER_ALL_ID);
  assert.equal(published.ok, true);

  const secondPublish = await publishSchemaVersion(packaged.schema.id, TESTER_ALL_ID);
  assert.equal(secondPublish.ok, false);
  assert.match(secondPublish.ok ? "" : secondPublish.error, /Only a Packaged schema/);

  const rejectAfterPublish = await rejectSchemaVersion(packaged.schema.id, TESTER_ALL_ID);
  assert.equal(rejectAfterPublish.ok, false);
  assert.match(rejectAfterPublish.ok ? "" : rejectAfterPublish.error, /Only a Packaged schema/);
});

test("AUTHORITY: an actor without schemadefinition_publish/_reject is denied, and the row stays Packaged", async () => {
  const created = await freshCreatedSchema();
  const packaged = await createSchemaVersion({ entityKind: created.entityKind, schemaJson: JSON.stringify({ type: "object", properties: {} }) });
  assert.equal(packaged.ok, true);
  if (!packaged.ok) return;

  const denied = await publishSchemaVersion(packaged.schema.id, NO_BADGE_ACTOR_ID);
  assert.equal(denied.ok, false);
  assert.match(denied.ok ? "" : denied.error, /requires badge schemadefinition_publish/);

  const { data: stillPackaged } = await schemaDefinitionsDB.findById(packaged.schema.id);
  assert.equal(stillPackaged!.lifecycle_state, "Packaged");
  assert.equal(stillPackaged!.author_badge, null);
});

test("AUTHORITY: an unknown schema id is rejected before any authority check", async () => {
  const denied = await publishSchemaVersion("00000000-0000-0000-0000-000000000000", TESTER_ALL_ID);
  assert.equal(denied.ok, false);
  assert.match(denied.ok ? "" : denied.error, /not found/);
});
