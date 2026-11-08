// Dispatch Engine and the redispatch chain (src/domain/engine/dispatchEngine.ts, redispatchRequest.ts, redispatch.ts).
//
//   - Dispatch is called directly with a Work Item built in the test: an SEU, a Deliverable, a Command, a Work Item and a pool of Participants.
//     The Participants are created Available. A Participant that must not be selectable is moved to Assigned with the governed hop.
//   - Event subscriptions are not loaded in this file, so a published event runs no handler. The test calls each handler itself with the event
//     it would receive, and reads the events, Obligations, Attention Items and Work Items the handler left behind.
//   - Two SEUs are used. One has an active EBM that settles redispatchMaxAttempts 3, redispatchAttentionThreshold 2 and a cost-optimisation
//     preference; the other has no EBM, so no limit, no threshold and the default strategy apply.
//   - Rows are not deleted, as in the other tests that create SEUs.
import "dotenv/config";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { seusDB } from "../src/dblayer/seusDB.js";
import { ebmsDB } from "../src/dblayer/ebmsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { commandsDB } from "../src/dblayer/commandsDB.js";
import { workItemsDB } from "../src/dblayer/workItemsDB.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { obligationsDB } from "../src/dblayer/obligationsDB.js";
import { attentionItemsDB } from "../src/dblayer/attentionItemsDB.js";
import { participantsDB } from "../src/dblayer/participantsDB.js";
import { participantsMasterDB } from "../src/dblayer/participantsMasterDB.js";
import { capabilityFulfilmentPoolsDB } from "../src/dblayer/capabilityFulfilmentPoolsDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { ensureSeuSystemParticipant, getSystemActor } from "../src/dblayer/constants.js";
import { createObjective } from "../src/routes/seu/core/objectives.js";
import { applyParticipantHop } from "../src/routes/seu/core/participants.js";
import { dispatchEngine } from "../src/domain/engine/dispatchEngine.js";
import { redispatchRequestHandler } from "../src/domain/engine/redispatchRequest.js";
import { redispatchHandler } from "../src/domain/engine/redispatch.js";
import { workItemGeneratedHandler } from "../src/domain/engine/workItemGenerated.js";
import { eventBus } from "../src/domain/engine/eventBus.js";
import type { CommandRow, EventRow, ParticipantRow, SeuRow, WorkItemRow } from "../src/dblayer/seuTypes.js";
import { ensureWebAppTemplateFixture, seuBirthState, PLATFORM_TENANT_ID, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE } from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
let counter = 0;
const label = (what: string) => `dispatch-engine ${run} ${what} ${++counter}`;

interface TestSeu { seu: SeuRow; systemParticipantId: string; systemActorId: string }
let configured: TestSeu; // EBM: max 3 attempts, attention at 2, cost-optimisation
let plain: TestSeu; // no EBM
let capabilityId: string;
let deliverableBirthState: string;

async function createSeu(what: string, config: Array<{ parameter: string; value: unknown }> | null): Promise<TestSeu> {
  const { template, profile } = await ensureWebAppTemplateFixture();
  const { objective } = await createObjective({ statement: label(what), requiredCapabilityCodes: [], tier: "Strategic", requestedBy: ROOT_ACTOR_ID });
  const { data: seu, error } = await seusDB.create({
    lifecycleState: await seuBirthState(), authorBadge: ROOT_ACTOR_BADGE, objectiveId: objective.id, templateId: template.id, profileId: profile.id, tenantId: PLATFORM_TENANT_ID, requestedBy: ROOT_ACTOR_ID,
  });
  assert.ok(seu && !error, error?.message ?? "the SEU is created");
  const systemParticipantId = await ensureSeuSystemParticipant(seu.id);
  if (config) {
    const { data: birth } = await transitionDefinitionsDB.findBirth("EBM");
    assert.ok(birth, "the EBM has a birth row");
    const { data: ebm, error: ebmError } = await ebmsDB.create({
      seuId: seu.id, templateId: seu.template_id, profileId: seu.profile_id, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
      status: birth.to_state as never, composedPacks: [], compositionReport: {} as never,
      behaviors: { settled: { profileConfiguration: { result: config } } },
    });
    assert.ok(ebm && !ebmError, ebmError?.message ?? "the EBM is created");
    await seusDB.setActiveEbm(seu.id, ebm.id);
  }
  return { seu, systemParticipantId, systemActorId: (await getSystemActor(seu.id)).actorId };
}

