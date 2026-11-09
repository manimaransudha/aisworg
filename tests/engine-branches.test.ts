// Branches of the engine's handlers and metrics that the pipeline tests do not reach: the Capability request handler's skips, the Deliverable
// Kickoff handler's re-issue of a producing Command, the metric calculations on an SEU with no data, and the eligibility Policies of a settled EBM.
//
//   - Each case has an SEU of its own, a plain row in the Operational state with the rows the case needs. Event subscriptions are not loaded in this
//     file, so the events the handlers publish run no handler.
//   - Rows are not deleted, as in the other tests that create SEUs.
import { activeCapabilityDefinitionIds } from "./entityTenantCache.js";
import "dotenv/config";
// The Event Bus is loaded first: it loads the handler registry, which loads the handlers under test.
import "../src/domain/engine/eventBus.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { commandsDB } from "../src/dblayer/commandsDB.js";
import { eventsDB } from "../src/dblayer/eventsDB.js";
import { obligationsDB } from "../src/dblayer/obligationsDB.js";
import { participantsDB } from "../src/dblayer/participantsDB.js";
import { seuCapabilitiesDB } from "../src/dblayer/seuCapabilitiesDB.js";
import { capabilityFulfilmentsDB } from "../src/dblayer/capabilityFulfilmentsDB.js";
import { capabilityOnReadyHandler } from "../src/domain/engine/capabilityOnReady.js";
import { deliverableKickoffHandler } from "../src/domain/engine/deliverableKickoff.js";
import { metricRegistryEngine } from "../src/domain/engine/metricRegistryEngine.js";
import { getEntityAdapter } from "../src/domain/engine/entityAdapters.js";
import { participantsMasterDB } from "../src/dblayer/participantsMasterDB.js";
import { createDecision } from "../src/routes/seu/core/decisions.js";
import { createKnowledgeItem } from "../src/routes/seu/core/knowledge.js";
import { eligibilityPoliciesOf, competencyRequirementsOf } from "../src/domain/engine/ebmSettled.js";
import type { DeliverableRow } from "../src/dblayer/seuTypes.js";
import { publishTestEvent } from "./engineFixtures.js";
import { commissionedSeu, type CommissionedSeu } from "./webScenarios.js";
import { createObligationAsRoot, createEvidenceAsRoot, supportingEvidenceReferences, PLATFORM_TENANT_ID, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE } from "./testFixtures.js";

const run = randomUUID().slice(0, 8);

async function capabilityId(offset = 0): Promise<string> {
  const id = (await activeCapabilityDefinitionIds())[offset];
  assert.ok(id, "the Platform tenant holds a Capability Definition");
  return id;
}

async function operationalSeu(label: string): Promise<{ t: CommissionedSeu; capability: string; seuCapabilityId: string }> {
  const t = await commissionedSeu(label, "clean", { conflictSet: "branches" });
  const capability = await capabilityId();
  await seuCapabilitiesDB.createMany(t.seu.id, [capability], t.systemParticipantId, ROOT_ACTOR_BADGE);
  const { data } = await seuCapabilitiesDB.findBySeuIdAndCapabilityId(t.seu.id, capability);
  assert.ok(data);
  return { t, capability, seuCapabilityId: data.id };
}

async function createDeliverable(t: CommissionedSeu, label: string, state: string, capability: string | null): Promise<DeliverableRow> {
  const { data, error } = await deliverablesDB.create({
    seuId: t.seu.id, name: `engine-branches ${label} ${run} ${randomUUID()}`, state, producingCapabilityId: capability, authorId: t.systemParticipantId, authorBadge: ROOT_ACTOR_BADGE,
  });
  assert.ok(data && !error, error);
  return data;
}

const eventTypesOn = async (type: string, id: string) => ((await eventsDB.findByOriginatingObject(type, id)).data ?? []).map((e) => e.event_type);

// ── capabilityOnReady ─────────────────────────────────────────────────────────────────────────────────────────────

test("the Capability request handler ignores an event with no SEU, a readiness that is not for a producing state and a Deliverable that does not exist", async () => {
  const { t } = await operationalSeu("on-ready-ignored");
  const ready = (payload: Record<string, unknown>, id = randomUUID()) => publishTestEvent({ eventType: "DeliverableReady", originatingObjectType: "Deliverable", originatingObjectId: id, seuId: t.seu.id, payload });
  await capabilityOnReadyHandler({ ...(await ready({ toEntityType: "Deliverable", toState: "In Progress" })), seu_id: null });
  await capabilityOnReadyHandler(await ready({ toEntityType: "Capability", toState: "In Progress" }));
  await capabilityOnReadyHandler(await ready({ toEntityType: "Deliverable", toState: "Approved" }));
  await capabilityOnReadyHandler(await ready({ toEntityType: "Deliverable", toState: "In Progress" }));
  assert.deepEqual((await eventsDB.findByOriginatingObject("SEU", t.seu.id)).data?.filter((e) => e.event_type === "CapabilityRequested"), []);
});

