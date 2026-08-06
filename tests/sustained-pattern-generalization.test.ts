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