before(async () => {
  const { rows } = await pool.query<{ id: string }>("SELECT id FROM capability_definitions ORDER BY created_at LIMIT 1");
  assert.ok(rows[0], "the database holds a Capability Definition");
  capabilityId = rows[0].id;
  const { data: birth } = await transitionDefinitionsDB.findBirth("Deliverable");
  assert.ok(birth, "the Deliverable has a birth row");
  deliverableBirthState = birth.to_state;
  configured = await createSeu("configured", [
    { parameter: "redispatchMaxAttempts", value: 3 },
    { parameter: "redispatchAttentionThreshold", value: 2 },
    { parameter: "dispatchStrategyPreference", value: [{ strategy: "cost-optimisation", order: 1 }] },
  ]);
  plain = await createSeu("plain", null);
});

async function createParticipant(t: TestSeu, what: string, cost: number | null = null): Promise<ParticipantRow> {
  const { data: master, error } = await participantsMasterDB.create({ tenantId: PLATFORM_TENANT_ID, type: "Human", displayName: label(what), userId: null, cost });
  assert.ok(master && !error, error?.message ?? "the participants_master row is created");
  const { data, error: participantError } = await participantsDB.create({ seuId: t.seu.id, type: "Human", displayName: master.display_name, participantId: master.id });
  assert.ok(data && !participantError, participantError?.message ?? "the participant is created");
  return data;
}

async function makeUnavailable(t: TestSeu, participant: ParticipantRow): Promise<void> {
  const result = await applyParticipantHop({ participantId: participant.id, targetState: "Assigned", actorId: t.systemActorId });
  assert.equal(result.ok, true, JSON.stringify(result));
}

// A Work Item of a producing Command for a Deliverable (or for the SEU itself), with a pool of the given Participants.
async function makeWork(t: TestSeu, participants: ParticipantRow[], options: { poolId?: null; forSeu?: boolean } = {}): Promise<{ command: CommandRow; workItem: WorkItemRow; deliverableId: string }> {
  let entityType: "Deliverable" | "SEU" = "Deliverable";
  let entityId = t.seu.id;
  if (!options.forSeu) {
    const { data: deliverable, error } = await deliverablesDB.create({
      seuId: t.seu.id, name: label("deliverable"), producingCapabilityId: capabilityId, state: deliverableBirthState, authorId: t.systemParticipantId, authorBadge: ROOT_ACTOR_BADGE,
    });
    assert.ok(deliverable && !error, error?.message ?? "the Deliverable is created");
    entityId = deliverable.id;
  } else {
    entityType = "SEU";
  }
  let poolId: string | null = null;
  if (options.poolId !== null) {
    const { data: poolRow, error } = await capabilityFulfilmentPoolsDB.create({
      seuId: t.seu.id, seuCapabilityId: null, capabilityId, participantIds: participants.map((p) => p.id), authorId: t.systemParticipantId, authorBadge: ROOT_ACTOR_BADGE,
    });
    assert.ok(poolRow && !error, error?.message ?? "the pool is created");
    poolId = poolRow.id;
  }
  const { data: command, error: commandError } = await commandsDB.create({
    seuId: t.seu.id, entityType, entityId, commandType: `zz-dispatch-${run}`, fromState: "Defined", toState: "In Progress",
    requestedBy: ROOT_ACTOR_ID, actingBadgeType: ROOT_ACTOR_BADGE, correlationId: randomUUID(), eligibleParticipantPoolId: poolId,
  });
  assert.ok(command && !commandError, commandError?.message ?? "the Command is created");
  const { data: workItem, error: workItemError } = await workItemsDB.create({ commandId: command.id, authorId: t.systemParticipantId, authorBadge: ROOT_ACTOR_BADGE });
  assert.ok(workItem && !workItemError, workItemError?.message ?? "the Work Item is created");
  return { command, workItem, deliverableId: entityId };
}

async function eventsOf(workItemId: string): Promise<EventRow[]> {
  const { data } = await eventsDB.findByOriginatingObject("WorkItem", workItemId);
  return data ?? [];
}

const eventTypesOf = async (workItemId: string) => (await eventsOf(workItemId)).map((e) => e.event_type).sort();

async function workItemOf(id: string): Promise<WorkItemRow> {
  const { data } = await workItemsDB.findById(id);
  assert.ok(data, "the Work Item exists");
  return data;
}

async function commandOf(id: string): Promise<CommandRow> {
  const { data } = await commandsDB.findById(id);
  assert.ok(data, "the Command exists");
  return data;
}

