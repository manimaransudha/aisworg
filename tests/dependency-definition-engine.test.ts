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
import { ensureWebAppTemplateFixture } from "./testFixtures.js";

after(async () => {
  await pool.end();
});

test("dependencyDefinitionEngine: a target with no incoming rows is ready trivially", async () => {
  await ensureWebAppTemplateFixture();
  const { data: template } = await templatesDB.findByCode("test-enterprise-web-application");
  assert.ok(template);

  const { data: objective } = await objectivesDB.create({ statement: `dep-def-engine-test-${randomUUID()}`, tier: "Strategic", requestedBy: 1001 });
  const { data: profile } = await profilesDB.findByCode("test-profile-default-development");
  const { data: seu } = await seusDB.create({ objectiveId: objective!.id, templateId: template!.id, profileId: profile!.id });
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

  const { data: objective } = await objectivesDB.create({ statement: `dep-def-engine-test-${randomUUID()}`, tier: "Strategic", requestedBy: 1001 });
  const { data: profile } = await profilesDB.findByCode("test-profile-default-development");
  const { data: seu } = await seusDB.create({ objectiveId: objective!.id, templateId: template!.id, profileId: profile!.id });
  assert.ok(seu);

  const { data: upstream } = await deliverablesDB.create({ seuId: seu!.id, name: "Requirements Analysis Model", category: "Documentation" });
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

  const { data: objective } = await objectivesDB.create({ statement: `dep-def-engine-test-${randomUUID()}`, tier: "Strategic", requestedBy: 1001 });
  const { data: profile } = await profilesDB.findByCode("test-profile-default-development");
  const { data: seu } = await seusDB.create({ objectiveId: objective!.id, templateId: template!.id, profileId: profile!.id });
  assert.ok(seu);

  const { data: upstream } = await deliverablesDB.create({ seuId: seu!.id, name: "Requirements Analysis Model", category: "Documentation" });
  const { data: downstream } = await deliverablesDB.create({ seuId: seu!.id, name: "Architecture Decision Record", category: "Documentation" });
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
