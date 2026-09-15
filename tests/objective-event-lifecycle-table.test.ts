// Version Feature Plan.md, point 1: an executable check of Events and
// Lifecycles.md's Objective table (Ch.1) — once this is green, that table's
// content is meant to move into Chapter 1 itself as its own section, with
// this fixture as the thing that keeps it honest against the real code.
//
// OBJECTIVE_TABLE below is a hand-transcription of that table's "corrected"
// state (rows 5/"Validate" excluded — confirmed not applicable: Objective's
// chapter-defined lifecycle has no Validated state, see Version Feature
// Plan.md §7 Q3). Two kinds of assertion:
//   - DEFINITION: every row's transition_definitions record (event_type/
//     version_event/submit_version_event) matches the table, checked
//     declaratively — including rows 7-10, whose own business logic
//     (Supersede/Retire/Achieve/Archive) is still deferred (Implementation
//     table), so they're checked here but not driven end-to-end.
//   - DRIVEN: rows 1, 2, 3, 4, 6 are actually exercised through the real
//     functions (createObjective/updateObjective/submitObjective/
//     transitionObjective) and the events they publish are asserted against
//     eventsDB directly — no mocking, same discipline as
//     objective-lifecycle.test.ts.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { createObjective, submitObjective, transitionObjective, updateObjective } from "../src/routes/seu/core/objectives.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { ensureEventSubscriptionsLoaded } from "./testFixtures.js";

before(async () => {
  await ensureEventSubscriptionsLoaded();
});

async function strategicRoot(): Promise<string> {
  const { objective } = await createObjective({
    statement: `event-table-root-${randomUUID()}`,
    requiredCapabilityCodes: [],
    tier: "Strategic", requestedBy: 1001, status: "Proposed",
  });
  return objective.id;
}

interface ObjectiveTableRow {
  row: number;
  description: string;
  fromState: string;
  toState: string;
  eventType: string;
  versionEvent: string | null;
  submitVersionEvent?: string;
}

const OBJECTIVE_TABLE: ObjectiveTableRow[] = [
  { row: 3, description: "Queue to Validate (submit)", fromState: "Proposed", toState: "Active", eventType: "ObjectiveProposed", versionEvent: null, submitVersionEvent: "VersionCreated" },
  { row: 6, description: "Activate", fromState: "Proposed", toState: "Active", eventType: "ObjectiveActivated", versionEvent: "VersionActivated" },
  { row: 4, description: "Reject", fromState: "Active", toState: "Reject", eventType: "ObjectiveRejected", versionEvent: null },
  { row: 7, description: "Supersede (deferred)", fromState: "Active", toState: "Superseded", eventType: "ObjectiveSuperseded", versionEvent: "VersionSuperseded" },
  { row: 8, description: "Retire (deferred)", fromState: "Active", toState: "Retired", eventType: "ObjectiveRetired", versionEvent: "VersionDeprecated" },
  { row: 9, description: "Achieve (deferred)", fromState: "Active", toState: "Achieved", eventType: "ObjectiveAchieved", versionEvent: "VersionPublished" },
  { row: 10, description: "Archive, from Achieved (deferred)", fromState: "Achieved", toState: "Archived", eventType: "ObjectiveArchived", versionEvent: "VersionArchived" },
  { row: 10, description: "Archive, from Superseded (deferred)", fromState: "Superseded", toState: "Archived", eventType: "ObjectiveArchived", versionEvent: "VersionArchived" },
  { row: 10, description: "Archive, from Retired (deferred)", fromState: "Retired", toState: "Archived", eventType: "ObjectiveArchived", versionEvent: "VersionArchived" },
];

