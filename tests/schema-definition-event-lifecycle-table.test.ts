// CR-115 — Version Feature Plan.md, point 1 discipline: an executable check
// of Ch.39 §15's SchemaDefinition table, same shape as
// policy-definition-event-lifecycle-table.test.ts / objective-event-lifecycle-table.test.ts.
// SchemaDefinition's own lifecycle (CR-128): a birth row (None -> Created) fired by
// createSchemaVersion, three 'governed' auto-advance steps
// (Created->Validated->Tested->Packaged, each carrying its own verb and badge, no button)
// followed by autoAdvanceGoverned, plus two real 'manual', badge-gated decisions
// (Packaged->Published / Packaged->PublicationRejected) fired through the generic
// transitionEntity. No version_event on any
// row — SchemaDefinition's own version/schema columns are the versioning
// mechanism (createSchemaVersion is additive-only), so the Version Feature
// Plan's version_event wiring does not apply here.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";

import { query } from "../src/utils/db.js";
import { BIRTH_STATE, SDK_ATTENTION_EVENT, UNDEFINED_EVENT } from "../src/dblayer/constants.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { routeAuthorityDB } from "../src/dblayer/routeAuthorityDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import { participantsMasterDB } from "../src/dblayer/participantsMasterDB.js";
import type { SchemaDefinitionRow, TransitionEntityType } from "../src/dblayer/seuTypes.js";
import { transitionEngine } from "../src/domain/engine/transitionEngine.js";
import { nextActionsFor } from "../src/domain/engine/entityTransition.js";
import { transitionAndPublish } from "./testFixtures.js";
import { createSchemaVersion } from "../src/routes/seu/core/schemaRegistry.js";
import { TESTER_ALL_ID, TESTER_OBJECTIVE_ACHIEVE_ONLY, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE, grantBadge } from "./testFixtures.js";

// This file reuses the real "Capability" entity_kind as its fixture (see
// freshCreatedSchema below), which otherwise permanently pollutes
// schema_definitions.findLatest("Capability") for every other test and the
// real app with throwaway {code: string}-only schemas. No application
// delete path exists for schema_definitions (append-only at the app layer),
// so this is a raw test-only cleanup query, never a DB-layer method —
// every id this file creates is tracked here and deleted after the file's
// own tests finish, restoring findLatest("Capability") to the real row.
const createdSchemaIds: string[] = [];

after(async () => {
  if (createdSchemaIds.length === 0) return;
  await query("DELETE FROM schema_definitions WHERE id = ANY($1::uuid[])", [createdSchemaIds]);
});

// TESTER_ALL_ID holds every noun_verb grant seeded for tests, so it
// is authorised for schemadefinition_publish/schemadefinition_reject without
// needing root. A plain id with no grants proves the denial path.
const NO_BADGE_ACTOR_ID = "999999";
const UNKNOWN_ID = "00000000-0000-0000-0000-000000000000";

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
  { row: 0, description: "Create (birth)", fromState: BIRTH_STATE, toState: "Created", trigger: "manual", verb: "create", eventType: "SDKElementSchemaCreated" },
  { row: 1, description: "Validate", fromState: "Created", toState: "Validated", trigger: "governed", verb: "validate", eventType: "SDKElementSchemaValidated" },
  { row: 2, description: "Test", fromState: "Validated", toState: "Tested", trigger: "governed", verb: "test", eventType: "SDKElementSchemaTested" },
  { row: 3, description: "Package", fromState: "Tested", toState: "Packaged", trigger: "governed", verb: "package", eventType: "SDKElementSchemaPackaged" },
  { row: 4, description: "Publish", fromState: "Packaged", toState: "Published", trigger: "manual", verb: "publish", eventType: "SDKElementSchemaPublished" },
  { row: 5, description: "Reject", fromState: "Packaged", toState: "PublicationRejected", trigger: "manual", verb: "reject", eventType: "SDKElementSchemaPublicationRejected" },
];

async function freshCreatedSchema(): Promise<{ id: string; entityKind: string }> {
  const entityKind = "Capability";
  const { data: existing } = await schemaDefinitionsDB.findAllVersions(entityKind);
  const nextVersion = (existing ?? []).reduce((max, e) => Math.max(max, e.version), 0) + 1;
  const { data: root } = await participantsMasterDB.findById(ROOT_ACTOR_ID);
  if (!root) throw new Error("No participants_master row for user_id 1 -- log in as root first.");
  const { data: birth } = await transitionDefinitionsDB.findBirth("SchemaDefinition");
  if (!birth) throw new Error("no birth Transition Definition for SchemaDefinition -- is db:clean-slate seeded?");
  const { data: created, error } = await schemaDefinitionsDB.create({
    entityKind,
    version: nextVersion,
    schema: { type: "object", properties: { code: { type: "string" } } },
    lifecycleState: birth.to_state as SchemaDefinitionRow["lifecycle_state"],
    authorId: root.id,
    authorBadge: "root",
  });
  if (error || !created) throw error ?? new Error("failed to create bare schema_definitions row");
  createdSchemaIds.push(created.id);
  return { id: created.id, entityKind };
}

