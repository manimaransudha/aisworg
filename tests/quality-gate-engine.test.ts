// Quality Gate Engine (src/domain/engine/qualityGateEngine.ts): the gates a Transition Definition names by Definition id (evaluateByIds), a criteria
// type the engine does not know, a Waiver, and an SEU that has no EBM yet.
//
//   - Each gate is written for an AttentionItem edge between states that carry the run tag, so it can never match a real transition. Gates and
//     Policies are not deleted, as in the other Quality Gate tests.
//   - The entity under evaluation is a random id. The criteria that read Obligations find none. A gate named by Definition id has the criteria of its
//     Definition alone, so a policy or review gate has no Policy or Review Gate to read.
//   - The Waiver is granted for one gate and one entity, so the other gates are untouched.
import "dotenv/config";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { qualityGateWaiversDB } from "../src/dblayer/qualityGateWaiversDB.js";
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

// A Transition Definition names a gate by the id of its Quality Gate Definition.
const definitionIdOf = (gate: QualityGateRow) => gate.quality_gate_definition_id!;

// The reason of the first Blocked or Waived gate of a decision.
const reasonOf = (d: QualityGateDecision) => (d.blocked[0]?.reason ?? d.waived[0]?.reason);

const input = (overrides: Record<string, unknown> = {}) => ({
  entityType: "AttentionItem" as const, entityId: randomUUID(), seuId: testSeu.seu.id, authorId: testSeu.systemParticipantId, authorBadge: ROOT_ACTOR_BADGE, tenantId: testSeu.seu.tenant_id, ...overrides,
});

test("a policy criteria gate evaluated by Definition id blocks, because a Definition names no Policy", async () => {
  const none = await createGate("policy-none", { type: "requires_active_policy" });
  const noneResult = qualityGateEngine.decideQualityGate(await qualityGateEngine.evaluateByIds([definitionIdOf(none)], input()));
  assert.deepEqual([noneResult.outcome, reasonOf(noneResult)], ["Blocked", "requires_active_policy criteria has no policyIds configured"]);
});

test("a gate id that names no Quality Gate Definition is an error", async () => {
  const unknownId = randomUUID();
  await assert.rejects(() => qualityGateEngine.evaluateByIds([unknownId], input()), new RegExp(`names no Quality Gate Definition for id\\(s\\) ${unknownId}`));
});

test("a gate with a criteria type the Ontology does not know cannot be stored, so the engine never meets one", async () => {
  await assert.rejects(createGate("unknown", { type: `zz-unknown-${run}` }), /is not a canonical quality-gate-criteria-type concept/);
});

test("a Waiver granted for the gate and the entity turns the block into a waived outcome, and leaves another entity blocked", async () => {
  const gate = await createGate("waived", { type: "requires_active_policy" });
  const waivedEntity = randomUUID();
  const { data: waiver, error } = await qualityGateWaiversDB.grant({
    qualityGateId: gate.quality_gate_definition_id!, seuId: testSeu.seu.id, entityType: "AttentionItem", entityId: waivedEntity, rationale: "quality-gate-engine test", grantedBy: ROOT_ACTOR_ID, authorityBadge: ROOT_ACTOR_BADGE,
  });
  assert.ok(waiver && !error, error);

  const waived = qualityGateEngine.decideQualityGate(await qualityGateEngine.evaluateByIds([definitionIdOf(gate)], input({ entityId: waivedEntity })));
  assert.equal(waived.outcome, "Waived");
  assert.equal(reasonOf(waived), "requires_active_policy criteria has no policyIds configured");
  assert.equal((qualityGateEngine.decideQualityGate(await qualityGateEngine.evaluateByIds([definitionIdOf(gate)], input()))).outcome, "Blocked", "another entity has no Waiver");
});

test("an SEU with no EBM has no gates: its gates are the ones its EBM names", async () => {
  const gate = await createGate("no-ebm", { type: "no_unresolved_obligations" });
  assert.equal(testSeu.seu.active_ebm_id, null);
  const edge = { fromState: gate.from_state, toState: gate.to_state };

  assert.equal((qualityGateEngine.decideQualityGate(await qualityGateEngine.evaluate({ ...input(), ...edge }))).outcome, "NotApplicable", "an active gate on the edge is not evaluated without an EBM that names it");
  assert.equal((qualityGateEngine.decideQualityGate(await qualityGateEngine.evaluate({ ...input(), fromState: `zz-no-gate-${run}`, toState: `zz-no-gate-to-${run}` }))).outcome, "NotApplicable", "an edge with no gate");
});

test("evaluating no gates is not applicable, and a review gate with no Review Gate and an evidence gate with nothing to show block", async () => {
  assert.equal(qualityGateEngine.decideQualityGate(await qualityGateEngine.evaluateByIds([], input())).outcome, "NotApplicable");

  const unconfigured = await createGate("review-unconfigured", { type: "requires_accepted_review" });
  const noConfig = qualityGateEngine.decideQualityGate(await qualityGateEngine.evaluateByIds([definitionIdOf(unconfigured)], input()));
  assert.equal(noConfig.outcome, "Blocked");
  assert.equal(reasonOf(noConfig), "requires_accepted_review criteria has no reviewGateId configured");

  const evidence = await createGate("evidence-none", { type: "requires_accepted_evidence_or_approved_decision", evidenceCategory: "Validation Evidence" });
  const noEvidence = qualityGateEngine.decideQualityGate(await qualityGateEngine.evaluateByIds([definitionIdOf(evidence)], input()));
  assert.equal(noEvidence.outcome, "Blocked");
  assert.ok(/no accepted Evidence of category ".*" or approved Decision/.test(reasonOf(noEvidence) ?? ""), JSON.stringify(noEvidence));
});
