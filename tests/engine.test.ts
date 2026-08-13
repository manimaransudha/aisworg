// Engine-layer unit tests — run against the real dev database (no separate
// test database is configured yet; that's a reasonable MVP gap, not something
// this pass tries to fix). Every fixture this file creates uses randomUUID-ish
// unique names so it never collides with or mutates other tests' rows or the
// seed data itself.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { compositionEngine } from "../src/domain/engine/compositionEngine.js";
import { transitionEngine } from "../src/domain/engine/transitionEngine.js";
import { dependencyEngine } from "../src/domain/engine/dependencyEngine.js";
import { eventBus } from "../src/domain/engine/eventBus.js";

import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { objectivesDB } from "../src/dblayer/objectivesDB.js";
import { seusDB } from "../src/dblayer/seusDB.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { dependencyEdgesDB } from "../src/dblayer/dependencyEdgesDB.js";
import { capabilitiesDB } from "../src/dblayer/capabilitiesDB.js";
import { servicesDB } from "../src/dblayer/servicesDB.js";
import { seuCapabilitiesDB } from "../src/dblayer/seuCapabilitiesDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { publishPack } from "../src/routes/seu/core/packs.js";
import { ensureWebAppTemplateFixture } from "./testFixtures.js";

after(async () => {
  await pool.end();
});

// Post-MVP Phase 9's own "Done when" line asked for a second,
// independently-versioned Pack composed alongside the first — this exercises
// that multi-Pack merge path with real, non-conflicting data (see
// tests/pack-sdk.test.ts for the override-conflict path, forced with two
// Packs that genuinely collide, and for the "non-Active Packs are excluded"
// path). Deliberately built on fresh, isolated Pack/Template/Profile
// fixtures rather than the seeded platform-core-engineering/technology-nodejs
// — those are now real, governed Packs a person can walk through their own
// lifecycle by hand via the Pack Registry page (exactly how the
// Archived-Packs-compose-silently bug below was found), so this test can no
// longer assume their ambient status.
test("compositionEngine.compose resolves a Template's mandatory Pack plus a Profile's optional Pack, deterministically", async () => {
  const mandatory = await publishPack({
    seed: { code: `test-compose-mandatory-${randomUUID()}`, name: "Test Mandatory Pack", category: "Platform", packVersion: "1.0.0", installationClassification: "Mandatory", contributions: {} },
    actorRole: "power", actorId: "1001",
    activate: true,
  });
  const optional = await publishPack({
    seed: { code: `test-compose-optional-${randomUUID()}`, name: "Test Optional Pack", category: "Technology", packVersion: "1.0.0", installationClassification: "Optional", contributions: {} },
    actorRole: "power", actorId: "1001",
    activate: true,
  });
  assert.equal(mandatory.ok, true);
  assert.equal(optional.ok, true);

  const { data: template } = await templatesDB.upsert({ code: `test-compose-template-${randomUUID()}`, name: "Compose Test Template" });
  assert.ok(template);
  await templatesDB.setMandatoryPacks(template!.id, [mandatory.pack!.code]);

  const { data: profile } = await profilesDB.upsert({ code: `test-compose-profile-${randomUUID()}`, name: "Compose Test Profile", baseTemplateId: template!.id, environment: "development", configParameters: {} });
  assert.ok(profile);
  await profilesDB.setOptionalPacks(profile!.id, [optional.pack!.code]);

  const first = await compositionEngine.compose({ templateId: template!.id, profileId: profile!.id });
  const second = await compositionEngine.compose({ templateId: template!.id, profileId: profile!.id });

  assert.equal(first.composedPacks.length, 2);
  const packCodes = first.composedPacks.map((p) => p.packCode).sort();
  assert.deepEqual(packCodes, [mandatory.pack!.code, optional.pack!.code].sort());
  assert.deepEqual(first.compositionReport.warnings, []);
  assert.deepEqual(first, second, "composition must be deterministic for identical inputs");
});

test("transitionEngine.evaluate allows an authorised, policy-satisfied SEU transition", async () => {
  const outcome = await transitionEngine.evaluate({
    entityType: "SEU",
    fromState: "Pending",
    toState: "Commissioned",
    actorRole: "general",
    actorId: "1001",
    context: {},
  });
  assert.equal(outcome.allowed, true);
});

test("transitionEngine.evaluate denies an under-privileged actor", async () => {
  const outcome = await transitionEngine.evaluate({
    entityType: "SEU",
    fromState: "Pending",
    toState: "Commissioned",
    actorRole: "unregistered-role",
    context: {},
  });
  assert.equal(outcome.allowed, false);
  if (!outcome.allowed) assert.equal(outcome.reason, "authority_denied");
});

test("transitionEngine.evaluate rejects a transition with no Transition Definition", async () => {
  const outcome = await transitionEngine.evaluate({
    entityType: "SEU",
    fromState: "Operational",
    toState: "Retired",
    actorRole: "super", actorId: "1001",
  });
  assert.equal(outcome.allowed, false);
  if (!outcome.allowed) assert.equal(outcome.reason, "no_transition_definition");
});

