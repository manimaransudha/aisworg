// Post-MVP Phase 1 (Formalize Objective) — automated coverage for what the
// Phase 1 audit in design/mvp-build-plan/Post-MVP Build Sequence.md checked
// by hand: decomposition/tier validation, the Ch.1 lifecycle, real versioning,
// the "Objective must be Active to commission" gate, and the Objective-first
// commissioning path. Run against the real dev database, same discipline as
// tests/engine.test.ts — no mocking, unique statements per test so fixtures
// never collide with seed data or each other.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { createObjective, deleteObjective, getObjectiveChildren, getObjectiveDetail, getRejectedObjectivesPage, listReParentCandidates, reParentObjective, submitObjective, transitionObjective, updateObjective, suggestCapabilityCodes } from "../src/routes/seu/core/objectives.js";
import { createProfile } from "../src/routes/seu/core/profiles.js";
import { commissionSeu, commissionFromExistingObjective } from "../src/routes/seu/core/commissioning.js";
import { findCandidateTemplates } from "../src/routes/seu/core/templates.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { objectivesDB } from "../src/dblayer/objectivesDB.js";
import { ensureWebAppTemplateFixture } from "./testFixtures.js";

after(async () => {
  await pool.end();
});

// CR-009: Operational/Engineering Objectives require a parent (only Strategic
// may be a root). These tests build their fixtures under a fresh Strategic root.
async function strategicRoot(): Promise<string> {
  // CR-075 — createObjective now requires the parent to be Proposed when
  // adding a child under it. This helper's only job is to be a parent, so
  // it stays Proposed (never activated) rather than the old implicit-Active
  // default.
  const { objective } = await createObjective({
    statement: `phase1-root-${randomUUID()}`,
    requiredCapabilityCodes: [],
    tier: "Strategic", requestedBy: 1001, status: "Proposed",});
  return objective.id;
}

test("createObjective rejects a child whose tier is more strategic than its parent's", async () => {
  const { objective: parent } = await createObjective({
    statement: `phase1-parent-${randomUUID()}`,
    requiredCapabilityCodes: ["architecture"],
    tier: "Operational",
    parentObjectiveId: await strategicRoot(), requestedBy: 1001,});

  await assert.rejects(
    () =>
      createObjective({
        statement: `phase1-bad-child-${randomUUID()}`,
        requiredCapabilityCodes: ["architecture"],
        tier: "Strategic",
        parentObjectiveId: parent.id, requestedBy: 1001,}),
    /cannot be more strategic than its parent/
  );
});

test("createObjective accepts a valid child, and getObjectiveDetail shows both sides of the decomposition tree", async () => {
  const { objective: parent } = await createObjective({
    statement: `phase1-parent-${randomUUID()}`,
    requiredCapabilityCodes: ["architecture"],
    tier: "Strategic", requestedBy: 1001, status: "Proposed",});
  const { objective: child } = await createObjective({
    statement: `phase1-child-${randomUUID()}`,
    requiredCapabilityCodes: ["development"],
    tier: "Operational",
    parentObjectiveId: parent.id, requestedBy: 1001,});

  const parentDetail = await getObjectiveDetail(parent.id);
  assert.equal(parentDetail?.children.length, 1);
  assert.equal(parentDetail?.children[0]?.id, child.id);

  const childDetail = await getObjectiveDetail(child.id);
  assert.equal(childDetail?.parent?.id, parent.id);
});

test("updateObjective bumps the version's patch segment and applies the edit", async () => {
  const { objective } = await createObjective({
    statement: `phase1-versioned-${randomUUID()}`,
    requiredCapabilityCodes: ["architecture"],
    tier: "Engineering",
    // CR-075 — updateObjective now requires Proposed (every other status is
    // Comments-only); explicit here since this test is about version-bump
    // behavior, not status gating.
    parentObjectiveId: await strategicRoot(), requestedBy: 1001, status: "Proposed",});
  assert.equal(objective.version, "1.0.0");

  const updated = await updateObjective(objective.id, { statement: "phase1-revised-statement" });
  assert.equal(updated.version, "1.0.1");
  assert.equal(updated.statement, "phase1-revised-statement");

  // owner: "add a save without versioning. in which case the current version
  // carries over" — bumpVersion: false must leave version untouched.
  const unversioned = await updateObjective(objective.id, { statement: "phase1-revised-again", bumpVersion: false });
  assert.equal(unversioned.version, "1.0.1");
  assert.equal(unversioned.statement, "phase1-revised-again");
});