async function trackedCreateSchemaVersion(input: Parameters<typeof createSchemaVersion>[0]): ReturnType<typeof createSchemaVersion> {
  const result = await createSchemaVersion(input);
  if (result.ok) createdSchemaIds.push(result.schema.id);
  return result;
}

async function packagedSchema(): Promise<SchemaDefinitionRow> {
  const created = await freshCreatedSchema();
  const packaged = await trackedCreateSchemaVersion({ entityKind: created.entityKind, schemaJson: JSON.stringify({ type: "object", properties: {} }), actorId: ROOT_ACTOR_ID });
  assert.equal(packaged.ok, true);
  if (!packaged.ok) throw new Error("createSchemaVersion failed");
  return packaged.schema;
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

test("DEFINITION: route_authority (CR-110) gates the transition route to the sdk_author role", async () => {
  const { data: rows } = await routeAuthorityDB.findAll();
  const path = "/aisworg/seu/sdk/schema-registry/:id/transition";
  const match = (rows ?? []).find((r) => r.method === "POST" && r.path === path);
  assert.ok(match, `no route_authority row for POST ${path}`);
  assert.deepEqual(match!.roles, ["sdk_author"], `POST ${path}: roles`);
  assert.deepEqual(match!.badges, [], `POST ${path}: badges`);
  assert.equal(match!.match_mode, "all", `POST ${path}: match_mode`);
});

test("DRIVEN: createSchemaVersion births a row in Created, then auto-advances Validated -> Tested -> Packaged, one event per hop", async () => {
  const result = await trackedCreateSchemaVersion({ entityKind: "Capability", schemaJson: JSON.stringify({ type: "object", properties: { code: { type: "string" } } }), actorId: ROOT_ACTOR_ID });
  assert.equal(result.ok, true, !result.ok ? result.errors.join("; ") : "assertion failed");
  if (!result.ok) return;

  assert.equal(result.schema.lifecycle_state, "Packaged");
  // The last auto-advance hop (Tested -> Packaged, verb "package") stamps the actor's badge: root for a root actor.
  assert.equal(result.schema.author_badge, ROOT_ACTOR_BADGE);

  const { data: events } = await eventsDB.findByOriginatingObject("SchemaDefinition", result.schema.id);
  const eventTypes = (events ?? []).map((e) => e.event_type);
  assert.deepEqual(eventTypes, ["SDKElementSchemaCreated", "SDKElementSchemaValidated", "SDKElementSchemaTested", "SDKElementSchemaPackaged"]);
});

test("DRIVEN: transitionEntity moves a Packaged row to Published, records the badge, and publishes the event", async () => {
  const packaged = await packagedSchema();

  const published = await transitionAndPublish({ entityType: "SchemaDefinition", entityId: packaged.id, targetState: "Published", actorId: TESTER_ALL_ID });
  assert.equal(published.ok, true);
  if (!published.ok) return;

  const row = published.row as SchemaDefinitionRow;
  assert.equal(row.lifecycle_state, "Published");
  assert.equal(row.author_badge, ROOT_ACTOR_BADGE);
  assert.deepEqual(published.appliedTransition, { fromState: "Packaged", toState: "Published" });

  const { data: events } = await eventsDB.findByOriginatingObject("SchemaDefinition", packaged.id);
  const eventTypes = (events ?? []).map((e) => e.event_type);
  assert.deepEqual(eventTypes, ["SDKElementSchemaCreated", "SDKElementSchemaValidated", "SDKElementSchemaTested", "SDKElementSchemaPackaged", "SDKElementSchemaPublished"]);
});

test("DRIVEN: transitionEntity moves a Packaged row to PublicationRejected and records the reject badge", async () => {
  const packaged = await packagedSchema();

  const rejected = await transitionAndPublish({ entityType: "SchemaDefinition", entityId: packaged.id, targetState: "PublicationRejected", actorId: TESTER_ALL_ID });
  assert.equal(rejected.ok, true);
  if (!rejected.ok) return;

  const row = rejected.row as SchemaDefinitionRow;
  assert.equal(row.lifecycle_state, "PublicationRejected");
  assert.equal(row.author_badge, ROOT_ACTOR_BADGE);
});

test("GUARD: publish/reject only fires from Packaged — a row already at Published cannot be re-decided", async () => {
  const packaged = await packagedSchema();

  const published = await transitionAndPublish({ entityType: "SchemaDefinition", entityId: packaged.id, targetState: "Published", actorId: TESTER_ALL_ID });
  assert.equal(published.ok, true);

  const secondPublish = await transitionAndPublish({ entityType: "SchemaDefinition", entityId: packaged.id, targetState: "Published", actorId: TESTER_ALL_ID });
  assert.deepEqual({ ok: secondPublish.ok, reason: secondPublish.ok ? null : secondPublish.reason }, { ok: false, reason: "no_transition_definition" });

  const rejectAfterPublish = await transitionAndPublish({ entityType: "SchemaDefinition", entityId: packaged.id, targetState: "PublicationRejected", actorId: TESTER_ALL_ID });
  assert.deepEqual({ ok: rejectAfterPublish.ok, reason: rejectAfterPublish.ok ? null : rejectAfterPublish.reason }, { ok: false, reason: "no_transition_definition" });
});

test("AUTHORITY: an actor without schemadefinition_publish/_reject is denied, and the row stays Packaged", async () => {
  const packaged = await packagedSchema();

  const stampBeforeDenial = packaged.author_badge;
  await assert.rejects(() => transitionAndPublish({ entityType: "SchemaDefinition", entityId: packaged.id, targetState: "Published", actorId: NO_BADGE_ACTOR_ID }), /does not hold schemadefinition_publish/);

  const { data: stillPackaged } = await schemaDefinitionsDB.findById(packaged.id);
  assert.equal(stillPackaged!.lifecycle_state, "Packaged");
  // Unchanged from the stamp the Packaged row already carried — a denied
  // publish attempt must not overwrite it.
  assert.equal(stillPackaged!.author_badge, stampBeforeDenial);
});

test("AUTHORITY: an unknown schema id is rejected before any authority check", async () => {
  const denied = await transitionAndPublish({ entityType: "SchemaDefinition", entityId: UNKNOWN_ID, targetState: "Published", actorId: NO_BADGE_ACTOR_ID });
  assert.deepEqual({ ok: denied.ok, reason: denied.ok ? null : denied.reason }, { ok: false, reason: "not_found" });
});

test("BIRTH: an actor without schemadefinition_create is refused when creating a schema, and no row is written", async () => {
  const { data: before } = await schemaDefinitionsDB.findAllVersions("Capability");
  await assert.rejects(
    () => createSchemaVersion({ entityKind: "Capability", schemaJson: JSON.stringify({ type: "object", properties: {} }), actorId: TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId }),
    /does not hold schemadefinition_create/
  );
  const { data: afterRows } = await schemaDefinitionsDB.findAllVersions("Capability");
  assert.equal((afterRows ?? []).length, (before ?? []).length);
});

test("BIRTH: beginBirth throws for an entity type with no birth row", async () => {
  await assert.rejects(() => transitionEngine.beginBirth({ entityType: "NoSuchEntity" as TransitionEntityType, actorId: ROOT_ACTOR_ID }), /no birth Transition Definition for NoSuchEntity/);
});

test("BUTTONS: nextActionsFor offers Publish and Reject on Packaged to a holder of both badges, only the held one otherwise, and nothing on Created", async () => {
  const both = await nextActionsFor("SchemaDefinition", "Packaged", TESTER_ALL_ID);
  assert.deepEqual(both.map((a) => a.toState).sort(), ["PublicationRejected", "Published"]);
  assert.deepEqual(both.map((a) => a.verb).sort(), ["publish", "reject"]);

  assert.deepEqual(await nextActionsFor("SchemaDefinition", "Created", TESTER_ALL_ID), []);

  const holderId = TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId;
  const { data: holder } = await participantsMasterDB.findById(holderId);
  const badgesBefore = holder!.authorised_badges;
  try {
    assert.deepEqual(await nextActionsFor("SchemaDefinition", "Packaged", holderId), []);
    await grantBadge(holderId, "schemadefinition_publish");
    const onlyPublish = await nextActionsFor("SchemaDefinition", "Packaged", holderId);
    assert.deepEqual(onlyPublish.map((a) => a.toState), ["Published"]);
  } finally {
    await participantsMasterDB.setAuthorisedBadges(holderId, badgesBefore);
  }
});

test("GENERIC: a transition row with no event publishes Undefined and then SDKAttention", async () => {
  const created = await freshCreatedSchema();
  const toState = "TestNoEvent";
  await transitionDefinitionsDB.upsert({ entityType: "SchemaDefinition", fromState: "Created", toState, verb: "validate" });
  try {
    const result = await transitionAndPublish({ entityType: "SchemaDefinition", entityId: created.id, targetState: toState, actorId: ROOT_ACTOR_ID });
    assert.equal(result.ok, true);
    const { data: events } = await eventsDB.findByOriginatingObject("SchemaDefinition", created.id);
    assert.deepEqual((events ?? []).map((e) => e.event_type), [UNDEFINED_EVENT, SDK_ATTENTION_EVENT]);
  } finally {
    await query("DELETE FROM transition_definitions WHERE entity_type = 'SchemaDefinition' AND to_state = $1", [toState]);
  }
});

test("GENERIC: an entity type with no adapter throws", async () => {
  await assert.rejects(() => transitionAndPublish({ entityType: "Review", entityId: UNKNOWN_ID, targetState: "Prepared", actorId: ROOT_ACTOR_ID }), /no entity adapter for Review/);
});
