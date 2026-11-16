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

import { qualityGateWaiversDB } from "../src/dblayer/qualityGateWaiversDB.js";
import { policiesDB } from "../src/dblayer/policiesDB.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { qualityGateEngine, type QualityGateDecision } from "../src/domain/engine/qualityGateEngine.js";
import type { QualityGateRow } from "../src/dblayer/seuTypes.js";
import { commissionedSeu, type CommissionedSeu } from "./webScenarios.js";
import { ROOT_ACTOR_ID, ROOT_ACTOR_BADGE } from "./testFixtures.js";
import { getTestDevelopmentPack, createGateRowWithDefinition } from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
let packId: string;
let testSeu: CommissionedSeu;

before(async () => {
  const pack = await getTestDevelopmentPack();
  assert.ok(pack, "the development Pack is seeded");
  packId = pack.id;
  testSeu = await commissionedSeu("quality-gate-engine", "unsettled", { conflictSet: "gates" });
});

async function createGate(label: string, criteria: Record<string, unknown>): Promise<QualityGateRow> {
  return createGateRowWithDefinition({
    category: "Exit", code: `qg-test-${randomUUID()}`, name: `quality-gate-engine ${label} ${run}`, entityType: "AttentionItem", fromState: `zz-from-${label}-${run}`, toState: `zz-to-${label}-${run}`,
    criteria, originatingPackId: packId, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
  });
}

async function createPolicy(label: string, condition: Record<string, unknown>) {
  const { data, error } = await policiesDB.upsert({ code: `zz-policy-${label}-${run}`, name: `quality-gate-engine ${label}`, condition, originatingPackId: packId, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE });
  assert.ok(data && !error, error);
  return data;
}

// The reason of the first Blocked or Waived gate of a decision.
const reasonOf = (d: QualityGateDecision) => (d.blocked[0]?.reason ?? d.waived[0]?.reason);

const input = (overrides: Record<string, unknown> = {}) => ({
  entityType: "AttentionItem" as const, entityId: randomUUID(), seuId: testSeu.seu.id, authorId: testSeu.systemParticipantId, authorBadge: ROOT_ACTOR_BADGE, tenantId: testSeu.seu.tenant_id, ...overrides,
});

test("a policy criteria gate blocks when it names no Policy, or a Policy that does not exist", async () => {
  const none = await createGate("policy-none", { type: "requires_active_policy", policyIds: [] });
  const noneResult = qualityGateEngine.decideQualityGate(await qualityGateEngine.evaluateByIds([none.id], input()));
  assert.deepEqual([noneResult.outcome, reasonOf(noneResult)], ["Blocked", "requires_active_policy criteria has no policyIds configured"]);

  const missing = await createGate("policy-missing", { type: "requires_active_policy", policyIds: [randomUUID()] });
  const missingResult = qualityGateEngine.decideQualityGate(await qualityGateEngine.evaluateByIds([missing.id], input()));
  assert.deepEqual([missingResult.outcome, reasonOf(missingResult)], ["Blocked", "one or more referenced Policies do not exist"]);
});

test("a policy criteria gate passes when every Policy holds for the context, and blocks on the first that does not", async () => {
  const holds = await createPolicy("holds", { type: "always_true" });
  const fails = await createPolicy("fails", { type: "field_in", field: "status", values: ["Ready"] });

  const passing = await createGate("policy-pass", { type: "requires_active_policy", policyIds: [holds.id] });
  assert.equal((qualityGateEngine.decideQualityGate(await qualityGateEngine.evaluateByIds([passing.id], input()))).outcome, "Approved");

  const blocking = await createGate("policy-block", { type: "requires_active_policy", policyIds: [holds.id, fails.id] });
  const blocked = qualityGateEngine.decideQualityGate(await qualityGateEngine.evaluateByIds([blocking.id], input({ context: { status: "Draft" } })));
  assert.equal(blocked.outcome, "Blocked");
  assert.equal(reasonOf(blocked), `Policy "${fails.code}" is not satisfied for this entity`);
  assert.equal((qualityGateEngine.decideQualityGate(await qualityGateEngine.evaluateByIds([blocking.id], input({ context: { status: "Ready" } })))).outcome, "Approved", "the context decides");
});