test("transitionObjective follows the Ch.1 lifecycle and rejects an undefined transition", async () => {
  const { objective } = await createObjective({
    statement: `phase1-lifecycle-${randomUUID()}`,
    requiredCapabilityCodes: ["architecture"],
    tier: "Engineering",
    parentObjectiveId: await strategicRoot(),
    status: "Proposed", requestedBy: 1001,});

  const skipAhead = await transitionObjective({ objectiveId: objective.id, targetState: "Archived", actorRole: "super", actorId: "1001" });
  assert.equal(skipAhead.ok, false);
  if (!skipAhead.ok && skipAhead.reason !== "not_found") assert.equal(skipAhead.reason, "no_transition_definition");

  // CR-072 — Proposed -> Active now needs its own submit_verb ("propose")
  // queued first; transitionObjective real-gates on it (not just a UI hint).
  await submitObjective(objective.id, 1001);
  const activate = await transitionObjective({ objectiveId: objective.id, targetState: "Active", actorRole: "general", actorId: "1001" });
  assert.equal(activate.ok, true);
  if (activate.ok) {
    assert.equal(activate.objective.status, "Active");
    assert.deepEqual(activate.appliedTransition, { fromState: "Proposed", toState: "Active" });
  }
});

// CR-075 (owner: "Disallow Edit when the Objective has been proposed... Same
// with Delete. Once it is queued with the active badge, it cannot be
// deleted") — once a Proposed leaf is submitted for activation, the
// objective_activate holder is reviewing it as a real candidate; both Edit
// and Delete must refuse until they act on it (real checks in
// updateObjective/deleteObjective, not just a hidden button).
test("a submitted Proposed Objective locks both Edit and Delete until the activate badge holder acts on it", async () => {
  const { objective } = await createObjective({
    statement: `phase1-locked-${randomUUID()}`,
    requiredCapabilityCodes: ["architecture"],
    tier: "Engineering",
    parentObjectiveId: await strategicRoot(),
    status: "Proposed", requestedBy: 1001,
  });

  // Before submission: both work normally.
  const beforeDetail = await getObjectiveDetail(objective.id);
  assert.equal(beforeDetail?.editLocked, false);
  assert.equal(beforeDetail?.deletable, true);
  const preSubmitEdit = await updateObjective(objective.id, { statement: "still-editable-pre-submit" });
  assert.equal(preSubmitEdit.statement, "still-editable-pre-submit");

  await submitObjective(objective.id, 1001);

  const afterDetail = await getObjectiveDetail(objective.id);
  assert.equal(afterDetail?.editLocked, true, "the detail view must reflect the lock, not just the throw below");
  assert.equal(afterDetail?.deletable, false);

  await assert.rejects(
    () => updateObjective(objective.id, { statement: "should-not-apply" }),
    /already been submitted for activation/
  );
  await assert.rejects(
    () => deleteObjective(objective.id),
    /already been submitted for activation/
  );

  // The statement from the rejected edit attempt must not have applied.
  const { data: unchanged } = await objectivesDB.findById(objective.id);
  assert.equal(unchanged?.statement, "still-editable-pre-submit");
});

