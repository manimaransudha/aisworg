// Post-completion fix (Open Design Questions.md #3) — Quality Gates were
// wired to exactly one entity type (Deliverable), short of Ch.29 §10's own
// spec. Root cause: qualityGateEngine's two criteria types resolved
// Obligations/Evidence/Decisions by a Deliverable-only deliverable_id FK, so
// a Quality Gate on any other entity type could never have meant anything
// even though quality_gates.entity_type was never actually restricted to
// 'Deliverable'. Fixed by making Obligation/Evidence/Decision polymorphic
// (related_object_type/related_object_id) and wiring qualityGateEngine.evaluate
// into every SEU-scoped transition* function, the same way transitionDeliverable
// always has.
//
// This file proves the fix at two levels:
//   1. qualityGateEngine.evaluate itself correctly resolves Obligations
//      attached to a non-Deliverable entity (direct call, isolated fabricated
//      (entityType, fromState, toState) — zero risk of colliding with real
//      seeded Quality Gates or any other test's data).
//   2. The wiring is real: a real transitionAttentionItem call, through a
//      one-off Transition Definition + Quality Gate constructed just for this
//      test (randomized state names), is genuinely blocked and then unblocked.
// Both are deliberately built on throwaway, randomized (fromState, toState)
// pairs rather than any real entity lifecycle's actual states — inserting a
// Quality Gate against a real (entityType, fromState, toState) tuple would be
// a permanent, global change to this shared, never-reset dev database that
// could affect every other test and the real running app.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { commissionFromForm } from "../src/routes/seu/core/commissioning.js";
import { createAttentionItem, transitionAttentionItem } from "../src/routes/seu/core/attentionItems.js";
import { createObligation, transitionObligation } from "../src/routes/seu/core/obligations.js";
import { qualityGateEngine } from "../src/domain/engine/qualityGateEngine.js";
import { qualityGatesDB } from "../src/dblayer/qualityGatesDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { authorityRulesDB } from "../src/dblayer/authorityRulesDB.js";
import { policiesDB } from "../src/dblayer/policiesDB.js";
import { attentionItemsDB } from "../src/dblayer/attentionItemsDB.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { ensureWebAppTemplateFixture } from "./testFixtures.js";

after(async () => {
  await pool.end();
});

// originating_pack_id is a plain traceability FK — any real Pack id satisfies
// it; which one doesn't matter for what this file is testing.
async function anyRealPackId(): Promise<string> {
  const { data: pack } = await packsDB.findByCode("development");
  if (!pack) throw new Error("expected development pack to be seeded");
  return pack.id;
}

