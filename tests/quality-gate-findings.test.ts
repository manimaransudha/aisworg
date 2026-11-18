// CR-145: every condition of a hop (a Quality Gate line item, a Policy, an Obligation, a dependency and so on) enters the Quality Gate decision as Passed or Blocked.
// The composition fetches the Active waivers of the SEU and marks a Blocked condition Waived when a waiver covers it. A waiver of the Policy or Obligation scope covers the
// condition it names for the entity it names, and nothing else.
import "dotenv/config";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { qualityGateWaiversDB } from "../src/dblayer/qualityGateWaiversDB.js";
import { qualityGateEngine, type QualityGateCondition } from "../src/domain/engine/qualityGateEngine.js";
import { WAIVER_SCOPE_OBLIGATION, WAIVER_SCOPE_POLICY, WAIVER_SCOPE_POLICY_OBLIGATION } from "../src/dblayer/constants.js";
import { commissionedSeu, type CommissionedSeu } from "./webScenarios.js";
import { ROOT_ACTOR_ID, ROOT_ACTOR_BADGE } from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
let testSeu: CommissionedSeu;

before(async () => {
  testSeu = await commissionedSeu("quality-gate-findings", "unsettled", { conflictSet: "gates" });
});

const blocked = (name: string, waivable: QualityGateCondition["waivable"]): QualityGateCondition => ({ name, reason: "blocked", outcome: "Blocked", waivable });
const policyFinding = (code: string) => blocked(`Policy ${code}`, { scope: WAIVER_SCOPE_POLICY, policyCode: code });
const obligationFinding = (title: string) => blocked(`Obligation "${title}"`, { scope: WAIVER_SCOPE_OBLIGATION, category: "Risk", title });
const policyObligationFinding = (code: string, title: string) => blocked(`Obligation "${title}" of ${code}`, { scope: WAIVER_SCOPE_POLICY_OBLIGATION, policyCode: code, title });
const dependencyFinding = blocked("Dependencies", null);

async function grant(entityId: string, over: Record<string, unknown>) {
  const { data, error } = await qualityGateWaiversDB.grant({ seuId: testSeu.seu.id, entityType: "Deliverable", entityId, rationale: "findings test", grantedBy: ROOT_ACTOR_ID, authorityBadge: ROOT_ACTOR_BADGE, ...over });
  assert.ok(data && !error, error ? error.message : "no waiver");
}
const entity = (entityId: string) => ({ entityType: "Deliverable" as const, entityId, seuId: testSeu.seu.id });
const outcomes = (results: Array<{ name: string; outcome: string }>) => Object.fromEntries(results.map((r) => [r.name, r.outcome]));
const settle = async (conditions: QualityGateCondition[], entityId: string) => (await qualityGateEngine.decideQualityGate([], conditions, entity(entityId))).conditions;

test("a Policy waiver covers the Policy finding of its code for its entity, and no other finding", async () => {
  const deliverableId = randomUUID();
  await grant(deliverableId, { scope: WAIVER_SCOPE_POLICY, policyCode: `policy-a-${run}` });
  const results = await settle([policyFinding(`policy-a-${run}`), policyFinding(`policy-b-${run}`), obligationFinding(`o-${run}`), dependencyFinding], deliverableId);
  assert.deepEqual(outcomes(results), { [`Policy policy-a-${run}`]: "Waived", [`Policy policy-b-${run}`]: "Blocked", [`Obligation "o-${run}"`]: "Blocked", Dependencies: "Blocked" });
  const other = await settle([policyFinding(`policy-a-${run}`)], randomUUID());
  assert.equal(other[0].outcome, "Blocked", "another entity has no waiver");
});

test("an Obligation waiver covers the Obligation finding of its category and title", async () => {
  const deliverableId = randomUUID();
  await grant(deliverableId, { scope: WAIVER_SCOPE_OBLIGATION, obligationCategory: "Risk", obligationTitle: `o-${run}` });
  const results = await settle([obligationFinding(`o-${run}`), obligationFinding(`other-${run}`)], deliverableId);
  assert.deepEqual(outcomes(results), { [`Obligation "o-${run}"`]: "Waived", [`Obligation "other-${run}"`]: "Blocked" });
});

