// Version Feature Plan.md, point 1: an executable check of Events and
// Lifecycles.md's Template table (Ch.6), same discipline as
// pack-event-lifecycle-table.test.ts / objective-event-lifecycle-table.test.ts.
// TEMPLATE_TABLE below is a hand-transcription of that table's corrected
// state — no Queue to Validate / submit row, no Reject row: Template's real
// transition_definitions rows have no Validated->Draft entry and no row
// anywhere declares submit_verb, same shape as Pack (not Objective).
//
//   - DEFINITION: every row's transition_definitions record (event_type/
//     version_event) matches the table.
//   - DRIVEN: every row is actually exercised through the real functions
//     (publishTemplate/transitionTemplate) and the events they publish are
//     asserted against eventsDB directly — no mocking.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";

import pool from "../src/utils/db.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { publishTemplate, transitionTemplate, type TemplateSeedInput } from "../src/routes/seu/core/templates.js";
import { uniqueTestPackVersion } from "./testFixtures.js";

// "api-platform" — a real, platform-seeded template-categories Ontology
// concept (migration 053) — Template's `code` must resolve to one of these,
// not a hand-typed string (validateTemplateSeed -> assertCanonicalCategory).
// "source-code" — a real, platform-seeded deliverable-name Ontology concept
// (migration 134-ish set) for the same reason on deliverableCatalogue's own
// entries. Identity is (code, templateVersion, tenantId), so reusing this
// same code every run is safe as long as templateVersion differs
// (uniqueTestPackVersion — generic, not Pack-specific despite the name).
async function freshTemplateSeed(overrides: Partial<TemplateSeedInput> = {}): Promise<TemplateSeedInput> {
  return {
    code: "api-platform",
    name: "Test Template",
    templateVersion: uniqueTestPackVersion(),
    deliverableCatalogue: [{ code: "source-code" }],
    ...overrides,
  };
}

// Rows 3-8 need to observe ONE hop at a time, so they start from a bare
// Draft directly (templatesDB.createDraft — the same row the interactive SDK
// authoring path produces) rather than going through publishTemplate, which
// now walks a fresh Draft all the way to Active in one call (see the row 1
// test above).
async function freshTemplateDraft(): Promise<{ id: string }> {
  const { data: draft, error } = await templatesDB.createDraft({
    code: "api-platform",
    name: "Test Template Draft",
    templateVersion: uniqueTestPackVersion(),
  });
  if (error || !draft) throw error ?? new Error("failed to create Template draft");
  return { id: draft.id };
}

interface TemplateTableRow {
  row: number;
  description: string;
  fromState: string;
  toState: string;
  eventType: string;
  versionEvent: string | null;
}

const TEMPLATE_TABLE: TemplateTableRow[] = [
  { row: 3, description: "Validate", fromState: "Draft", toState: "Validated", eventType: "TemplateValidated", versionEvent: "VersionValidated" },
  { row: 4, description: "Publish", fromState: "Validated", toState: "Published", eventType: "TemplatePublished", versionEvent: "VersionPublished" },
  { row: 5, description: "Activate", fromState: "Published", toState: "Active", eventType: "TemplateActivated", versionEvent: "VersionActivated" },
  { row: 6, description: "Deprecate", fromState: "Active", toState: "Deprecated", eventType: "TemplateDeprecated", versionEvent: "VersionDeprecated" },
  { row: 7, description: "Retire", fromState: "Deprecated", toState: "Retired", eventType: "TemplateRetired", versionEvent: "VersionSuperseded" },
  { row: 8, description: "Archive", fromState: "Retired", toState: "Archived", eventType: "TemplateArchived", versionEvent: "VersionArchived" },
];

// The three reactivation gate rows (CR-024/026) carry no event_type/
// version_event of their own — reactivateAsNewVersion never runs
// updateStatus for these, it walks a brand-new Draft through rows 3-5
// instead. Checked directly, so a future change accidentally giving them a
// value (which would then never actually get published) doesn't go unnoticed.
const REACTIVATION_ROWS: Array<{ fromState: string; toState: string }> = [
  { fromState: "Deprecated", toState: "Active" },
  { fromState: "Retired", toState: "Active" },
  { fromState: "Archived", toState: "Active" },
];