test("the Capability request handler requests nothing for a Capability that is Fulfilled or that a request is already in flight for", async () => {
  const { t, capability, seuCapabilityId } = await operationalSeu("on-ready-skips");
  const deliverable = await createDeliverable(t, "producing", "Defined", capability);
  const readyEvent = await publishTestEvent({
    eventType: "DeliverableReady", originatingObjectType: "Deliverable", originatingObjectId: deliverable.id, seuId: t.seu.id, payload: { toEntityType: "Deliverable", toState: "In Progress" },
  });
  const commissioned = await publishTestEvent({ eventType: "SEUCommissioned", originatingObjectType: "SEU", originatingObjectId: t.seu.id, seuId: t.seu.id });
  const requests = async () => ((await eventsDB.findByOriginatingObject("SEU", t.seu.id)).data ?? []).filter((e) => e.event_type === "CapabilityRequested" && (e.payload as { capabilityId?: string } | null)?.capabilityId === capability).length;

  await publishTestEvent({ eventType: "CapabilityRequested", originatingObjectType: "SEU", originatingObjectId: t.seu.id, seuId: t.seu.id, payload: { capabilityId: capability } });
  const inFlight = await requests();
  await capabilityOnReadyHandler(readyEvent);
  await capabilityOnReadyHandler(commissioned);
  assert.equal(await requests(), inFlight, "a request is in flight");

  await pool.query("UPDATE seu_capabilities SET status = 'Fulfilled' WHERE id = $1", [seuCapabilityId]);
  await capabilityOnReadyHandler(readyEvent);
  await capabilityOnReadyHandler(commissioned);
  assert.equal(await requests(), inFlight, "the Capability is Fulfilled");
});

// ── deliverableKickoff ────────────────────────────────────────────────────────────────────────────────────────────

test("the Kickoff handler ignores a Deliverable transition that is not into the producing state, and an Obligation or Attention Item that is not resolved", async () => {
  const { t } = await operationalSeu("kickoff-ignored");
  const send = async (eventType: string, payload: Record<string, unknown>) =>
    deliverableKickoffHandler(await publishTestEvent({ eventType, originatingObjectType: "SEU", originatingObjectId: t.seu.id, seuId: t.seu.id, payload }));
  await send("DeliverableTransitioned", { toState: "Approved" });
  await send("ObligationTransitioned", {});
  await send("ObligationTransitioned", { toState: "Open" });
  await send("AttentionItemTransitioned", {});
  await send("AttentionItemTransitioned", { toState: "Open" });
  await send("SomethingElse", {});
});

test("a resolved Obligation, a fulfilled Capability and a rejected dispatch re-issue the producing Command only for a Deliverable that is In Progress, not held, with nobody producing it yet and a Participant fulfilling its Capability", async () => {
  const { t, capability, seuCapabilityId } = await operationalSeu("kickoff-reissue");
  const held = await createDeliverable(t, "held", "In Progress", capability);
  const waiting = await createDeliverable(t, "waiting", "Approved", capability);
  const free = await createDeliverable(t, "free", "In Progress", capability);
  const unrelated = await createDeliverable(t, "unrelated", "In Progress", null);
  await createObligationAsRoot({
    relatedObjectType: "Deliverable", relatedObjectId: held.id, category: "Operational", title: `Holds ${run}`, blockedFromState: "In Progress", blockedToState: "In Progress",
  });
  const send = async (eventType: string, payload: Record<string, unknown>) =>
    deliverableKickoffHandler(await publishTestEvent({ eventType, originatingObjectType: "SEU", originatingObjectId: t.seu.id, seuId: t.seu.id, payload }));
  const producing = async () => ((await commandsDB.findBySeuId(t.seu.id)).data ?? []).filter((c) => c.from_state === "In Progress" && c.to_state === "In Progress");

  await assert.rejects(() => send("CapabilityFulfilled", {}), /carries no capabilityId/);
  await send("CapabilityFulfilled", { capabilityId: capability });
  await send("ObligationTransitioned", { toState: "Verified" });
  assert.deepEqual(await producing(), [], "the held Deliverable is held, the waiting one is not In Progress, and nobody fulfils the Capability");

  const { data: root } = await participantsDB.findBySeuIdAndParticipantMasterId(t.seu.id, ROOT_ACTOR_ID);
  assert.ok(root);
  const { error } = await capabilityFulfilmentsDB.create({ seuCapabilityId, participantId: root.id, authorId: root.id, authorBadge: ROOT_ACTOR_BADGE });
  assert.ok(!error, error);
  await assert.rejects(() => send("CapabilityFulfilled", { capabilityId: capability }), /has no transition Command to take its governance outcome from/);

  const { data: transition } = await commandsDB.create({
    seuId: t.seu.id, entityType: "Deliverable", entityId: free.id, commandType: `zz-transition-${run}`, fromState: "Defined", toState: "In Progress",
    requestedBy: ROOT_ACTOR_ID, actingBadgeType: ROOT_ACTOR_BADGE, correlationId: randomUUID(),
  });
  assert.ok(transition);
  await send("CapabilityFulfilled", { capabilityId: capability });
  assert.deepEqual((await producing()).map((c) => c.entity_id), [free.id], "the free Deliverable gets its producing Command");
  await send("CapabilityFulfilled", { capabilityId: capability });
  assert.equal((await producing()).length, 1, "a second report does not issue a second Command");

  // A rejected dispatch re-issues only for a Deliverable of this SEU that has a producing Capability.
  const rejectedFor = async (entityType: "Deliverable" | "SEU", entityId: string) => {
    const { data: command } = await commandsDB.create({
      seuId: t.seu.id, entityType, entityId, commandType: `zz-rejected-${run}`, fromState: "In Progress", toState: "Approved",
      requestedBy: ROOT_ACTOR_ID, actingBadgeType: ROOT_ACTOR_BADGE, correlationId: randomUUID(),
    });
    assert.ok(command);
    await send("DispatchRejected", { commandId: command.id, reason: "empty_eligible_pool" });
  };
  await send("DispatchRejected", {});
  await send("DispatchRejected", { commandId: randomUUID() });
  await rejectedFor("SEU", t.seu.id);
  await rejectedFor("Deliverable", randomUUID());
  await rejectedFor("Deliverable", unrelated.id);
  await rejectedFor("Deliverable", waiting.id);
  assert.equal((await producing()).length, 1, "none of these issues a Command");
  assert.ok((await obligationsDB.findByRelatedObject("Deliverable", held.id)).data?.some((o) => o.title === `Holds ${run}`));
});

