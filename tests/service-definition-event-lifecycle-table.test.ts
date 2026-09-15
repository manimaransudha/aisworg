// Version Feature Plan.md, point 1: an executable check of Events and
// Lifecycles.md's Service Definition table (Ch.11), same discipline as
// template-event-lifecycle-table.test.ts (Ch.6) / profile-event-lifecycle-table.test.ts
// (Ch.7). SERVICE_DEFINITION_TABLE mirrors those tables' shape but is one
// hop shorter — Ch.11 §13's own lifecycle (Defined -> Published -> Active ->
// Deprecated -> Retired -> Archived) has no Validated state at all, unlike
// Pack/Template/Profile's seven-state chain.
//
// Scope note (definition vs execution, Ch.11 §18.9): this file covers
// SERVICE DEFINITION — the canonical, versioned catalog entry
// (core/serviceDefinitions.ts, CR-086) a Pack's own contributionServices[]
// picks by code. It does NOT cover the separate `services` table (a
// Pack-materialized, per-Capability EXECUTION row, content-diff versioned
// via CR-064, no governed lifecycle) — those are two different things that
// happen to share a chapter and a short name.
//
//   - DEFINITION: every row's transition_definitions record (event_type/
//     version_event) matches the table.
//   - DRIVEN: every row is actually exercised through the real functions
//     (serviceDefinitionsDB.createDraft/transitionServiceDefinition) and the
//     events they publish are asserted against eventsDB directly — no
//     mocking.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { serviceDefinitionsDB } from "../src/dblayer/serviceDefinitionsDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { transitionServiceDefinition } from "../src/routes/seu/core/serviceDefinitions.js";

// serviceDefinitionsDB.createDraft is a raw DB-layer insert (no
// validateServiceDefinitionSeed call, no Ontology check on code/
// capabilityCode) — same "bare Draft, one hop at a time" fixture pattern
// freshTemplateDraft/freshProfileDraft already use, since these tests need
// to observe ONE transition at a time, not exercise a full authoring flow.
async function freshServiceDefinitionDraft(): Promise<{ id: string }> {
  const { data: draft, error } = await serviceDefinitionsDB.createDraft({
    code: `test-service-definition-lifecycle-${randomUUID()}`,
    name: "Test Service Definition",
    capabilityCode: "test-capability",
  });
  if (error || !draft) throw error ?? new Error("failed to create Service Definition draft");
  return { id: draft.id };
}

interface ServiceDefinitionTableRow {
  row: number;
  description: string;
  fromState: string;
  toState: string;
  eventType: string;
  versionEvent: string | null;
}

const SERVICE_DEFINITION_TABLE: ServiceDefinitionTableRow[] = [
  { row: 3, description: "Publish", fromState: "Defined", toState: "Published", eventType: "ServiceDefinitionPublished", versionEvent: "VersionPublished" },
  { row: 4, description: "Activate", fromState: "Published", toState: "Active", eventType: "ServiceDefinitionActivated", versionEvent: "VersionActivated" },
  { row: 5, description: "Deprecate", fromState: "Active", toState: "Deprecated", eventType: "ServiceDefinitionDeprecated", versionEvent: "VersionDeprecated" },
  { row: 6, description: "Retire", fromState: "Deprecated", toState: "Retired", eventType: "ServiceDefinitionRetired", versionEvent: "VersionSuperseded" },
  { row: 7, description: "Archive", fromState: "Retired", toState: "Archived", eventType: "ServiceDefinitionArchived", versionEvent: "VersionArchived" },
];

test("DEFINITION: every Service Definition transition_definitions row matches Events and Lifecycles.md's event_type/version_event", async () => {
  for (const row of SERVICE_DEFINITION_TABLE) {
    const { data: def } = await transitionDefinitionsDB.find("Service", row.fromState, row.toState);
    assert.ok(def, `no transition_definitions row for Service ${row.fromState} -> ${row.toState} (table row ${row.row}: ${row.description})`);
    assert.equal(def!.event_type, row.eventType, `row ${row.row} (${row.description}): event_type`);
    assert.equal(def!.version_event, row.versionEvent, `row ${row.row} (${row.description}): version_event`);
    // No submit/queue step for Service Definition.
    assert.equal(def!.submit_verb, null, `row ${row.row} (${row.description}): submit_verb should be null`);
  }
});

