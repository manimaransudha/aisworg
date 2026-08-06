// Engineering Telemetry — Plan (design/mvp-build-plan/Engineering Telemetry
// — Plan.md), Build order step 5 — generalising sustained-pattern detection
// beyond Quality-Gate-blocking to Policy waiver (c) and capability shortage
// (d). Proves, against real dev data (no mocking), same isolation
// discipline as tests/quality-gate-generalization.test.ts:
//   1. transitionEngine.evaluate records a StandardPolicyDeviation event
//      when a Standard Policy's condition fails, and
//      checkSustainedPolicyWaivers raises a real Obligation once the same
//      (Policy, SEU) pair crosses the threshold, deduplicated on repeat
//      calls.
//   2. seuCapabilitiesDB.findUnfulfilledByCapability correctly surfaces a
//      capability sitting Unfulfilled across multiple real SEUs, and
//      checkSustainedCapabilityShortages doesn't throw and (when it's the
//      first detection) raises a real Obligation attached to one
//      representative SEU. This one is deliberately not asserted as
//      strictly raised:true — "architecture"/"development" are real, shared
//      Capabilities other tests across this whole suite also leave
//      Unfulfilled, so an earlier test run may have already raised (and
//      correctly deduplicated) the same pattern; asserting the mechanism
//      runs correctly either way is what's actually true here, not a
//      specific call-order-dependent outcome.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { commissionFromForm } from "../src/routes/seu/core/commissioning.js";
import { createAttentionItem } from "../src/routes/seu/core/attentionItems.js";
import { checkSustainedPolicyWaivers, checkSustainedCapabilityShortages } from "../src/routes/seu/core/telemetry.js";
import { transitionEngine } from "../src/domain/engine/transitionEngine.js";
import { policiesDB } from "../src/dblayer/policiesDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { attentionItemsDB } from "../src/dblayer/attentionItemsDB.js";
import { seuCapabilitiesDB } from "../src/dblayer/seuCapabilitiesDB.js";
import { obligationsDB } from "../src/dblayer/obligationsDB.js";
import { packsDB } from "../src/dblayer/packsDB.js";

after(async () => {
  await pool.end();
});

async function anyRealPackId(): Promise<string> {
  const { data: pack } = await packsDB.findByCode("platform-core-engineering");
  if (!pack) throw new Error("expected platform-core-engineering to be seeded");
  return pack.id;
}

async function commissionTestSeu(statementPrefix: string): Promise<string> {
  const result = await commissionFromForm({
    statement: `${statementPrefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"],
    actorRole: "super",
  });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");
  return result.seu.id;
}

test("Policy waiver: transitionEngine.evaluate records the deviation, and checkSustainedPolicyWaivers raises (and deduplicates) an Obligation once the SEU crosses the threshold", async () => {
  const seuId = await commissionTestSeu("policy-waiver-generalization");
  const packId = await anyRealPackId();
  const attentionItem = await createAttentionItem({ seuId, category: "Action Required", title: "Policy waiver generalization test item" });

  const fromState = `policy-waiver-from-${randomUUID()}`;
  const toState = `policy-waiver-to-${randomUUID()}`;

  // A Standard policy whose condition can never be satisfied — every
  // evaluation is a deviation, by construction.
  const { data: policy, error: policyError } = await policiesDB.upsert({
    code: `policy-waiver-test-${randomUUID()}`,
    name: "Policy waiver generalization test policy",
    constraintType: "Standard",
    governedTransition: "test.transition",
    condition: { type: "field_in", field: "neverPresent", values: ["nothing-ever-matches"] },
    originatingPackId: packId,
  });
  assert.ok(!policyError && policy, policyError?.message);

  const { error: definitionError } = await transitionDefinitionsDB.upsert({
    entityType: "AttentionItem",
    fromState,
    toState,
    requiredPolicyIds: [policy!.id],
  });
  assert.equal(definitionError, undefined);

  await attentionItemsDB.updateStatus(attentionItem.id, fromState);

  // Three real evaluations, each recording its own StandardPolicyDeviation
  // event (Standard never blocks, so `allowed` stays true throughout).
  for (let i = 0; i < 3; i++) {
    const outcome = await transitionEngine.evaluate({
      entityType: "AttentionItem",
      fromState,
      toState,
      actorRole: "super",
      entityId: attentionItem.id,
      seuId,
      context: {},
    });
    assert.equal(outcome.allowed, true);
  }

  const marker = `policyWaiver:${policy!.id}`;
  const firstPass = await checkSustainedPolicyWaivers();
  const mine = firstPass.find((r) => r.raised && r.obligation.description?.includes(marker));
  assert.ok(mine, "expected a new Obligation raised for this specific Policy+SEU pair");
  if (!mine || !mine.raised) return;
  assert.equal(mine.obligation.seu_id, seuId);
  assert.equal(mine.obligation.category, "Organisational Learning");

  // Deduplicated on repeat: the same pattern must not raise a second time.
  const secondPass = await checkSustainedPolicyWaivers();
  const mineAgain = secondPass.find((r) => r.raised && r.obligation.description?.includes(marker));
  assert.equal(mineAgain, undefined, "the same Policy+SEU pattern must not raise a duplicate Obligation");
});

test("Capability shortage: findUnfulfilledByCapability surfaces real SEUs missing a Participant, and checkSustainedCapabilityShortages runs without error", async () => {
  const seuIds = [
    await commissionTestSeu("capability-shortage-a"),
    await commissionTestSeu("capability-shortage-b"),
    await commissionTestSeu("capability-shortage-c"),
  ];
  // Deliberately leave "architecture" unfulfilled on all three — a real,
  // shared Capability other tests also leave Unfulfilled, which is exactly
  // why this test only asserts the subset it directly controls, not an
  // exact count.

  const { data: shortages, error } = await seuCapabilitiesDB.findUnfulfilledByCapability();
  assert.equal(error, undefined);
  const architecture = (shortages ?? []).find((s) => s.capability_code === "architecture");
  assert.ok(architecture, "expected 'architecture' to appear as an unfulfilled Capability");
  for (const seuId of seuIds) {
    assert.ok(architecture!.seu_ids.includes(seuId), `expected ${seuId} among architecture's unfulfilled SEUs`);
  }

  const results = await checkSustainedCapabilityShortages();
  assert.ok(Array.isArray(results));
  for (const result of results) {
    if (result.raised) {
      assert.equal(result.obligation.category, "Organisational Learning");
      assert.ok(result.obligation.seu_id);
    }
  }
});

