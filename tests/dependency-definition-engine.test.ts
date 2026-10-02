// CR-039 — proves dependencyDefinitionEngine against the real
// test-enterprise-web-application Template's own authored dependencyGraph,
// materialised into real dependency_definitions rows
// (materialiseDependencyGraph, CR-041). Mirrors what used to be
// engine.test.ts's own dependencyEngine tests (same fixture, same
// reach-or-passed regression case, since deleted along with the old
// dependency_edges model) so the two engines' observable behaviour could be
// compared directly during the cutover.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { dependencyDefinitionEngine } from "../src/domain/engine/dependencyDefinitionEngine.js";

import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { objectivesDB } from "../src/dblayer/objectivesDB.js";
import { seusDB } from "../src/dblayer/seusDB.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { participantsDB } from "../src/dblayer/participantsDB.js";
import { participantsMasterDB } from "../src/dblayer/participantsMasterDB.js";
import { ensureWebAppTemplateFixture, ROOT_ACTOR_ID, TESTER_ALL_ID } from "./testFixtures.js";

// deliverables.author_id is a FK to participants(id) (the SEU-scoped
// engagement row), not participants_master directly — same two-hop shape
// resolveAuthor (core/attentionItems.ts) uses for every other seu_id-scoped
// author column. This suite calls deliverablesDB.create directly (not
// through a route), so it resolves its own root actor the same way.
async function rootDeliverableAuthor(seuId: string): Promise<string> {
  const { data: root } = await participantsMasterDB.findById(ROOT_ACTOR_ID);
  if (!root) throw new Error("No participants_master row for the superuser -- is db:clean-slate seeded?");
  const { data: participant, error } = await participantsDB.create({ seuId, type: "Human", displayName: "root", participantId: root.id });
  if (error || !participant) throw error ?? new Error("failed to create root participant fixture");
  return participant.id;
}

// objective_root_sequences.author_id/author_badge are NOT NULL — this suite
// calls objectivesDB.create directly (not through the route/createObjective,
// which resolves this itself), so it resolves its own root actor for the
// same requestedBy: TESTER_ALL_ID these tests already use.
async function rootObjectiveAuthor(): Promise<string> {
  const { data: root } = await participantsMasterDB.findById(TESTER_ALL_ID);
  if (!root) throw new Error("No participants_master row for tester-all -- is db:clean-slate seeded?");
  return root.id;
}

test("dependencyDefinitionEngine: a target with no incoming rows is ready trivially", async () => {
  await ensureWebAppTemplateFixture();
  const { data: template } = await templatesDB.findByCode("test-enterprise-web-application");
  assert.ok(template);

  const objAuthorId = await rootObjectiveAuthor();
  const { data: objective } = await objectivesDB.create({ statement: `dep-def-engine-test-${randomUUID()}`, tier: "Strategic", requestedBy: TESTER_ALL_ID, authorId: objAuthorId, authorBadge: "root" });
  const { data: profile } = await profilesDB.findByCode("test-profile-default-development");
  const { data: seu } = await seusDB.create({ objectiveId: objective!.id, templateId: template!.id, profileId: profile!.id, requestedBy: TESTER_ALL_ID });
  assert.ok(seu);

  // "Requirements Analysis Model" is the catalogue's own root — nothing
  // depends on anything to reach it, so the canonical graph has zero rows
  // targeting it.
  const result = await dependencyDefinitionEngine.isTargetReady(seu!.id, "Deliverable", "Requirements Analysis Model", "In Progress");
  assert.equal(result.ready, true);
  assert.equal(result.rows.length, 0);
});