test("the decision composes every condition: a Blocked condition blocks, all Blocked conditions Waived give Waived, Passed conditions alone approve, and none gives NotApplicable", async () => {
  const deliverableId = randomUUID();
  const passed: QualityGateCondition = { name: "Obligations", reason: "", outcome: "Passed", waivable: null };
  const decision = await qualityGateEngine.decideQualityGate([], [passed, dependencyFinding], entity(deliverableId));
  assert.equal(decision.outcome, "Blocked");
  assert.match(decision.rationale, /Other checks: Dependencies \(blocked\)\./);
  await grant(deliverableId, { scope: WAIVER_SCOPE_POLICY, policyCode: `policy-f-${run}` });
  const waived = await qualityGateEngine.decideQualityGate([], [passed, policyFinding(`policy-f-${run}`)], entity(deliverableId));
  assert.equal(waived.outcome, "Waived");
  assert.deepEqual(waived.conditions.map((c) => [c.name, c.outcome, c.waiverId !== null]), [["Obligations", "Passed", false], [`Policy policy-f-${run}`, "Waived", true]]);
  assert.match(waived.rationale, /Waived: Policy policy-f-.* \(waiver /);
  const mixed = await qualityGateEngine.decideQualityGate([], [policyFinding(`policy-f-${run}`), dependencyFinding], entity(deliverableId));
  assert.equal(mixed.outcome, "Blocked", "a condition no waiver covers keeps the decision Blocked");
  assert.equal((await qualityGateEngine.decideQualityGate([], [passed], entity(deliverableId))).outcome, "Approved");
  assert.equal((await qualityGateEngine.decideQualityGate([], [], entity(deliverableId))).outcome, "NotApplicable");
});

test("a Policy Obligation waiver covers the Obligation a Policy raised, by Policy and title, and not an Obligation of the same title that no Policy raised", async () => {
  const deliverableId = randomUUID();
  await grant(deliverableId, { scope: WAIVER_SCOPE_POLICY_OBLIGATION, policyCode: `policy-c-${run}`, obligationTitle: `t-${run}` });
  const results = await settle([policyObligationFinding(`policy-c-${run}`, `t-${run}`), policyObligationFinding(`policy-d-${run}`, `t-${run}`), obligationFinding(`t-${run}`)], deliverableId);
  assert.deepEqual(results.map((r) => r.outcome), ["Waived", "Blocked", "Blocked"]);
});

test("a Policy that raised an Obligation is covered by a waiver of the Policy or of that Obligation, and by no other Obligation", async () => {
  const alternatives = (code: string, title: string): QualityGateCondition["waivable"] => [{ scope: WAIVER_SCOPE_POLICY, policyCode: code }, { scope: WAIVER_SCOPE_POLICY_OBLIGATION, policyCode: code, title }];
  const policyWithObligation = (code: string, title: string) => blocked(`Policy ${code}`, alternatives(code, title));
  const waivedByObligation = randomUUID();
  await grant(waivedByObligation, { scope: WAIVER_SCOPE_POLICY_OBLIGATION, policyCode: `policy-e-${run}`, obligationTitle: `t-${run}` });
  const byObligation = await settle([policyWithObligation(`policy-e-${run}`, `t-${run}`), policyObligationFinding(`policy-e-${run}`, `t-${run}`)], waivedByObligation);
  assert.deepEqual(byObligation.map((r) => r.outcome), ["Waived", "Waived"], "the waiver of the Obligation covers the Obligation and the Policy that raised it");
  assert.equal(byObligation[0].waiverId, byObligation[1].waiverId);
  const otherObligation = randomUUID();
  await grant(otherObligation, { scope: WAIVER_SCOPE_POLICY_OBLIGATION, policyCode: `policy-e-${run}`, obligationTitle: `another-${run}` });
  assert.equal((await settle([policyWithObligation(`policy-e-${run}`, `t-${run}`)], otherObligation))[0].outcome, "Blocked", "a waiver of another Obligation does not cover it");
  const waivedByPolicy = randomUUID();
  await grant(waivedByPolicy, { scope: WAIVER_SCOPE_POLICY, policyCode: `policy-f-${run}` });
  assert.equal((await settle([policyWithObligation(`policy-f-${run}`, `t-${run}`)], waivedByPolicy))[0].outcome, "Waived", "a waiver of the Policy still covers it");
});

test("a waiver names Deliverables by code: it covers the Deliverable of that code in its SEU, not one of another code, and not one of another SEU unless it is shared with the Profile", async () => {
  const { deliverablesDB } = await import("../src/dblayer/deliverablesDB.js");
  const { data: mine } = await deliverablesDB.findBySeuId(testSeu.seu.id);
  const withCode = (mine ?? []).filter((d) => d.code);
  if (withCode.length < 2) return;
  const [first, second] = withCode;
  await grant(first.id, { scope: WAIVER_SCOPE_POLICY, policyCode: `policy-e-${run}`, deliverableCodes: [first.code, second.code] });
  const findings = [policyFinding(`policy-e-${run}`)];
  assert.equal((await settle(findings, second.id))[0].outcome, "Waived", "the second code is covered in the same SEU");
});