// CR-075 (owner: "Only propose can edit every field based on rules wherever
// applicable. All other states can only add comments in their edit form" /
// "adding moving is all editing") — statement, required Capabilities, Add
// child and Move are only allowed while status is Proposed; every other
// status can still be commented on (a separate, status-independent rule),
// just nothing else.
test("only a Proposed Objective can have its fields/decomposition edited — every other status is Comments-only", async () => {
  const { objective: root } = await createObjective({
    statement: `phase1-proposed-only-root-${randomUUID()}`,
    requiredCapabilityCodes: [],
    tier: "Strategic",
    status: "Proposed", requestedBy: 1001,
  });
  const { objective: child } = await createObjective({
    statement: `phase1-proposed-only-child-${randomUUID()}`,
    requiredCapabilityCodes: ["architecture"],
    tier: "Engineering",
    parentObjectiveId: root.id,
    status: "Proposed", requestedBy: 1001,
  });
  const { objective: otherRoot } = await createObjective({
    statement: `phase1-proposed-only-otherroot-${randomUUID()}`,
    requiredCapabilityCodes: [],
    tier: "Strategic",
    status: "Proposed", requestedBy: 1001,
  });

  // While still Proposed: everything works normally.
  await updateObjective(child.id, { statement: "still-Proposed-still-editable" });

  await submitObjective(child.id, 1001);
  const activated = await transitionObjective({ objectiveId: child.id, targetState: "Active", actorRole: "general", actorId: "1001" });
  assert.equal(activated.ok, true);

  // Now Active: statement/Capabilities/Move/Add-child must all be refused —
  // real enforcement, the same rule everywhere it applies.
  await assert.rejects(() => updateObjective(child.id, { statement: "should-not-apply" }), /is not Proposed/);
  await assert.rejects(() => reParentObjective(child.id, otherRoot.id), /is not Proposed/);
  await assert.rejects(
    () =>
      createObjective({
        statement: `phase1-proposed-only-grandchild-${randomUUID()}`,
        requiredCapabilityCodes: ["architecture"],
        tier: "Engineering",
        parentObjectiveId: child.id,
        requestedBy: 1001,
      }),
    /parent Objective is not Proposed/
  );

  // Comments are a separate, status-independent rule — still work.
  const { error: commentErr } = await objectivesDB.addComment(child.id, 1001, "still commentable while Active");
  assert.equal(commentErr, undefined);
  const { data: comments } = await objectivesDB.getComments(child.id);
  assert.ok(comments?.some((c) => c.comment_text === "still commentable while Active"));

  // The rejected edit attempt must not have applied.
  const { data: unchangedChild } = await objectivesDB.findById(child.id);
  assert.equal(unchangedChild?.statement, "still-Proposed-still-editable");
});

// CR-075 (owner: "Check the functionality of move objectives. It should not
// move beyond the tenant scope") — objectivesDB.updateParent only ever
// changes parent_objective_id, never sponsoring_authority, so a cross-tenant
// move would otherwise leave the moved subtree structurally under the new
// tenant's tree while still attributed to its OLD tenant forever. Blocked
// outright (no root exemption — moving is never a legitimate cross-tenant
// operation), and the "Move to" candidate list must not even offer the
// other tenant's Objective as an option (owner-established precedent: never
// leak another tenant's existence/statement, even where the action would
// just fail). Athens (2001) / Babylon (2011) are the real, seeded
// cross-tenant test identities (CR-006).
test("reParentObjective refuses a cross-tenant move, and listReParentCandidates never offers one", async () => {
  const { objective: athensRoot } = await createObjective({
    statement: `phase1-tenant-move-athens-root-${randomUUID()}`,
    requiredCapabilityCodes: [], tier: "Strategic", requestedBy: 2001, status: "Proposed",
  });
  const { objective: athensOtherRoot } = await createObjective({
    statement: `phase1-tenant-move-athens-other-root-${randomUUID()}`,
    requiredCapabilityCodes: [], tier: "Strategic", requestedBy: 2001, status: "Proposed",
  });
  const { objective: babylonRoot } = await createObjective({
    statement: `phase1-tenant-move-babylon-root-${randomUUID()}`,
    requiredCapabilityCodes: [], tier: "Strategic", requestedBy: 2011, status: "Proposed",
  });
  const { objective: athensChild } = await createObjective({
    statement: `phase1-tenant-move-athens-child-${randomUUID()}`,
    requiredCapabilityCodes: ["architecture"], tier: "Engineering",
    parentObjectiveId: athensRoot.id, requestedBy: 2001, status: "Proposed",
  });

  const candidates = await listReParentCandidates(athensChild.id);
  assert.ok(candidates.some((c) => c.id === athensOtherRoot.id), "a same-tenant candidate must still be offered");
  assert.ok(!candidates.some((c) => c.id === babylonRoot.id), "another tenant's Objective must never be offered as a move target");

  await assert.rejects(() => reParentObjective(athensChild.id, babylonRoot.id), /different tenant/);

  // A same-tenant move still works normally.
  const moved = await reParentObjective(athensChild.id, athensOtherRoot.id);
  assert.equal(moved.parent_objective_id, athensOtherRoot.id);
});

