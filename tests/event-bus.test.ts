// Event Bus (src/domain/engine/eventBus.ts): the subscription loader refuses a subscription whose handler is not registered, and a version
// event that cannot be recorded does not fail the publish.
//
//   - The unregistered subscription is a row the test writes for a handler name with the run tag. It is deleted, and the subscriptions are loaded
//     again, before the file ends.
//   - The version event is published for a tenant that does not exist, so its row cannot be written. The publish still returns the event.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { eventBus } from "../src/domain/engine/eventBus.js";
import { ROOT_ACTOR_ID, ROOT_ACTOR_BADGE, PLATFORM_TENANT_ID } from "./testFixtures.js";

const handlerName = `zz-no-handler-${randomUUID().slice(0, 8)}`;

after(async () => {
  await pool.query("DELETE FROM event_subscriptions WHERE handler_name = $1", [handlerName]);
  await eventBus.loadSubscriptions();
});

const publish = (overrides: Partial<Parameters<typeof eventBus.publish>[0]> = {}) =>
  eventBus.publish({
    eventType: "ConceptApproved", originatingObjectType: "Ontology", originatingObjectId: randomUUID(), seuId: null, correlationId: randomUUID(),
    actorId: ROOT_ACTOR_ID, authorityBadge: ROOT_ACTOR_BADGE, ...overrides,
  });

test("loading subscriptions skips a subscription whose handler is not registered, and keeps the others", async () => {
  // ConceptCreated is consumed by a handler that ignores an event with no concept in its payload, so the published event has no side effect.
  const eventType = "ConceptCreated";
  const { error } = await eventsDB.bulkUpsertSubscriptions([{ eventType, handlerName, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE }]);
  assert.ok(!error, error);

  await eventBus.loadSubscriptions();
  const event = await publish({ eventType });
  assert.ok(!(handlerName in event.consumption_state), "the unregistered handler is not a subscriber");
  assert.ok("conceptCreated" in event.consumption_state, "the registered handler of the event type is");
});

test("a version event that cannot be recorded does not fail the publish, and a version event with no tenant is refused", async () => {
  // The event is written for a real tenant, and its version event names an actor that is not a participants_master row, so only the version event is refused.
  const event = await publish({ versionEvent: "zz-version-event", tenantId: PLATFORM_TENANT_ID, actorId: randomUUID(), fromState: "A", toState: "B" });
  assert.ok(event.id, "the event is published");
  await assert.rejects(() => publish({ versionEvent: "zz-version-event" }), /no tenantId/);
});
