// Governance & EBM Sharpening — Plan (Phase 16). Four FRs:
//   FR-3.3      the EBM is versioned
//   FR-3.6/3.7  composition conflicts hard-block commissioning
//   FR-21.1     an SEU exposes one effective Governance Model derived from its EBM
//   §4.3 / Q#3  Quality Gates can gate Pack/Objective (seu_id nullable + CHECK)
// Run against the real dev database, no mocking.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { commissionFromForm, commissionSeu } from "../src/routes/seu/core/commissioning.js";
import { getEffectiveGovernanceModel } from "../src/routes/seu/core/governanceModel.js";
import { publishPack } from "../src/routes/seu/core/packs.js";
import { createObjective } from "../src/routes/seu/core/objectives.js";
import { ebmsDB } from "../src/dblayer/ebmsDB.js";
import { seusDB } from "../src/dblayer/seusDB.js";
import { templatesDB } from "../src/dblayer/templatesDB.js";
import { profilesDB } from "../src/dblayer/profilesDB.js";
import { qualityGatesDB } from "../src/dblayer/qualityGatesDB.js";
import { qualityGateEvaluationsDB } from "../src/dblayer/qualityGateEvaluationsDB.js";
import { qualityGateEngine } from "../src/domain/engine/qualityGateEngine.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { ensureWebAppTemplateFixture, registerTestOntologyCode, deleteTestOntologyCodes } from "./testFixtures.js";

// CR-046 (owner: "the test script should use a code present in the
// ontology") — Pack.code is Ontology-validated (capability-name) at publish
// time now; the two real concepts this file registers are tracked and
// cleaned up here, same discipline as pack-sdk.test.ts's own.
const createdOntologyCodes: Array<{ conceptType: string; code: string }> = [];

after(async () => {
  await deleteTestOntologyCodes(createdOntologyCodes);
  await pool.end();
});

