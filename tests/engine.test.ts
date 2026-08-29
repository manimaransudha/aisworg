// Engine-layer unit tests — run against the real dev database (no separate
// test database is configured yet; that's a reasonable MVP gap, not something
// this pass tries to fix). Every fixture this file creates uses randomUUID-ish
// unique names so it never collides with or mutates other tests' rows or the
// seed data itself.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool, { query } from "../src/utils/db.js";
import { compositionEngine } from "../src/domain/engine/compositionEngine.js";
import { transitionEngine } from "../src/domain/engine/transitionEngine.js";
import { triggerEngine } from "../src/domain/engine/triggerEngine.js";
import { eventBus, dispatch } from "../src/domain/engine/eventBus.js";
import { HANDLER_REGISTRY } from "../src/domain/engine/eventHandlerRegistry.js";

import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { objectivesDB } from "../src/dblayer/objectivesDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { publishPack } from "../src/routes/seu/core/packs.js";
import { registerTestOntologyCode, deleteTestOntologyCodes } from "./testFixtures.js";

// CR-046 (owner: "the test script should use a code present in the
// ontology") — Pack.code is Ontology-validated (capability-name) at publish
// time now; the two real concepts this file registers are tracked and
// cleaned up here, same discipline as pack-sdk.test.ts's own.
const createdOntologyCodes: Array<{ conceptType: string; code: string }> = [];

after(async () => {
  await deleteTestOntologyCodes(createdOntologyCodes);
  await pool.end();
});

// Post-MVP Phase 9's own "Done when" line asked for a second,
// independently-versioned Pack composed alongside the first — this exercises
// that multi-Pack merge path with real, non-conflicting data (see
// tests/pack-sdk.test.ts for the override-conflict path, forced with two
// Packs that genuinely collide, and for the "non-Active Packs are excluded"
// path). Deliberately built on fresh, isolated Pack/Template/Profile
// fixtures rather than the seeded development/technology-nodejs
// — those are now real, governed Packs a person can walk through their own
// lifecycle by hand via the Pack Registry page (exactly how the
// Archived-Packs-compose-silently bug below was found), so this test can no
// longer assume their ambient status.
test("compositionEngine.compose resolves a Template's mandatory Pack plus a Profile's optional Pack, deterministically", async () => {
  const mandatoryCode = await registerTestOntologyCode("capability-name", "test-compose-mandatory");
  createdOntologyCodes.push({ conceptType: "capability-name", code: mandatoryCode });
  const optionalCode = await registerTestOntologyCode("capability-name", "test-compose-optional");
  createdOntologyCodes.push({ conceptType: "capability-name", code: optionalCode });

  const mandatory = await publishPack({
    seed: { code: mandatoryCode, name: "Test Mandatory Pack", category: "Engineering", packVersion: "1.0.0", installationClassification: "Mandatory", contributions: {} },
    actorRole: "power", actorId: "1001",
    activate: true,
  });
  const optional = await publishPack({
    seed: { code: optionalCode, name: "Test Optional Pack", category: "Engineering", packVersion: "1.0.0", installationClassification: "Optional", contributions: {} },
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
    fromState: "Commissioned",
    toState: "Archived",
    actorRole: "super", actorId: "1001",
  });
  assert.equal(outcome.allowed, false);
  if (!outcome.allowed) assert.equal(outcome.reason, "no_transition_definition");
});

