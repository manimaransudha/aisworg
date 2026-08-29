// transitionEngine generalisation (SDK UI Layer Plan, Transition Definition
// section). Proves the generic mechanism itself: transitionEngine.evaluate,
// called directly, genuinely enforces a transition_definitions row's Quality
// Gate for a real entity instance — blocked, then unblocked — exactly like
// qualityGateEngine's existing single-entity-type (Deliverable) wiring does.
//
// NOTE: Transition Definitions are NOT authored through an SDK pipeline. CR-019
// established they are authored through the CR-007 add/retire form (noun × verb),
// and the bug fix that made Pack/Template/Profile authoring entity-direct removed
// the old Deliverable-based SDK authoring pipeline entirely — so the earlier two
// tests here (which drove startAuthoring → submitForReview → publish for a
// TransitionDefinition) tested a path that no longer exists by design and were
// removed. The engine-enforcement test below is independent of authoring.
//
// Built on throwaway, randomized (fromState, toState) pairs for AttentionItem
// — the same isolation discipline tests/quality-gate-generalization.test.ts
// already established, for the same reason: inserting against a real, seeded
// triple would be a permanent, global change to this shared dev database.
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
import { validateTransitionDefinitionSeed, addTransitionDefinition } from "../src/routes/seu/core/transitionDefinitions.js";
import { addVerb, addMapping, listAuthorityMapping } from "../src/routes/seu/core/authorityVocabulary.js";
import { ensureWebAppTemplateFixture } from "./testFixtures.js";

after(async () => {
  await pool.end();
});

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
    const step = await transitionObligation({ obligationId: obligation.id, targetState, actorRole: "super", actorId: "1001" });
    assert.equal(step.ok, true, !step.ok ? JSON.stringify(step) : undefined);
  }

  const afterResolution = await transitionEngine.evaluate(evaluateArgs);
  assert.equal(afterResolution.allowed, true);
});

test("Transition Definition authoring: a Quality Gate code scoped to a different transition is rejected", async () => {
  const gateFromState = `td-mismatch-gate-from-${randomUUID()}`;
  const gateToState = `td-mismatch-gate-to-${randomUUID()}`;
  // CR-059 build-time fix — since CR-058, `code` is no longer author-typed
  // (qualityGatesDB.upsert always sets code = category); this test's own
  // `code` field was silently ignored, so every un-categorized gate landed
  // in the shared default "Exit" bucket. findByCode("Exit") then resolves
  // ambiguously among every other "Exit"-category test gate in the shared
  // dev DB (its own documented limitation), sometimes returning a
  // different-transition gate than this one — a real, observed flake, not
  // hypothetical. A run-scoped category makes the lookup unambiguous.
  const { data: gate, error: gateError } = await qualityGatesDB.upsert({
    name: "Transition Definition mismatch test gate",
    category: `test-${randomUUID()}`,
    entityType: "AttentionItem",
    fromState: gateFromState,
    toState: gateToState,
    criteria: { type: "no_unresolved_obligations" },
    originatingPackId: await anyRealPackId(),
  });
  assert.ok(!gateError && gate, gateError?.message);

  // The referential check lives in validateTransitionDefinitionSeed (the same
  // validator the CR-007 form and any publisher run) — a Quality Gate code
  // scoped to a different (entityType, fromState, toState) triple is rejected.
  const result = await validateTransitionDefinitionSeed({
    entityType: "AttentionItem",
    fromState: `td-mismatch-from-${randomUUID()}`,
    toState: `td-mismatch-to-${randomUUID()}`,
    requiredQualityGateCodes: [gate!.code],
  });
  assert.equal(result.ok, false);
  assert.match((!result.ok && result.errors.join(";")) || "", /is scoped to AttentionItem/);
});

// Owner: "the allow now has only [noun] and [verb]. It should also include
// the trigger" — and the bug found reviewing the first pass: trigger has no
// storage of its own on a mapping row, it's a live read-through off whichever
// transition_definitions rows already share the (noun, verb) pair. Applying
// the Allow form's chosen trigger straight onto those rows would silently
// overwrite an ALREADY-EXISTING mapping's real, deliberately-set transitions
// every time Allow is resubmitted (its own upsert is idempotent — re-adding
// an existing pair just reactivates it). The fix: store the choice as the
// mapping's own default_trigger (migration 128), applied only to a NEW
// transition definition added later — never retroactively.
test("Mapping's Allow trigger seeds a new Transition Definition, but re-Allowing an existing pair never rewrites an already-wired one", async () => {
  const verbCode = `verb-td-${randomUUID().slice(0, 8)}`;
  const nounCode = "AttentionItem";
  const fromState = `td-mapping-from-${randomUUID()}`;
  const toState = `td-mapping-to-${randomUUID()}`;

  const verbAdded = await addVerb(verbCode, "Test trigger verb", null);
  assert.equal(verbAdded.ok, true, !verbAdded.ok ? verbAdded.error : undefined);

  const allowed = await addMapping(nounCode, verbCode, "governed");
  assert.equal(allowed.ok, true, !allowed.ok ? allowed.error : undefined);

  const created = await addTransitionDefinition({ entityType: nounCode, fromState, toState, verb: verbCode });
  assert.equal(created.ok, true, !created.ok ? created.error : undefined);

  const { data: rowAfterCreate } = await transitionDefinitionsDB.find(nounCode, fromState, toState);
  assert.equal(rowAfterCreate?.trigger, "governed", "a new transition under this pair starts at the mapping's chosen trigger");

  const mappingAfterCreate = (await listAuthorityMapping()).find((m) => m.nounCode === nounCode && m.verbCode === verbCode);
  assert.equal(mappingAfterCreate?.hasWiredTransitions, true);
  assert.equal(mappingAfterCreate?.trigger, "governed");

  // Re-submitting Allow for the SAME pair with a DIFFERENT trigger — this is
  // exactly what the first pass got wrong: it must move the mapping's own
  // default, but must never touch the transition that already exists.
  const reAllowed = await addMapping(nounCode, verbCode, "manual");
  assert.equal(reAllowed.ok, true, !reAllowed.ok ? reAllowed.error : undefined);

  const { data: rowAfterReAllow } = await transitionDefinitionsDB.find(nounCode, fromState, toState);
  assert.equal(rowAfterReAllow?.trigger, "governed", "an already-wired transition's trigger must survive re-submitting Allow");

  const mappingAfterReAllow = (await listAuthorityMapping()).find((m) => m.nounCode === nounCode && m.verbCode === verbCode);
  assert.equal(mappingAfterReAllow?.defaultTrigger, "manual", "the mapping's own default DOES move on re-Allow");
  assert.equal(mappingAfterReAllow?.trigger, "governed", "the list still shows the real wired transition's trigger, not the new default");

  // A SECOND new transition under the same pair now starts at the updated default.
  const secondFromState = `td-mapping-from2-${randomUUID()}`;
  const secondToState = `td-mapping-to2-${randomUUID()}`;
  const createdSecond = await addTransitionDefinition({ entityType: nounCode, fromState: secondFromState, toState: secondToState, verb: verbCode });
  assert.equal(createdSecond.ok, true, !createdSecond.ok ? createdSecond.error : undefined);
  const { data: secondRow } = await transitionDefinitionsDB.find(nounCode, secondFromState, secondToState);
  assert.equal(secondRow?.trigger, "manual", "a transition added after the re-Allow starts at the NEW default");
});
