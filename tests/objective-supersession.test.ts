// CR-116 — No successor linkage on supersession (Chapter 1 §12/§13, OBJ-006).
// Covers: transitionObjective's new Active -> Superseded wiring
// (supersessionEngine.check, inline the same way Reject's own
// comment-required check already sits), the cross-tenant real enforcement
// (not just a UI candidate-list filter — reParentObjective's own precedent),
// and getObjectiveDetail's supersedable/supersedeCandidates/possibleNextStates
// surfacing. Run against the real dev database, no mocking — same discipline
// as objective-lifecycle.test.ts.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { createObjective, getObjectiveDetail, submitObjective, transitionObjective } from "../src/routes/seu/core/objectives.js";
import { objectivesDB } from "../src/dblayer/objectivesDB.js";
import { ensureEventSubscriptionsLoaded, TESTER_ALL_ID, TESTER_OBJECTIVE_ACHIEVE_ONLY, TESTER_OBJECTIVE_BABYLON, grantBadge } from "./testFixtures.js";

before(async () => {
  await ensureEventSubscriptionsLoaded();
});

async function activeObjective(requestedBy: string, statementPrefix: string) {
  const { objective } = await createObjective({
    statement: `${statementPrefix}-${randomUUID()}`,
    requiredCapabilityCodes: [],
    tier: "Strategic",
    status: "Proposed",
    requestedBy,
  });
  await submitObjective(objective.id, requestedBy);
  const activated = await transitionObjective({ objectiveId: objective.id, targetState: "Active", actorRole: "general", actorId: requestedBy });
  assert.equal(activated.ok, true, !activated.ok ? activated.reason : "assertion failed");
  return objective;
}

test("transitionObjective Active -> Superseded requires a real superseding Objective and a comment", async () => {
  const a = await activeObjective(TESTER_ALL_ID, "cr116-a");
  const b = await activeObjective(TESTER_ALL_ID, "cr116-b");

  // No supersedingObjectiveId at all.
  const missing = await transitionObjective({ objectiveId: a.id, targetState: "Superseded", actorRole: "general", actorId: TESTER_ALL_ID, comment: "replaced by a better fit" });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.reason, "superseding_target_required");

  // An id that doesn't resolve to a real Objective.
  const notFound = await transitionObjective({ objectiveId: a.id, targetState: "Superseded", actorRole: "general", actorId: TESTER_ALL_ID, comment: "replaced by a better fit", supersedingObjectiveId: randomUUID() });
  assert.equal(notFound.ok, false);
  if (!notFound.ok) assert.equal(notFound.reason, "superseding_target_not_found");

  // A real, valid B but no comment — mandatory whenever a superseding id is
  // supplied (owner: "make it mandatory when supersession id exists").
  const noComment = await transitionObjective({ objectiveId: a.id, targetState: "Superseded", actorRole: "general", actorId: TESTER_ALL_ID, supersedingObjectiveId: b.id });
  assert.equal(noComment.ok, false);
  if (!noComment.ok) assert.equal(noComment.reason, "comment_required");

  // Valid B + comment — succeeds, and A's own superseding_objective_id is
  // written to B's id.
  const superseded = await transitionObjective({ objectiveId: a.id, targetState: "Superseded", actorRole: "general", actorId: TESTER_ALL_ID, comment: "replaced by a better fit", supersedingObjectiveId: b.id });
  assert.equal(superseded.ok, true, !superseded.ok ? superseded.reason : "assertion failed");
  if (superseded.ok) {
    assert.equal(superseded.objective.status, "Superseded");
    assert.deepEqual(superseded.appliedTransition, { fromState: "Active", toState: "Superseded" });
  }

  const { data: reloaded } = await objectivesDB.findById(a.id);
  assert.equal(reloaded?.superseding_objective_id, b.id);

  const { data: comments } = await objectivesDB.getComments(a.id);
  assert.ok(comments?.some((c) => c.comment_text === "replaced by a better fit"), "the Supersede comment must be recorded on A's comment thread");
});

// CLAUDE.md tenancy rule — "every objective scoped to tenant that is Active"
// is real enforcement, not just a candidate-list filter (reParentObjective's
// own cross-tenant precedent). TESTER_OBJECTIVE_ACHIEVE_ONLY only holds
// objective_achieve, so it's granted objective_supersede/objective_propose
// here, same pattern sdk-authoring.test.ts's own grant() helper established.
test("transitionObjective refuses a cross-tenant superseding Objective", async () => {
  await grantBadge(TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId, "objective_propose");
  await grantBadge(TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId, "objective_activate");
  await grantBadge(TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId, "objective_supersede");

  const athens = await activeObjective(TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId, "cr116-athens");
  const babylon = await activeObjective(TESTER_OBJECTIVE_BABYLON.participantId, "cr116-babylon");

  const result = await transitionObjective({
    objectiveId: athens.id,
    targetState: "Superseded",
    actorRole: "general",
    actorId: TESTER_OBJECTIVE_ACHIEVE_ONLY.participantId,
    comment: "trying to supersede across tenants",
    supersedingObjectiveId: babylon.id,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "superseding_target_wrong_tenant");

  // Athens must be untouched — still Active, no superseding id recorded.
  const { data: reloaded } = await objectivesDB.findById(athens.id);
  assert.equal(reloaded?.status, "Active");
  assert.equal(reloaded?.superseding_objective_id, null);
});

test("getObjectiveDetail excludes Superseded from the generic dropdown and exposes supersedable + same-tenant Active candidates", async () => {
  const a = await activeObjective(TESTER_ALL_ID, "cr116-detail-a");
  const b = await activeObjective(TESTER_ALL_ID, "cr116-detail-b");

  const detail = await getObjectiveDetail(a.id);
  assert.ok(detail);
  assert.equal(detail?.supersedable, true);
  assert.ok(!detail?.possibleNextStates.includes("Superseded"), "Superseded must never appear in the generic one-click dropdown");
  assert.ok(detail?.supersedeCandidates.some((c) => c.id === b.id), "another Active same-tenant Objective must be offered as a candidate");
  assert.ok(!detail?.supersedeCandidates.some((c) => c.id === a.id), "the Objective itself must never be offered as its own supersessor");

  // Once Superseded, it is no longer itself supersedable.
  const superseded = await transitionObjective({ objectiveId: a.id, targetState: "Superseded", actorRole: "general", actorId: TESTER_ALL_ID, comment: "superseded for this test", supersedingObjectiveId: b.id });
  assert.equal(superseded.ok, true);
  const afterDetail = await getObjectiveDetail(a.id);
  assert.equal(afterDetail?.supersedable, false);
});
