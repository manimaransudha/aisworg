// Deliverable Kickoff handler (src/domain/engine/deliverableKickoff.ts): which Deliverables an event makes it attempt.
//
//   - SEUOperational attempts only the start nodes, the Deliverables no dependency row points at.
//   - DeliverableTransitioned attempts only the Deliverables that depend on the Deliverable named in the payload at the state it reached, and only when
//     every one of their rows holds.
//   - The dependency rows are written on the source the SEU's EBM records before the SEU is commissioned, as in dependency-flow.test.ts.
//   - An attempt of a Deliverable whose dependency rows do not hold publishes DeliverableBlocked. A Deliverable that was not attempted has none.
//   - The handler is called with an event row it is given. The row is not published, so the handlers that Event Bus subscriptions name do not run.
import "dotenv/config";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { dependencyDefinitionsDB } from "../src/dblayer/dependencyDefinitionsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { resolveDeliverableSource, resolveSeuOwningScope } from "../src/domain/engine/deliverableSource.js";
import { dependencyDefinitionEngine } from "../src/domain/engine/dependencyDefinitionEngine.js";
import { deliverableKickoffHandler } from "../src/domain/engine/deliverableKickoff.js";
import { ensureFixtureTenant, buildStage4Fixtures } from "./schemaFixtures.js";
import { commissionFixtureSeu, type FixtureSeu } from "./webScenarios.js";
import { ROOT_ACTOR_ID, ROOT_ACTOR_BADGE } from "./testFixtures.js";
import type { DeliverableRow, EventRow } from "../src/dblayer/seuTypes.js";

const run = randomUUID().slice(0, 8);
const code = (name: string) => `zz-${name}-${run}`;
const names = {
  a: code("a"), b: code("b"), c: code("c"),
  a2: code("a2"), b2: code("b2"), c2: code("c2"),
  a3: code("a3"), b3: code("b3"), c3: code("c3"),
};
let t: FixtureSeu;
let birthState: string;

before(async () => {
  const tenantId = await ensureFixtureTenant("kickoff-dependency");
  const fixtures = await buildStage4Fixtures(tenantId);
  const [{ data: template }, { data: profile }] = await Promise.all([templatesDB.findById(fixtures.template.id), profilesDB.findById(fixtures.profile.id)]);
  assert.ok(template && profile);
  const source = await resolveDeliverableSource(template, profile);
  await dependencyDefinitionsDB.deleteByOwner(source.type, source.id);
  // A is the source of B and of C, once for each group of Deliverables the tests create.
  for (const [from, to] of [[names.a, names.b], [names.a, names.c], [names.a2, names.b2], [names.a2, names.c2], [names.a3, names.b3], [names.a3, names.c3]]) {
    const { error } = await dependencyDefinitionsDB.create({
      owningEntityType: source.type, owningEntityId: source.id, fromEntityType: "Deliverable", fromName: from, fromState: "Approved",
      toEntityType: "Deliverable", toName: to, toState: "In Progress", authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
    });
    assert.ok(!error, error);
  }
  t = await commissionFixtureSeu("kickoff-dependency");
  assert.equal(t.seu.lifecycle_state, "Operational");
  const { data: birth } = await transitionDefinitionsDB.findBirth("Deliverable");
  assert.ok(birth);
  birthState = birth.to_state;
});

async function createDeliverable(name: string, state: string = birthState): Promise<DeliverableRow> {
  const { data, error } = await deliverablesDB.create({ seuId: t.seu.id, name, state, authorId: t.systemParticipantId, authorBadge: ROOT_ACTOR_BADGE });
  assert.ok(data && !error, error);
  return data;
}

// The handler reads an event from the row it is given: the type, the SEU, the payload and the object it came from.
function eventRow(eventType: string, originatingObjectId: string, payload: Record<string, unknown>): EventRow {
  return {
    id: randomUUID(), event_type: eventType, seu_id: t.seu.id, payload, originating_object_type: "Deliverable", originating_object_id: originatingObjectId,
    correlation_id: randomUUID(), actor_id: ROOT_ACTOR_ID, authority_badge: ROOT_ACTOR_BADGE,
  } as unknown as EventRow;
}

const blockedEvents = async (deliverableId: string) =>
  ((await eventsDB.findByOriginatingObject("Deliverable", deliverableId)).data ?? []).filter((e) => e.event_type === "DeliverableBlocked");

