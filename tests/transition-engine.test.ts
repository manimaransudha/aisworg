// Transition Engine (src/domain/engine/transitionEngine.ts) and the submission trigger (triggerEngine.ts): the branches a seeded Transition
// Definition does not reach.
//
//   - The test writes its own AttentionItem edges between states that carry the run tag, so no real AttentionItem transition is touched. The
//     edges are deleted when the file ends.
//   - An edge with no verb is ungoverned: it resolves no authority badge. An edge with a submit verb needs the entity to have been submitted
//     first, which is an event named after the entity type and the from-state. No seeded edge has a submit verb, so the test sets it on its own edge.
//   - A Quality Gate on an edge with no verb is refused loudly, because the gate's records need a badge.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { transitionDefinitionsDB, reloadIfLoaded } from "../src/dblayer/transitionDefinitionsDB.js";
import { qualityGatesDB } from "../src/dblayer/qualityGatesDB.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { transitionEngine } from "../src/domain/engine/transitionEngine.js";
import { triggerEngine } from "../src/domain/engine/triggerEngine.js";
import { eventBus } from "../src/domain/engine/eventBus.js";
import { createTestSeu } from "./engineFixtures.js";
import { ROOT_ACTOR_ID, ROOT_ACTOR_BADGE } from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
const state = (name: string) => `zz-${name}-${run}`;
const edges: Array<[string, string]> = [];

async function addEdge(from: string, to: string, fields: { requiredQualityGateIds?: string[]; requiredPolicyIds?: string[]; verb?: string | null; versionEvent?: string | null } = {}): Promise<void> {
  const { error } = await transitionDefinitionsDB.upsert({ entityType: "AttentionItem", fromState: from, toState: to, ...fields });
  assert.ok(!error, error?.message);
  edges.push([from, to]);
}

after(async () => {
  for (const [from, to] of edges) await pool.query("DELETE FROM transition_definitions WHERE entity_type = 'AttentionItem' AND from_state = $1 AND to_state = $2", [from, to]);
  await reloadIfLoaded();
});

test("an edge with no verb is ungoverned: it is allowed and resolves no authority badge", async () => {
  const from = state("open-a");
  const to = state("done-a");
  await addEdge(from, to);

  const authorised = await transitionEngine.authorise({ entityType: "AttentionItem", fromState: from, toState: to, actorId: ROOT_ACTOR_ID });
  assert.ok(authorised.allowed);
  assert.equal(authorised.authorityBadge, null);

  const outcome = await transitionEngine.evaluate({ entityType: "AttentionItem", fromState: from, toState: to, actorId: ROOT_ACTOR_ID });
  assert.ok(outcome.allowed);
  assert.deepEqual([outcome.authorityBadge, outcome.eventType, outcome.nextVersion], [null, null, null]);

  const missing = await transitionEngine.evaluate({ entityType: "AttentionItem", fromState: from, toState: state("nowhere"), actorId: ROOT_ACTOR_ID });
  assert.deepEqual(missing, { allowed: false, reason: "no_transition_definition" });
});

test("an edge with a submit verb is refused until the entity has been submitted, and then allowed", async () => {
  const from = state("open-b");
  const to = state("done-b");
  await addEdge(from, to);
  const { rows } = await pool.query<{ verb: string }>("SELECT verb FROM transition_definitions WHERE entity_type = 'AttentionItem' AND verb IS NOT NULL LIMIT 1");
  assert.ok(rows[0], "a seeded AttentionItem edge names a verb");
  await pool.query("UPDATE transition_definitions SET submit_verb = $3 WHERE entity_type = 'AttentionItem' AND from_state = $1 AND to_state = $2", [from, to, rows[0].verb]);
  await reloadIfLoaded();

  const entityId = randomUUID();
  const input = { entityType: "AttentionItem" as const, fromState: from, toState: to, actorId: ROOT_ACTOR_ID, entityId };
  const refused = await transitionEngine.evaluate(input);
  assert.deepEqual(refused, { allowed: false, reason: "not_submitted", submitBadge: `attentionitem_${rows[0].verb}` });
  assert.equal((await transitionEngine.evaluate({ ...input, entityId: undefined })).allowed, false, "an entity with no id has not been submitted");
  assert.equal(await triggerEngine.hasBeenSubmitted("AttentionItem", entityId, from), false);

  await eventBus.publish({
    eventType: `AttentionItem${from}`, originatingObjectType: "AttentionItem", originatingObjectId: entityId, seuId: null,
    correlationId: randomUUID(), actorId: ROOT_ACTOR_ID, authorityBadge: ROOT_ACTOR_BADGE,
  });
  assert.equal(await triggerEngine.hasBeenSubmitted("AttentionItem", entityId, from), true);
  assert.equal((await transitionEngine.evaluate(input)).allowed, true);
});