test("transitionEngine.evaluate handles the Objective entity type (Post-MVP Phase 1 — Ch.1 lifecycle)", async () => {
  const allowed = await transitionEngine.evaluate({
    entityType: "Objective",
    fromState: "Proposed",
    toState: "Active",
    actorRole: "general",
    actorId: "1001",
    context: {},
  });
  assert.equal(allowed.allowed, true);

  const denied = await transitionEngine.evaluate({
    entityType: "Objective",
    fromState: "Proposed",
    toState: "Active",
    actorRole: "unregistered-role",
    context: {},
  });
  assert.equal(denied.allowed, false);
  if (!denied.allowed) assert.equal(denied.reason, "authority_denied");

  const undefinedTransition = await transitionEngine.evaluate({
    entityType: "Objective",
    fromState: "Proposed",
    toState: "Retired",
    actorRole: "super", actorId: "1001",
  });
  assert.equal(undefinedTransition.allowed, false);
  if (!undefinedTransition.allowed) assert.equal(undefinedTransition.reason, "no_transition_definition");
});

test("dependencyEngine: Deliverable-type edge becomes Satisfied only once the target reaches the required state", async () => {
  const { data: objective } = await objectivesDB.create({ statement: `engine-test-${randomUUID()}`, tier: "Strategic" });
  await ensureWebAppTemplateFixture();
  const { data: template } = await templatesDB.findByCode("template-web-application");
  const { data: profile } = await profilesDB.findByCode("profile-default-development");
  const { data: seu } = await seusDB.create({ objectiveId: objective!.id, templateId: template!.id, profileId: profile!.id });
  assert.ok(seu);

  const { data: upstream } = await deliverablesDB.create({ seuId: seu.id, name: "Requirements Specification", category: "Documentation" });
  const { data: downstream } = await deliverablesDB.create({ seuId: seu.id, name: "Architecture Document", category: "Documentation" });
  assert.ok(upstream && downstream);

  await dependencyEdgesDB.createDeliverableEdge({
    seuId: seu.id,
    fromDeliverableId: downstream.id,
    toDeliverableId: upstream.id,
    requiredState: "Approved",
  });

  const before = await dependencyEngine.isDeliverableReady(downstream.id);
  assert.equal(before.ready, false);
  assert.equal(before.edges[0]?.readiness_state, "Pending");

  await deliverablesDB.updateLifecycleState(upstream.id, "Approved");

  const after1 = await dependencyEngine.isDeliverableReady(downstream.id);
  assert.equal(after1.ready, true);
  assert.equal(after1.edges[0]?.readiness_state, "Satisfied");

  // Regression test for a real bug found auditing Phase 5's Evidence-gated
  // transition: the upstream Deliverable moving PAST its required state
  // (Approved -> Baselined) must not flip an already-Satisfied edge back to
  // Pending. The original check was exact-equality against required_state,
  // so any further upstream progress permanently un-satisfied every
  // downstream edge pointing at an earlier state, with no way back short of
  // moving the upstream Deliverable backward (which the engine disallows).
  await deliverablesDB.updateLifecycleState(upstream.id, "Baselined");

  const after2 = await dependencyEngine.isDeliverableReady(downstream.id);
  assert.equal(after2.ready, true, "an upstream Deliverable that has moved PAST the required state must still satisfy the dependency, not flip back to Pending");
  assert.equal(after2.edges[0]?.readiness_state, "Satisfied");
});

test("dependencyEngine: Capability-type edge becomes Satisfied once the SEU's Capability requirement is Fulfilled", async () => {
  const { data: objective } = await objectivesDB.create({ statement: `engine-test-${randomUUID()}`, tier: "Strategic" });
  await ensureWebAppTemplateFixture();
  const { data: template } = await templatesDB.findByCode("template-web-application");
  const { data: profile } = await profilesDB.findByCode("profile-default-development");
  const { data: seu } = await seusDB.create({ objectiveId: objective!.id, templateId: template!.id, profileId: profile!.id });
  const { data: capability } = await capabilitiesDB.findByCodes(["requirements-analysis"]);
  const requirementsCapability = capability?.[0];
  assert.ok(seu && requirementsCapability);

  const { data: services } = await servicesDB.findByCapabilityId(requirementsCapability.id);
  const service = services?.[0];
  assert.ok(service);

  const { data: seuCapabilities } = await seuCapabilitiesDB.createMany(seu.id, [requirementsCapability.id]);
  const seuCapability = seuCapabilities?.[0];
  assert.ok(seuCapability);

  const { data: deliverable } = await deliverablesDB.create({ seuId: seu.id, name: "Requirements Specification", category: "Documentation" });
  assert.ok(deliverable);

  await dependencyEdgesDB.createCapabilityEdge({ seuId: seu.id, fromDeliverableId: deliverable.id, toServiceId: service.id });

  const before = await dependencyEngine.isDeliverableReady(deliverable.id);
  assert.equal(before.ready, false);

  await seuCapabilitiesDB.markFulfilled(seuCapability.id);

  const after1 = await dependencyEngine.isDeliverableReady(deliverable.id);
  assert.equal(after1.ready, true);
});

test("eventBus.publish persists the event and notifies subscribers exactly once", async () => {
  const received: string[] = [];
  eventBus.subscribe((event) => {
    if (event.originating_object_type === "engine-test") received.push(event.event_type);
  });

  const correlationId = eventBus.newCorrelationId();
  const objectId = randomUUID();
  await eventBus.publish({
    eventType: "EngineTestFired",
    originatingObjectType: "engine-test",
    originatingObjectId: objectId,
    correlationId,
    payload: { ok: true },
  });

  assert.deepEqual(received, ["EngineTestFired"]);

  const { data: persisted } = await eventsDB.findByOriginatingObject("engine-test", objectId);
  assert.equal(persisted?.length, 1);
  assert.equal(persisted?.[0]?.correlation_id, correlationId);
});
