// Version Feature Plan.md, point 1: an executable check of Events and
// Lifecycles.md's Ontology Model table (Ch.18), same discipline as
// service-definition-event-lifecycle-table.test.ts (Ch.11). Ontology's own
// shape is the most unusual of the entities covered so far: there is no
// Draft/Defined prefix at all (a concept goes live the moment it's added —
// no review workflow, Ch.18 §18.8) and rows 1-4 (New/Edit/Edit metadata/
// Compose) are ALL ungoverned (no transition_definitions row, gated only by
// the ontology_define authoring badge) yet still publish real events
// (ConceptCreated/ConceptUpdated/OntologyComposed) — unlike every other
// entity's own "New"/"Edit" rows (Objective/Pack/Template/Profile/Service
// Definition), which are pure Revisions with NO event at all. Only rows 5-7
// (Deprecate/Retire/Archive) are real governed transitions with
// transition_definitions rows.
//
//   - DEFINITION: rows 5-7's transition_definitions record (event_type/
//     version_event) matches the table; rows 1-4 have no
//     transition_definitions row at all (confirmed absent, not just unchecked).
//   - DRIVEN: every row is actually exercised through the real functions
//     (addConcept/updateConceptMeta/composeConcept/deprecateConcept/
//     retireConcept/archiveConcept) and the events they publish are
//     asserted against eventsDB directly — no mocking.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { ontologyDB } from "../src/dblayer/ontologyDB.js";
import { PLATFORM_TENANT_ID } from "../src/dblayer/constants.js";
import { addConcept, updateConceptMeta, composeConcept, deprecateConcept, retireConcept, archiveConcept, type OntologyActor } from "../src/routes/seu/core/ontology.js";

// TESTER_ALL_ID (1001, seedIdentityBaseline.ts) — "holds every active
// noun_verb (any authorised transition)" — the same standing test-fixture
// actor every other lifecycle-table test file already uses for its governed
// transitions (ontology_deprecate/ontology_retire/ontology_archive here).
const ACTOR: OntologyActor = { isRoot: true, tenantId: null, actorId: "1001" };
const CONCEPT_TYPE_PREFIX = "test-ontology-lifecycle";

function freshConceptType(): string {
  return `${CONCEPT_TYPE_PREFIX}-${randomUUID()}`;
}

interface OntologyTableRow {
  row: number;
  description: string;
  fromState: string;
  toState: string;
  eventType: string;
  versionEvent: string | null;
}

// Rows 5-7 only — rows 1-4 (New/Edit/Edit metadata/Compose) have no
// transition_definitions row at all (see the DEFINITION test below, which
// confirms the absence directly rather than skipping it).
const ONTOLOGY_TABLE: OntologyTableRow[] = [
  { row: 5, description: "Deprecate", fromState: "Active", toState: "Deprecated", eventType: "ConceptDeprecated", versionEvent: "VersionDeprecated" },
  { row: 6, description: "Retire", fromState: "Deprecated", toState: "Retired", eventType: "OntologyConceptRetired", versionEvent: "VersionSuperseded" },
  { row: 7, description: "Archive", fromState: "Retired", toState: "Archived", eventType: "OntologyConceptArchived", versionEvent: "VersionArchived" },
];

test("DEFINITION: every Ontology governed transition_definitions row (5-7) matches Events and Lifecycles.md's event_type/version_event", async () => {
  for (const row of ONTOLOGY_TABLE) {
    const { data: def } = await transitionDefinitionsDB.find("Ontology", row.fromState, row.toState);
    assert.ok(def, `no transition_definitions row for Ontology ${row.fromState} -> ${row.toState} (table row ${row.row}: ${row.description})`);
    assert.equal(def!.event_type, row.eventType, `row ${row.row} (${row.description}): event_type`);
    assert.equal(def!.version_event, row.versionEvent, `row ${row.row} (${row.description}): version_event`);
    assert.equal(def!.submit_verb, null, `row ${row.row} (${row.description}): submit_verb should be null`);
  }
});

test("DEFINITION: rows 1-4 (New/Edit/Edit metadata/Compose) have no transition_definitions row — confirmed absent, not a gap", async () => {
  const { data: all } = await transitionDefinitionsDB.listAll();
  const ontologyRows = (all ?? []).filter((r) => r.entity_type === "Ontology");
  assert.equal(ontologyRows.length, ONTOLOGY_TABLE.length, `expected exactly the ${ONTOLOGY_TABLE.length} governed rows (5-7), got: ${JSON.stringify(ontologyRows.map((r) => `${r.from_state}->${r.to_state}`))}`);
});

