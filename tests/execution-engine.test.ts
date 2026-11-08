// Execution Engine (src/domain/engine/executionEngine.ts) and the Work Item Generator (workItemGenerator.ts): the governance refusals a commissioned
// pipeline does not reach, the persistence of a governance outcome and an eligible-Participant pool with a Command, and the Quality Gate that a
// Work Item records.
//
//   - The Deliverables belong to a plain SEU row with no EBM, so no Policy applies. Governance is evaluated with the real functions.
//   - The edges with a submit verb or with no verb are written for a Deliverable state that carries the run tag, so no real Deliverable
//     transition is touched. The edges are deleted when the file ends.
//   - Rows are not deleted, as in the other tests that create SEUs.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { deliverablesDB } from "../src/dblayer/deliverablesDB.js";
import { commandsDB } from "../src/dblayer/commandsDB.js";
import { workItemsDB } from "../src/dblayer/workItemsDB.js";
import { qualityGatesDB } from "../src/dblayer/qualityGatesDB.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { capabilityFulfilmentPoolsDB } from "../src/dblayer/capabilityFulfilmentPoolsDB.js";
import { governanceEvaluationOutcomesDB } from "../src/dblayer/governanceEvaluationOutcomesDB.js";
import { transitionDefinitionsDB, reloadIfLoaded } from "../src/dblayer/transitionDefinitionsDB.js";
import { executionEngine, type DeliverableGovernanceResult } from "../src/domain/engine/executionEngine.js";
import { workItemGenerator } from "../src/domain/engine/workItemGenerator.js";
import { eventBus } from "../src/domain/engine/eventBus.js";
import type { GovernanceEvaluationOutcomeDraft } from "../src/dblayer/seuTypes.js";
import { createTestSeu, type TestSeu } from "./engineFixtures.js";
import { createObligationAsRoot, ROOT_ACTOR_ID, ROOT_ACTOR_BADGE } from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
const state = (name: string) => `zz-${name}-${run}`;
let t: TestSeu;
let capabilityId: string;
let packId: string;
let deliverableBirthState: string;
let verb: string;
const edges: Array<[string, string]> = [];

before(async () => {
  t = await createTestSeu("execution-engine");
  const { rows } = await pool.query<{ id: string }>("SELECT id FROM capability_definitions ORDER BY created_at LIMIT 1");
  assert.ok(rows[0], "the database holds a Capability Definition");
  capabilityId = rows[0].id;
  const { data: pack } = await packsDB.findByCode("development");
  assert.ok(pack, "the development Pack is seeded");
  packId = pack.id;
  const { data: birth } = await transitionDefinitionsDB.findBirth("Deliverable");
  assert.ok(birth, "the Deliverable has a birth row");
  deliverableBirthState = birth.to_state;
  const verbRows = await pool.query<{ verb: string }>("SELECT verb FROM transition_definitions WHERE entity_type = 'Deliverable' AND verb IS NOT NULL LIMIT 1");
  assert.ok(verbRows.rows[0], "a seeded Deliverable edge names a verb");
  verb = verbRows.rows[0].verb;
});

after(async () => {
  for (const [from, to] of edges) await pool.query("DELETE FROM transition_definitions WHERE entity_type = 'Deliverable' AND from_state = $1 AND to_state = $2", [from, to]);
  await reloadIfLoaded();
});

async function createDeliverable(lifecycle: string = deliverableBirthState) {
  const { data, error } = await deliverablesDB.create({
    seuId: t.seu.id, name: `execution-engine ${run} ${randomUUID()}`, state: lifecycle, authorId: t.systemParticipantId, authorBadge: ROOT_ACTOR_BADGE,
  });
  assert.ok(data && !error, error?.message);
  return data;
}

async function addEdge(from: string, to: string, withVerb: boolean): Promise<void> {
  const { error } = await transitionDefinitionsDB.upsert({ entityType: "Deliverable", fromState: from, toState: to, verb: withVerb ? verb : null });
  assert.ok(!error, error?.message);
  edges.push([from, to]);
}