test("a Deliverable moving into the producing state gets no producing Command while one is live or while an Obligation holds it", async () => {
  const { t, capability } = await operationalSeu("kickoff-transitioned");
  const live = await createDeliverable(t, "live", "In Progress", capability);
  const held = await createDeliverable(t, "held", "In Progress", capability);
  await createObligationAsRoot({
    relatedObjectType: "Deliverable", relatedObjectId: held.id, category: "Operational", title: `Holds ${run}`, blockedFromState: "In Progress", blockedToState: "In Progress",
  });
  const command = async (entityId: string, fromState: string) => {
    const { data } = await commandsDB.create({
      seuId: t.seu.id, entityType: "Deliverable", entityId, commandType: `zz-live-${run}`, fromState, toState: "In Progress",
      requestedBy: ROOT_ACTOR_ID, actingBadgeType: ROOT_ACTOR_BADGE, correlationId: randomUUID(),
    });
    assert.ok(data);
    return data;
  };
  const transitioned = async (deliverable: DeliverableRow, commandId: string) =>
    deliverableKickoffHandler(await publishTestEvent({
      eventType: "DeliverableTransitioned", originatingObjectType: "Deliverable", originatingObjectId: deliverable.id, seuId: t.seu.id, payload: { toState: "In Progress", commandId },
    }));

  const liveTransition = await command(live.id, "Defined");
  await command(live.id, "In Progress");
  const heldTransition = await command(held.id, "Defined");
  await transitioned(live, liveTransition.id);
  await transitioned(held, heldTransition.id);
  const commands = (await commandsDB.findBySeuId(t.seu.id)).data ?? [];
  assert.equal(commands.filter((c) => c.from_state === "In Progress" && c.to_state === "In Progress").length, 1, "only the live Command the test wrote exists");
});

// ── metrics ───────────────────────────────────────────────────────────────────────────────────────────────────────

test("every metric of the registry is computed for an SEU with no data, and the averages and rates that have nothing to divide are null", async () => {
  const { t } = await operationalSeu("metrics-empty");
  const known = ["deliverable_cycle_time", "quality_gate_latency", "command_generation_count", "dispatch_latency", "work_item_duration", "knowledge_growth", "evidence_generation", "rework_rate", "deliverable_acceptance_rate"];
  const { rows } = await pool.query<{ identifier: string; calculation_method: string }>("SELECT identifier, calculation_method FROM metric_definitions WHERE calculation_method = ANY($1::text[])", [known]);
  assert.ok(rows.length > 0, "the registry holds metrics");
  const nullField: Record<string, string> = {
    deliverable_cycle_time: "averageCycleTimeSeconds", dispatch_latency: "averageDispatchLatencySeconds", work_item_duration: "averageDurationSeconds",
    rework_rate: "reworkRate", deliverable_acceptance_rate: "acceptanceRate",
  };
  for (const { identifier, calculation_method } of rows) {
    const result = await metricRegistryEngine.compute(identifier, { seuId: t.seu.id });
    assert.equal(result.outcome, "Computed", identifier);
    const field = nullField[calculation_method];
    if (field && result.outcome === "Computed") assert.equal((result.value as Record<string, unknown>)[field], null, `${identifier}: ${field}`);
  }
});

