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
import { capabilitiesDB } from "../src/dblayer/capabilitiesDB.js";
import { seuCapabilitiesDB } from "../src/dblayer/seuCapabilitiesDB.js";
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

  // "Requirements Specification" is the catalogue's own root — nothing
  // depends on anything to reach it, so the canonical graph has zero rows
  // targeting it.
  const result = await dependencyDefinitionEngine.isTargetReady(seu!.id, "Deliverable", "Requirements Specification", "In Progress");
  assert.equal(result.ready, true);
  assert.equal(result.rows.length, 0);
});

test("dependencyDefinitionEngine: a Deliverable-type AND a Capability-type row on the same target both gate it, and reach-or-passed holds once satisfied", async () => {
  await ensureWebAppTemplateFixture();
  const { data: template } = await templatesDB.findByCode("test-enterprise-web-application");
  assert.ok(template);

  const { data: objective } = await objectivesDB.create({ statement: `dep-def-engine-test-${randomUUID()}`, tier: "Strategic", requestedBy: 1001 });
  const { data: profile } = await profilesDB.findByCode("test-profile-default-development");
  const { data: seu } = await seusDB.create({ objectiveId: objective!.id, templateId: template!.id, profileId: profile!.id });
  assert.ok(seu);

  const { data: requirementsCapability } = await capabilitiesDB.findByCodes(["requirements-analysis"]);
  assert.ok(requirementsCapability?.[0]);
  const { data: seuCapabilities } = await seuCapabilitiesDB.createMany(seu!.id, [requirementsCapability![0].id]);
  const seuCapability = seuCapabilities?.[0];
  assert.ok(seuCapability);

  // "Architecture Document" is gated by 4 rows (derived from the real
  // catalogue and materialiseDependencyGraph's "one row per Service a
  // Capability provides" rule): Requirements Specification reaching Approved
  // (Deliverable-type, 1 row), and the requirements-analysis Capability being
  // Fulfilled (Capability-type — 1 row per Service it provides:
  // vision/requirements-specification/glossary, openup-requirements.pack.json
  // — 3 rows) — all 4 must hold.
  const { data: upstream } = await deliverablesDB.create({ seuId: seu!.id, name: "Requirements Specification", category: "Documentation" });
  assert.ok(upstream);

  const before = await dependencyDefinitionEngine.isTargetReady(seu!.id, "Deliverable", "Architecture Document", "In Progress");
  assert.equal(before.ready, false);
  assert.equal(before.rows.length, 4);

  await deliverablesDB.updateLifecycleState(upstream!.id, "Approved");
  const deliverableOnly = await dependencyDefinitionEngine.isTargetReady(seu!.id, "Deliverable", "Architecture Document", "In Progress");
  assert.equal(deliverableOnly.ready, false, "the Capability-type row is still unsatisfied — both rows must hold, not just one");

  await seuCapabilitiesDB.markFulfilled(seuCapability!.id);
  const bothSatisfied = await dependencyDefinitionEngine.isTargetReady(seu!.id, "Deliverable", "Architecture Document", "In Progress");
  assert.equal(bothSatisfied.ready, true);

  // Regression parity with dependencyEngine's own fix (engine.test.ts): the
  // upstream Deliverable moving PAST the required state (Approved ->
  // Baselined) must not un-satisfy an already-satisfied row.
  await deliverablesDB.updateLifecycleState(upstream!.id, "Baselined");
  const afterPassed = await dependencyDefinitionEngine.isTargetReady(seu!.id, "Deliverable", "Architecture Document", "In Progress");
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

  const { data: requirementsCapability } = await capabilitiesDB.findByCodes(["requirements-analysis"]);
  const { data: seuCapabilities } = await seuCapabilitiesDB.createMany(seu!.id, [requirementsCapability![0].id]);
  await seuCapabilitiesDB.markFulfilled(seuCapabilities![0].id);

  const { data: upstream } = await deliverablesDB.create({ seuId: seu!.id, name: "Requirements Specification", category: "Documentation" });
  const { data: downstream } = await deliverablesDB.create({ seuId: seu!.id, name: "Architecture Document", category: "Documentation" });
  assert.ok(upstream && downstream);

  const { eventsDB } = await import("../src/dblayer/eventsDB.js");

  // The Capability side is already Fulfilled (set up above), but Requirements
  // Specification hasn't reached Approved yet — pushing from the Capability
  // side alone must not publish, since isTargetReady still needs both rows.
  await dependencyDefinitionEngine.evaluateAndPublishFromTransition({
    seuId: seu!.id,
    entityType: "Capability",
    name: "approved-requirements-specification",
    newState: "Fulfilled",
  });
  const { data: tooEarly } = await eventsDB.findByOriginatingObject("Deliverable", downstream!.id);
  assert.equal((tooEarly ?? []).filter((e) => e.event_type === "DeliverableReady").length, 0, "must not publish while the Deliverable-type row is still unsatisfied");

  await deliverablesDB.updateLifecycleState(upstream!.id, "Approved");
  await dependencyDefinitionEngine.evaluateAndPublishFromTransition({
    seuId: seu!.id,
    entityType: "Deliverable",
    name: "Requirements Specification",
    newState: "Approved",
  });

  const { data: nowSatisfied } = await eventsDB.findByOriginatingObject("Deliverable", downstream!.id);
  const published = (nowSatisfied ?? []).filter((e) => e.event_type === "DeliverableReady");
  assert.equal(published.length, 1);
  assert.equal((published[0].payload as { toName?: string }).toName, "Architecture Document");
});