function assertGovernanceOk(result: DeliverableGovernanceResult): asserts result is Extract<DeliverableGovernanceResult, { ok: true }> {
  assert.equal(result.ok, true, JSON.stringify(result));
}

test("governance refuses a Deliverable while an Obligation that blocks the hop is open on it", async () => {
  const deliverable = await createDeliverable();
  await createObligationAsRoot({
    relatedObjectType: "Deliverable", relatedObjectId: deliverable.id, category: "Operational", title: `Blocks the hop ${run}`, blockedFromState: deliverableBirthState, blockedToState: "In Progress",
  });
  const result = await executionEngine.evaluateDeliverableTransition({ deliverable, targetState: "In Progress", actorId: ROOT_ACTOR_ID });
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.reason === "obligation_blocked" && result.detail.includes(`Blocks the hop ${run}`), JSON.stringify(result));
});

test("governance passes a Deliverable that has no producing Capability, and the governance outcome is stored with a Command and an eligible-Participant pool", async () => {
  const deliverable = await createDeliverable();
  const governance = await executionEngine.evaluateDeliverableTransition({ deliverable, targetState: "In Progress", actorId: ROOT_ACTOR_ID });
  assertGovernanceOk(governance);
  assert.equal(governance.fromState, deliverableBirthState);

  const common = {
    seuId: t.seu.id, entityType: "Deliverable" as const, entityId: deliverable.id, fromState: governance.fromState, toState: "In Progress", commandType: `zz-execute-${run}`,
    producingCapabilityId: capabilityId, requestedBy: ROOT_ACTOR_ID, actorId: ROOT_ACTOR_ID, actingBadgeType: ROOT_ACTOR_BADGE, correlationId: randomUUID(),
  };
  await assert.rejects(() => executionEngine.execute({ ...common, actorId: "" }), /without a real actorId/);
  await assert.rejects(() => executionEngine.execute({ ...common, actingBadgeType: "" }), /without a resolved acting badge/);

  await executionEngine.execute({ ...common, governanceOutcome: governance.governanceOutcome });
  const { data: commands } = await commandsDB.findBySeuId(t.seu.id);
  const command = (commands ?? []).find((c) => c.command_type === common.commandType);
  assert.ok(command, "the Command is stored");
  assert.ok(command.governance_outcome_id, "the Command carries the governance outcome");
  assert.ok(command.eligible_participant_pool_id, "the Command carries the pool");
  const { data: pool } = await capabilityFulfilmentPoolsDB.findById(command.eligible_participant_pool_id);
  assert.deepEqual(pool?.participant_ids, [], "the SEU does not require the Capability, so nobody fulfils it");
});

test("applying a hop with no Transition Definition is refused, and a hop whose Deliverable has already moved is refused as in flight", async () => {
  const deliverable = await createDeliverable();
  const governance = await executionEngine.evaluateDeliverableTransition({ deliverable, targetState: "In Progress", actorId: ROOT_ACTOR_ID });
  assertGovernanceOk(governance);
  const base = { deliverable, fromState: deliverableBirthState, requestedBy: ROOT_ACTOR_ID, actingBadgeType: ROOT_ACTOR_BADGE, governanceOutcome: governance.governanceOutcome, correlationId: randomUUID() };

  const nowhere = await executionEngine.applyGovernedDeliverableTransition({ ...base, toState: state("nowhere") });
  assert.deepEqual(nowhere, { ok: false, reason: "no_transition_definition" });

  const moved = await executionEngine.applyDeliverableTransition({ ...base, fromState: state("not-current"), toState: "In Progress" });
  assert.ok(!moved.ok && moved.reason === "already_in_flight");
});

