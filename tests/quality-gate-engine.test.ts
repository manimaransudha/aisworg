// Quality Gate Engine (src/domain/engine/qualityGateEngine.ts): the policy criteria, a criteria type the engine does not know, a Waiver, and an SEU
// that has no EBM yet.
//
//   - Each gate is written for an AttentionItem edge between states that carry the run tag, so it can never match a real transition. Gates and
//     Policies are not deleted, as in the other Quality Gate tests.
//   - The entity under evaluation is a random id. The criteria that read Obligations find none, and the policy criteria read the context given.
//   - The Waiver is granted for one gate and one entity, so the other gates are untouched.
import "dotenv/config";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { qualityGatesDB } from "../src/dblayer/qualityGatesDB.js";
import { qualityGateWaiversDB } from "../src/dblayer/qualityGateWaiversDB.js";
import { policiesDB } from "../src/dblayer/policiesDB.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { qualityGateEngine } from "../src/domain/engine/qualityGateEngine.js";
import type { QualityGateRow } from "../src/dblayer/seuTypes.js";
import { createTestSeu, type TestSeu } from "./engineFixtures.js";
import { ROOT_ACTOR_ID, ROOT_ACTOR_BADGE } from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
let packId: string;
let testSeu: TestSeu;

before(async () => {
  const { data: pack } = await packsDB.findByCode("development");
  assert.ok(pack, "the development Pack is seeded");
  packId = pack.id;
  testSeu = await createTestSeu("quality-gate-engine");
});

async function createGate(label: string, criteria: Record<string, unknown>): Promise<QualityGateRow> {
  const { data, error } = await qualityGatesDB.upsert({
    name: `quality-gate-engine ${label} ${run}`, entityType: "AttentionItem", fromState: `zz-from-${label}-${run}`, toState: `zz-to-${label}-${run}`,
    criteria, originatingPackId: packId, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
  });
  assert.ok(data && !error, error?.message);
  return data;
}

async function createPolicy(label: string, condition: Record<string, unknown>) {
  const { data, error } = await policiesDB.upsert({ code: `zz-policy-${label}-${run}`, name: `quality-gate-engine ${label}`, condition, originatingPackId: packId, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE });
  assert.ok(data && !error, error?.message);
  return data;
}

const input = (overrides: Record<string, unknown> = {}) => ({
  entityType: "AttentionItem" as const, entityId: randomUUID(), seuId: testSeu.seu.id, authorId: testSeu.systemParticipantId, authorBadge: ROOT_ACTOR_BADGE, tenantId: testSeu.seu.tenant_id, ...overrides,
});

test("a policy criteria gate blocks when it names no Policy, or a Policy that does not exist", async () => {
  const none = await createGate("policy-none", { type: "requires_active_policy", policyIds: [] });
  const noneResult = await qualityGateEngine.evaluateByIds([none.id], input());
  assert.deepEqual([noneResult.outcome, "reason" in noneResult && noneResult.reason], ["Blocked", "requires_active_policy criteria has no policyIds configured"]);

  const missing = await createGate("policy-missing", { type: "requires_active_policy", policyIds: [randomUUID()] });
  const missingResult = await qualityGateEngine.evaluateByIds([missing.id], input());
  assert.deepEqual([missingResult.outcome, "reason" in missingResult && missingResult.reason], ["Blocked", "one or more referenced Policies do not exist"]);
});

test("a policy criteria gate passes when every Policy holds for the context, and blocks on the first that does not", async () => {
  const holds = await createPolicy("holds", { type: "always_true" });
  const fails = await createPolicy("fails", { type: "field_in", field: "status", values: ["Ready"] });

  const passing = await createGate("policy-pass", { type: "requires_active_policy", policyIds: [holds.id] });
  assert.equal((await qualityGateEngine.evaluateByIds([passing.id], input())).outcome, "Passed");

  const blocking = await createGate("policy-block", { type: "requires_active_policy", policyIds: [holds.id, fails.id] });
  const blocked = await qualityGateEngine.evaluateByIds([blocking.id], input({ context: { status: "Draft" } }));
  assert.equal(blocked.outcome, "Blocked");
  assert.equal("reason" in blocked && blocked.reason, `Policy "${fails.code}" is not satisfied for this entity`);
  assert.equal((await qualityGateEngine.evaluateByIds([blocking.id], input({ context: { status: "Ready" } }))).outcome, "Passed", "the context decides");
});

test("a gate with a criteria type the engine does not know blocks", async () => {
  const unknown = await createGate("unknown", { type: `zz-unknown-${run}` });
  const result = await qualityGateEngine.evaluateByIds([unknown.id], input());
  assert.equal(result.outcome, "Blocked");
  assert.equal("reason" in result && result.reason, `unrecognised Quality Gate criteria type: zz-unknown-${run}`);
});

test("a Waiver granted for the gate and the entity turns the block into a waived outcome, and leaves another entity blocked", async () => {
  const gate = await createGate("waived", { type: "requires_active_policy", policyIds: [] });
  const waivedEntity = randomUUID();
  const { data: waiver, error } = await qualityGateWaiversDB.grant({
    qualityGateId: gate.id, seuId: testSeu.seu.id, entityType: "AttentionItem", entityId: waivedEntity, rationale: "quality-gate-engine test", grantedBy: ROOT_ACTOR_ID, authorityBadge: ROOT_ACTOR_BADGE,
  });
  assert.ok(waiver && !error, error?.message);

  const waived = await qualityGateEngine.evaluateByIds([gate.id], input({ entityId: waivedEntity }));
  assert.equal(waived.outcome, "Waived");
  assert.equal("reason" in waived && waived.reason, "requires_active_policy criteria has no policyIds configured");
  assert.equal((await qualityGateEngine.evaluateByIds([gate.id], input())).outcome, "Blocked", "another entity has no Waiver");
});

test("an SEU with no EBM evaluates the active gates of the edge", async () => {
  const gate = await createGate("no-ebm", { type: "no_unresolved_obligations" });
  assert.equal(testSeu.seu.active_ebm_id, null);
  const edge = { fromState: gate.from_state, toState: gate.to_state };

  assert.equal((await qualityGateEngine.evaluate({ ...input(), ...edge })).outcome, "Passed");
  assert.equal((await qualityGateEngine.evaluate({ ...input(), fromState: `zz-no-gate-${run}`, toState: `zz-no-gate-to-${run}` })).outcome, "NotApplicable", "an edge with no gate");
});