// No creation event exists today for Service Definition (checked directly —
// no "ServiceDefinitionCreated"/"ServiceDefined" event-type string anywhere
// in src/): createDraft is a pure Revision, the same shape as Objective's
// own row 1 (New) — no CR ever asked for a PackRegistered/TemplateCreated-
// style creation event here, so this isn't treated as a gap to close as
// part of this pass, only confirmed and recorded.
test("DRIVEN: row 1 (New) is a pure Revision — no event published on creation", async () => {
  const draft = await freshServiceDefinitionDraft();
  const { data: events } = await eventsDB.findByOriginatingObject("ServiceDefinition", draft.id);
  assert.equal(events?.length ?? 0, 0, "expected no event published by createDraft alone");
});

// Regression test — found while building the tests above. Migration 159
// changed service_definitions.inputs/.outputs to TEXT[] NOT NULL (a
// referential-multi-select of deliverable-name codes), but
// serviceDefinitionsDB.ts, ServiceDefinitionSeedInput/ServiceDefinitionRow,
// and sdkAuthoring.ts's own form parsing all still treated them as a bare
// `string | null`. Two live bugs: (1) any caller omitting inputs/outputs hit
// a NOT NULL violation (createDraft passed a literal `null` into an array
// column with no default supplied), and (2) a real multi-select form
// submission (an array) could never be captured by the old
// `typeof content.inputs === "string"` parser — the fields could never
// actually be saved through the UI. Fixed in the same pass as Ch.11's
// Version Feature Plan work.
test("REGRESSION: Service Definition inputs/outputs round-trip as real string arrays, not a bare string", async () => {
  const { data: draft, error } = await serviceDefinitionsDB.createDraft({
    code: `test-service-definition-io-${randomUUID()}`,
    name: "Test Service Definition IO",
    capabilityCode: "test-capability",
    inputs: ["requirements-specification", "domain-model"],
    outputs: ["source-code"],
  });
  assert.equal(error, undefined);
  assert.deepEqual(draft?.inputs, ["requirements-specification", "domain-model"]);
  assert.deepEqual(draft?.outputs, ["source-code"]);

  // Omitting them entirely must not violate the NOT NULL constraint (the bug
  // this regression test guards against) — defaults to real empty arrays.
  const { data: bare, error: bareError } = await serviceDefinitionsDB.createDraft({
    code: `test-service-definition-io-bare-${randomUUID()}`,
    name: "Test Service Definition IO Bare",
    capabilityCode: "test-capability",
  });
  assert.equal(bareError, undefined);
  assert.deepEqual(bare?.inputs, []);
  assert.deepEqual(bare?.outputs, []);
});

test("DRIVEN: row 3 (Publish) publishes ServiceDefinitionPublished, matching transition_definitions.event_type", async () => {
  const draft = await freshServiceDefinitionDraft();

  const result = await transitionServiceDefinition({ serviceDefinitionId: draft.id, targetState: "Published", actorRole: "power", actorId: "1001" });
  assert.equal(result.ok, true, result.ok ? undefined : `${result.reason}: ${result.detail}`);

  const { data: events } = await eventsDB.findByOriginatingObject("ServiceDefinition", draft.id);
  const published = events?.find((e) => e.event_type === "ServiceDefinitionPublished");
  assert.ok(published, "expected a ServiceDefinitionPublished event");

  const { data: def } = await transitionDefinitionsDB.find("Service", "Defined", "Published");
  assert.equal(published!.event_type, def!.event_type);
});

test("DRIVEN: rows 4-7 (Activate/Deprecate/Retire/Archive) each publish their matching event", async () => {
  const draft = await freshServiceDefinitionDraft();

  await transitionServiceDefinition({ serviceDefinitionId: draft.id, targetState: "Published", actorRole: "power", actorId: "1001" });
  await transitionServiceDefinition({ serviceDefinitionId: draft.id, targetState: "Active", actorRole: "power", actorId: "1001" });
  await transitionServiceDefinition({ serviceDefinitionId: draft.id, targetState: "Deprecated", actorRole: "power", actorId: "1001" });
  await transitionServiceDefinition({ serviceDefinitionId: draft.id, targetState: "Retired", actorRole: "power", actorId: "1001" });
  const archived = await transitionServiceDefinition({ serviceDefinitionId: draft.id, targetState: "Archived", actorRole: "power", actorId: "1001" });
  assert.equal(archived.ok, true, archived.ok ? undefined : `${archived.reason}: ${archived.detail}`);

  const { data: events } = await eventsDB.findByOriginatingObject("ServiceDefinition", draft.id);
  const eventTypes = (events ?? []).map((e) => e.event_type);
  for (const expected of ["ServiceDefinitionActivated", "ServiceDefinitionDeprecated", "ServiceDefinitionRetired", "ServiceDefinitionArchived"]) {
    assert.ok(eventTypes.includes(expected), `expected ${expected} among published events, got: ${eventTypes.join(", ")}`);
  }
});