test("a Quality Gate on an edge with no verb is refused with an error, because the gate's records need a badge", async () => {
  const { data: pack } = await packsDB.findByCode("development");
  assert.ok(pack, "the development Pack is seeded");
  const { data: gate, error } = await qualityGatesDB.upsert({
    name: `transition-engine gate ${run}`, entityType: "AttentionItem", fromState: state("open-c"), toState: state("done-c"),
    criteria: { type: "no_unresolved_obligations" }, originatingPackId: pack.id, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
  });
  assert.ok(gate && !error, error?.message);
  await addEdge(state("open-c"), state("done-c"), { requiredQualityGateIds: [gate.id] });

  const { seu } = await createTestSeu("transition-engine-gate");
  await assert.rejects(
    () => transitionEngine.evaluate({ entityType: "AttentionItem", fromState: state("open-c"), toState: state("done-c"), actorId: ROOT_ACTOR_ID, entityId: randomUUID(), seuId: seu.id }),
    /requires a resolved authority badge, but this transition is ungoverned/
  );
});

// ── Branches the first tests do not reach ─────────────────────────────────────────────────────────────────────────

import { gateRejection, type RejectedOutcome } from "../src/domain/engine/transitionEngine.js";
import { nextActionsFor } from "../src/domain/engine/entityTransition.js";
import { policiesDB } from "../src/dblayer/policiesDB.js";
import { participantsMasterDB } from "../src/dblayer/participantsMasterDB.js";
import { COMMENT_REQUIRED_POLICY_CODE } from "../src/dblayer/constants.js";
import { PLATFORM_TENANT_ID } from "./testFixtures.js";

async function seededVerb(): Promise<string> {
  const { rows } = await pool.query<{ verb: string }>("SELECT verb FROM transition_definitions WHERE entity_type = 'AttentionItem' AND verb IS NOT NULL LIMIT 1");
  assert.ok(rows[0], "a seeded AttentionItem edge names a verb");
  return rows[0].verb;
}

test("every rejected outcome maps to the result a transition function returns", () => {
  const rejected = (outcome: RejectedOutcome) => gateRejection(outcome, "Widget", "A", "B");
  assert.deepEqual(rejected({ allowed: false, reason: "no_transition_definition" }), { ok: false, reason: "no_transition_definition", detail: "no Transition Definition for Widget A -> B" });
  assert.deepEqual(rejected({ allowed: false, reason: "quality_gate_blocked", gateCode: "g", gateName: "Gate", detail: "why" }), { ok: false, reason: "quality_gate_blocked", detail: 'Quality Gate "Gate" blocked: why' });
  assert.deepEqual(rejected({ allowed: false, reason: "not_submitted", submitBadge: "widget_submit" }), { ok: false, reason: "not_submitted", detail: "must be submitted first (requires badge widget_submit)" });
  assert.deepEqual(rejected({ allowed: false, reason: "policy_blocked", policyCode: "p" }), { ok: false, reason: "policy_blocked", detail: "blocked by policy p", policyCode: "p" });
});

test("an edge that requires Policies but declares no verb is an error, because the Policy events need a badge", async () => {
  const from = state("open-d");
  const to = state("done-d");
  await addEdge(from, to, { requiredPolicyIds: [randomUUID()] });
  await assert.rejects(() => transitionEngine.evaluate({ entityType: "AttentionItem", fromState: from, toState: to, actorId: ROOT_ACTOR_ID }), /requires policies but declares no verb/);
});