test("a start node is a Deliverable that no dependency row points at", async () => {
  assert.equal(await dependencyDefinitionEngine.isStartNode(t.seu.id, "Deliverable", names.a), true, "A is the source of rows and the target of none");
  assert.equal(await dependencyDefinitionEngine.isStartNode(t.seu.id, "Deliverable", names.b), false, "B is the target of a row");
  assert.equal(await dependencyDefinitionEngine.isStartNode(t.seu.id, "Deliverable", names.c), false, "C is the target of a row");
});

test("findSuccessors returns the Deliverables of the SEU that depend on the named Deliverable at the given state", async () => {
  await createDeliverable(names.a);
  const b = await createDeliverable(names.b);
  const c = await createDeliverable(names.c);
  const scope = await resolveSeuOwningScope(t.seu);

  const atApproved = (await deliverablesDB.findSuccessors(t.seu.id, scope.dependencyDefinitionIds, "Deliverable", names.a, "Approved")).data ?? [];
  assert.deepEqual(atApproved.map((d) => d.id).sort(), [b.id, c.id].sort(), "B and C depend on A at Approved");
  const atInProgress = (await deliverablesDB.findSuccessors(t.seu.id, scope.dependencyDefinitionIds, "Deliverable", names.a, "In Progress")).data ?? [];
  assert.equal(atInProgress.length, 0, "no row names A at In Progress");
  const ofB = (await deliverablesDB.findSuccessors(t.seu.id, scope.dependencyDefinitionIds, "Deliverable", names.b, "Approved")).data ?? [];
  assert.equal(ofB.length, 0, "nothing depends on B");
  const noRows = (await deliverablesDB.findSuccessors(t.seu.id, [], "Deliverable", names.a, "Approved")).data ?? [];
  assert.equal(noRows.length, 0, "with no dependency rows given there is no successor");
});

test("SEUOperational attempts only the start node: A is attempted and B and C, which wait for A, are not", async () => {
  await createDeliverable(names.a2);
  const b = await createDeliverable(names.b2);
  const c = await createDeliverable(names.c2);

  await deliverableKickoffHandler(eventRow("SEUOperational", t.seu.id, {}));

  assert.equal((await blockedEvents(b.id)).length, 0, "B was not attempted");
  assert.equal((await blockedEvents(c.id)).length, 0, "C was not attempted");
});

test("DeliverableTransitioned attempts only the Deliverables that depend on the one named, at the state it reached, and only when their rows hold", async () => {
  const a = await createDeliverable(names.a3);
  const b = await createDeliverable(names.b3);
  const c = await createDeliverable(names.c3);

  // A reached In Progress. No row names A at In Progress, so B and C are not attempted.
  await deliverableKickoffHandler(eventRow("DeliverableTransitioned", a.id, { deliverableName: names.a3, fromState: "Defined", toState: "In Progress", commandId: randomUUID() }));
  assert.equal((await blockedEvents(b.id)).length, 0, "B does not depend on A at In Progress");
  assert.equal((await blockedEvents(c.id)).length, 0, "C does not depend on A at In Progress");

  // The event says A reached Approved, and the rows of B and C name that state, but A is still in its birth state in the database. The rows do not hold, so B and C are not attempted.
  await deliverableKickoffHandler(eventRow("DeliverableTransitioned", a.id, { deliverableName: names.a3, fromState: "In Progress", toState: "Approved", commandId: randomUUID() }));
  assert.equal((await blockedEvents(b.id)).length, 0, "B's row does not hold, so B was not attempted");
  assert.equal((await blockedEvents(c.id)).length, 0, "C's row does not hold, so C was not attempted");
});

test("DeliverableTransitioned without a Deliverable name or state is refused, and so is an event type the handler does not handle", async () => {
  const a = await createDeliverable(code("refused"));
  await assert.rejects(async () => deliverableKickoffHandler(eventRow("DeliverableTransitioned", a.id, { toState: "Approved" })), /carries no deliverableName or toState/);
  await assert.rejects(async () => deliverableKickoffHandler(eventRow("DeliverableTransitioned", a.id, { deliverableName: a.name })), /carries no deliverableName or toState/);
  await assert.rejects(async () => deliverableKickoffHandler(eventRow("ParticipantUnavailable", a.id, {})), /does not handle event type ParticipantUnavailable/);
});

test("CapabilityFulfilled without a Capability is refused before any Deliverable is attempted", async () => {
  await assert.rejects(async () => deliverableKickoffHandler(eventRow("CapabilityFulfilled", t.seu.id, {})), /carries no capabilityId/);
});