const dispatchInput = (t: TestSeu, work: { command: CommandRow; workItem: WorkItemRow }, overrides: Partial<Parameters<typeof dispatchEngine.dispatch>[0]> = {}) => ({
  workItem: work.workItem, seuId: t.seu.id, producingCapabilityId: capabilityId as string | null, eligibleParticipantPoolId: work.command.eligible_participant_pool_id,
  correlationId: randomUUID(), ...overrides,
});

async function publishRequest(t: TestSeu, workItemId: string, eventType: string): Promise<EventRow> {
  return eventBus.publish({
    eventType, originatingObjectType: "WorkItem", originatingObjectId: workItemId, seuId: t.seu.id, correlationId: randomUUID(),
    actorId: t.systemActorId, authorityBadge: ROOT_ACTOR_BADGE, payload: {},
  });
}

test("dispatch rejects a Work Item whose Command declares no producing Capability, raising an Obligation and an Attention Item", async () => {
  const work = await makeWork(plain, []);
  await dispatchEngine.dispatch(dispatchInput(plain, work, { producingCapabilityId: null }));

  assert.equal((await workItemOf(work.workItem.id)).status, "Disposed");
  assert.equal((await commandOf(work.command.id)).status, "Failed");
  assert.deepEqual(await eventTypesOf(work.workItem.id), ["DispatchRejected"]);
  const rejected = (await eventsOf(work.workItem.id))[0];
  assert.deepEqual(rejected.payload, { reason: "no_producing_capability_declared", commandId: work.command.id });
  const { data: obligations } = await obligationsDB.findByRelatedObject("Deliverable", work.deliverableId);
  assert.ok((obligations ?? []).some((o) => o.title.includes(work.workItem.id) && o.title.includes("no_producing_capability_declared")));
  const { data: items } = await attentionItemsDB.findOpenByRelatedObjectAny("Deliverable", work.deliverableId);
  assert.ok((items ?? []).some((i) => i.category === "Action Required" && i.title.includes(work.workItem.id)));
});

test("dispatch rejects a Work Item with no pool, and one whose pool lists no Participant", async () => {
  const noPool = await makeWork(plain, [], { poolId: null });
  await dispatchEngine.dispatch(dispatchInput(plain, noPool));
  assert.equal((await workItemOf(noPool.workItem.id)).status, "Disposed");
  assert.equal((await eventsOf(noPool.workItem.id))[0].payload.reason, "empty_eligible_pool");

  const emptyPool = await makeWork(plain, []);
  await dispatchEngine.dispatch(dispatchInput(plain, emptyPool));
  assert.equal((await commandOf(emptyPool.command.id)).status, "Failed");
  assert.equal((await eventsOf(emptyPool.workItem.id))[0].payload.reason, "empty_eligible_pool");
});

test("dispatch defers a Work Item when no Participant of the pool is Available", async () => {
  const busy = await createParticipant(plain, "busy");
  await makeUnavailable(plain, busy);
  const work = await makeWork(plain, [busy]);
  await dispatchEngine.dispatch(dispatchInput(plain, work));

  assert.equal((await commandOf(work.command.id)).status, "Deferred");
  assert.equal((await workItemOf(work.workItem.id)).status, "Generated", "the Work Item waits");
  assert.deepEqual(await eventTypesOf(work.workItem.id), ["DispatchDeferred"]);
  assert.deepEqual((await eventsOf(work.workItem.id))[0].payload, { reason: "no_available_participant" });
});

test("dispatch rejects a Work Item when no candidate matches the dispatch strategy", async () => {
  const candidate = await createParticipant(plain, "no-expert");
  const work = await makeWork(plain, [candidate]);
  await dispatchEngine.dispatch(dispatchInput(plain, work, { strategies: [{ strategy: "specialist-preference", order: 1 }] }));

  assert.equal((await workItemOf(work.workItem.id)).status, "Disposed");
  assert.deepEqual(await eventTypesOf(work.workItem.id), ["ParticipantUnavailable"]);
  assert.equal((await eventsOf(work.workItem.id))[0].payload.reason, "no_candidate_matched_dispatch_strategy");
});

