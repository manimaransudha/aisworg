// CR-111 (Capability Registry) — Version Feature Plan.md, point 1: an
// executable check of Capability's own transition_definitions rows, same
// discipline as service-definition-event-lifecycle-table.test.ts. Capability
// reuses Service Definition's own lean 6-state lifecycle verbatim (Defined ->
// Published -> Active -> Deprecated -> Retired -> Archived), so
// CAPABILITY_DEFINITION_TABLE mirrors SERVICE_DEFINITION_TABLE's shape
// exactly, one entity over.
//
//   - DEFINITION: every row's transition_definitions record (event_type/
//     version_event) matches the table.
//   - DRIVEN: every row is actually exercised through the real functions
//     (capabilityDefinitionsDB.createDraft/transitionCapabilityDefinition)
//     and the events they publish are asserted against eventsDB directly —
//     no mocking.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { capabilityDefinitionsDB } from "../src/dblayer/capabilityDefinitionsDB.js";
import { schemaDefinitionsDB } from "../src/dblayer/schemaDefinitionsDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { transitionCapabilityDefinition } from "../src/routes/seu/core/capabilityDefinitions.js";

// capabilityDefinitionsDB.createDraft is a raw DB-layer insert (no
// validateCapabilityDefinitionSeed call — the hand-coded uniqueness/parent
// checks are skipped), same "bare Draft, one hop at a time" fixture pattern
// freshServiceDefinitionDraft uses. createDraft DOES still enforce the
// schema's own x-ontology fields (write-time schema validation), so `code`
// below is a real registered capability-name code, not a fabricated one —
// unique per test run via a fresh Ontology-registered suffix would break the
// x-ontology check, so this reuses a real seeded code instead (capability
// codes are not expected to be unique per Definition version — code+version+
// tenant is the real uniqueness key, and version is randomised here).
// CR-114 follow-on — capabilityDefinitionsDB.createDraft's schemaDefinitionId
// is now mandatory; resolved once and reused by every direct call in this file.
async function requireCapabilitySchemaId(): Promise<string> {
  const { data: capabilitySchema } = await schemaDefinitionsDB.findLatest("Capability");
  if (!capabilitySchema) throw new Error("no schema_definitions grammar for Capability");
  return capabilitySchema.id;
}

async function freshCapabilityDefinitionDraft(): Promise<{ id: string }> {
  const { data: draft, error } = await capabilityDefinitionsDB.createDraft({
    code: "requirements-analysis",
    defaultLabel: "Test Capability Definition",
    version: `0.0.${Math.floor(Math.random() * 1_000_000)}`,
    schemaDefinitionId: await requireCapabilitySchemaId(),
  });
  if (error || !draft) throw error ?? new Error("failed to create Capability Definition draft");
  return { id: draft.id };
}

interface CapabilityDefinitionTableRow {
  row: number;
  description: string;
  fromState: string;
  toState: string;
  eventType: string;
  versionEvent: string | null;
}

const CAPABILITY_DEFINITION_TABLE: CapabilityDefinitionTableRow[] = [
  { row: 3, description: "Publish", fromState: "Defined", toState: "Published", eventType: "CapabilityDefinitionPublished", versionEvent: "VersionPublished" },
  { row: 4, description: "Activate", fromState: "Published", toState: "Active", eventType: "CapabilityDefinitionActivated", versionEvent: "VersionActivated" },
  { row: 5, description: "Deprecate", fromState: "Active", toState: "Deprecated", eventType: "CapabilityDefinitionDeprecated", versionEvent: "VersionDeprecated" },
  { row: 6, description: "Retire", fromState: "Deprecated", toState: "Retired", eventType: "CapabilityDefinitionRetired", versionEvent: "VersionSuperseded" },
  { row: 7, description: "Archive", fromState: "Retired", toState: "Archived", eventType: "CapabilityDefinitionArchived", versionEvent: "VersionArchived" },
];

test("DEFINITION: every Capability transition_definitions row matches its own event_type/version_event", async () => {
  for (const row of CAPABILITY_DEFINITION_TABLE) {
    const { data: def } = await transitionDefinitionsDB.find("Capability", row.fromState, row.toState);
    assert.ok(def, `no transition_definitions row for Capability ${row.fromState} -> ${row.toState} (table row ${row.row}: ${row.description})`);
    assert.equal(def!.event_type, row.eventType, `row ${row.row} (${row.description}): event_type`);
    assert.equal(def!.version_event, row.versionEvent, `row ${row.row} (${row.description}): version_event`);
    // No submit/queue step for Capability Definition.
    assert.equal(def!.submit_verb, null, `row ${row.row} (${row.description}): submit_verb should be null`);
  }
});

test("DRIVEN: row 1 (New) is a pure Revision — no event published on creation", async () => {
  const draft = await freshCapabilityDefinitionDraft();
  const { data: events } = await eventsDB.findByOriginatingObject("CapabilityDefinition", draft.id);
  assert.equal(events?.length ?? 0, 0, "expected no event published by createDraft alone");
});

