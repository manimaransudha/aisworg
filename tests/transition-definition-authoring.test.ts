// SDK UI Layer Plan (design/mvp-build-plan/SDK UI Layer Plan.md), Transition
// Definition section — Build order step 6. Proves:
//   1. Transition Definition's own authoring surface: Create -> author ->
//      Review -> Publish through the exact same generic pipeline as Pack/
//      Template/Profile, producing a real transition_definitions row with
//      real required_quality_gate_ids (codes resolved to ids at publish
//      time, same pattern as requiredAuthorityRuleCode/requiredPolicyCodes).
//   2. The generalised mechanism itself: transitionEngine.evaluate, called
//      directly (not through any specific entity's own core/*.ts wrapper —
//      see the note on the second test below for why), genuinely enforces
//      the newly-published row's Quality Gate for a real entity instance,
//      blocked and then unblocked exactly like qualityGateEngine's existing
//      single-entity-type (Deliverable) wiring already does.
//   3. validateTransitionDefinitionSeed's referential check: a Quality Gate
//      code scoped to a different (entityType, fromState, toState) triple
//      than the Transition Definition being authored is rejected.
//
// Built on throwaway, randomized (fromState, toState) pairs for AttentionItem
// — the exact same isolation discipline tests/quality-gate-generalization.test.ts
// already established, for the same reason: inserting against a real,
// seeded triple would be a permanent, global change to this shared,
// never-reset dev database.
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import pool from "../src/utils/db.js";
import { commissionFromForm } from "../src/routes/seu/core/commissioning.js";
import { createAttentionItem } from "../src/routes/seu/core/attentionItems.js";
import { createObligation, transitionObligation } from "../src/routes/seu/core/obligations.js";
import { transitionEngine } from "../src/domain/engine/transitionEngine.js";
import { qualityGatesDB } from "../src/dblayer/qualityGatesDB.js";
import { transitionDefinitionsDB } from "../src/dblayer/transitionDefinitionsDB.js";
import { packsDB } from "../src/dblayer/packsDB.js";
import { startAuthoring, saveAuthoringContent, submitForReview, publishAuthoredContent } from "../src/routes/seu/core/sdkAuthoring.js";
import { createEvidence, transitionEvidence } from "../src/routes/seu/core/evidence.js";
import type { TransitionDefinitionSeedInput } from "../src/routes/seu/core/transitionDefinitions.js";
import { ensureWebAppTemplateFixture } from "./testFixtures.js";

after(async () => {
  await pool.end();
});

const ROOT_ACTOR_ID = "1";

async function anyRealPackId(): Promise<string> {
  const { data: pack } = await packsDB.findByCode("platform-core-engineering");
  if (!pack) throw new Error("expected platform-core-engineering to be seeded");
  return pack.id;
}

async function commissionTestSeu(statementPrefix: string): Promise<string> {
  await ensureWebAppTemplateFixture();
  const result = await commissionFromForm({
    statement: `${statementPrefix}-${randomUUID()}`,
    requiredCapabilityCodes: ["requirements-analysis", "architecture", "development"],
    actorRole: "super",
  });
  assert.equal(result.ok, true, !result.ok ? `commissioning failed: ${result.reason}` : undefined);
  if (!result.ok) throw new Error("unreachable");
  return result.seu.id;
}

async function acceptReviewEvidence(seuId: string, deliverableId: string): Promise<void> {
  const evidence = await createEvidence({
    seuId,
    relatedObjectType: "Deliverable",
    relatedObjectId: deliverableId,
    category: "Review",
    title: "Reviewer confirms the authored document is complete and correct",
  });
  await transitionEvidence({ evidenceId: evidence.id, targetState: "Validated", actorRole: "general" });
  await transitionEvidence({ evidenceId: evidence.id, targetState: "Accepted", actorRole: "general" });
}

test("Transition Definition authoring: the same generic pipeline as Pack/Template/Profile publishes a real transition_definitions row with resolved Quality Gate ids", async () => {
  const fromState = `td-authoring-from-${randomUUID()}`;
  const toState = `td-authoring-to-${randomUUID()}`;

  // The gate this Transition Definition will reference — a real quality_gates
  // row, contributed the same way any Pack contributes one; authoring a
  // Transition Definition references gates, it doesn't create them (SDK UI
  // Layer Plan: quality gates aren't one of the four SDK-authored kinds).
  const { data: gate, error: gateError } = await qualityGatesDB.upsert({
    code: `td-authoring-gate-${randomUUID()}`,
    name: "Transition Definition authoring test gate",
    entityType: "AttentionItem",
    fromState,
    toState,
    criteria: { type: "no_unresolved_obligations" },
    originatingPackId: await anyRealPackId(),
  });
  assert.ok(!gateError && gate, gateError?.message);

  const seed: TransitionDefinitionSeedInput = {
    entityType: "AttentionItem",
    fromState,
    toState,
    requiredQualityGateCodes: [gate!.code],
  };

  const started = await startAuthoring({ kind: "TransitionDefinition", actorId: ROOT_ACTOR_ID, actorName: "Root", actorRole: "general" });
  assert.equal(started.deliverable.category, "Transition Definition Definition");

  await saveAuthoringContent(started.deliverable.id, seed as unknown as Record<string, unknown>);
  await acceptReviewEvidence(started.seu.id, started.deliverable.id);

  const reviewed = await submitForReview({ deliverableId: started.deliverable.id, kind: "TransitionDefinition", actorId: ROOT_ACTOR_ID, actorRole: "general" });
  assert.equal(reviewed.ok, true, reviewed.errors?.join("; "));

  const published = await publishAuthoredContent({ deliverableId: started.deliverable.id, kind: "TransitionDefinition", actorId: ROOT_ACTOR_ID, actorRole: "general" });
  assert.equal(published.ok, true, published.errors?.join("; "));

  const { data: transitionDefinition } = await transitionDefinitionsDB.find("AttentionItem", fromState, toState);
  assert.ok(transitionDefinition, "expected the authored Transition Definition to be registered");
  assert.deepEqual(transitionDefinition!.required_quality_gate_ids, [gate!.id]);
});

