// CR-139: the review gates conflict detector and its unravel, on hand-built Pack rows.
import { test } from "node:test";
import assert from "node:assert/strict";

import { detectReviewGateConflictsFrom, reviewGateKey } from "../src/domain/engine/conflicts/reviewGates.js";
import { unravelReviewGates } from "../src/domain/engine/conflicts/unravelReviewGates.js";
import type { ComposedPacks } from "../src/domain/engine/conflicts/composedPacks.js";
import type { PackContributions, PackRow } from "../src/dblayer/seuTypes.js";

const STEP = "Deliverable|In Progress|Approved";

const packs = (...entries: Array<[string, PackContributions]>): ComposedPacks => ({
  packs: entries.map(([code, contributions]) => ({ id: `id-${code}`, code, contributions }) as unknown as PackRow),
  directPackCodes: entries.map(([code]) => code),
  warnings: [],
  dependencyConflicts: [],
});
const gate = (over: Record<string, unknown> = {}) => ({ code: "rg1", name: "Review", governedTransition: STEP, ...over });
const detect = (...entries: Array<[string, PackContributions]>) => detectReviewGateConflictsFrom(unravelReviewGates({ composedPacks: packs(...entries) }));

test("one review gate, or two identical gates from two Packs, is no conflict", () => {
  assert.deepEqual(detect(["a", { reviewGates: [gate()] }]), []);
  assert.deepEqual(detect(["a", { reviewGates: [gate()] }], ["b", { reviewGates: [gate()] }]), []);
});

test("a different field of any kind at the same step is a conflict", () => {
  for (const over of [{ code: "rg2" }, { name: "Other" }, { statement: "s" }, { classification: "judgment" }, { externalEvidence: true }, { prompt: "p" }, { participant: "AI" }, { outputContract: "assessment-acceptance" }, { assurance: "a" }]) {
    const conflicts = detect(["a", { reviewGates: [gate()] }], ["b", { reviewGates: [gate(over)] }]);
    assert.equal(conflicts.length, 1, JSON.stringify(over));
    assert.equal(conflicts[0].key, reviewGateKey(STEP));
    assert.equal(conflicts[0].options.length, 2);
  }
});

test("checklists are a union: gates that differ only in their checklists or recommended checklists are no conflict", () => {
  assert.deepEqual(detect(["a", { reviewGates: [gate({ checklistIds: ["x"], recommendedChecklistIds: ["r1"] })] }], ["b", { reviewGates: [gate({ checklistIds: ["y"], recommendedChecklistIds: ["r2"] })] }]), []);
});

test("gates at different steps are not compared", () => {
  assert.deepEqual(detect(["a", { reviewGates: [gate()] }], ["b", { reviewGates: [gate({ governedTransition: "Deliverable|Approved|Released", code: "rg2" })] }]), []);
});

test("a picked conflict is returned with its pick", () => {
  const facts = unravelReviewGates({ composedPacks: packs(["a", { reviewGates: [gate()] }], ["b", { reviewGates: [gate({ name: "Other" })] }]) });
  assert.deepEqual(detectReviewGateConflictsFrom(facts, { [reviewGateKey(STEP)]: ["a", "b"] }).map((c) => c.resolution), [["a", "b"]]);
});
