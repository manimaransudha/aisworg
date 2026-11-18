// CR-145: the risks a Quality Gate waiver accepts and the controls that offset them. A risk is a text. It has one or more controls: Expiry (the default),
// an Obligation raised from the risk, or Accept risk. An Obligation control names where the Obligation is raised and carries the risk as its originating entity.
import "dotenv/config";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { qualityGateWaiverRisksDB } from "../src/dblayer/qualityGateWaiverRisksDB.js";
import { obligationsDB } from "../src/dblayer/obligationsDB.js";
import { grantQualityGateWaiver } from "../src/routes/seu/core/qualityGateWaivers.js";
import { rateGateWaivers } from "../src/domain/engine/waiverConfidence.js";
import { evidenceDB } from "../src/dblayer/evidenceDB.js";
import { WAIVER_CONTROL_ACCEPT_RISK, WAIVER_CONTROL_EXPIRY, WAIVER_CONTROL_OBLIGATION, WAIVER_RISK_ENTITY_TYPE, WAIVER_RISK_OBLIGATION_CATEGORY, WAIVER_SCOPE_POLICY } from "../src/dblayer/constants.js";
import { commissionedSeu, type CommissionedSeu } from "./webScenarios.js";
import { ROOT_ACTOR_ID, ROOT_ACTOR_BADGE, createGateRowWithDefinition, createEvidenceAsRoot, ensureActorParticipant, getTestDevelopmentPack } from "./testFixtures.js";

const run = randomUUID().slice(0, 8);
let testSeu: CommissionedSeu;
let gateDefinitionId: string;

before(async () => {
  const pack = await getTestDevelopmentPack();
  assert.ok(pack, "the development Pack is seeded");
  testSeu = await commissionedSeu("quality-gate-waiver-risks", "unsettled", { conflictSet: "gates" });
  await ensureActorParticipant(testSeu.seu.id, ROOT_ACTOR_ID);
  const gate = await createGateRowWithDefinition({
    category: "Exit", code: `qg-test-${randomUUID()}`, name: `waiver-risks ${run}`, entityType: "AttentionItem", fromState: `zz-from-${run}`, toState: `zz-to-${run}`,
    criteria: { type: "no_unresolved_obligations" }, originatingPackId: pack.id, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
  });
  assert.ok(gate.quality_gate_definition_id);
  gateDefinitionId = gate.quality_gate_definition_id;
});

const grant = (over: Record<string, unknown>) =>
  grantQualityGateWaiver({ qualityGateId: gateDefinitionId, seuId: testSeu.seu.id, entityType: "SEU", entityId: testSeu.seu.id, rationale: "test", actorId: ROOT_ACTOR_ID, ...over });

// Each waiver of the same scope, target and entity must differ from the Active ones, so these tests use a Policy waiver with a code of its own.
const otherTarget = () => ({ scope: WAIVER_SCOPE_POLICY, policyCode: `policy-${randomUUID()}` });

test("a risk with an Obligation control and an Accept risk control stores the risk, both controls and the Obligation, which names the risk as its originator", async () => {
  const result = await grant({
    risks: [{
      risk: `late security review ${run}`,
      controls: [
        { type: WAIVER_CONTROL_OBLIGATION, obligation: { relatedObjectType: "SEU", relatedObjectId: testSeu.seu.id, category: WAIVER_RISK_OBLIGATION_CATEGORY, title: `review ${run}`, completionCriteria: "review accepted" } },
        { type: WAIVER_CONTROL_ACCEPT_RISK },
      ],
    }],
  });
  assert.ok(result.ok, result.ok ? "" : result.reason);
  if (!result.ok) return;
  const { data: risks } = await qualityGateWaiverRisksDB.findRisksBySeuId(testSeu.seu.id);
  const risk = (risks ?? []).find((r) => r.waiver_id === result.waiver.id);
  assert.equal(risk?.risk, `late security review ${run}`);
  const { data: controls } = await qualityGateWaiverRisksDB.findControlsBySeuId(testSeu.seu.id);
  const own = (controls ?? []).filter((c) => c.risk_id === risk?.id);
  assert.deepEqual(own.map((c) => c.control_type).sort(), [WAIVER_CONTROL_ACCEPT_RISK, WAIVER_CONTROL_OBLIGATION].sort());
  const obligationId = own.find((c) => c.control_type === WAIVER_CONTROL_OBLIGATION)?.obligation_id;
  assert.ok(obligationId);
  const { data: obligation } = await obligationsDB.findById(obligationId);
  assert.deepEqual(
    [obligation?.originating_entity_type, obligation?.originating_entity_id, obligation?.related_object_type, obligation?.related_object_id, obligation?.category],
    [WAIVER_RISK_ENTITY_TYPE, risk?.id, "SEU", testSeu.seu.id, WAIVER_RISK_OBLIGATION_CATEGORY]
  );
});

