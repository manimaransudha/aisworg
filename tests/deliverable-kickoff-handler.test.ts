// Deliverable Kickoff handler (src/domain/engine/deliverableKickoff.ts): the events it refuses, and the hold it puts on a Deliverable whose producing
// Capability has nobody to fulfil it.
//
//   - The SEU is a plain row in the Operational state, with the Capability of a Service, a Deliverable that is In Progress and produced by that Capability, and
//     a Deliverable that is Approved and produced by it (the handler leaves that one alone). Event subscriptions are not loaded in this file.
//   - Rows are not deleted, as in the other tests that create SEUs.
import "dotenv/config";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { commandsDB } from "../src/dblayer/commandsDB.js";
import { obligationsDB } from "../src/dblayer/obligationsDB.js";
import { attentionItemsDB } from "../src/dblayer/attentionItemsDB.js";
import { seuCapabilitiesDB } from "../src/dblayer/seuCapabilitiesDB.js";
import { deliverableKickoffHandler } from "../src/domain/engine/deliverableKickoff.js";
import type { DeliverableRow } from "../src/dblayer/seuTypes.js";
import { createTestSeu, publishTestEvent, type TestSeu } from "./engineFixtures.js";
import { ROOT_ACTOR_ID, ROOT_ACTOR_BADGE } from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
let t: TestSeu;
let capabilityId: string;
let capabilityCode: string;
let unrelatedCapabilityId: string;
let producing: DeliverableRow;
let approved: DeliverableRow;

before(async () => {
  t = await createTestSeu("deliverable-kickoff", "Operational");
  const { rows } = await pool.query<{ id: string }>("SELECT id FROM capability_definitions ORDER BY created_at LIMIT 2");
  assert.ok(rows.length === 2, "the database holds two Capability Definitions");
  [capabilityId, unrelatedCapabilityId] = [rows[0].id, rows[1].id];
  await seuCapabilitiesDB.createMany(t.seu.id, [capabilityId], t.systemParticipantId, ROOT_ACTOR_BADGE);
  const { data: capabilities } = await seuCapabilitiesDB.findBySeuId(t.seu.id);
  capabilityCode = (capabilities ?? []).find((c) => c.capability_id === capabilityId)!.capability_code;

  const create = async (label: string, state: string) => {
    const { data, error } = await deliverablesDB.create({
      seuId: t.seu.id, name: `kickoff ${label} ${run}`, state, producingCapabilityId: capabilityId, authorId: t.systemParticipantId, authorBadge: ROOT_ACTOR_BADGE,
    });
    assert.ok(data && !error, error?.message);
    return data;
  };
  producing = await create("producing", "In Progress");
  approved = await create("approved", "Approved");
});

const event = (eventType: string, payload: Record<string, unknown>, originatingObjectId = t.seu.id) =>
  publishTestEvent({ eventType, originatingObjectType: eventType === "DeliverableTransitioned" ? "Deliverable" : "SEU", originatingObjectId, seuId: t.seu.id, payload });

const obligationsOf = async (deliverableId: string) => (await obligationsDB.findByRelatedObject("Deliverable", deliverableId)).data ?? [];

test("the handler ignores an event with no SEU and an event for an SEU that does not exist", async () => {
  await deliverableKickoffHandler({ ...(await event("CapabilityFulfilled", {})), seu_id: null });
  await deliverableKickoffHandler({ ...(await event("CapabilityUnavailable", { capabilityId })), seu_id: randomUUID() });
  assert.equal((await obligationsOf(producing.id)).length, 0);
});

test("a Capability that is unavailable is refused when the event names none, and when the SEU does not require the Capability", async () => {
  await assert.rejects(async () => deliverableKickoffHandler(await event("CapabilityUnavailable", {})), /carries no capabilityId/);
  await assert.rejects(async () => deliverableKickoffHandler(await event("CapabilityUnavailable", { capabilityId: unrelatedCapabilityId })), /does not require Capability/);
});

test("an unavailable producing Capability holds the Deliverable that is In Progress with one blocking Obligation and an Attention Item, however many times it is reported", async () => {
  const unavailable = await event("CapabilityUnavailable", { capabilityId });
  await deliverableKickoffHandler(unavailable);
  await deliverableKickoffHandler(await event("CapabilityUnavailable", { capabilityId }));

  const title = `Capability "${capabilityCode}" is unavailable for Deliverable "${producing.name}"`;
  const held = (await obligationsOf(producing.id)).filter((o) => o.title === title);
  assert.equal(held.length, 1, "the second report does not raise a second Obligation");
  assert.deepEqual([held[0].blocked_from_state, held[0].blocked_to_state], ["In Progress", "In Progress"]);
  const { data: items } = await attentionItemsDB.findOpenByRelatedObjectAny("Deliverable", producing.id);
  assert.ok((items ?? []).some((i) => i.title === title && i.category === "Action Required"));
  assert.deepEqual(await obligationsOf(approved.id), [], "a Deliverable that is not In Progress is not held");
});

test("a Deliverable transition into In Progress is refused without its Command, and ignored when the Command exists but the Deliverable does not", async () => {
  await assert.rejects(async () => deliverableKickoffHandler(await event("DeliverableTransitioned", { toState: "In Progress" }, producing.id)), /carries no commandId/);
  await assert.rejects(async () => deliverableKickoffHandler(await event("DeliverableTransitioned", { toState: "In Progress", commandId: randomUUID() }, producing.id)), /not found for DeliverableTransitioned/);

  const { data: command, error } = await commandsDB.create({
    seuId: t.seu.id, entityType: "Deliverable", entityId: producing.id, commandType: `zz-kickoff-${run}`, fromState: "Defined", toState: "In Progress",
    requestedBy: ROOT_ACTOR_ID, actingBadgeType: ROOT_ACTOR_BADGE, correlationId: randomUUID(),
  });
  assert.ok(command && !error, error?.message);
  await deliverableKickoffHandler(await event("DeliverableTransitioned", { toState: "In Progress", commandId: command.id }, randomUUID()));
  const { data: commands } = await commandsDB.findBySeuId(t.seu.id);
  assert.equal((commands ?? []).filter((c) => c.from_state === "In Progress" && c.to_state === "In Progress").length, 0, "no producing Command is issued");
});