test("DEFINITION: every Objective transition_definitions row matches Events and Lifecycles.md's event_type/version_event", async () => {
  for (const row of OBJECTIVE_TABLE) {
    const { data: def } = await transitionDefinitionsDB.find("Objective", row.fromState, row.toState);
    assert.ok(def, `no transition_definitions row for Objective ${row.fromState} -> ${row.toState} (table row ${row.row}: ${row.description})`);
    if (row.submitVersionEvent) {
      assert.equal(def!.submit_verb, "propose", `row ${row.row} (${row.description}): expected a submit_verb`);
      assert.equal(def!.submit_version_event, row.submitVersionEvent, `row ${row.row} (${row.description}): submit_version_event`);
    }
    // Row 3 (submit) and row 6 (Activate) share the same transition_definitions
    // row (Proposed->Active) — its own event_type/version_event belong to
    // row 6's to_state transition, not row 3's submit step (checked via
    // submit_version_event above; submit's own published event is the
    // mechanical ${entityType}${fromState} triggerEngine produces, not a
    // stored event_type — see the DRIVEN check below).
    if (row.row !== 3) {
      assert.equal(def!.event_type, row.eventType, `row ${row.row} (${row.description}): event_type`);
      assert.equal(def!.version_event, row.versionEvent, `row ${row.row} (${row.description}): version_event`);
    }
  }
});

test("DRIVEN: row 1 (New) and row 2 (Edit) are pure Revisions — no event published", async () => {
  const { objective } = await createObjective({
    statement: `event-table-revision-${randomUUID()}`,
    requiredCapabilityCodes: [],
    tier: "Engineering",
    parentObjectiveId: await strategicRoot(), requestedBy: 1001, status: "Proposed",
  });
  const { data: afterCreate } = await eventsDB.findByOriginatingObject("Objective", objective.id);
  assert.deepEqual(afterCreate, [], "row 1 (New) must publish no event");

  await updateObjective(objective.id, { statement: "event-table-revision-edited" });
  const { data: afterEdit } = await eventsDB.findByOriginatingObject("Objective", objective.id);
  assert.deepEqual(afterEdit, [], "row 2 (Edit) must publish no event");
});

test("DRIVEN: row 3 (submit) publishes ObjectiveProposed — the VersionCreated moment", async () => {
  const { objective } = await createObjective({
    statement: `event-table-submit-${randomUUID()}`,
    requiredCapabilityCodes: [],
    tier: "Engineering",
    parentObjectiveId: await strategicRoot(), requestedBy: 1001, status: "Proposed",
  });
  await submitObjective(objective.id, 1001);
  const { data: events } = await eventsDB.findByOriginatingObject("Objective", objective.id);
  assert.equal(events?.length, 1);
  assert.equal(events?.[0]?.event_type, "ObjectiveProposed");
});

test("DRIVEN: row 6 (Activate) publishes ObjectiveActivated, matching transition_definitions.event_type", async () => {
  const { objective } = await createObjective({
    statement: `event-table-activate-${randomUUID()}`,
    requiredCapabilityCodes: [],
    tier: "Engineering",
    parentObjectiveId: await strategicRoot(), requestedBy: 1001, status: "Proposed",
  });
  await submitObjective(objective.id, 1001);
  const result = await transitionObjective({ objectiveId: objective.id, targetState: "Active", actorRole: "general", actorId: "1001" });
  assert.equal(result.ok, true);

  const { data: events } = await eventsDB.findByOriginatingObject("Objective", objective.id);
  const activated = events?.find((e) => e.event_type === "ObjectiveActivated");
  assert.ok(activated, "expected an ObjectiveActivated event");

  const { data: def } = await transitionDefinitionsDB.find("Objective", "Proposed", "Active");
  assert.equal(activated!.event_type, def!.event_type);
});

test("DRIVEN: row 4 (Reject) publishes ObjectiveRejected, matching transition_definitions.event_type", async () => {
  const { objective } = await createObjective({
    statement: `event-table-reject-${randomUUID()}`,
    requiredCapabilityCodes: [],
    tier: "Engineering",
    parentObjectiveId: await strategicRoot(), requestedBy: 1001, status: "Proposed",
  });
  await submitObjective(objective.id, 1001);
  await transitionObjective({ objectiveId: objective.id, targetState: "Active", actorRole: "general", actorId: "1001" });
  const result = await transitionObjective({
    objectiveId: objective.id, targetState: "Reject", actorRole: "general", actorId: "1001",
    comment: "event-table test rejection — needs rework",
  });
  assert.equal(result.ok, true);

  const { data: events } = await eventsDB.findByOriginatingObject("Objective", objective.id);
  const rejected = events?.find((e) => e.event_type === "ObjectiveRejected");
  assert.ok(rejected, "expected an ObjectiveRejected event");

  const { data: def } = await transitionDefinitionsDB.find("Objective", "Active", "Reject");
  assert.equal(rejected!.event_type, def!.event_type);
});
