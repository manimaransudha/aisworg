// CR-145: the risks a Quality Gate waiver accepts and the controls that offset them. A risk is a text. It has one or more controls: Expiry (the default),
// an Obligation raised from the risk, or Accept risk. An Obligation control names where the Obligation is raised and carries the risk as its originating entity.
import "dotenv/config";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { qualityGateWaiverRisksDB } from "../src/dblayer/qualityGateWaiverRisksDB.js";
import { obligationsDB } from "../src/dblayer/obligationsDB.js";
import { grantQualityGateWaiver } from "../src/routes/seu/core/qualityGateWaivers.js";
import { WAIVER_CONTROL_ACCEPT_RISK, WAIVER_CONTROL_EXPIRY, WAIVER_CONTROL_OBLIGATION, WAIVER_RISK_ENTITY_TYPE, WAIVER_RISK_OBLIGATION_CATEGORY } from "../src/dblayer/constants.js";
import { commissionedSeu, type CommissionedSeu } from "./webScenarios.js";
import { ROOT_ACTOR_ID, ROOT_ACTOR_BADGE, createGateRowWithDefinition, ensureActorParticipant, getTestDevelopmentPack } from "./testFixtures.js";

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
  const granted = await grant({ expiresAt: new Date(Date.now() + 86400000).toISOString(), risks: [{ risk: `default control ${run}`, controls: [] }] });
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
  const plain = await grant({});
  assert.ok(plain.ok);
});