test("a risk with no control gets the Expiry control, and needs the expiry time of the waiver", async () => {
  const refused = await grant({ risks: [{ risk: `no control ${run}`, controls: [] }] });
  assert.equal(refused.ok, false);
  const granted = await grant({ ...otherTarget(), expiresAt: new Date(Date.now() + 86400000).toISOString(), risks: [{ risk: `default control ${run}`, controls: [] }] });
  assert.ok(granted.ok, granted.ok ? "" : granted.reason);
  if (!granted.ok) return;
  const { data: risks } = await qualityGateWaiverRisksDB.findRisksBySeuId(testSeu.seu.id);
  const risk = (risks ?? []).find((r) => r.waiver_id === granted.waiver.id);
  const { data: controls } = await qualityGateWaiverRisksDB.findControlsBySeuId(testSeu.seu.id);
  assert.deepEqual((controls ?? []).filter((c) => c.risk_id === risk?.id).map((c) => c.control_type), [WAIVER_CONTROL_EXPIRY]);
});

test("an Obligation control on a Deliverable of another SEU, an empty risk and a risk-less waiver", async () => {
  const foreign = await grant({ risks: [{ risk: `foreign ${run}`, controls: [{ type: WAIVER_CONTROL_OBLIGATION, obligation: { relatedObjectType: "Deliverable", relatedObjectId: randomUUID(), category: WAIVER_RISK_OBLIGATION_CATEGORY, title: "t" } }] }] });
  assert.equal(foreign.ok, false);
  const empty = await grant({ risks: [{ risk: "  ", controls: [{ type: WAIVER_CONTROL_ACCEPT_RISK }] }] });
  assert.equal(empty.ok, false);
  const plain = await grant({ ...otherTarget() });
  assert.ok(plain.ok);
});

test("a waiver of the same scope and target for the same entity is refused while an Active one exists", async () => {
  const target = otherTarget();
  const first = await grant({ ...target });
  assert.ok(first.ok, first.ok ? "" : first.reason);
  const second = await grant({ ...target });
  assert.equal(second.ok, false);
  assert.match(second.ok ? "" : second.reason, /already exists/);
});

// Waiver confidence: each waiver is granted on a Quality Gate of its own, because one Active waiver of a gate for an entity covers it already.
const expiresAt = () => new Date(Date.now() + 86400000).toISOString();
const obligationRisk = () => ({
  risk: `obligation risk ${randomUUID()}`,
  controls: [{ type: WAIVER_CONTROL_OBLIGATION, obligation: { relatedObjectType: "SEU", relatedObjectId: testSeu.seu.id, category: WAIVER_RISK_OBLIGATION_CATEGORY, title: `control ${randomUUID()}` } }],
});

async function waiverOfNewGate(over: Record<string, unknown>) {
  const pack = await getTestDevelopmentPack();
  assert.ok(pack);
  const id = randomUUID().slice(0, 8);
  const gate = await createGateRowWithDefinition({
    category: "Exit", code: `qg-test-${randomUUID()}`, name: `waiver-confidence ${id}`, entityType: "AttentionItem", fromState: `zz-from-${id}`, toState: `zz-to-${id}`,
    criteria: { type: "no_unresolved_obligations" }, originatingPackId: pack.id, authorId: ROOT_ACTOR_ID, authorBadge: ROOT_ACTOR_BADGE,
  });
  assert.ok(gate.quality_gate_definition_id);
  const result = await grant({ qualityGateId: gate.quality_gate_definition_id, ...over });
  assert.ok(result.ok, result.ok ? "" : result.reason);
  if (!result.ok) throw new Error("unreachable");
  return { gateId: gate.quality_gate_definition_id, waiverId: result.waiver.id };
}