test("dispatch assigns the selected Participant, sets the target completion it was given and publishes the selection, the dispatch and the redispatch completion", async () => {
  const chosen = await createParticipant(plain, "chosen");
  const work = await makeWork(plain, [chosen]);
  const target = new Date(Date.now() + 3_600_000);
  await dispatchEngine.dispatch(dispatchInput(plain, work, { targetCompletionAt: target, isRedispatch: true }));

  const workItem = await workItemOf(work.workItem.id);
  assert.deepEqual([workItem.status, workItem.participant_id, workItem.dispatch_strategy], ["Dispatched", chosen.id, "capability-match"]);
  assert.equal(new Date(workItem.target_completion_at as string).getTime(), target.getTime());
  assert.equal((await commandOf(work.command.id)).status, "Dispatched");
  assert.equal((await participantsDB.findById(chosen.id)).data?.state, "Assigned");
  assert.deepEqual(await eventTypesOf(work.workItem.id), ["ParticipantSelected", "RedispatchCompleted", "WorkItemDispatched"]);
});

test("dispatch without a target completion takes it from the producing Capability's Service, and a first dispatch publishes no redispatch completion", async () => {
  const chosen = await createParticipant(plain, "no-target");
  const work = await makeWork(plain, [chosen]);
  await dispatchEngine.dispatch(dispatchInput(plain, work));

  const workItem = await workItemOf(work.workItem.id);
  assert.equal(workItem.status, "Dispatched");
  assert.deepEqual(await eventTypesOf(work.workItem.id), ["ParticipantSelected", "WorkItemDispatched"]);
});

test("the redispatch request handler turns a deferred dispatch into a redispatch request that carries the same Work Item, correlation and actor", async () => {
  const work = await makeWork(plain, []);
  const deferred = await publishRequest(plain, work.workItem.id, "DispatchDeferred");
  await redispatchRequestHandler(deferred);

  const requested = (await eventsOf(work.workItem.id)).find((e) => e.event_type === "RedispatchRequested");
  assert.ok(requested, "a RedispatchRequested event is published");
  assert.deepEqual(
    [requested.originating_object_id, requested.correlation_id, requested.causation_id, requested.actor_id, requested.authority_badge],
    [work.workItem.id, deferred.correlation_id, deferred.id, deferred.actor_id, deferred.authority_badge]
  );
});

test("the redispatch handler ignores a Work Item that does not exist", async () => {
  const event = await publishRequest(plain, randomUUID(), "RedispatchRequested");
  await redispatchHandler(event);
  assert.deepEqual(await eventTypesOf(event.originating_object_id), ["RedispatchRequested"], "nothing else is published");
});

test("the redispatch handler counts attempts, raises an escalation at the threshold and gives up at the limit", async () => {
  const busy = await createParticipant(configured, "busy");
  await makeUnavailable(configured, busy);
  const work = await makeWork(configured, [busy]);
  const request = async () => redispatchHandler(await publishRequest(configured, work.workItem.id, "RedispatchRequested"));
  const escalations = async () => ((await attentionItemsDB.findOpenByRelatedObjectAny("Deliverable", work.deliverableId)).data ?? []).filter((i) => i.category === "Escalation");

  await request();
  assert.equal((await workItemOf(work.workItem.id)).dispatch_attempts, 1);
  assert.equal((await escalations()).length, 0, "below the threshold");
  assert.equal((await commandOf(work.command.id)).status, "Deferred");

  await request();
  assert.equal((await workItemOf(work.workItem.id)).dispatch_attempts, 2);
  assert.equal((await escalations()).length, 1, "at the threshold");
  assert.match((await escalations())[0].title, /still not dispatched after 2 attempts/);

  await request();
  assert.equal((await workItemOf(work.workItem.id)).status, "Disposed");
  assert.equal((await commandOf(work.command.id)).status, "Failed");
  const exhausted = (await eventsOf(work.workItem.id)).find((e) => e.event_type === "DispatchRejected");
  assert.deepEqual(exhausted?.payload, { reason: "redispatch_exhausted", attempts: 3 });
  const { data: obligations } = await obligationsDB.findByRelatedObject("Deliverable", work.deliverableId);
  assert.ok((obligations ?? []).some((o) => o.title.includes("gave up") && o.title.includes("after 3 attempts")));
  const { data: items } = await attentionItemsDB.findOpenByRelatedObjectAny("Deliverable", work.deliverableId);
  assert.ok((items ?? []).some((i) => i.category === "Action Required" && /could not be dispatched after 3 attempts/.test(i.title)));
});