// CR-075 (owner: "Locked node locks its whole subtree") — submitting a root
// locks every descendant too, not just the root itself: isObjectiveEditLocked
// walks the ancestor chain (findAncestorPath), the existing counterpart to
// findDescendantIds retireObjectiveSubtree already uses for the same "whole
// subtree" pattern. A sibling subtree, unrelated to the locked root, must
// stay completely unaffected.
test("submitting a Proposed root locks edit/delete/move/add-child on its whole subtree, not just itself", async () => {
  const { objective: root } = await createObjective({
    statement: `phase1-subtree-root-${randomUUID()}`,
    requiredCapabilityCodes: [],
    tier: "Strategic",
    status: "Proposed", requestedBy: 1001,
  });
  const { objective: child } = await createObjective({
    statement: `phase1-subtree-child-${randomUUID()}`,
    requiredCapabilityCodes: ["architecture"],
    tier: "Operational",
    parentObjectiveId: root.id,
    status: "Proposed", requestedBy: 1001,
  });
  const { objective: grandchild } = await createObjective({
    statement: `phase1-subtree-grandchild-${randomUUID()}`,
    requiredCapabilityCodes: ["architecture"],
    tier: "Engineering",
    parentObjectiveId: child.id,
    status: "Proposed", requestedBy: 1001,
  });

  // An unrelated sibling tree, to prove the lock doesn't leak globally.
  const { objective: otherRoot } = await createObjective({
    statement: `phase1-subtree-unrelated-${randomUUID()}`,
    requiredCapabilityCodes: [],
    tier: "Strategic",
    status: "Proposed", requestedBy: 1001,
  });

  // Before the root is submitted: the whole subtree is freely editable.
  assert.equal((await getObjectiveDetail(child.id))?.editLocked, false);
  assert.equal((await getObjectiveDetail(grandchild.id))?.editLocked, false);

  await submitObjective(root.id, 1001);

  assert.equal((await getObjectiveDetail(root.id))?.editLocked, true);
  assert.equal((await getObjectiveDetail(child.id))?.editLocked, true, "a submitted ancestor locks its child");
  assert.equal((await getObjectiveDetail(grandchild.id))?.editLocked, true, "a submitted ancestor locks its grandchild too");
  assert.equal((await getObjectiveDetail(grandchild.id))?.deletable, false);

  await assert.rejects(() => updateObjective(child.id, { statement: "should-not-apply" }), /already been submitted for activation/);
  await assert.rejects(() => deleteObjective(grandchild.id), /already been submitted for activation/);
  await assert.rejects(() => reParentObjective(grandchild.id, otherRoot.id), /already been submitted for activation/);
  await assert.rejects(
    () =>
      createObjective({
        statement: `phase1-subtree-new-grandchild-${randomUUID()}`,
        requiredCapabilityCodes: ["architecture"],
        tier: "Engineering",
        parentObjectiveId: child.id,
        requestedBy: 1001,
      }),
    /already been submitted for activation/
  );

  // The unrelated sibling tree is untouched by the root's own lock.
  assert.equal((await getObjectiveDetail(otherRoot.id))?.editLocked, false);

  // CR-075 (owner: "It does not extend to the tree/list rows' Delete button
  // visibility - It has to") — the batched list-rendering path
  // (getObjectiveChildren, used by both the tree page and its lazy-expand
  // fragment) must reflect the same lock, not just the single-node detail
  // page's own getObjectiveDetail call above.
  const childrenOfChild = await getObjectiveChildren(child.id);
  const grandchildRow = childrenOfChild.find((c) => c.id === grandchild.id);
  assert.ok(grandchildRow, "grandchild must still appear in the list");
  assert.equal(grandchildRow?.deletable, false, "a list row must reflect an ancestor's lock, not just its own submission state");
});

