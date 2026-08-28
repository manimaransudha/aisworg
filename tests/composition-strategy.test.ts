// CR-067 — the generic Composition Strategy engine's own strategy functions
// (specialize/merge/union/intersection/supplement/strategyRequirements).
// Pure functions, no DB — unlike engine.test.ts's own compositionEngine.compose
// coverage, none of this needs a database fixture at all.
import { test } from "node:test";
import assert from "node:assert/strict";

import { compositionEngine, type CompositionSource } from "../src/domain/engine/compositionEngine.js";

function source(id: string, code: string, fields: Record<string, unknown>): CompositionSource {
  return { id, code, fields };
}

test("strategyRequirements — the owner's own examples (Specialization needs 1, Merge needs 2+)", () => {
  assert.deepEqual(compositionEngine.strategyRequirements("specialization"), { minSources: 1, maxSources: 1, sameCodeRequired: false });
  assert.deepEqual(compositionEngine.strategyRequirements("merge"), { minSources: 2, maxSources: null, sameCodeRequired: true });
  assert.deepEqual(compositionEngine.strategyRequirements("union"), { minSources: 2, maxSources: null, sameCodeRequired: false });
  assert.deepEqual(compositionEngine.strategyRequirements("intersection"), { minSources: 2, maxSources: null, sameCodeRequired: false });
  assert.deepEqual(compositionEngine.strategyRequirements("supplement"), { minSources: 2, maxSources: null, sameCodeRequired: false });
  assert.deepEqual(compositionEngine.strategyRequirements("override"), { minSources: 0, maxSources: 0, sameCodeRequired: false });
});

test("strategyRequirements — unknown strategy and conflict-detection both fall back to Override (owner's fallback rule)", () => {
  assert.deepEqual(compositionEngine.strategyRequirements("conflict-detection"), compositionEngine.strategyRequirements("override"));
  assert.deepEqual(compositionEngine.strategyRequirements("not-a-real-strategy"), compositionEngine.strategyRequirements("override"));
});

test("specialize — exact copy of the parent, code included, free to override any field", () => {
  const parent = source("p1", "widget-a", { name: "Widget A", description: "original" });
  const result = compositionEngine.specialize(parent, { name: "Widget A Specialized" });
  assert.deepEqual(result.fields, { name: "Widget A Specialized", description: "original" });
  assert.deepEqual(result.parentIds, ["p1"]);
});

test("merge — requires at least two sources", () => {
  const result = compositionEngine.merge([source("a", "x", {})]);
  assert.equal(result.ok, false);
});

test("merge — requires every source to share the same code", () => {
  const result = compositionEngine.merge([source("a", "x", { name: "A" }), source("b", "y", { name: "B" })]);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /same code/);
});

test("merge — combines unambiguous fields, flags a genuine disagreement", () => {
  const a = source("a", "shared-code", { name: "Same", owner: "team-a" });
  const b = source("b", "shared-code", { name: "Same", owner: "team-b" });
  const result = compositionEngine.merge([a, b]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.fields.name, "Same");
  assert.equal("owner" in result.fields, false, "a disagreeing field must not survive into the merged result");
  assert.equal(result.conflicts.length, 1);
  assert.match(result.conflicts[0], /owner/);
  assert.deepEqual(result.parentIds, ["a", "b"]);
});

test("merge — a field present in only one source combines unambiguously (no conflict)", () => {
  const a = source("a", "shared-code", { name: "Same", onlyOnA: "value" });
  const b = source("b", "shared-code", { name: "Same" });
  const result = compositionEngine.merge([a, b]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.fields.onlyOnA, "value");
  assert.deepEqual(result.conflicts, []);
});

test("merge — Conflict Detection walks into nested contribution structure, not just the top field", () => {
  const a = source("a", "shared-code", {
    contributions: { checklists: [{ name: "Checklist 1", items: [{ statement: "Do the thing" }] }] },
  });
  const b = source("b", "shared-code", {
    contributions: { checklists: [{ name: "Checklist 1", items: [{ statement: "Do the OTHER thing" }] }] },
  });
  const result = compositionEngine.merge([a, b]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.conflicts.length, 1);
  // The path should identify the specific nested item, not just "contributions" or "checklists".
  assert.match(result.conflicts[0], /statement/);
  assert.match(result.conflicts[0], /Checklist 1/);
});

test("union — no same-code requirement, same combine-with-flag algorithm as merge", () => {
  const a = source("a", "pack-a", { requiredCapabilityCodes: "irrelevant-here", shared: "yes" });
  const b = source("b", "pack-b", { shared: "yes" });
  const result = compositionEngine.union([a, b]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.fields.shared, "yes");
});

test("intersection — keeps only unanimous fields, drops disagreement silently (never flags)", () => {
  const a = source("a", "x", { name: "Same", onlyOnA: "value", disagree: "a" });
  const b = source("b", "y", { name: "Same", disagree: "b" });
  const result = compositionEngine.intersection([a, b]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.fields, { name: "Same" });
});

test("supplement — purely additive: base fields untouched, colliding supplement keys rejected not applied", () => {
  const base = source("base", "x", { name: "Base", existingField: "base-value" });
  const supplement1 = source("s1", "y", { existingField: "attempted-override", newField: "added" });
  const result = compositionEngine.supplement(base, [supplement1]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.fields.existingField, "base-value", "supplement must never override an existing base field");
  assert.equal(result.fields.newField, "added");
  assert.deepEqual(result.rejected, ["existingField"]);
});

test("supplement — requires at least one supplementing source", () => {
  const base = source("base", "x", { name: "Base" });
  const result = compositionEngine.supplement(base, []);
  assert.equal(result.ok, false);
});