async function evidenceWithConfidence(level: string | null) {
  const evidence = await createEvidenceAsRoot({ seuId: testSeu.seu.id, relatedObjectType: "SEU", relatedObjectId: testSeu.seu.id, category: "Analytical Evidence", title: `waiver support ${randomUUID()}` });
  if (level) {
    const { error } = await evidenceDB.appendValidationAssessment(evidence.id, { dimension: "accuracy", status: "Pass", notes: null, assessedAt: new Date().toISOString() }, level);
    assert.equal(error, undefined);
  }
  return evidence;
}

test("tier 1 and tier 3: a waiver with no supporting record is 25 with an Expiry control and 75 with an Obligation control", async () => {
  const expiry = await waiverOfNewGate({ expiresAt: expiresAt(), risks: [{ risk: `expiry ${run}`, controls: [] }] });
  assert.deepEqual(await rateGateWaivers([expiry]), [25]);
  const obligation = await waiverOfNewGate({ risks: [obligationRisk()] });
  assert.deepEqual(await rateGateWaivers([obligation]), [75]);
});

test("tier 2 and tier 4: supporting Evidence lifts the tier and its confidence scales it", async () => {
  const high = await evidenceWithConfidence("High");
  const low = await evidenceWithConfidence("Low");
  const expiryHigh = await waiverOfNewGate({ expiresAt: expiresAt(), risks: [{ risk: `expiry ${run}`, controls: [] }], supportingRecords: { Evidence: [high.id] } });
  assert.deepEqual(await rateGateWaivers([expiryHigh]), [50]);
  const obligationHigh = await waiverOfNewGate({ risks: [obligationRisk()], supportingRecords: { Evidence: [high.id] } });
  assert.deepEqual(await rateGateWaivers([obligationHigh]), [100]);
  const expiryLow = await waiverOfNewGate({ expiresAt: expiresAt(), risks: [{ risk: `expiry ${run}`, controls: [] }], supportingRecords: { Evidence: [low.id] } });
  assert.deepEqual(await rateGateWaivers([expiryLow]), [16.5]);
});

test("with several supporting records the lowest confidence is used, and a record with no confidence level counts for 5", async () => {
  const high = await evidenceWithConfidence("High");
  const medium = await evidenceWithConfidence("Medium");
  const unassessed = await evidenceWithConfidence(null);
  const mixed = await waiverOfNewGate({ risks: [obligationRisk()], supportingRecords: { Evidence: [high.id, medium.id, unassessed.id] } });
  assert.deepEqual(await rateGateWaivers([mixed]), [5]);
  const assessed = await waiverOfNewGate({ risks: [obligationRisk()], supportingRecords: { Evidence: [high.id, medium.id] } });
  assert.deepEqual(await rateGateWaivers([assessed]), [66]);
  const onlyUnassessed = await waiverOfNewGate({ risks: [obligationRisk()], supportingRecords: { Evidence: [unassessed.id] } });
  assert.deepEqual(await rateGateWaivers([onlyUnassessed]), [5]);
});

test("a waiver is refused when a supporting record is not a record of the SEU or has a type a waiver does not accept", async () => {
  const foreign = await grant({ ...otherTarget(), supportingRecords: { Evidence: [randomUUID()] } });
  assert.equal(foreign.ok, false);
  assert.match(foreign.ok ? "" : foreign.reason, /not a record of this SEU/);
  const evidence = await evidenceWithConfidence("High");
  const wrongType = await grant({ ...otherTarget(), supportingRecords: { Obligation: [evidence.id] } });
  assert.equal(wrongType.ok, false);
  assert.match(wrongType.ok ? "" : wrongType.reason, /cannot be supported/);
});