// CR-073 — Active -> Reject: a real, distinct status (owner: "It is Active
// to Reject" — not "Rejected", not a reuse of "Proposed"), its own
// objective_reject badge (owner: "A verb cannot denote two different
// transitions" — not a reuse of Activate's), mandatory feedback that must be
// genuinely new text every time, not just non-empty. actorId "1001" holds
// every objective_* badge (seedIdentityBaseline's TESTER_ALL_ID), so this
// isn't isolating the badge check itself — just proving the transition and
// its comment-mandatory gate.
test("transitionObjective Active -> Reject requires new feedback every time and records it as a comment", async () => {
  const { objective } = await createObjective({
    statement: `phase1-reject-${randomUUID()}`,
    requiredCapabilityCodes: ["architecture"],
    tier: "Engineering",
    parentObjectiveId: await strategicRoot(),
    status: "Proposed", requestedBy: 1001,
  });
  await submitObjective(objective.id, 1001);
  const activated = await transitionObjective({ objectiveId: objective.id, targetState: "Active", actorRole: "general", actorId: "1001" });
  assert.equal(activated.ok, true);

  const noComment = await transitionObjective({ objectiveId: objective.id, targetState: "Reject", actorRole: "general", actorId: "1001" });
  assert.equal(noComment.ok, false);
  if (!noComment.ok) assert.equal(noComment.reason, "comment_required");

  // Pre-seed a comment (as if left earlier via the general comment thread) —
  // rejecting with that exact same text must still be refused, since a
  // reject needs genuinely new feedback, not just a non-empty field.
  const staleText = "needs more detail on the fraud-detection scope";
  await objectivesDB.addComment(objective.id, 1001, staleText);
  const staleComment = await transitionObjective({ objectiveId: objective.id, targetState: "Reject", actorRole: "general", actorId: "1001", comment: staleText });
  assert.equal(staleComment.ok, false);
  if (!staleComment.ok) assert.equal(staleComment.reason, "comment_required");

  const rejected = await transitionObjective({ objectiveId: objective.id, targetState: "Reject", actorRole: "general", actorId: "1001", comment: "needs a narrower fraud-detection scope before reconsidering" });
  assert.equal(rejected.ok, true);
  if (rejected.ok) {
    assert.equal(rejected.objective.status, "Reject");
    assert.deepEqual(rejected.appliedTransition, { fromState: "Active", toState: "Reject" });
  }

  const { data: comments } = await objectivesDB.getComments(objective.id);
  assert.equal(comments?.length, 2, "the stale pre-seeded comment plus the successful reject's own comment");
  assert.equal(comments?.[1]?.comment_text, "needs a narrower fraud-detection scope before reconsidering");
});

// CR-075 — a Reject-status row is never self-locked (isObjectiveEditLocked
// only fires for Proposed), but getRejectedObjectivesPage must still reflect
// a currently-submitted ancestor's lock, same rule as every other list here
// — this is its own code path (a distinct wiring fix), not just a re-test of
// computeEditLockedIds itself.
test("getRejectedObjectivesPage reflects an ancestor's lock on a Reject-status row", async () => {
  const { objective: root } = await createObjective({
    statement: `phase1-rejected-list-root-${randomUUID()}`,
    requiredCapabilityCodes: [],
    tier: "Strategic",
    status: "Proposed", requestedBy: 1001,
  });
  const { objective: child } = await createObjective({
    statement: `phase1-rejected-list-child-${randomUUID()}`,
    requiredCapabilityCodes: ["architecture"],
    tier: "Engineering",
    parentObjectiveId: root.id,
    status: "Proposed", requestedBy: 1001,
  });

  await submitObjective(child.id, 1001);
  await transitionObjective({ objectiveId: child.id, targetState: "Active", actorRole: "general", actorId: "1001" });
  const rejected = await transitionObjective({
    objectiveId: child.id, targetState: "Reject", actorRole: "general", actorId: "1001",
    comment: "needs revision before reconsidering",
  });
  assert.equal(rejected.ok, true);

  const beforeRootSubmit = await getRejectedObjectivesPage({ limit: 100, offset: 0 });
  assert.equal(beforeRootSubmit.items.find((o) => o.id === child.id)?.editLocked, false);

  await submitObjective(root.id, 1001);

  const afterRootSubmit = await getRejectedObjectivesPage({ limit: 100, offset: 0 });
  const row = afterRootSubmit.items.find((o) => o.id === child.id);
  assert.ok(row, "the rejected child must still appear in the list");
  assert.equal(row?.editLocked, true, "a Reject-status row must reflect its ancestor's lock");
});