test("DRIVEN: row 1 (New) publishes ConceptCreated despite being ungoverned (no transition_definitions row)", async () => {
  const conceptType = freshConceptType();
  const code = "first-code";
  const created = await addConcept({ conceptType, code, defaultLabel: "First Code" }, ACTOR);
  assert.equal(created.version, "1.0.0");
  assert.equal(created.status, "Active");

  const { data: events } = await eventsDB.findByOriginatingObject("Ontology", created.id);
  const eventTypes = (events ?? []).map((e) => e.event_type);
  assert.deepEqual(eventTypes, ["ConceptCreated"], "row 1 (New) should publish exactly one ConceptCreated, no version_event significance");
});

test("DRIVEN: row 2 (Edit — publish a new Version of an existing code) publishes ConceptUpdated on the new row, ConceptDeprecated on the superseded one", async () => {
  const conceptType = freshConceptType();
  const code = "second-code";
  const v1 = await addConcept({ conceptType, code, defaultLabel: "V1 Label" }, ACTOR);
  const v2 = await addConcept({ conceptType, code, defaultLabel: "V2 Label" }, ACTOR);
  assert.equal(v2.version, "1.0.1", "editing an existing code bumps the patch version");

  const { data: v2Events } = await eventsDB.findByOriginatingObject("Ontology", v2.id);
  assert.deepEqual((v2Events ?? []).map((e) => e.event_type), ["ConceptUpdated"]);

  // The superseded v1 row gets its own ConceptDeprecated, auto-fired as a
  // side effect of the new Version reaching Active — not itself a governed
  // transition the actor separately authorised, but a real, distinct event.
  const { data: v1Events } = await eventsDB.findByOriginatingObject("Ontology", v1.id);
  assert.deepEqual((v1Events ?? []).map((e) => e.event_type), ["ConceptCreated", "ConceptDeprecated"]);

  const { data: v1Row } = await ontologyDB.findConceptById(v1.id);
  assert.equal(v1Row?.status, "Deprecated");
});

test("DRIVEN: row 3 (Edit metadata — text_type/ui_grouping) publishes ConceptUpdated in place, no new Version", async () => {
  const conceptType = freshConceptType();
  const code = "third-code";
  const created = await addConcept({ conceptType, code, defaultLabel: "Third Code" }, ACTOR);

  const updated = await updateConceptMeta(conceptType, code, PLATFORM_TENANT_ID, { textType: "text" }, ACTOR);
  assert.equal(updated.id, created.id, "same row, no new Version");
  assert.equal(updated.version, "1.0.0");
  assert.equal(updated.text_type, "text");

  const { data: events } = await eventsDB.findByOriginatingObject("Ontology", created.id);
  assert.deepEqual((events ?? []).map((e) => e.event_type), ["ConceptCreated", "ConceptUpdated"]);
});

test("DRIVEN: row 4 (Compose — Specialization) publishes OntologyComposed alongside the underlying ConceptCreated", async () => {
  const sourceType = freshConceptType();
  const source = await addConcept({ conceptType: sourceType, code: "source-code", defaultLabel: "Source Label", description: "Source description" }, ACTOR);

  const targetType = freshConceptType();
  const composed = await composeConcept({ conceptType: targetType, code: "composed-code", strategy: "specialization", sourceConceptId: source.id }, ACTOR);
  assert.equal(composed.composition_strategy, "specialization");

  const { data: events } = await eventsDB.findByOriginatingObject("Ontology", composed.id);
  const eventTypes = (events ?? []).map((e) => e.event_type);
  assert.ok(eventTypes.includes("ConceptCreated"), `expected ConceptCreated among: ${eventTypes.join(", ")}`);
  assert.ok(eventTypes.includes("OntologyComposed"), `expected OntologyComposed among: ${eventTypes.join(", ")}`);
});

test("DRIVEN: rows 5-7 (Deprecate/Retire/Archive) each publish their matching event", async () => {
  const conceptType = freshConceptType();
  const code = "lifecycle-code";
  const created = await addConcept({ conceptType, code, defaultLabel: "Lifecycle Code" }, ACTOR);

  await deprecateConcept(conceptType, code, PLATFORM_TENANT_ID, ACTOR);
  await retireConcept(conceptType, code, PLATFORM_TENANT_ID, ACTOR);
  const archived = await archiveConcept(conceptType, code, PLATFORM_TENANT_ID, ACTOR);
  assert.equal(archived.status, "Archived");

  const { data: events } = await eventsDB.findByOriginatingObject("Ontology", created.id);
  const eventTypes = (events ?? []).map((e) => e.event_type);
  for (const expected of ["ConceptDeprecated", "OntologyConceptRetired", "OntologyConceptArchived"]) {
    assert.ok(eventTypes.includes(expected), `expected ${expected} among published events, got: ${eventTypes.join(", ")}`);
  }
});