// Rewritten (owner, 2026-09-06: "rewrite tests to assert the new
// Deliverable-only model instead") — this test used to prove a Deliverable-
// type row AND a Capability-type row both gating the same target. Capability-
// type edges were retired outright before this session (materialiseDependencyGraph.ts,
// owner, 2026-09-04: "there is no Capability-type edge... Canonical
// Capabilities do not depend on each other... What has dependency is the
// deliverable... deliverable dependency is what is real") — a
// dependencyGraph entry with fromType "Capability" is now silently skipped
// at materialisation time, so "Architecture Decision Record" is gated by
// exactly the one Deliverable-type row (Requirements Analysis Model reaching
// Approved), not four. The reach-or-passed regression this test also covers
// is still real and still worth proving on the model that's actually live.
test("dependencyDefinitionEngine: a Deliverable-type row gates its target, and reach-or-passed holds once satisfied", async () => {
  await ensureWebAppTemplateFixture();
  const { data: template } = await templatesDB.findByCode("test-enterprise-web-application");
  assert.ok(template);

  const objAuthorId = await rootObjectiveAuthor();
  const { data: objective } = await objectivesDB.create({ statement: `dep-def-engine-test-${randomUUID()}`, tier: "Strategic", requestedBy: TESTER_ALL_ID, authorId: objAuthorId, authorBadge: "root" });
  const { data: profile } = await profilesDB.findByCode("test-profile-default-development");
  const { data: seu } = await seusDB.create({ objectiveId: objective!.id, templateId: template!.id, profileId: profile!.id, requestedBy: TESTER_ALL_ID });
  assert.ok(seu);

  const authorId = await rootDeliverableAuthor(seu!.id);
  const { data: upstream } = await deliverablesDB.create({ seuId: seu!.id, name: "Requirements Analysis Model", category: "Documentation", authorId, authorBadge: "root" });
  assert.ok(upstream);

  const before = await dependencyDefinitionEngine.isTargetReady(seu!.id, "Deliverable", "Architecture Decision Record", "In Progress");
  assert.equal(before.ready, false);
  assert.equal(before.rows.length, 1, "only the Deliverable-type row gates this target now — Capability-type edges are retired");

  await deliverablesDB.updateLifecycleState(upstream!.id, "Approved");
  const satisfied = await dependencyDefinitionEngine.isTargetReady(seu!.id, "Deliverable", "Architecture Decision Record", "In Progress");
  assert.equal(satisfied.ready, true);

  // Regression parity with dependencyEngine's own fix (engine.test.ts): the
  // upstream Deliverable moving PAST the required state (Approved ->
  // Baselined) must not un-satisfy an already-satisfied row.
  await deliverablesDB.updateLifecycleState(upstream!.id, "Baselined");
  const afterPassed = await dependencyDefinitionEngine.isTargetReady(seu!.id, "Deliverable", "Architecture Decision Record", "In Progress");
  assert.equal(afterPassed.ready, true, "an upstream Deliverable that has moved PAST the required state must still satisfy the dependency");
});

test("dependencyDefinitionEngine.evaluateAndPublishFromTransition publishes DeliverableReady only once a target's rows all hold, not before", async () => {
  await ensureWebAppTemplateFixture();
  const { data: template } = await templatesDB.findByCode("test-enterprise-web-application");
  assert.ok(template);

  const objAuthorId = await rootObjectiveAuthor();
  const { data: objective } = await objectivesDB.create({ statement: `dep-def-engine-test-${randomUUID()}`, tier: "Strategic", requestedBy: TESTER_ALL_ID, authorId: objAuthorId, authorBadge: "root" });
  const { data: profile } = await profilesDB.findByCode("test-profile-default-development");
  const { data: seu } = await seusDB.create({ objectiveId: objective!.id, templateId: template!.id, profileId: profile!.id, requestedBy: TESTER_ALL_ID });
  assert.ok(seu);

  const authorId = await rootDeliverableAuthor(seu!.id);
  const { data: upstream } = await deliverablesDB.create({ seuId: seu!.id, name: "Requirements Analysis Model", category: "Documentation", authorId, authorBadge: "root" });
  const { data: downstream } = await deliverablesDB.create({ seuId: seu!.id, name: "Architecture Decision Record", category: "Documentation", authorId, authorBadge: "root" });
  assert.ok(upstream && downstream);

  const { eventsDB } = await import("../src/dblayer/eventsDB.js");

  // Rewritten (owner, 2026-09-06: "rewrite tests to assert the new
  // Deliverable-only model instead") — Capability-type edges are retired
  // (see this file's other test); the only row gating "Architecture Decision
  // Record" is the Deliverable-type one. Pushing a transition on the
  // upstream Deliverable BEFORE it reaches Approved must not publish.
  await dependencyDefinitionEngine.evaluateAndPublishFromTransition({
    seuId: seu!.id,
    entityType: "Deliverable",
    name: "Requirements Analysis Model",
    newState: "In Progress",
  });
  const { data: tooEarly } = await eventsDB.findByOriginatingObject("Deliverable", downstream!.id);
  assert.equal((tooEarly ?? []).filter((e) => e.event_type === "DeliverableReady").length, 0, "must not publish while the Deliverable-type row is still unsatisfied");

  await deliverablesDB.updateLifecycleState(upstream!.id, "Approved");
  await dependencyDefinitionEngine.evaluateAndPublishFromTransition({
    seuId: seu!.id,
    entityType: "Deliverable",
    name: "Requirements Analysis Model",
    newState: "Approved",
  });

  const { data: nowSatisfied } = await eventsDB.findByOriginatingObject("Deliverable", downstream!.id);
  const published = (nowSatisfied ?? []).filter((e) => e.event_type === "DeliverableReady");
  assert.equal(published.length, 1);
  assert.equal((published[0].payload as { toName?: string }).toName, "Architecture Decision Record");
});