test("governance refuses an edge with a submit verb until the Deliverable has been submitted, and an edge that declares no verb is an error", async () => {
  const from = state("open");
  const to = state("done");
  await addEdge(from, to, true);
  await pool.query("UPDATE transition_definitions SET submit_verb = $3 WHERE entity_type = 'Deliverable' AND from_state = $1 AND to_state = $2", [from, to, verb]);
  await reloadIfLoaded();
  const deliverable = await createDeliverable(from);

  const refused = await executionEngine.evaluateDeliverableTransition({ deliverable, targetState: to, actorId: ROOT_ACTOR_ID });
  assert.ok(!refused.ok && refused.reason === "not_submitted" && refused.detail.includes(`deliverable_${verb}`), JSON.stringify(refused));

  await eventBus.publish({
    eventType: `Deliverable${from}`, originatingObjectType: "Deliverable", originatingObjectId: deliverable.id, seuId: t.seu.id,
    correlationId: randomUUID(), actorId: ROOT_ACTOR_ID, authorityBadge: ROOT_ACTOR_BADGE,
  });
  assertGovernanceOk(await executionEngine.evaluateDeliverableTransition({ deliverable, targetState: to, actorId: ROOT_ACTOR_ID }));

  const noVerbFrom = state("open-no-verb");
  const noVerbTo = state("done-no-verb");
  await addEdge(noVerbFrom, noVerbTo, false);
  const noVerbDeliverable = await createDeliverable(noVerbFrom);
  await assert.rejects(() => executionEngine.evaluateDeliverableTransition({ deliverable: noVerbDeliverable, targetState: noVerbTo, actorId: ROOT_ACTOR_ID }), /declares no verb/);
});

test("a Work Item records the Quality Gate of the governance outcome of its Command, and none when the Deliverable does not exist", async () => {
  const { data: gate, error: gateError } = await qualityGatesDB.upsert({
    name: `execution-engine gate ${run}`, entityType: "AttentionItem", fromState: state("gate-from"), toState: state("gate-to"),
    criteria: { type: "no_unresolved_obligations" }, originatingPackId: packId, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
  });
  assert.ok(gate && !gateError, gateError?.message);

  const deliverable = await createDeliverable();
  const governance = await executionEngine.evaluateDeliverableTransition({ deliverable, targetState: "In Progress", actorId: ROOT_ACTOR_ID });
  assertGovernanceOk(governance);
  const draft: GovernanceEvaluationOutcomeDraft = { ...governance.governanceOutcome, outcome: "Waived", quality_gate_id: gate.id, quality_gate_outcome: "Waived", originating_pack_id: packId };
  const { data: outcome, error: outcomeError } = await governanceEvaluationOutcomesDB.create({ ...draft, author_id: t.systemParticipantId, author_badge: ROOT_ACTOR_BADGE });
  assert.ok(outcome && !outcomeError, outcomeError?.message);

  const create = async (entityId: string, governanceOutcomeId: string | null) => {
    const { data: command, error } = await commandsDB.create({
      seuId: t.seu.id, entityType: "Deliverable", entityId, commandType: `zz-work-item-${run}`, fromState: deliverableBirthState, toState: "In Progress",
      requestedBy: ROOT_ACTOR_ID, actingBadgeType: ROOT_ACTOR_BADGE, correlationId: randomUUID(), governanceOutcomeId,
    });
    assert.ok(command && !error, error?.message);
    return command;
  };

  const command = await create(deliverable.id, outcome.id);
  const workItem = await workItemGenerator.generate({ command, seuId: t.seu.id, correlationId: randomUUID(), causationEventId: null });
  const stored = (await workItemsDB.findById(workItem.id)).data;
  assert.deepEqual(stored?.execution_context?.qualityGate, { id: gate.id, name: gate.name, outcome: "Waived" });
  assert.equal(stored?.execution_context?.relevantDeliverable.id, deliverable.id);

  const orphan = await workItemGenerator.generate({ command: await create(randomUUID(), null), seuId: t.seu.id, correlationId: randomUUID(), causationEventId: null });
  assert.equal((await workItemsDB.findById(orphan.id)).data?.execution_context, null, "a Command for a Deliverable that does not exist has no execution context");
});
