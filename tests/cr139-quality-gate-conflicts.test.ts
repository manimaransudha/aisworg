// CR-139: the quality gates conflict detector and its unravel, on hand-built Pack rows.
import { test } from "node:test";
import assert from "node:assert/strict";

import { detectQualityGateConflictsFrom, qualityGateKey } from "../src/domain/engine/conflicts/qualityGates.js";
import { unravelQualityGates } from "../src/domain/engine/conflicts/unravelQualityGates.js";
import type { ComposedPacks } from "../src/domain/engine/conflicts/composedPacks.js";
import type { PackContributions, PackRow } from "../src/dblayer/seuTypes.js";

const STEP = "Deliverable|In Progress|Approved";

const packs = (...entries: Array<[string, PackContributions]>): ComposedPacks => ({
  packs: entries.map(([code, contributions]) => ({ id: `id-${code}`, code, contributions }) as unknown as PackRow),
  directPackCodes: entries.map(([code]) => code),
  warnings: [],
  dependencyConflicts: [],
});
const gate = (over: Record<string, unknown> = {}) => ({ name: "Code review", category: "Verification", governedTransition: STEP, criteriaType: "requires_accepted_review" as const, deliverableName: "source-code", ...over });
const detect = (...entries: Array<[string, PackContributions]>) => detectQualityGateConflictsFrom(unravelQualityGates({ composedPacks: packs(...entries) }));

test("one gate, or two identical gates from two Packs, is no conflict", () => {
  assert.deepEqual(detect(["a", { qualityGates: [gate()] }]), []);
  assert.deepEqual(detect(["a", { qualityGates: [gate()] }], ["b", { qualityGates: [gate()] }]), []);
});

test("the table's example: the same criteria under two names is a conflict", () => {
  const conflicts = detect(["a", { qualityGates: [gate()] }], ["b", { qualityGates: [gate({ name: "Review gate" })] }]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].key, qualityGateKey(STEP, "source-code"));
  assert.equal(conflicts[0].kind, "quality-gate-different");
  assert.equal(conflicts[0].options.length, 2);
});

test("a different field of any kind is a conflict", () => {
  for (const over of [{ category: "Exit" }, { criteriaType: "no_unresolved_obligations" }, { requiredPolicyCodes: ["p1"] }, { statement: "s" }, { classification: "judgment" }, { participant: "AI" }, { outputContract: "assessment-acceptance" }]) {
    assert.equal(detect(["a", { qualityGates: [gate()] }], ["b", { qualityGates: [gate(over)] }]).length, 1, JSON.stringify(over));
  }
});

test("checklists are a union: gates that differ only in their checklists or recommended checklists are no conflict", () => {
  assert.deepEqual(detect(["a", { qualityGates: [gate({ checklistIds: ["x"], recommendedChecklistIds: ["r1"] })] }], ["b", { qualityGates: [gate({ checklistIds: ["y"], recommendedChecklistIds: ["r2"] })] }]), []);
});

test("the required Policy codes in a different order are the same", () => {
  assert.deepEqual(detect(["a", { qualityGates: [gate({ requiredPolicyCodes: ["x", "y"] })] }], ["b", { qualityGates: [gate({ requiredPolicyCodes: ["y", "x"] })] }]), []);
});

test("gates for different Deliverables or different steps are not compared", () => {
  assert.deepEqual(detect(["a", { qualityGates: [gate()] }], ["b", { qualityGates: [gate({ deliverableName: "api-spec", name: "Other" })] }]), []);
  assert.deepEqual(detect(["a", { qualityGates: [gate()] }], ["b", { qualityGates: [gate({ governedTransition: "Deliverable|Approved|Released", name: "Other" })] }]), []);
});

test("a gate listed for several Deliverables is compared for each of them", () => {
  const conflicts = detect(["a", { qualityGates: [gate({ deliverableName: undefined, applicabilityDeliverableNames: ["d1", "d2"] })] }], ["b", { qualityGates: [gate({ deliverableName: "d2", name: "Other" })] }]);
  assert.deepEqual(conflicts.map((c) => c.key), [qualityGateKey(STEP, "d2")]);
});

test("gates that name no Deliverable are compared with each other at the step", () => {
  const conflicts = detect(["a", { qualityGates: [gate({ deliverableName: undefined })] }], ["b", { qualityGates: [gate({ deliverableName: undefined, name: "Other" })] }]);
  assert.deepEqual(conflicts.map((c) => c.key), [qualityGateKey(STEP, "")]);
  assert.deepEqual(detect(["a", { qualityGates: [gate({ deliverableName: undefined })] }], ["b", { qualityGates: [gate({ name: "Other" })] }]), [], "a gate that names no Deliverable is not compared with a gate that names one");
});

test("a picked conflict is returned with its pick", () => {
  const unraveled = unravelQualityGates({ composedPacks: packs(["a", { qualityGates: [gate()] }], ["b", { qualityGates: [gate({ name: "Review gate" })] }]) });
  assert.deepEqual(detectQualityGateConflictsFrom(unraveled, { [qualityGateKey(STEP, "source-code")]: ["a"] }).map((c) => c.resolution), [["a"]]);
});