test("transitionEngine.evaluate handles the Objective entity type (Post-MVP Phase 1 — Ch.1 lifecycle)", async () => {
  // CR-072 — Proposed -> Active is a manual transition with a real Submit
  // step (submit_verb "propose"): transitionEngine now denies it outright
  // (not_submitted) until that queue event exists for this exact entityId,
  // real enforcement, not just a UI filter. A synthetic id is enough — the
  // events table has no FK to a real objectives row.
  const submittedObjectiveId = randomUUID();
  await triggerEngine.submit({ entityType: "Objective", entityId: submittedObjectiveId, fromState: "Proposed", actorId: "1001" });

  const allowed = await transitionEngine.evaluate({
    entityType: "Objective",
    fromState: "Proposed",
    toState: "Active",
    actorRole: "general",
    actorId: "1001",
    context: {},
    entityId: submittedObjectiveId,
  });
  assert.equal(allowed.allowed, true, JSON.stringify(allowed));

  const notSubmitted = await transitionEngine.evaluate({
    entityType: "Objective",
    fromState: "Proposed",
    toState: "Active",
    actorRole: "general",
    actorId: "1001",
    context: {},
    entityId: randomUUID(), // a different, never-submitted id
  });
  assert.equal(notSubmitted.allowed, false);
  if (!notSubmitted.allowed) assert.equal(notSubmitted.reason, "not_submitted");

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

test("eventBus.publish persists the event with the correct seu_id and an empty consumption_state when nobody subscribes", async () => {
  const correlationId = eventBus.newCorrelationId();
  const objectId = randomUUID();
  const event = await eventBus.publish({
    eventType: "EngineTestFired",
    originatingObjectType: "engine-test",
    originatingObjectId: objectId,
    seuId: null,
    correlationId,
    payload: { ok: true },
  });

  assert.equal(event.seu_id, null);
  assert.deepEqual(event.consumption_state, {});

  const { data: persisted } = await eventsDB.findByOriginatingObject("engine-test", objectId);
  assert.equal(persisted?.length, 1);
  assert.equal(persisted?.[0]?.correlation_id, correlationId);
});

// Ch.30 Event Bus redesign — dispatch() is exported standalone specifically
// so it's testable without going through publish()'s fire-and-forget timing.
// Real handler invocation + per-handler consumption_state tracking, tested
// directly.
test("dispatch invokes each handler and records its own consumption_state entry, independently of other handlers", async () => {
  const event = await eventBus.publish({
    eventType: "EngineTestDispatch",
    originatingObjectType: "engine-test",
    originatingObjectId: randomUUID(),
    seuId: null,
    correlationId: eventBus.newCorrelationId(),
    payload: {},
  });

  const received: string[] = [];
  await dispatch(event, [
    { name: "engineTestOk", handler: async (e) => { received.push(e.event_type); } },
    { name: "engineTestThrows", handler: async () => { throw new Error("engine-test deliberate failure"); } },
  ]);

  assert.deepEqual(received, ["EngineTestDispatch"]);

  const { data: refetched } = await eventsDB.findByOriginatingObject("engine-test", event.originating_object_id);
  const state = refetched?.[0]?.consumption_state ?? {};
  assert.equal(state.engineTestOk?.status, "consumed");
  assert.ok(typeof state.engineTestOk?.consumedAt === "string");
  // The failing handler does not affect the succeeding one's own entry (Ch.30 §9).
  assert.equal(state.engineTestThrows?.status, "failed");
  assert.equal(state.engineTestThrows?.consumedAt, null);
  assert.match(state.engineTestThrows?.error ?? "", /engine-test deliberate failure/);
});

// Proves publish() genuinely never blocks on a handler's own work — the
// actual behavior CR-052/this redesign was built to fix (assignmentDelivery.ts's
// own external delivery call previously ran inline inside publish()).
test("eventBus.publish returns well before a slow registered handler resolves", async () => {
  const eventType = `EngineTestSlow-${randomUUID()}`;
  const handlerName = "engineTestSlowHandler";
  let handlerStarted = false;
  let handlerFinished = false;
  HANDLER_REGISTRY[handlerName] = async () => {
    handlerStarted = true;
    await new Promise((resolve) => setTimeout(resolve, 300));
    handlerFinished = true;
  };

  await query("INSERT INTO event_registry (event_type) VALUES ($1)", [eventType]);
  await query("INSERT INTO event_subscriptions (event_type, handler_name) VALUES ($1, $2)", [eventType, handlerName]);
  try {
    await eventBus.loadSubscriptions();

    const start = Date.now();
    const event = await eventBus.publish({
      eventType,
      originatingObjectType: "engine-test",
      originatingObjectId: randomUUID(),
      seuId: null,
      correlationId: eventBus.newCorrelationId(),
      payload: {},
    });
    const publishDuration = Date.now() - start;

    assert.ok(publishDuration < 250, `publish() should return well before the handler's 300ms delay — took ${publishDuration}ms`);
    assert.equal(event.consumption_state[handlerName]?.status, "pending");
    assert.equal(handlerFinished, false, "the handler must not have finished yet when publish() already returned");

    // Let the fire-and-forget dispatch actually run and settle.
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.equal(handlerStarted, true);
    assert.equal(handlerFinished, true);
    const { data: refetched } = await eventsDB.findByOriginatingObject("engine-test", event.originating_object_id);
    assert.equal(refetched?.[0]?.consumption_state[handlerName]?.status, "consumed");
  } finally {
    delete HANDLER_REGISTRY[handlerName];
    await query("DELETE FROM event_subscriptions WHERE event_type = $1", [eventType]);
    await query("DELETE FROM events WHERE event_type = $1", [eventType]);
    await query("DELETE FROM event_registry WHERE event_type = $1", [eventType]);
    await eventBus.loadSubscriptions(); // restore the real map
  }
});