// Real bug found in production data, fixed 2026-08-06: dedup used to search
// obligationsDB.findBySeuId(representativeSeuId), but the representative SEU
// is deliberately the *most recently affected* one (newest-first ordering)
// — it shifts every time a new SEU is commissioned leaving the same
// Capability unfulfilled, so a SEU-scoped dedup search always looked at a
// SEU that had never had this Obligation before. Confirmed live: 6 real
// chronic shortages had produced 37 Obligations. This proves the fix
// (dedupScope: "platform") holds across an actual shift, not just a
// same-representative repeat call.
test("Capability shortage: dedup survives the representative SEU actually shifting between checks (the real bug)", async () => {
  const marker = "capabilityShortage:";
  const countMarked = async () => {
    const { data } = await obligationsDB.findByCategory("Organisational Learning");
    return (data ?? []).filter((o) => o.description?.includes(marker)).length;
  };

  const seuIds = [
    await commissionTestSeu("capability-shortage-shift-a"),
    await commissionTestSeu("capability-shortage-shift-b"),
    await commissionTestSeu("capability-shortage-shift-c"),
  ];
  // Deliberately leave "architecture" unfulfilled on all three, same as the
  // test above — first pass establishes (or confirms already-deduplicated)
  // the pattern for "architecture".
  const before = await checkSustainedCapabilityShortages();
  void before;
  const afterFirstPass = await countMarked();

  const { data: shortagesBefore } = await seuCapabilitiesDB.findUnfulfilledByCapability();
  const architectureBefore = (shortagesBefore ?? []).find((s) => s.capability_code === "architecture");
  assert.ok(architectureBefore);
  const representativeBefore = architectureBefore!.seu_ids[0];

  // Commission one more SEU leaving "architecture" unfulfilled — newer than
  // all three above, so it becomes the new representative (newest-first).
  const newestSeuId = await commissionTestSeu("capability-shortage-shift-newest");

  const { data: shortagesAfter } = await seuCapabilitiesDB.findUnfulfilledByCapability();
  const architectureAfter = (shortagesAfter ?? []).find((s) => s.capability_code === "architecture");
  assert.ok(architectureAfter);
  const representativeAfter = architectureAfter!.seu_ids[0];
  // Not asserted as strictly === newestSeuId: "architecture" is a real,
  // shared Capability other test *files* also leave Unfulfilled, and the
  // full suite runs files concurrently — a different file's SEU can land
  // even newer than this test's own between these two queries. What this
  // test actually needs is for the representative to have moved off its
  // original value (representativeBefore) and for the newly-commissioned
  // SEU to be a real, present candidate — both true regardless of exactly
  // which concurrently-commissioned SEU ends up newest.
  assert.notEqual(representativeAfter, representativeBefore, "expected the representative to have actually shifted — the scenario this test exists to cover");
  assert.ok(architectureAfter!.seu_ids.includes(newestSeuId), "expected the newly-commissioned SEU to be among the unfulfilled set");

  await checkSustainedCapabilityShortages();
  const afterSecondPass = await countMarked();

  assert.equal(afterSecondPass, afterFirstPass, "the representative shifting must not raise a duplicate Obligation for the same capability shortage");
  void seuIds;
});