test("commissionSeu requires the Objective to be Active — blocks Proposed, succeeds once Activated", async () => {
  const { objective } = await createObjective({
    statement: `phase1-gate-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"],
    tier: "Engineering",
    parentObjectiveId: await strategicRoot(),
    status: "Proposed", requestedBy: 1001,});
  await ensureWebAppTemplateFixture();
  const { data: template } = await templatesDB.findByCode("test-enterprise-web-application");
  assert.ok(template);
  const profile = await createProfile({ templateId: template.id, environment: "development" });

  const blocked = await commissionSeu({ objectiveId: objective.id, templateId: template.id, profileId: profile.id, actorRole: "super", actorId: "1001" });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.ok(blocked.reason.includes("not Active"), `expected reason to mention "not Active", got: ${blocked.reason}`);

  await submitObjective(objective.id, 1001);
  const activated = await transitionObjective({ objectiveId: objective.id, targetState: "Active", actorRole: "general", actorId: "1001" });
  assert.equal(activated.ok, true);

  const allowed = await commissionSeu({ objectiveId: objective.id, templateId: template.id, profileId: profile.id, actorRole: "super", actorId: "1001" });
  assert.equal(allowed.ok, true);
  if (allowed.ok) assert.equal(allowed.seu.lifecycle_state, "Operational");
});

test("commissionFromExistingObjective reuses the Objective's own declared Capabilities, no re-picking", async () => {
  const { objective } = await createObjective({
    statement: `phase1-existing-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"],
    tier: "Engineering",
    parentObjectiveId: await strategicRoot(),
    requestedBy: 1001,
    // status omitted — defaults Active, matching the one-shot quick-commission path
  });

  const result = await commissionFromExistingObjective({ objectiveId: objective.id, actorRole: "super", actorId: "1001" });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.seu.lifecycle_state, "Operational");
});

test("suggestCapabilityCodes matches on word overlap with a Capability's name/description", async () => {
  const codes = await suggestCapabilityCodes("We need requirements analysis work done for this engagement");
  assert.ok(codes.includes("requirements-analysis"), `expected requirements-analysis in ${JSON.stringify(codes)}`);
});

// Bug fix regression: findCandidateTemplates correctly allows a Template
// requiring MORE Capabilities than requested to satisfy (Ch.6 §11 — that's
// intentional, not a mismatch). The real defect was in what happened when
// more than one Template satisfies: the first alphabetically-sorted match
// won, not the tightest fit. This only became observable once a second real
// Template (requiring strictly more Capabilities than
// test-enterprise-web-application) existed in the Registry — see
// seedEbookLibraryPilot.ts. Requesting exactly test-enterprise-web-application's
// 3 required Capabilities must select it over any looser-fitting Template
// that also happens to satisfy, regardless of code ordering.
test("findCandidateTemplates picks the tightest-fitting satisfying Template, not whichever sorts first alphabetically", async () => {
  await ensureWebAppTemplateFixture();
  const { data: webApp } = await templatesDB.findByCode("test-enterprise-web-application");
  assert.ok(webApp, "expected test-enterprise-web-application to be seeded");
  const { data: webAppCapabilities } = await templatesDB.getRequiredCapabilities(webApp!.id);
  assert.ok(webAppCapabilities && webAppCapabilities.length > 0);

  const candidates = await findCandidateTemplates(webAppCapabilities!.map((c) => c.code));
  const satisfying = candidates.filter((c) => c.satisfies);
  assert.ok(satisfying.length >= 1);

  // Ascending by required-Capability count — the tightest fit is first.
  for (let i = 1; i < satisfying.length; i++) {
    assert.ok(satisfying[i]!.requiredCapabilityCount >= satisfying[i - 1]!.requiredCapabilityCount);
  }

  const selected = satisfying[0];
  assert.equal(selected?.code, "test-enterprise-web-application", `expected the exact-fit Template to win, got: ${selected?.code}`);
});