test("DEFINITION: every Template transition_definitions row matches Events and Lifecycles.md's event_type/version_event", async () => {
  for (const row of TEMPLATE_TABLE) {
    const { data: def } = await transitionDefinitionsDB.find("Template", row.fromState, row.toState);
    assert.ok(def, `no transition_definitions row for Template ${row.fromState} -> ${row.toState} (table row ${row.row}: ${row.description})`);
    assert.equal(def!.event_type, row.eventType, `row ${row.row} (${row.description}): event_type`);
    assert.equal(def!.version_event, row.versionEvent, `row ${row.row} (${row.description}): version_event`);
    // No submit/queue step for Template — see this file's own header.
    assert.equal(def!.submit_verb, null, `row ${row.row} (${row.description}): submit_verb should be null`);
  }

  for (const row of REACTIVATION_ROWS) {
    const { data: def } = await transitionDefinitionsDB.find("Template", row.fromState, row.toState);
    assert.ok(def, `no transition_definitions row for Template ${row.fromState} -> ${row.toState} (reactivation gate)`);
    assert.equal(def!.event_type, null, `reactivation gate ${row.fromState} -> ${row.toState}: event_type should be null`);
    assert.equal(def!.version_event, null, `reactivation gate ${row.fromState} -> ${row.toState}: version_event should be null`);
  }
});

// publishTemplate used to create an already-Active row directly (relying on
// templates.status's own — since-fixed — 'Active' default), firing only
// TemplateCreated. Owner: "templates.status defaults to 'Active' - this
// should be draft; similar to pack" — publishTemplate now creates a real
// Draft and walks it through the full governed lifecycle for real (mirroring
// publishPack exactly), so a fresh publish fires all four events in order,
// not just the first one.
test("DRIVEN: row 1 (New) creates a real Draft and walks it to Active, firing TemplateCreated then the real governed events", async () => {
  const created = await publishTemplate({ seed: await freshTemplateSeed(), actorRole: "power", actorId: "1001" });
  assert.equal(created.ok, true, created.ok ? undefined : created.errors.join("; "));
  if (!created.ok) return;

  const { data: events } = await eventsDB.findByOriginatingObject("Template", created.templateId);
  const eventTypes = (events ?? []).map((e) => e.event_type);
  assert.deepEqual(eventTypes, ["TemplateCreated", "TemplateValidated", "TemplatePublished", "TemplateActivated"]);

  const { data: template } = await templatesDB.findById(created.templateId);
  assert.equal(template?.status, "Active");
});

test("DRIVEN: row 3 (Validate) publishes TemplateValidated, matching transition_definitions.event_type", async () => {
  const draft = await freshTemplateDraft();

  const result = await transitionTemplate({ templateId: draft.id, targetState: "Validated", actorRole: "power", actorId: "1001" });
  assert.equal(result.ok, true, result.ok ? undefined : `${result.reason}: ${result.detail}`);

  const { data: events } = await eventsDB.findByOriginatingObject("Template", draft.id);
  const validated = events?.find((e) => e.event_type === "TemplateValidated");
  assert.ok(validated, "expected a TemplateValidated event");

  const { data: def } = await transitionDefinitionsDB.find("Template", "Draft", "Validated");
  assert.equal(validated!.event_type, def!.event_type);
});

test("DRIVEN: rows 4-8 (Publish/Activate/Deprecate/Retire/Archive) each publish their matching event", async () => {
  const draft = await freshTemplateDraft();

  await transitionTemplate({ templateId: draft.id, targetState: "Validated", actorRole: "power", actorId: "1001" });
  await transitionTemplate({ templateId: draft.id, targetState: "Published", actorRole: "power", actorId: "1001" });
  await transitionTemplate({ templateId: draft.id, targetState: "Active", actorRole: "power", actorId: "1001" });
  await transitionTemplate({ templateId: draft.id, targetState: "Deprecated", actorRole: "power", actorId: "1001" });
  await transitionTemplate({ templateId: draft.id, targetState: "Retired", actorRole: "power", actorId: "1001" });
  const archived = await transitionTemplate({ templateId: draft.id, targetState: "Archived", actorRole: "power", actorId: "1001" });
  assert.equal(archived.ok, true, archived.ok ? undefined : `${archived.reason}: ${archived.detail}`);

  const { data: events } = await eventsDB.findByOriginatingObject("Template", draft.id);
  const eventTypes = (events ?? []).map((e) => e.event_type);
  for (const expected of ["TemplatePublished", "TemplateActivated", "TemplateDeprecated", "TemplateRetired", "TemplateArchived"]) {
    assert.ok(eventTypes.includes(expected), `expected ${expected} among published events, got: ${eventTypes.join(", ")}`);
  }
});