// Deliberately calls transitionEngine.evaluate directly, not through
// transitionAttentionItem — every one of the 9 entity types migrated by
// Open Design Questions.md #3 (Deliverable, Obligation, Evidence, Knowledge,
// Decision, AttentionItem, ExternalInteraction) already runs its own
// separate qualityGateEngine.evaluate pre-check before ever reaching
// transitionEngine.evaluate, so for a gate scoped to a real, matching
// (entityType, fromState, toState) triple, that old pre-check would fire
// first and this test would just be re-proving the old mechanism. Pack and
// Objective have no seu_id at all, so they can never supply one to this new
// check either. This test proves the new, generic mechanism itself is real
// and correct, callable by anything that does choose to use it (see the
// design doc's own note: not yet actively exercised through any existing
// entity's public function, since all of them already had their own).
test("transitionEngine.evaluate itself enforces an authored Transition Definition's required_quality_gate_ids, for a real entity instance", async () => {
  const seuId = await commissionTestSeu("td-engine-generalization");
  const attentionItem = await createAttentionItem({ seuId, category: "Action Required", title: "Transition Definition engine-generalization test item" });

  const fromState = `td-engine-from-${randomUUID()}`;
  const toState = `td-engine-to-${randomUUID()}`;
  const { data: gate, error: gateError } = await qualityGatesDB.upsert({
    code: `td-engine-gate-${randomUUID()}`,
    name: "Transition Definition engine-generalization test gate",
    entityType: "AttentionItem",
    fromState,
    toState,
    criteria: { type: "no_unresolved_obligations" },
    originatingPackId: await anyRealPackId(),
  });
  assert.ok(!gateError && gate, gateError?.message);

  const { error: definitionError } = await transitionDefinitionsDB.upsert({
    entityType: "AttentionItem",
    fromState,
    toState,
    requiredQualityGateIds: [gate!.id],
  });
  assert.equal(definitionError, undefined);

  const evaluateArgs = { entityType: "AttentionItem" as const, fromState, toState, actorRole: "general", entityId: attentionItem.id, seuId };

  const beforeObligation = await transitionEngine.evaluate(evaluateArgs);
  assert.equal(beforeObligation.allowed, true);

  const obligation = await createObligation({
    seuId,
    relatedObjectType: "AttentionItem",
    relatedObjectId: attentionItem.id,
    category: "Engineering",
    title: "Transition Definition engine-generalization test obligation (left unresolved)",
  });

  const blocked = await transitionEngine.evaluate(evaluateArgs);
  assert.equal(blocked.allowed, false);
  if (blocked.allowed) throw new Error("unreachable");
  assert.equal(blocked.reason, "quality_gate_blocked");
  assert.match(blocked.detail, /unresolved Obligation/);

  for (const targetState of ["Analysed", "Assigned", "In Progress", "Resolved", "Verified"]) {
    const step = await transitionObligation({ obligationId: obligation.id, targetState, actorRole: "super" });
    assert.equal(step.ok, true, !step.ok ? JSON.stringify(step) : undefined);
  }

  const afterResolution = await transitionEngine.evaluate(evaluateArgs);
  assert.equal(afterResolution.allowed, true);
});

test("Transition Definition authoring: a Quality Gate code scoped to a different transition is rejected", async () => {
  const gateFromState = `td-mismatch-gate-from-${randomUUID()}`;
  const gateToState = `td-mismatch-gate-to-${randomUUID()}`;
  const { data: gate, error: gateError } = await qualityGatesDB.upsert({
    code: `td-mismatch-gate-${randomUUID()}`,
    name: "Transition Definition mismatch test gate",
    entityType: "AttentionItem",
    fromState: gateFromState,
    toState: gateToState,
    criteria: { type: "no_unresolved_obligations" },
    originatingPackId: await anyRealPackId(),
  });
  assert.ok(!gateError && gate, gateError?.message);

  const started = await startAuthoring({ kind: "TransitionDefinition", actorId: ROOT_ACTOR_ID, actorName: "Root", actorRole: "general" });
  const seed: TransitionDefinitionSeedInput = {
    entityType: "AttentionItem",
    fromState: `td-mismatch-from-${randomUUID()}`,
    toState: `td-mismatch-to-${randomUUID()}`,
    requiredQualityGateCodes: [gate!.code],
  };
  await saveAuthoringContent(started.deliverable.id, seed as unknown as Record<string, unknown>);

  const reviewed = await submitForReview({ deliverableId: started.deliverable.id, kind: "TransitionDefinition", actorId: ROOT_ACTOR_ID, actorRole: "general" });
  assert.equal(reviewed.ok, false);
  assert.match((reviewed.errors ?? []).join(";"), /is scoped to AttentionItem/);
});