test("the redispatch handler dispatches again with the SEU's strategy preference and the producing Capability of the Deliverable", async () => {
  const dear = await createParticipant(configured, "dear", 50);
  const cheap = await createParticipant(configured, "cheap", 20);
  const work = await makeWork(configured, [dear, cheap]);
  await redispatchHandler(await publishRequest(configured, work.workItem.id, "RedispatchRequested"));

  const workItem = await workItemOf(work.workItem.id);
  assert.deepEqual([workItem.status, workItem.participant_id, workItem.dispatch_strategy, workItem.dispatch_attempts], ["Dispatched", cheap.id, "cost-optimisation", 1]);
  assert.ok((await eventTypesOf(work.workItem.id)).includes("RedispatchCompleted"));
});

test("the redispatch handler of an SEU with no EBM has no limit and no threshold, and uses the default strategy", async () => {
  const chosen = await createParticipant(plain, "plain-chosen");
  const work = await makeWork(plain, [chosen]);
  await redispatchHandler(await publishRequest(plain, work.workItem.id, "RedispatchRequested"));
  const workItem = await workItemOf(work.workItem.id);
  assert.deepEqual([workItem.status, workItem.dispatch_strategy, workItem.dispatch_attempts], ["Dispatched", "capability-match", 1]);
});

test("the redispatch handler of a Command that is not for a Deliverable has no producing Capability and rejects the dispatch", async () => {
  const chosen = await createParticipant(plain, "seu-command");
  const work = await makeWork(plain, [chosen], { forSeu: true });
  await redispatchHandler(await publishRequest(plain, work.workItem.id, "RedispatchRequested"));
  assert.equal((await workItemOf(work.workItem.id)).status, "Disposed");
  assert.equal((await eventsOf(work.workItem.id)).find((e) => e.event_type === "DispatchRejected")?.payload.reason, "no_producing_capability_declared");
});

test("the redispatch handler escalates at the threshold when no limit is configured, and says so", async () => {
  const thresholdOnly = await createSeu("threshold-only", [{ parameter: "redispatchAttentionThreshold", value: 1 }]);
  const busy = await createParticipant(thresholdOnly, "busy");
  await makeUnavailable(thresholdOnly, busy);
  const work = await makeWork(thresholdOnly, [busy]);
  await redispatchHandler(await publishRequest(thresholdOnly, work.workItem.id, "RedispatchRequested"));

  const { data: items } = await attentionItemsDB.findOpenByRelatedObjectAny("Deliverable", work.deliverableId);
  const escalation = (items ?? []).find((i) => i.category === "Escalation");
  assert.ok(escalation?.description?.includes("limit none configured"), JSON.stringify(escalation));
  assert.equal((await workItemOf(work.workItem.id)).status, "Generated", "the Work Item waits, as no limit stops it");
});

test("a Work Item whose Deliverable no longer exists is dispatched without a producing Capability and rejected, by the redispatch handler and the Work Item handler alike", async () => {
  const chosen = await createParticipant(plain, "orphan");
  const orphan = async () => {
    const work = await makeWork(plain, [chosen]);
    await pool.query("UPDATE commands SET entity_id = $2 WHERE id = $1", [work.command.id, randomUUID()]);
    return work;
  };
  // The rejection raises an Obligation on the missing Deliverable, which cannot be resolved to an SEU, so the handlers fail with that reason.
  const redispatched = await orphan();
  await assert.rejects(async () => redispatchHandler(await publishRequest(plain, redispatched.workItem.id, "RedispatchRequested")), /deliverable not found/);
  const generated = await orphan();
  await assert.rejects(async () => workItemGeneratedHandler(await publishRequest(plain, generated.workItem.id, "WorkItemGenerated")), /deliverable not found/);
});

test("the Work Item handler dispatches with the target completion its event carries", async () => {
  const chosen = await createParticipant(plain, "target");
  const work = await makeWork(plain, [chosen]);
  const target = new Date(Date.now() + 7_200_000);
  const event = await eventBus.publish({
    eventType: "WorkItemGenerated", originatingObjectType: "WorkItem", originatingObjectId: work.workItem.id, seuId: plain.seu.id, correlationId: randomUUID(),
    actorId: plain.systemActorId, authorityBadge: ROOT_ACTOR_BADGE, payload: { targetCompletionAt: target.toISOString() },
  });
  await workItemGeneratedHandler(event);
  const workItem = await workItemOf(work.workItem.id);
  assert.equal(workItem.status, "Dispatched");
  assert.equal(new Date(workItem.target_completion_at as string).getTime(), target.getTime());
});