test("a gate with a criteria type the engine does not know blocks", async () => {
  const unknown = await createGate("unknown", { type: `zz-unknown-${run}` });
  const result = qualityGateEngine.decideQualityGate(await qualityGateEngine.evaluateByIds([unknown.id], input()));
  assert.equal(result.outcome, "Blocked");
  assert.equal(reasonOf(result), `unrecognised Quality Gate criteria type: zz-unknown-${run}`);
});

test("a Waiver granted for the gate and the entity turns the block into a waived outcome, and leaves another entity blocked", async () => {
  const gate = await createGate("waived", { type: "requires_active_policy", policyIds: [] });
  const waivedEntity = randomUUID();
  const { data: waiver, error } = await qualityGateWaiversDB.grant({
    qualityGateId: gate.quality_gate_definition_id!, seuId: testSeu.seu.id, entityType: "AttentionItem", entityId: waivedEntity, rationale: "quality-gate-engine test", grantedBy: ROOT_ACTOR_ID, authorityBadge: ROOT_ACTOR_BADGE,
  });
  assert.ok(waiver && !error, error);

  const waived = qualityGateEngine.decideQualityGate(await qualityGateEngine.evaluateByIds([gate.id], input({ entityId: waivedEntity })));
  assert.equal(waived.outcome, "Waived");
  assert.equal(reasonOf(waived), "requires_active_policy criteria has no policyIds configured");
  assert.equal((qualityGateEngine.decideQualityGate(await qualityGateEngine.evaluateByIds([gate.id], input()))).outcome, "Blocked", "another entity has no Waiver");
});

test("an SEU with no EBM has no gates: its gates are the ones its EBM names", async () => {
  const gate = await createGate("no-ebm", { type: "no_unresolved_obligations" });
  assert.equal(testSeu.seu.active_ebm_id, null);
  const edge = { fromState: gate.from_state, toState: gate.to_state };

  assert.equal((qualityGateEngine.decideQualityGate(await qualityGateEngine.evaluate({ ...input(), ...edge }))).outcome, "NotApplicable", "an active gate on the edge is not evaluated without an EBM that names it");
  assert.equal((qualityGateEngine.decideQualityGate(await qualityGateEngine.evaluate({ ...input(), fromState: `zz-no-gate-${run}`, toState: `zz-no-gate-to-${run}` }))).outcome, "NotApplicable", "an edge with no gate");
});

test("evaluating no gates is not applicable, and a review or evidence gate with nothing to show blocks", async () => {
  assert.equal(qualityGateEngine.decideQualityGate(await qualityGateEngine.evaluateByIds([], input())).outcome, "NotApplicable");

  const unconfigured = await createGate("review-unconfigured", { type: "requires_accepted_review" });
  const noConfig = qualityGateEngine.decideQualityGate(await qualityGateEngine.evaluateByIds([unconfigured.id], input()));
  assert.equal(noConfig.outcome, "Blocked");
  assert.equal(reasonOf(noConfig), "requires_accepted_review criteria has no reviewGateId configured");

  const noReview = await createGate("review-none", { type: "requires_accepted_review", reviewGateId: randomUUID() });
  const missing = qualityGateEngine.decideQualityGate(await qualityGateEngine.evaluateByIds([noReview.id], input()));
  assert.equal(missing.outcome, "Blocked");
  assert.equal(reasonOf(missing), "no Accepted, passing Review found for this entity against the required Review Gate");

  const evidence = await createGate("evidence-none", { type: "requires_accepted_evidence_or_approved_decision", evidenceCategory: "Validation Evidence" });
  const noEvidence = qualityGateEngine.decideQualityGate(await qualityGateEngine.evaluateByIds([evidence.id], input()));
  assert.equal(noEvidence.outcome, "Blocked");
  assert.ok(/no accepted Evidence of category ".*" or approved Decision/.test(reasonOf(noEvidence) ?? ""), JSON.stringify(noEvidence));
});
