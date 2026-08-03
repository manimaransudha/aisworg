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

import { packsDB } from "../src/dblayer/packsDB.js";
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

after(async () => {
  await pool.end();
});

test("compositionEngine.compose resolves the seeded Template's mandatory Packs deterministically", async () => {
  const { data: pack } = await packsDB.findByCode("platform-core-engineering");
  const { data: template } = await templatesDB.findByCode("template-web-application");
  const { data: profile } = await profilesDB.findByCode("profile-default-development");
  assert.ok(pack && template && profile);

  const first = await compositionEngine.compose({ templateId: template.id, profileId: profile.id });
  const second = await compositionEngine.compose({ templateId: template.id, profileId: profile.id });

  assert.equal(first.composedPacks.length, 1);
  assert.equal(first.composedPacks[0]?.packCode, "platform-core-engineering");
  assert.deepEqual(first.compositionReport.warnings, []);
  assert.deepEqual(first, second, "composition must be deterministic for identical inputs");
});

test("transitionEngine.evaluate allows an authorised, policy-satisfied SEU transition", async () => {
  const outcome = await transitionEngine.evaluate({
    entityType: "SEU",
    fromState: "Pending",
    toState: "Commissioned",
    actorRole: "general",
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
    actorRole: "super",
  });
  assert.equal(outcome.allowed, false);
  if (!outcome.allowed) assert.equal(outcome.reason, "no_transition_definition");
});

test("dependencyEngine: Deliverable-type edge becomes Satisfied only once the target reaches the required state", async () => {
  const { data: objective } = await objectivesDB.create({ statement: `engine-test-${randomUUID()}` });
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
});

test("dependencyEngine: Capability-type edge becomes Satisfied once the SEU's Capability requirement is Fulfilled", async () => {
  const { data: objective } = await objectivesDB.create({ statement: `engine-test-${randomUUID()}` });
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
