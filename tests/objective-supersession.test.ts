// CR-116 — No successor linkage on supersession (Chapter 1 §12/§13, OBJ-006).
// Covers: the Active -> Superseded hop through the generic transition
// (the supersede-objective action calls supersessionEngine.check), the cross-tenant real enforcement
// (not just a UI candidate-list filter — reParentObjective's own precedent),
// and getObjectiveDetail's supersedeCandidates/possibleNextStates
// surfacing. Run against the real dev database, no mocking — same discipline
// as objective-lifecycle.test.ts.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { createObjective, getObjectiveDetail } from "../src/routes/seu/core/objectives.js";
import { objectivesDB } from "../src/dblayer/objectivesDB.js";
import { participantsMasterDB } from "../src/dblayer/participantsMasterDB.js";
import { ensureEventSubscriptionsLoaded, TESTER_ALL_ID, TESTER_OBJECTIVE_ACHIEVE_ONLY, TESTER_OBJECTIVE_BABYLON, grantBadge, transitionObjective } from "./testFixtures.js";

before(async () => {
  await ensureEventSubscriptionsLoaded();
});

async function activeObjective(requestedBy: string, statementPrefix: string) {
  const { objective } = await createObjective({
    statement: `${statementPrefix}-${randomUUID()}`,
    requiredCapabilityCodes: [],
    tier: "Strategic",
    requestedBy,
  });
  const activated = await transitionObjective({ objectiveId: objective.id, targetState: "Active", actorId: requestedBy });
  assert.equal(activated.ok, true, !activated.ok ? activated.reason : "assertion failed");
  return objective;
}

test("transitionObjective Active -> Superseded requires a real superseding Objective and a comment", async () => {
  const a = await activeObjective(TESTER_ALL_ID, "cr116-a");
  const b = await activeObjective(TESTER_ALL_ID, "cr116-b");

  // No supersedingObjectiveId at all.
  await assert.rejects(
    () => transitionObjective({ objectiveId: a.id, targetState: "Superseded", actorId: TESTER_ALL_ID, comment: "replaced by a better fit" }),
    /requires the superseding entity's id/
  );

  // An id that doesn't resolve to a real Objective.
  await assert.rejects(
    () => transitionObjective({ objectiveId: a.id, targetState: "Superseded", actorId: TESTER_ALL_ID, comment: "replaced by a better fit", supersedingObjectiveId: randomUUID() }),
    /superseding entity not found/
  );

  // A real, valid B but no comment — mandatory whenever a superseding id is
  // supplied (owner: "make it mandatory when supersession id exists").
  const noComment = await transitionObjective({ objectiveId: a.id, targetState: "Superseded", actorId: TESTER_ALL_ID, supersedingObjectiveId: b.id });
  assert.equal(noComment.ok, false);
  if (!noComment.ok) assert.equal(noComment.reason, "policy_blocked");

  // Valid B + comment — succeeds, and A's own superseding_objective_id is
  // written to B's id.
  const superseded = await transitionObjective({ objectiveId: a.id, targetState: "Superseded", actorId: TESTER_ALL_ID, comment: "replaced by a better fit", supersedingObjectiveId: b.id });
  assert.equal(superseded.ok, true, !superseded.ok ? superseded.reason : "assertion failed");
  if (superseded.ok) {
    assert.equal(superseded.objective.status, "Superseded");
    assert.deepEqual(superseded.appliedTransition, { fromState: "Active", toState: "Superseded" });
  }

  const { data: reloaded } = await objectivesDB.findById(a.id);
  assert.equal(reloaded?.superseding_objective_id, b.id);

  const { data: aAfter } = await objectivesDB.findById(a.id);
  assert.ok(aAfter?.comments.some((c) => c.text === "replaced by a better fit"), "the Supersede comment must be recorded on A's comment thread");
});

// CLAUDE.md tenancy rule — "every objective scoped to tenant that is Active"
// is real enforcement, not just a candidate-list filter (reParentObjective's
// own cross-tenant precedent). TESTER_OBJECTIVE_ACHIEVE_ONLY only holds
// objective_achieve, so it's granted objective_supersede/objective_propose
// here, same pattern sdk-authoring.test.ts's own grant() helper established.
test("transitionObjective refuses a cross-tenant superseding Objective", async () => {
  // grantBadge persists on the shared tester row, so restore the original badge list afterwards —
  // the Objectives viewer test in web-flow.e2e.test.ts needs this tester to hold objective_achieve only.
  const { data: holder } = await participantsMasterDB.findById(TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId);
  const originalBadges = holder!.authorised_badges;
  try {
  await grantBadge(TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId, "objective_propose");
  await grantBadge(TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId, "objective_activate");
  await grantBadge(TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId, "objective_supersede");

  const athens = await activeObjective(TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId, "cr116-athens");
  const babylon = await activeObjective(TESTER_OBJECTIVE_BABYLON.participantId, "cr116-babylon");

  await assert.rejects(
    () =>
      transitionObjective({
        objectiveId: athens.id,
        targetState: "Superseded",
        actorId: TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId,
        comment: "trying to supersede across tenants",
        supersedingObjectiveId: babylon.id,
      }),
    /different tenant/
  );

  // Athens must be untouched — still Active, no superseding id recorded.
  const { data: reloaded } = await objectivesDB.findById(athens.id);
  assert.equal(reloaded?.status, "Active");
  assert.equal(reloaded?.superseding_objective_id, null);
  } finally {
    const { error } = await participantsMasterDB.setAuthorisedBadges(TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId, originalBadges);
    if (error) throw error;
  }
});

test("getObjectiveDetail excludes Superseded from the generic dropdown and exposes same-tenant Active candidates", async () => {
  const a = await activeObjective(TESTER_ALL_ID, "cr116-detail-a");
  const b = await activeObjective(TESTER_ALL_ID, "cr116-detail-b");

  const detail = await getObjectiveDetail(a.id);
  assert.ok(detail);
  assert.ok(!detail?.possibleNextStates.includes("Superseded"), "Superseded must never appear in the generic one-click dropdown");
  assert.ok(detail?.supersedeCandidates.some((c) => c.id === b.id), "another Active same-tenant Objective must be offered as a candidate");
  assert.ok(!detail?.supersedeCandidates.some((c) => c.id === a.id), "the Objective itself must never be offered as its own supersessor");

  const superseded = await transitionObjective({ objectiveId: a.id, targetState: "Superseded", actorId: TESTER_ALL_ID, comment: "superseded for this test", supersedingObjectiveId: b.id });
  assert.equal(superseded.ok, true);
  const afterDetail = await getObjectiveDetail(a.id);
  assert.equal(afterDetail?.supersedeCandidates.length, 0, "a Superseded Objective has no Superseded hop left, so no candidates are offered");
});
