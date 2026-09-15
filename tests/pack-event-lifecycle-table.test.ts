// Version Feature Plan.md, point 1: an executable check of Events and
// Lifecycles.md's Pack table (Ch.5), same discipline as
// objective-event-lifecycle-table.test.ts. PACK_TABLE below is a hand-
// transcription of that table's corrected state — no Queue to Validate /
// submit row (owner: "There is no Queue to Validate in pack... the
// transition buttons are sufficient", considered and deliberately not
// built, unlike Objective's Proposed->Active).
//
//   - DEFINITION: every row's transition_definitions record (event_type/
//     version_event) matches the table.
//   - DRIVEN: every row is actually exercised through the real functions
//     (createPackDraft/updateDraftContent/transitionPack) and the events
//     they publish are asserted against eventsDB directly — no mocking,
//     same discipline as pack-sdk.test.ts.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { createPackDraft, transitionPack, type PackSeedInput } from "../src/routes/seu/core/packs.js";
import { uniqueTestPackVersion } from "./testFixtures.js";

async function freshPackSeed(overrides: Partial<PackSeedInput> = {}): Promise<PackSeedInput> {
  return {
    code: "test-pack",
    name: "Test Pack",
    category: "Engineering",
    packVersion: uniqueTestPackVersion(),
    installationClassification: "Optional",
    contributions: {
      capabilities: [{ code: "software-construction", name: "Test Capability" }],
    },
    ...overrides,
  };
}

interface PackTableRow {
  row: number;
  description: string;
  fromState: string;
  toState: string;
  eventType: string;
  versionEvent: string | null;
}

const PACK_TABLE: PackTableRow[] = [
  { row: 3, description: "Validate", fromState: "Draft", toState: "Validated", eventType: "PackValidated", versionEvent: "VersionValidated" },
  { row: 4, description: "Reject", fromState: "Validated", toState: "Draft", eventType: "PackRejected", versionEvent: null },
  { row: 5, description: "Publish", fromState: "Validated", toState: "Published", eventType: "PackPublished", versionEvent: "VersionPublished" },
  { row: 6, description: "Activate", fromState: "Published", toState: "Active", eventType: "PackActivated", versionEvent: "VersionActivated" },
  { row: 7, description: "Retire", fromState: "Active", toState: "Retired", eventType: "PackRetired", versionEvent: "VersionDeprecated" },
  { row: 8, description: "Archive", fromState: "Retired", toState: "Archived", eventType: "PackArchived", versionEvent: "VersionArchived" },
];

test("DEFINITION: every Pack transition_definitions row matches Events and Lifecycles.md's event_type/version_event", async () => {
  for (const row of PACK_TABLE) {
    const { data: def } = await transitionDefinitionsDB.find("Pack", row.fromState, row.toState);
    assert.ok(def, `no transition_definitions row for Pack ${row.fromState} -> ${row.toState} (table row ${row.row}: ${row.description})`);
    assert.equal(def!.event_type, row.eventType, `row ${row.row} (${row.description}): event_type`);
    assert.equal(def!.version_event, row.versionEvent, `row ${row.row} (${row.description}): version_event`);
    // No submit/queue step for Pack — see this file's own header.
    assert.equal(def!.submit_verb, null, `row ${row.row} (${row.description}): submit_verb should be null`);
  }
});

test("DRIVEN: row 1 (New) publishes PackRegistered, a pure Revision (no version_event)", async () => {
  const draft = await createPackDraft(await freshPackSeed());
  assert.equal(draft.ok, true);
  if (!draft.ok) return;

  const { data: events } = await eventsDB.findByOriginatingObject("Pack", draft.pack.id);
  assert.equal(events?.length, 1);
  assert.equal(events?.[0]?.event_type, "PackRegistered");
});

test("DRIVEN: row 2 (Edit) is a pure Revision — no event published", async () => {
  const draft = await createPackDraft(await freshPackSeed());
  assert.equal(draft.ok, true);
  if (!draft.ok) return;

  const { error } = await packsDB.updateDraftContent(draft.pack.id, {
    code: draft.pack.code,
    name: "Edited Test Pack",
    category: draft.pack.category,
    packVersion: draft.pack.pack_version,
    contributions: draft.pack.contributions,
  });
  assert.equal(error, undefined);

  const { data: events } = await eventsDB.findByOriginatingObject("Pack", draft.pack.id);
  assert.equal(events?.length, 1, "still just the row-1 PackRegistered event — Edit adds none");
});

test("DRIVEN: row 3 (Validate) publishes PackValidated, matching transition_definitions.event_type", async () => {
  const draft = await createPackDraft(await freshPackSeed());
  assert.equal(draft.ok, true);
  if (!draft.ok) return;

  const result = await transitionPack({ packId: draft.pack.id, targetState: "Validated", actorRole: "power", actorId: "1001" });
  assert.equal(result.ok, true);

  const { data: events } = await eventsDB.findByOriginatingObject("Pack", draft.pack.id);
  const validated = events?.find((e) => e.event_type === "PackValidated");
  assert.ok(validated, "expected a PackValidated event");

  const { data: def } = await transitionDefinitionsDB.find("Pack", "Draft", "Validated");
  assert.equal(validated!.event_type, def!.event_type);
});

test("DRIVEN: row 4 (Reject) publishes PackRejected, matching transition_definitions.event_type", async () => {
  const draft = await createPackDraft(await freshPackSeed());
  assert.equal(draft.ok, true);
  if (!draft.ok) return;

  await transitionPack({ packId: draft.pack.id, targetState: "Validated", actorRole: "power", actorId: "1001" });
  const rejected = await transitionPack({
    packId: draft.pack.id, targetState: "Draft", actorRole: "power", actorId: "1001",
    comment: `event-table test rejection ${randomUUID()}`,
  });
  assert.equal(rejected.ok, true);

  const { data: events } = await eventsDB.findByOriginatingObject("Pack", draft.pack.id);
  const rejectedEvent = events?.find((e) => e.event_type === "PackRejected");
  assert.ok(rejectedEvent, "expected a PackRejected event");

  const { data: def } = await transitionDefinitionsDB.find("Pack", "Validated", "Draft");
  assert.equal(rejectedEvent!.event_type, def!.event_type);
});

test("DRIVEN: rows 5-8 (Publish/Activate/Retire/Archive) each publish their matching event", async () => {
  const draft = await createPackDraft(await freshPackSeed());
  assert.equal(draft.ok, true);
  if (!draft.ok) return;

  await transitionPack({ packId: draft.pack.id, targetState: "Validated", actorRole: "power", actorId: "1001" });
  await transitionPack({ packId: draft.pack.id, targetState: "Published", actorRole: "power", actorId: "1001" });
  await transitionPack({ packId: draft.pack.id, targetState: "Active", actorRole: "power", actorId: "1001" });
  await transitionPack({ packId: draft.pack.id, targetState: "Retired", actorRole: "power", actorId: "1001" });
  const archived = await transitionPack({ packId: draft.pack.id, targetState: "Archived", actorRole: "power", actorId: "1001" });
  assert.equal(archived.ok, true);

  const { data: events } = await eventsDB.findByOriginatingObject("Pack", draft.pack.id);
  const eventTypes = (events ?? []).map((e) => e.event_type);
  for (const expected of ["PackPublished", "PackActivated", "PackRetired", "PackArchived"]) {
    assert.ok(eventTypes.includes(expected), `expected ${expected} among published events, got: ${eventTypes.join(", ")}`);
  }
});
