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
import { createAttentionItem, transitionAttentionItem } from "../src/routes/seu/core/attentionItems.js";
import { transitionObligation } from "../src/routes/seu/core/obligations.js";
import { createObligationAsRoot as createObligation } from "./testFixtures.js";
import { qualityGateEngine } from "../src/domain/engine/qualityGateEngine.js";
import { qualityGatesDB } from "../src/dblayer/qualityGatesDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { attentionItemsDB } from "../src/dblayer/attentionItemsDB.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { ensureWebAppTemplateFixture, commissionFromFormSync } from "./testFixtures.js";
import { TESTER_ALL_ID, ROOT_ACTOR_ID } from "./testFixtures.js";

// originating_pack_id is a plain traceability FK — any real Pack id satisfies
// it; which one doesn't matter for what this file is testing.
async function anyRealPackId(): Promise<string> {
  const { data: pack } = await packsDB.findByCode("development");
  if (!pack) throw new Error("expected development pack to be seeded");
  return pack.id;
}

async function commissionTestSeu(statementPrefix: string): Promise<string> {
  await ensureWebAppTemplateFixture();
  const result = await commissionFromFormSync({
    statement: `${statementPrefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture-design", "software-construction"],
    actorRole: "super", actorId: TESTER_ALL_ID, requestedBy: TESTER_ALL_ID,
  });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : "assertion failed");
  if (!result.ok) throw new Error("unreachable");
  return result.seu.id;
}

test("qualityGateEngine.evaluate resolves Obligations attached to a non-Deliverable entity (AttentionItem)", async () => {
  // CR-104 — Quality Gates are materialised onto an SEU's own EBM once, at
  // EBM creation, from whichever Packs are composed at that exact moment
  // (compositionCompleted.ts) — not re-derived live on every evaluate() call.
  // This gate must therefore exist BEFORE the SEU below is commissioned, or
  // that EBM's applicable_quality_gate_ids will never include it (same real
  // ordering requirement production Pack-authoring already has: a Pack's
  // contribution exists before any Template/Profile/SEU can compose it).
  //
  // A gate scoped to AttentionItem, on a fabricated (fromState, toState) pair
  // unique to this test run — this could never collide with any real
  // AttentionItem transition (Created/Delivered/Acknowledged/...).
  const fromState = `qg-test-from-${randomUUID()}`;
  const toState = `qg-test-to-${randomUUID()}`;
  const { data: gate, error: gateError } = await qualityGatesDB.upsert({
    name: "QG generalization test gate",
    entityType: "AttentionItem",
    fromState,
    toState,
    criteria: { type: "no_unresolved_obligations" },
    originatingPackId: await anyRealPackId(),
    authorId: ROOT_ACTOR_ID,
    authorBadge: "root",
  });
  assert.ok(!gateError && gate, gateError?.message ?? "assertion failed");

  const seuId = await commissionTestSeu("qg-generalization-direct");
  const attentionItem = await createAttentionItem({ seuId, category: "Action Required", title: "QG generalization test item", actorId: TESTER_ALL_ID, authorBadge: "root" });

  // No Obligations attached yet — must pass.
  const beforeObligation = await qualityGateEngine.evaluate({ entityType: "AttentionItem", entityId: attentionItem.id, seuId, fromState, toState, authorId: TESTER_ALL_ID, authorBadge: "root" });
  assert.equal(beforeObligation.outcome, "Passed");

  // Attach a real, unresolved Obligation directly to the AttentionItem (not a
  // Deliverable) — the exact case that used to be impossible.
  const obligation = await createObligation({
    relatedObjectType: "AttentionItem",
    relatedObjectId: attentionItem.id,
    category: "Engineering",
    title: "QG generalization test obligation (left unresolved)",
  });

  const blocked = await qualityGateEngine.evaluate({ entityType: "AttentionItem", entityId: attentionItem.id, seuId, fromState, toState, authorId: TESTER_ALL_ID, authorBadge: "root" });
  assert.equal(blocked.outcome, "Blocked");
  if (blocked.outcome === "Blocked") assert.match(blocked.reason, /unresolved Obligation/);

  // Resolve it — the gate must now pass.
  for (const targetState of ["Analysed", "Assigned", "In Progress", "Resolved", "Verified"]) {
    const step = await transitionObligation({ obligationId: obligation.id, targetState, actorRole: "super", actorId: TESTER_ALL_ID });
    assert.equal(step.ok, true, !step.ok ? JSON.stringify(step) : "assertion failed");
  }
  const afterResolution = await qualityGateEngine.evaluate({ entityType: "AttentionItem", entityId: attentionItem.id, seuId, fromState, toState, authorId: TESTER_ALL_ID, authorBadge: "root" });
  assert.equal(afterResolution.outcome, "Passed");
});

test("transitionAttentionItem is genuinely wired to qualityGateEngine — a real transition is blocked by an unresolved Obligation attached to the same AttentionItem, and unblocks once resolved", async () => {
  // CR-104 — same ordering requirement as the direct-evaluate test above:
  // this Quality Gate must exist before the SEU below is commissioned, or
  // its EBM's applicable_quality_gate_ids will never include it.
  //
  // Reuses the real, already-seeded AttentionItem lifecycle hop
  // ("In Progress" -> "Resolved", transitionDefinitions.json) instead of a
  // fabricated (fromState, toState) pair — that row already carries a real
  // verb ("resolve") and a real required_authority_rule_id, which a
  // from-scratch fabricated row has no way to acquire (seedAuthorityVocabulary's
  // verb back-fill only ever matches real, catalogued triples). Nothing about
  // the existing transition_definitions row itself needs to change — this
  // test's own contribution is only the new Quality Gate (scoped by
  // originating_pack_id, the same EBM-composition materialisation path
  // compositionCompleted.ts already uses, picked up by the later explicit
  // qualityGateEngine.evaluate call inside transitionAttentionItem). Routing
  // this through transition_definitions.required_quality_gate_ids instead
  // would make transitionEngine.evaluate's OWN quality-gate check (a
  // different, generic mechanism already proven by
  // transition-definition-authoring.test.ts) block the transition first,
  // never reaching — so never actually proving — transitionAttentionItem's
  // own separate, explicit call.
  const fromState = "In Progress";
  const toState = "Resolved";
  const packId = await anyRealPackId();
  const { data: existingDefinition } = await transitionDefinitionsDB.find("AttentionItem", fromState, toState);
  assert.ok(existingDefinition, "expected the real seeded AttentionItem In Progress -> Resolved transition to already exist");

  const { error: gateError } = await qualityGatesDB.upsert({
    name: "QG wiring test gate",
    entityType: "AttentionItem",
    fromState,
    toState,
    criteria: { type: "no_unresolved_obligations" },
    originatingPackId: packId,
    authorId: ROOT_ACTOR_ID,
    authorBadge: "root",
  });
  assert.equal(gateError, undefined);

  const seuId = await commissionTestSeu("qg-generalization-wiring");
  const attentionItem = await createAttentionItem({ seuId, category: "Action Required", title: "QG wiring test item", actorId: TESTER_ALL_ID, authorBadge: "root" });

  // Force the AttentionItem directly into the real "In Progress" state (test
  // setup only — skipping the Created -> Delivered -> Acknowledged -> In
  // Progress walk, which isn't what this test is exercising) so a real
  // transitionAttentionItem call can attempt the gated hop.
  await attentionItemsDB.updateStatus(attentionItem.id, fromState);

  const obligation = await createObligation({
    relatedObjectType: "AttentionItem",
    relatedObjectId: attentionItem.id,
    category: "Engineering",
    title: "QG wiring test obligation (left unresolved)",
  });

  const blockedResult = await transitionAttentionItem({ attentionItemId: attentionItem.id, targetState: toState, actorRole: "super", actorId: TESTER_ALL_ID });
  assert.equal(blockedResult.ok, false);
  if (blockedResult.ok) throw new Error("unreachable");
  assert.equal(blockedResult.reason, "quality_gate_blocked");
  assert.match(blockedResult.detail, /unresolved Obligation/);

  for (const targetState of ["Analysed", "Assigned", "In Progress", "Resolved", "Verified"]) {
    const step = await transitionObligation({ obligationId: obligation.id, targetState, actorRole: "super", actorId: TESTER_ALL_ID });
    assert.equal(step.ok, true, !step.ok ? JSON.stringify(step) : "assertion failed");
  }

  const passedResult = await transitionAttentionItem({ attentionItemId: attentionItem.id, targetState: toState, actorRole: "super", actorId: TESTER_ALL_ID });
  assert.equal(passedResult.ok, true, !passedResult.ok ? JSON.stringify(passedResult) : "assertion failed");
  if (passedResult.ok) assert.equal(passedResult.attentionItem.status, toState);
});
