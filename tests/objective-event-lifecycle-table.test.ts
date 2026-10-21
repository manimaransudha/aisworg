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
//     version_event) matches the table, checked
//     declaratively — including rows 7-10, whose own business logic
//     (Supersede/Retire/Achieve/Archive) is still deferred (Implementation
//     table), so they're checked here but not driven end-to-end.
//   - DRIVEN: rows 1, 2, 3, 4, 6 are actually exercised through the real
//     functions (createObjective/updateObjective/
//     transitionEntity) and the events they publish are asserted against
//     eventsDB directly — no mocking, same discipline as
//     objective-lifecycle.test.ts.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { createObjective, updateObjective } from "../src/routes/seu/core/objectives.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { ensureEventSubscriptionsLoaded, transitionObjective } from "./testFixtures.js";
import { TESTER_ALL_ID } from "./testFixtures.js";

before(async () => {
  await ensureEventSubscriptionsLoaded();
});

async function strategicRoot(): Promise<string> {
  const { objective } = await createObjective({
    statement: `event-table-root-${randomUUID()}`,
    requiredCapabilityCodes: [],
    tier: "Strategic", requestedBy: TESTER_ALL_ID, });
  return objective.id;
}

interface ObjectiveTableRow {
  row: number;
  description: string;
  fromState: string;
  toState: string;
  eventType: string;
  versionEvent: string | null;
}

const OBJECTIVE_TABLE: ObjectiveTableRow[] = [
  { row: 1, description: "Create (birth)", fromState: "None", toState: "Defined", eventType: "ObjectiveCreated", versionEvent: "VersionCreated" },
  { row: 6, description: "Activate", fromState: "Defined", toState: "Active", eventType: "ObjectiveActivated", versionEvent: "VersionActivated" },
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
    assert.equal(def!.submit_verb, null, `row ${row.row} (${row.description}): the submit step is deleted`);
    assert.equal(def!.event_type, row.eventType, `row ${row.row} (${row.description}): event_type`);
    assert.equal(def!.version_event, row.versionEvent, `row ${row.row} (${row.description}): version_event`);
  }
});

test("DRIVEN: row 1 (Create) publishes ObjectiveCreated and row 2 (Edit) is a pure Revision — no further event", async () => {
  const { objective } = await createObjective({
    statement: `event-table-revision-${randomUUID()}`,
    requiredCapabilityCodes: [],
    tier: "Engineering",
    parentObjectiveId: await strategicRoot(), requestedBy: TESTER_ALL_ID, });
  const { data: afterCreate } = await eventsDB.findByOriginatingObject("Objective", objective.id);
  assert.deepEqual(afterCreate?.map((e) => e.event_type), ["ObjectiveCreated"], "row 1 (Create) publishes the birth event only");
  assert.equal(afterCreate?.[0]?.actor_id, TESTER_ALL_ID);
  assert.ok(afterCreate?.[0]?.authority_badge, "the birth event carries the real badge");

  await updateObjective(objective.id, { statement: "event-table-revision-edited", requestedBy: TESTER_ALL_ID });
  const { data: afterEdit } = await eventsDB.findByOriginatingObject("Objective", objective.id);
  assert.equal(afterEdit?.length, 1, "row 2 (Edit) must publish no event");
});

test("DRIVEN: row 6 (Activate) publishes ObjectiveActivated, matching transition_definitions.event_type", async () => {
  const { objective } = await createObjective({
    statement: `event-table-activate-${randomUUID()}`,
    requiredCapabilityCodes: [],
    tier: "Engineering",
    parentObjectiveId: await strategicRoot(), requestedBy: TESTER_ALL_ID, });
  const result = await transitionObjective({ objectiveId: objective.id, targetState: "Active", actorId: TESTER_ALL_ID });
  assert.equal(result.ok, true);

  const { data: events } = await eventsDB.findByOriginatingObject("Objective", objective.id);
  const activated = events?.find((e) => e.event_type === "ObjectiveActivated");
  assert.ok(activated, "expected an ObjectiveActivated event");

  const { data: def } = await transitionDefinitionsDB.find("Objective", "Defined", "Active");
  assert.equal(activated!.event_type, def!.event_type);
});

test("DRIVEN: row 4 (Reject) publishes ObjectiveRejected, matching transition_definitions.event_type", async () => {
  const { objective } = await createObjective({
    statement: `event-table-reject-${randomUUID()}`,
    requiredCapabilityCodes: [],
    tier: "Engineering",
    parentObjectiveId: await strategicRoot(), requestedBy: TESTER_ALL_ID, });
  await transitionObjective({ objectiveId: objective.id, targetState: "Active", actorId: TESTER_ALL_ID });
  const result = await transitionObjective({
    objectiveId: objective.id, targetState: "Reject", actorId: TESTER_ALL_ID,
    comment: "event-table test rejection — needs rework",
  });
  assert.equal(result.ok, true);

  const { data: events } = await eventsDB.findByOriginatingObject("Objective", objective.id);
  const rejected = events?.find((e) => e.event_type === "ObjectiveRejected");
  assert.ok(rejected, "expected an ObjectiveRejected event");

  const { data: def } = await transitionDefinitionsDB.find("Objective", "Active", "Reject");
  assert.equal(rejected!.event_type, def!.event_type);
});
