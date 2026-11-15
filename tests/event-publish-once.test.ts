// Event Bus publishOnce (src/domain/engine/eventBus.ts): an event is published unless one with the same type, originating object and payload
// was already raised. A causing event narrows the match when one is given.
//
//   - Every test publishes for an originating object of its own (a new id), so no other event can match.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { eventsDB } from "../src/dblayer/eventsDB.js";
import { eventBus } from "../src/domain/engine/eventBus.js";
import { ROOT_ACTOR_ID, ROOT_ACTOR_BADGE } from "./testFixtures.js";

const publishOnce = (objectId: string, overrides: Partial<Parameters<typeof eventBus.publishOnce>[0]> = {}) =>
  eventBus.publishOnce({
    eventType: "ConceptApproved", originatingObjectType: "Ontology", originatingObjectId: objectId, seuId: null, correlationId: randomUUID(),
    actorId: ROOT_ACTOR_ID, authorityBadge: ROOT_ACTOR_BADGE, ...overrides,
  });

const eventsOf = async (objectId: string) => (await eventsDB.findByOriginatingObject("Ontology", objectId)).data ?? [];

test("the same type, object and payload is published once, and the second call returns the first event", async () => {
  const objectId = randomUUID();
  const first = await publishOnce(objectId, { payload: { fromState: "A", toState: "B", version: 2 } });
  const second = await publishOnce(objectId, { payload: { version: 2, toState: "B", fromState: "A" } });
  assert.equal(second.id, first.id, "the second call returns the event already raised");
  assert.equal((await eventsOf(objectId)).length, 1);
});

test("a different payload, a different type or a different object is a different event", async () => {
  const objectId = randomUUID();
  await publishOnce(objectId, { payload: { toState: "B", version: 1 } });
  await publishOnce(objectId, { payload: { toState: "B", version: 2 } });
  await publishOnce(objectId, { payload: { toState: "B", version: 2 }, eventType: "ConceptRetired" });
  assert.equal((await eventsOf(objectId)).length, 3, "a second hop into the same state carries another version");
  await publishOnce(randomUUID(), { payload: { toState: "B", version: 1 } });
  assert.equal((await eventsOf(objectId)).length, 3, "another object's event is not matched");
});

test("a causing event narrows the match: the same payload from another cause is published, and a call that names none matches the first", async () => {
  const objectId = randomUUID();
  const causeA = (await publishOnce(randomUUID(), { payload: { cause: "a" } })).id;
  const causeB = (await publishOnce(randomUUID(), { payload: { cause: "b" } })).id;

  const fromA = await publishOnce(objectId, { payload: { capabilityId: "c" }, causationId: causeA });
  const fromAAgain = await publishOnce(objectId, { payload: { capabilityId: "c" }, causationId: causeA });
  const fromB = await publishOnce(objectId, { payload: { capabilityId: "c" }, causationId: causeB });
  assert.equal(fromAAgain.id, fromA.id, "the same cause is not published twice");
  assert.notEqual(fromB.id, fromA.id, "another cause is published");
  assert.equal((await eventsOf(objectId)).length, 2);

  const noCause = await publishOnce(objectId, { payload: { capabilityId: "c" } });
  assert.equal((await eventsOf(objectId)).length, 2, "with no cause given, an event of the same type, object and payload matches");
  assert.ok([fromA.id, fromB.id].includes(noCause.id));
});

test("two calls at the same moment publish one event", async () => {
  const objectId = randomUUID();
  const results = await Promise.all([1, 2, 3, 4].map(() => publishOnce(objectId, { payload: { toState: "B", version: 1 } })));
  assert.equal((await eventsOf(objectId)).length, 1, "one event is stored");
  assert.equal(new Set(results.map((e) => e.id)).size, 1, "every caller gets that event");
});

test("publishTransition with once publishes the hop's event once", async () => {
  const { publishTransition } = await import("../src/domain/engine/entityTransition.js");
  const objectId = randomUUID();
  const result = {
    ok: true as const, row: {}, appliedTransition: { fromState: "A", toState: "B" },
    event: {
      eventType: "ConceptApproved", versionEvent: undefined, originatingObjectType: "Ontology", originatingObjectId: objectId, seuId: null,
      payload: { fromState: "A", toState: "B" }, actorId: ROOT_ACTOR_ID, authorityBadge: ROOT_ACTOR_BADGE, fromState: "A", toState: "B", tenantId: null,
    },
  };
  const first = await publishTransition(result as unknown as Parameters<typeof publishTransition>[0], { once: true });
  const second = await publishTransition(result as unknown as Parameters<typeof publishTransition>[0], { once: true });
  assert.equal(second.id, first.id);
  assert.equal((await eventsOf(objectId)).length, 1);
});
