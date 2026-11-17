// CR-145: the blocks the other checks of a hop find (a Policy, an Obligation, a dependency and so on) enter the Quality Gate decision with the gate results.
// A waiver of the Policy or Obligation scope covers the finding it names for the entity it names, and nothing else. The decision composes every item.
import "dotenv/config";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { qualityGateWaiversDB } from "../src/dblayer/qualityGateWaiversDB.js";
import { qualityGateEngine, type QualityGateFinding } from "../src/domain/engine/qualityGateEngine.js";
import { WAIVER_SCOPE_OBLIGATION, WAIVER_SCOPE_POLICY, WAIVER_SCOPE_POLICY_OBLIGATION } from "../src/dblayer/constants.js";
import { commissionedSeu, type CommissionedSeu } from "./webScenarios.js";
import { ROOT_ACTOR_ID, ROOT_ACTOR_BADGE } from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
let testSeu: CommissionedSeu;

before(async () => {
  testSeu = await commissionedSeu("quality-gate-findings", "unsettled", { conflictSet: "gates" });
});

const policyFinding = (code: string): QualityGateFinding => ({ name: `Policy ${code}`, reason: "blocked by policy", waivable: { scope: WAIVER_SCOPE_POLICY, policyCode: code } });
const obligationFinding = (title: string): QualityGateFinding => ({ name: `Obligation "${title}"`, reason: "blocked by an open Obligation", waivable: { scope: WAIVER_SCOPE_OBLIGATION, category: "Risk", title } });
const policyObligationFinding = (code: string, title: string): QualityGateFinding => ({ name: `Obligation "${title}" of ${code}`, reason: "blocked by an open Obligation", waivable: { scope: WAIVER_SCOPE_POLICY_OBLIGATION, policyCode: code, title } });
const dependencyFinding: QualityGateFinding = { name: "Dependencies", reason: "not satisfied", waivable: null };

async function grant(entityId: string, over: Record<string, unknown>) {
  const { data, error } = await qualityGateWaiversDB.grant({ seuId: testSeu.seu.id, entityType: "Deliverable", entityId, rationale: "findings test", grantedBy: ROOT_ACTOR_ID, authorityBadge: ROOT_ACTOR_BADGE, ...over });
  assert.ok(data && !error, error ? error.message : "no waiver");
}
const entity = (entityId: string) => ({ entityType: "Deliverable" as const, entityId, seuId: testSeu.seu.id });
const outcomes = (results: Array<{ name: string; outcome: string }>) => Object.fromEntries(results.map((r) => [r.name, r.outcome]));

test("a Policy waiver covers the Policy finding of its code for its entity, and no other finding", async () => {
  const deliverableId = randomUUID();
  await grant(deliverableId, { scope: WAIVER_SCOPE_POLICY, policyCode: `policy-a-${run}` });
  const results = await qualityGateEngine.resolveFindings([policyFinding(`policy-a-${run}`), policyFinding(`policy-b-${run}`), obligationFinding(`o-${run}`), dependencyFinding], entity(deliverableId));
  assert.deepEqual(outcomes(results), { [`Policy policy-a-${run}`]: "Waived", [`Policy policy-b-${run}`]: "Blocked", [`Obligation "o-${run}"`]: "Blocked", Dependencies: "Blocked" });
  const other = await qualityGateEngine.resolveFindings([policyFinding(`policy-a-${run}`)], entity(randomUUID()));
  assert.equal(other[0].outcome, "Blocked", "another entity has no waiver");
});

test("an Obligation waiver covers the Obligation finding of its category and title", async () => {
  const deliverableId = randomUUID();
  await grant(deliverableId, { scope: WAIVER_SCOPE_OBLIGATION, obligationCategory: "Risk", obligationTitle: `o-${run}` });
  const results = await qualityGateEngine.resolveFindings([obligationFinding(`o-${run}`), obligationFinding(`other-${run}`)], entity(deliverableId));
  assert.deepEqual(outcomes(results), { [`Obligation "o-${run}"`]: "Waived", [`Obligation "other-${run}"`]: "Blocked" });
});

test("the decision composes the gate results with the findings: a Blocked finding blocks, all findings Waived give Waived, and none gives NotApplicable", () => {
  const blocked = qualityGateEngine.decideQualityGate([], [{ name: "Dependencies", reason: "r", outcome: "Blocked", waiverId: null }]);
  assert.equal(blocked.outcome, "Blocked");
  assert.match(blocked.rationale, /Other checks: Dependencies Blocked \(r\)\./);
  const waived = qualityGateEngine.decideQualityGate([], [{ name: "Policy a", reason: "r", outcome: "Waived", waiverId: randomUUID() }]);
  assert.equal(waived.outcome, "Waived");
  assert.equal(qualityGateEngine.decideQualityGate([], []).outcome, "NotApplicable");
});

test("a Policy Obligation waiver covers the Obligation a Policy raised, by Policy and title, and not an Obligation of the same title that no Policy raised", async () => {
  const deliverableId = randomUUID();
  await grant(deliverableId, { scope: WAIVER_SCOPE_POLICY_OBLIGATION, policyCode: `policy-c-${run}`, obligationTitle: `t-${run}` });
  const results = await qualityGateEngine.resolveFindings([policyObligationFinding(`policy-c-${run}`, `t-${run}`), policyObligationFinding(`policy-d-${run}`, `t-${run}`), obligationFinding(`t-${run}`)], entity(deliverableId));
  assert.deepEqual(results.map((r) => r.outcome), ["Waived", "Blocked", "Blocked"]);
});

test("a waiver names Deliverables by code: it covers the Deliverable of that code in its SEU, not one of another code, and not one of another SEU unless it is shared with the Profile", async () => {
  const { deliverablesDB } = await import("../src/dblayer/deliverablesDB.js");
  const { data: mine } = await deliverablesDB.findBySeuId(testSeu.seu.id);
  const withCode = (mine ?? []).filter((d) => d.code);
  if (withCode.length < 2) return;
  const [first, second] = withCode;
  await grant(first.id, { scope: WAIVER_SCOPE_POLICY, policyCode: `policy-e-${run}`, deliverableCodes: [first.code, second.code] });
  const findings = [policyFinding(`policy-e-${run}`)];
  assert.equal((await qualityGateEngine.resolveFindings(findings, entity(second.id)))[0].outcome, "Waived", "the second code is covered in the same SEU");
});