test("FR-3.3: a commissioned SEU's Engineering Behavior Model is versioned (version 1 for the first)", async () => {
  await ensureWebAppTemplateFixture();
  const result = await commissionFromForm({ statement: `ebm-version-${randomUUID()}`, requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"], actorRole: "super", actorId: "1001" });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");
  const { data: seu } = await seusDB.findById(result.seu.id);
  const { data: ebm } = await ebmsDB.findById(seu!.active_ebm_id!);
  assert.equal(ebm?.version, 1, "the first EBM for an SEU is version 1");
});

test("FR-21.1: an SEU exposes one effective Governance Model derived from its EBM (authority rules, policies, quality gates)", async () => {
  await ensureWebAppTemplateFixture();
  const result = await commissionFromForm({ statement: `gov-model-${randomUUID()}`, requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"], actorRole: "super", actorId: "1001" });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");

  const model = await getEffectiveGovernanceModel(result.seu.id);
  assert.ok(model, "expected an effective governance model");
  assert.equal(model!.ebm.version, 1);
  assert.ok(model!.ebm.composedPacks.some((p) => p.packCode === "platform-core-engineering"), "the EBM's composed packs are listed");
  assert.ok(model!.authorityRules.some((r) => r.governedTransition === "deliverable.transition"), "authority rules derived from composed packs");
  assert.ok(model!.qualityGates.length >= 1, "quality gates derived from composed packs");
  assert.ok(model!.authorityRules.every((r) => typeof r.fromPack === "string"), "each rule records the contributing pack (traceable)");
});

test("FR-3.6/3.7: a composition conflict hard-blocks commissioning; the SEU never reaches Operational", async () => {
  const run = randomUUID().slice(0, 8);
  const codeA = await registerTestOntologyCode("capability-name", "conflict-a");
  createdOntologyCodes.push({ conceptType: "capability-name", code: codeA });
  const codeB = await registerTestOntologyCode("capability-name", "conflict-b");
  createdOntologyCodes.push({ conceptType: "capability-name", code: codeB });
  // Two packs contributing authority rules for the SAME governedTransition with DIFFERENT roles.
  const packA = { code: codeA, name: "Conflict A", category: "Organisation", packVersion: "1.0.0", installationClassification: "Mandatory",
    contributions: { authorityRules: [{ code: `auth-a-${run}`, governedTransition: `x.transition.${run}`, authorisedRole: "general" }] } };
  const packB = { code: codeB, name: "Conflict B", category: "Organisation", packVersion: "1.0.0", installationClassification: "Mandatory",
    contributions: { authorityRules: [{ code: `auth-b-${run}`, governedTransition: `x.transition.${run}`, authorisedRole: "super" }] } };
  const pubA = await publishPack({ seed: packA as any, actorRole: "super", actorId: "1001", activate: true });
  const pubB = await publishPack({ seed: packB as any, actorRole: "super", actorId: "1001", activate: true });
  assert.ok(pubA.ok && pubB.ok, "both packs publish");

  // A template that composes BOTH conflicting packs.
  const { data: template } = await templatesDB.upsert({ code: `conflict-tpl-${run}`, name: "Conflict Template", deliverableCatalogue: [] });
  await templatesDB.setMandatoryPacks(template!.id, [packA.code, packB.code]);
  await templatesDB.setRequiredCapabilities(template!.id, []);
  const { data: profile } = await profilesDB.upsert({ code: `conflict-prof-${run}`, name: "Conflict Profile", baseTemplateId: template!.id, environment: "development", configParameters: {} });
  // CR-009: Engineering Objectives need a Strategic parent (only Strategic may be a root).
  const { objective: conflictRoot } = await createObjective({ statement: `conflict-root-${run}`, requiredCapabilityCodes: [], tier: "Strategic" });
  const { objective } = await createObjective({ statement: `conflict-obj-${run}`, requiredCapabilityCodes: [], tier: "Engineering", parentObjectiveId: conflictRoot.id });

  const result = await commissionSeu({ objectiveId: objective.id, templateId: template!.id, profileId: profile!.id, actorRole: "super", actorId: "1001" });
  assert.equal(result.ok, false, "commissioning must be blocked by the conflict");
  if (!result.ok) {
    assert.match(result.reason, /conflict/i, "the reason names the conflict");
    // The SEU (created as Pending) must not have reached Operational.
    if (result.seuId) {
      const { data: blockedSeu } = await seusDB.findById(result.seuId);
      assert.notEqual(blockedSeu?.lifecycle_state, "Operational", "a conflicted commissioning never reaches Operational");
    }
  }
});

test("§4.3 / Open Q#3: a Quality Gate can gate a Pack transition with a null SEU; the CHECK rejects mis-scoped evaluations", async () => {
  const run = randomUUID().slice(0, 8);
  const { data: corePack } = await packsDB.findByCode("platform-core-engineering");
  assert.ok(corePack);

  // A gate on a Pack transition (platform-level entity, no SEU).
  await qualityGatesDB.upsert({ code: `qg-pack-${run}`, name: "Pack publish gate", entityType: "Pack", fromState: "Published", toState: "Active", criteria: { type: "no_unresolved_obligations" }, originatingPackId: corePack.id });
  const evalResult = await qualityGateEngine.evaluate({ entityType: "Pack", entityId: corePack.id, seuId: null, fromState: "Published", toState: "Active" });
  assert.equal(evalResult.outcome, "Passed", "a Pack transition can be gated and evaluated with a null SEU");

  // The CHECK enforces the scope invariant (the DB layer surfaces the violation
  // as { error }, not a throw): a SEU-scoped entity may not have a null SEU...
  const gateId = (evalResult as { gate: { id: string } }).gate.id;
  const badDeliverable = await qualityGateEvaluationsDB.create({ qualityGateId: gateId, seuId: null, entityType: "Deliverable", entityId: corePack.id, outcome: "Passed" });
  assert.ok(badDeliverable.error, "a Deliverable evaluation with a null SEU is rejected by the CHECK");
  // ...and a platform-level entity may not carry a SEU.
  const badPack = await qualityGateEvaluationsDB.create({ qualityGateId: gateId, seuId: corePack.id, entityType: "Pack", entityId: corePack.id, outcome: "Passed" });
  assert.ok(badPack.error, "a Pack evaluation carrying a SEU is rejected by the CHECK");
});