test("DRIVEN: row 3 (Publish) publishes CapabilityDefinitionPublished, matching transition_definitions.event_type", async () => {
  const draft = await freshCapabilityDefinitionDraft();

  const result = await transitionCapabilityDefinition({ capabilityDefinitionId: draft.id, targetState: "Published", actorRole: "power", actorId: "1001" });
  assert.equal(result.ok, true, result.ok ? undefined : `${result.reason}: ${result.detail}`);

  const { data: events } = await eventsDB.findByOriginatingObject("CapabilityDefinition", draft.id);
  const published = events?.find((e) => e.event_type === "CapabilityDefinitionPublished");
  assert.ok(published, "expected a CapabilityDefinitionPublished event");

  const { data: def } = await transitionDefinitionsDB.find("Capability", "Defined", "Published");
  assert.equal(published!.event_type, def!.event_type);
});

test("DRIVEN: rows 4-7 (Activate/Deprecate/Retire/Archive) each publish their matching event", async () => {
  const draft = await freshCapabilityDefinitionDraft();

  await transitionCapabilityDefinition({ capabilityDefinitionId: draft.id, targetState: "Published", actorRole: "power", actorId: "1001" });
  await transitionCapabilityDefinition({ capabilityDefinitionId: draft.id, targetState: "Active", actorRole: "power", actorId: "1001" });
  await transitionCapabilityDefinition({ capabilityDefinitionId: draft.id, targetState: "Deprecated", actorRole: "power", actorId: "1001" });
  await transitionCapabilityDefinition({ capabilityDefinitionId: draft.id, targetState: "Retired", actorRole: "power", actorId: "1001" });
  const archived = await transitionCapabilityDefinition({ capabilityDefinitionId: draft.id, targetState: "Archived", actorRole: "power", actorId: "1001" });
  assert.equal(archived.ok, true, archived.ok ? undefined : `${archived.reason}: ${archived.detail}`);

  const { data: events } = await eventsDB.findByOriginatingObject("CapabilityDefinition", draft.id);
  const eventTypes = (events ?? []).map((e) => e.event_type);
  for (const expected of ["CapabilityDefinitionActivated", "CapabilityDefinitionDeprecated", "CapabilityDefinitionRetired", "CapabilityDefinitionArchived"]) {
    assert.ok(eventTypes.includes(expected), `expected ${expected} among published events, got: ${eventTypes.join(", ")}`);
  }
});

test("REGRESSION: roles[] round-trips as real {name, worktypes[]} rows and is validated against role-name/worktype-name Ontology", async () => {
  const { data: draft, error } = await capabilityDefinitionsDB.createDraft({
    code: "requirements-analysis",
    defaultLabel: "Test Capability Definition Roles",
    version: `0.0.${Math.floor(Math.random() * 1_000_000)}`,
    roles: [{ name: "requirement-analysis", worktypes: ["requirement-examination", "requirement-interpretation"] }],
    schemaDefinitionId: await requireCapabilitySchemaId(),
  });
  assert.equal(error, undefined);
  assert.deepEqual(draft?.roles, [{ name: "requirement-analysis", worktypes: ["requirement-examination", "requirement-interpretation"] }]);

  const { error: badRoleError } = await capabilityDefinitionsDB.createDraft({
    code: "requirements-analysis",
    defaultLabel: "Test Capability Definition Bad Role",
    version: `0.0.${Math.floor(Math.random() * 1_000_000)}`,
    roles: [{ name: "not-a-real-role-name", worktypes: [] }],
    schemaDefinitionId: await requireCapabilitySchemaId(),
  });
  assert.ok(badRoleError, "expected an unregistered role-name to be rejected at write time");

  const { error: badWorktypeError } = await capabilityDefinitionsDB.createDraft({
    code: "requirements-analysis",
    defaultLabel: "Test Capability Definition Bad Worktype",
    version: `0.0.${Math.floor(Math.random() * 1_000_000)}`,
    roles: [{ name: "requirement-analysis", worktypes: ["not-a-real-worktype-name"] }],
    schemaDefinitionId: await requireCapabilitySchemaId(),
  });
  assert.ok(badWorktypeError, "expected an unregistered worktype-name to be rejected at write time");
});

test("REGRESSION: an unregistered code is rejected at write time (code is x-ontology, not composable)", async () => {
  const { error } = await capabilityDefinitionsDB.createDraft({
    code: `not-a-real-capability-${randomUUID()}`,
    defaultLabel: "Test Capability Definition Bad Code",
    version: `0.0.${Math.floor(Math.random() * 1_000_000)}`,
    schemaDefinitionId: await requireCapabilitySchemaId(),
  });
  assert.ok(error, "expected an unregistered capability-name code to be rejected at write time");
});