async function commissionTestSeu(statementPrefix: string): Promise<string> {
  await ensureWebAppTemplateFixture();
  const result = await commissionFromForm({
    statement: `${statementPrefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"],
    actorRole: "super", actorId: "1001", requestedBy: 1001,
  });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");
  return result.seu.id;
}

test("qualityGateEngine.evaluate resolves Obligations attached to a non-Deliverable entity (AttentionItem)", async () => {
  const seuId = await commissionTestSeu("qg-generalization-direct");
  const attentionItem = await createAttentionItem({ seuId, category: "Action Required", title: "QG generalization test item" });

  // A gate scoped to AttentionItem, on a fabricated (fromState, toState) pair
  // unique to this test run — this could never collide with any real
  // AttentionItem transition (Created/Delivered/Acknowledged/...).
  const fromState = `qg-test-from-${randomUUID()}`;
  const toState = `qg-test-to-${randomUUID()}`;
  const { data: gate, error: gateError } = await qualityGatesDB.upsert({
    code: `qg-test-${randomUUID()}`,
    name: "QG generalization test gate",
    entityType: "AttentionItem",
    fromState,
    toState,
    criteria: { type: "no_unresolved_obligations" },
    originatingPackId: await anyRealPackId(),
  });
  assert.ok(!gateError && gate, gateError?.message);

  // No Obligations attached yet — must pass.
  const beforeObligation = await qualityGateEngine.evaluate({ entityType: "AttentionItem", entityId: attentionItem.id, seuId, fromState, toState });
  assert.equal(beforeObligation.outcome, "Passed");

  // Attach a real, unresolved Obligation directly to the AttentionItem (not a
  // Deliverable) — the exact case that used to be impossible.
  const obligation = await createObligation({
    seuId,
    relatedObjectType: "AttentionItem",
    relatedObjectId: attentionItem.id,
    category: "Engineering",
    title: "QG generalization test obligation (left unresolved)",
  });

  const blocked = await qualityGateEngine.evaluate({ entityType: "AttentionItem", entityId: attentionItem.id, seuId, fromState, toState });
  assert.equal(blocked.outcome, "Blocked");
  if (blocked.outcome === "Blocked") assert.match(blocked.reason, /unresolved Obligation/);

  // Resolve it — the gate must now pass.
  for (const targetState of ["Analysed", "Assigned", "In Progress", "Resolved", "Verified"]) {
    const step = await transitionObligation({ obligationId: obligation.id, targetState, actorRole: "super", actorId: "1001" });
    assert.equal(step.ok, true, !step.ok ? JSON.stringify(step) : undefined);
  }
  const afterResolution = await qualityGateEngine.evaluate({ entityType: "AttentionItem", entityId: attentionItem.id, seuId, fromState, toState });
  assert.equal(afterResolution.outcome, "Passed");
});

test("transitionAttentionItem is genuinely wired to qualityGateEngine — a real transition is blocked by an unresolved Obligation attached to the same AttentionItem, and unblocks once resolved", async () => {
  const seuId = await commissionTestSeu("qg-generalization-wiring");
  const attentionItem = await createAttentionItem({ seuId, category: "Action Required", title: "QG wiring test item" });

  // A one-off Transition Definition + Quality Gate for a randomized
  // (fromState, toState) pair, reusing the real, already-seeded baseline
  // Authority Rule/Policy for AttentionItem transitions (safe to reuse —
  // upsert on an existing code is idempotent and changes nothing).
  const packId = await anyRealPackId();
  const { data: authorityRule } = await authorityRulesDB.upsert({ code: "authority-transition-attentionitem", governedTransition: "attentionitem.transition", authorisedRole: "general", originatingPackId: packId });
  const { data: policy } = await policiesDB.upsert({ code: "policy-attentionitem-transition-baseline", name: "Attention Item transition baseline check", governedTransition: "attentionitem.transition", originatingPackId: packId });
  assert.ok(authorityRule && policy);

  const fromState = `qg-wire-from-${randomUUID()}`;
  const toState = `qg-wire-to-${randomUUID()}`;
  await transitionDefinitionsDB.upsert({ entityType: "AttentionItem", fromState, toState, requiredAuthorityRuleId: authorityRule!.id, requiredPolicyIds: [policy!.id] });
  const { error: gateError } = await qualityGatesDB.upsert({
    code: `qg-wire-test-${randomUUID()}`,
    name: "QG wiring test gate",
    entityType: "AttentionItem",
    fromState,
    toState,
    criteria: { type: "no_unresolved_obligations" },
    originatingPackId: packId,
  });
  assert.equal(gateError, undefined);

  // Force the AttentionItem into the fabricated fromState directly (test
  // setup only — no governed path is meant to reach a state this test
  // invented) so a real transitionAttentionItem call can attempt the gated hop.
  await attentionItemsDB.updateStatus(attentionItem.id, fromState);

  const obligation = await createObligation({
    seuId,
    relatedObjectType: "AttentionItem",
    relatedObjectId: attentionItem.id,
    category: "Engineering",
    title: "QG wiring test obligation (left unresolved)",
  });

  const blockedResult = await transitionAttentionItem({ attentionItemId: attentionItem.id, targetState: toState, actorRole: "super", actorId: "1001" });
  assert.equal(blockedResult.ok, false);
  if (blockedResult.ok) throw new Error("unreachable");
  assert.equal(blockedResult.reason, "quality_gate_blocked");
  assert.match(blockedResult.detail, /unresolved Obligation/);

  for (const targetState of ["Analysed", "Assigned", "In Progress", "Resolved", "Verified"]) {
    const step = await transitionObligation({ obligationId: obligation.id, targetState, actorRole: "super", actorId: "1001" });
    assert.equal(step.ok, true, !step.ok ? JSON.stringify(step) : undefined);
  }

  const passedResult = await transitionAttentionItem({ attentionItemId: attentionItem.id, targetState: toState, actorRole: "super", actorId: "1001" });
  assert.equal(passedResult.ok, true, !passedResult.ok ? JSON.stringify(passedResult) : undefined);
  if (passedResult.ok) assert.equal(passedResult.attentionItem.status, toState);
});