test("an implemented Policy is decided by its function: satisfied by a comment, blocked without one, and an unknown implementation is an error", async () => {
  const { data: pack } = await packsDB.findByCode("development");
  assert.ok(pack);
  const createPolicy = async (code: string) => {
    const { data, error } = await policiesDB.upsert({
      code, name: `transition-engine ${code}`, constraintType: "Policy", scope: "Transition", governedTransition: null, condition: { type: "implemented" },
      originatingPackId: pack.id, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
    });
    assert.ok(data && !error, error?.message);
    return data;
  };
  const verb = await seededVerb();
  const commentPolicy = await createPolicy(`${COMMENT_REQUIRED_POLICY_CODE}::zz-${run}`);
  const from = state("open-e");
  const to = state("done-e");
  await addEdge(from, to, { requiredPolicyIds: [commentPolicy.id], verb });
  const input = { entityType: "AttentionItem" as const, fromState: from, toState: to, actorId: ROOT_ACTOR_ID };

  assert.equal((await transitionEngine.evaluate({ ...input, context: { comment: "because" } })).allowed, true);
  const blocked = await transitionEngine.evaluate(input);
  assert.deepEqual(blocked, { allowed: false, reason: "policy_blocked", policyCode: commentPolicy.code });

  const unknown = await createPolicy(`zz-no-implementation-${run}`);
  const unknownFrom = state("open-f");
  const unknownTo = state("done-f");
  await addEdge(unknownFrom, unknownTo, { requiredPolicyIds: [unknown.id], verb });
  await assert.rejects(() => transitionEngine.evaluate({ ...input, fromState: unknownFrom, toState: unknownTo }), /has an implemented condition and no implementation/);
});

test("an edge with a version event moves the version on only when the entity's current version is given", async () => {
  const from = state("open-g");
  const to = state("done-g");
  await addEdge(from, to, { versionEvent: "VersionCreated" });
  const input = { entityType: "AttentionItem" as const, fromState: from, toState: to, actorId: ROOT_ACTOR_ID };
  const withVersion = await transitionEngine.evaluate({ ...input, currentVersion: "1.0.0" });
  assert.ok(withVersion.allowed);
  assert.deepEqual([withVersion.versionEvent, withVersion.nextVersion], ["VersionCreated", "1.0.1"]);
  const without = await transitionEngine.evaluate(input);
  assert.ok(without.allowed);
  assert.equal(without.nextVersion, null);
});

test("governed evaluation refuses an edge with no verb, and an actor who is not a Participant of the SEU", async () => {
  const noVerbFrom = state("open-h");
  const noVerbTo = state("done-h");
  await addEdge(noVerbFrom, noVerbTo);
  const { seu } = await createTestSeu("transition-engine-governed");
  await assert.rejects(
    () => transitionEngine.evaluateGoverned({ entityType: "AttentionItem", fromState: noVerbFrom, toState: noVerbTo, actorId: ROOT_ACTOR_ID, gateEntityId: randomUUID(), gateSeuId: seu.id }),
    /declares no verb/
  );

  const verb = await seededVerb();
  const from = state("open-i");
  const to = state("done-i");
  await addEdge(from, to, { verb });
  const stranger = await createTestSeu("transition-engine-stranger", undefined, { rootParticipant: false });
  await assert.rejects(
    () => transitionEngine.evaluateGoverned({ entityType: "AttentionItem", fromState: from, toState: to, actorId: ROOT_ACTOR_ID, gateEntityId: randomUUID(), gateSeuId: stranger.seu.id }),
    /No participants row for participants_master/
  );
});

test("the manual next actions of a state list the hops whose badge the actor holds, with no Policy to read when the state has none", async () => {
  const verb = await seededVerb();
  const from = state("open-j");
  const to = state("done-j");
  await addEdge(from, to, { verb });

  assert.deepEqual(await nextActionsFor("AttentionItem", from, ROOT_ACTOR_ID), [{ toState: to, verb, requiresComment: false, actionCode: null }]);

  const { data: nobody } = await participantsMasterDB.create({ tenantId: PLATFORM_TENANT_ID, type: "Human", displayName: `transition-engine nobody ${run}`, userId: null });
  assert.ok(nobody);
  assert.deepEqual(await nextActionsFor("AttentionItem", from, nobody.id), [], "an actor with no badge is offered nothing");
});