test("the acceptance rate of an SEU whose Deliverables are not Baselined is zero, and a Baselined one raises it", async () => {
  const { t } = await operationalSeu("metrics-acceptance");
  await createDeliverable(t, "open", "Defined", null);
  const { rows } = await pool.query<{ identifier: string }>("SELECT identifier FROM metric_definitions WHERE calculation_method = 'deliverable_acceptance_rate'");
  assert.ok(rows[0], "the registry holds the acceptance rate");
  const rate = async () => {
    const result = await metricRegistryEngine.compute(rows[0].identifier, { seuId: t.seu.id });
    assert.equal(result.outcome, "Computed");
    return result.outcome === "Computed" ? (result.value as { acceptanceRate: number | null }).acceptanceRate : null;
  };
  assert.equal(await rate(), 0);
  await createDeliverable(t, "done", "Baselined", null);
  assert.equal(await rate(), 0.5);
});

// ── ebmSettled ────────────────────────────────────────────────────────────────────────────────────────────────────

test("the eligibility Policies of a settled EBM are the Eligibility ones, once each, with an always true condition when none is given; competency requirements are read by dimension", () => {
  const settled = {
    policies: { result: [
      { policyCode: "a", scope: "Eligibility", governingCondition: null },
      { policyCode: "a", scope: "Eligibility", governingCondition: null },
      { policyCode: "b", scope: "Eligibility", governingCondition: { type: "field_in", field: "x", values: [1] } },
      { policyCode: "c", scope: "Transition", governingCondition: null },
    ] },
    competencies: { result: [{ dimension: "Skill", value: "s1" }, { dimension: "Skill", value: "s2" }, { dimension: "Organisation", value: "o1" }] },
  };
  assert.deepEqual(eligibilityPoliciesOf(settled), [
    { code: "a", condition: { type: "always_true" } },
    { code: "b", condition: { type: "field_in", field: "x", values: [1] } },
  ]);
  assert.deepEqual(eligibilityPoliciesOf(null), []);
  assert.deepEqual(competencyRequirementsOf(settled), { Skill: ["s1", "s2"], Organisation: ["o1"] });
  assert.deepEqual(competencyRequirementsOf(null), {});
});

// ── entityAdapters ────────────────────────────────────────────────────────────────────────────────────────────────

test("an Evidence item with no SEU relationship cannot be placed in an SEU, and a Knowledge Item or Decision is not moved for an actor who is not a Participant of its SEU or when it does not exist", async () => {
  await assert.rejects(async () => getEntityAdapter("Evidence").seuId?.({ id: randomUUID() } as never), /has no SEU relationship/);

  const t = await commissionedSeu("adapters", "clean", { conflictSet: "branches" });
  const deliverable = await createDeliverable(t, "subject", "Defined", null);
  const evidence = await createEvidenceAsRoot({ seuId: t.seu.id, relatedObjectType: "Deliverable", relatedObjectId: deliverable.id, category: "Analytical Evidence", title: `adapters ${run}` });
  const decision = await createDecision({
    actorId: ROOT_ACTOR_ID, seuId: t.seu.id, evidenceIds: [evidence.id], relatedObjects: [{ related_object_type: "Deliverable", related_object_ids: [deliverable.id] }],
    category: "Engineering Decisions", title: `adapters decision ${run}`,
  });
  const knowledge = await createKnowledgeItem({
    actorId: ROOT_ACTOR_ID, seuId: t.seu.id, deliverableId: deliverable.id, category: "Technical Knowledge", title: `adapters knowledge ${run}`,
    evidenceReferences: await supportingEvidenceReferences(t.seu.id, deliverable.id),
  });
  const { data: stranger } = await participantsMasterDB.create({ tenantId: PLATFORM_TENANT_ID, type: "Human", displayName: `adapters stranger ${run}`, userId: null });
  assert.ok(stranger);

  for (const [type, id] of [["Decision", decision.id], ["Knowledge", knowledge.id]] as const) {
    const adapter = getEntityAdapter(type);
    await assert.rejects(() => adapter.setState(randomUUID(), "Analysed", ROOT_ACTOR_BADGE, ROOT_ACTOR_ID), /not found/, `${type}: unknown id`);
    await assert.rejects(() => adapter.setState(id, "Analysed", ROOT_ACTOR_BADGE, stranger.id), /No participants row for participants_master/, `${type}: actor outside the SEU`);
  }
});
