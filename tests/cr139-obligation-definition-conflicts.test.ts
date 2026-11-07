// CR-139: the Obligation definitions conflict detector and its unravel, on hand-built Pack rows.
import { test } from "node:test";
import assert from "node:assert/strict";

import { detectObligationDefinitionConflictsFrom, obligationStepKey } from "../src/domain/engine/conflicts/obligationDefinitions.js";
import { unravelObligationDefinitions } from "../src/domain/engine/conflicts/unravelObligationDefinitions.js";
import type { ComposedPacks } from "../src/domain/engine/conflicts/composedPacks.js";
import type { PackContributions, PackRow } from "../src/dblayer/seuTypes.js";

const STEP = "Deliverable|In Progress|Approved";

const packs = (...entries: Array<[string, PackContributions]>): ComposedPacks => ({
  packs: entries.map(([code, contributions]) => ({ id: `id-${code}`, code, contributions }) as unknown as PackRow),
  directPackCodes: entries.map(([code]) => code),
  warnings: [],
  dependencyConflicts: [],
});
const obligation = (code: string, over: Record<string, unknown> = {}, deliverable = "source-code", steps = [STEP]) => ({
  code, category: "c", title: "t", description: "d", origin: "o", priority: "High", severity: "High", completionCriteria: "done",
  requiredEvidence: { title: "", category: "", description: "", collectionMethod: "" },
  applicabilityDeliverables: [{ name: deliverable, transitions: steps, governingCondition: null }], ...over,
});
const detect = (...entries: Array<[string, PackContributions]>) => detectObligationDefinitionConflictsFrom(unravelObligationDefinitions({ composedPacks: packs(...entries) }));

test("the same definition from two Packs, word for word, is no conflict", () => {
  assert.deepEqual(detect(["a", { obligationDefinitions: [obligation("o1")] }], ["b", { obligationDefinitions: [obligation("o1")] }]), []);
});

test("the table's example: the same code with priority High in one Pack and Low in the other is a conflict", () => {
  const conflicts = detect(["a", { obligationDefinitions: [obligation("o1")] }], ["b", { obligationDefinitions: [obligation("o1", { priority: "Low" })] }]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].key, obligationStepKey("source-code", STEP));
  assert.equal(conflicts[0].kind, "obligation-different");
  assert.equal(conflicts[0].options.length, 2);
});

test("a different code on the same Deliverable at the same step is a conflict", () => {
  assert.equal(detect(["a", { obligationDefinitions: [obligation("o1")] }], ["b", { obligationDefinitions: [obligation("o2")] }]).length, 1);
});

test("a different field of any kind is a conflict", () => {
  for (const over of [{ category: "x" }, { title: "x" }, { description: "x" }, { origin: "x" }, { priority: "Low" }, { severity: "Low" }, { completionCriteria: "x" }, { requiredEvidence: { title: "x", category: "", description: "", collectionMethod: "" } }, { classification: "judgment" }, { externalEvidence: true }, { prompt: "p" }, { participant: "AI" }, { outputContract: "assessment-acceptance" }, { assurance: "a" }]) {
    assert.equal(detect(["a", { obligationDefinitions: [obligation("o1")] }], ["b", { obligationDefinitions: [obligation("o1", over)] }]).length, 1, JSON.stringify(over));
  }
});

test("a different governing condition for the Deliverable is a conflict", () => {
  const withCondition = obligation("o1", { applicabilityDeliverables: [{ name: "source-code", transitions: [STEP], governingCondition: { type: "field_in", field: "tier", values: ["x"] } }] });
  assert.equal(detect(["a", { obligationDefinitions: [obligation("o1")] }], ["b", { obligationDefinitions: [withCondition] }]).length, 1);
});

test("definitions for different Deliverables or different steps are not compared", () => {
  assert.deepEqual(detect(["a", { obligationDefinitions: [obligation("o1")] }], ["b", { obligationDefinitions: [obligation("o2", {}, "api-spec")] }]), []);
  assert.deepEqual(detect(["a", { obligationDefinitions: [obligation("o1")] }], ["b", { obligationDefinitions: [obligation("o2", {}, "source-code", ["Deliverable|Approved|Released"])] }]), []);
});

test("a definition that applies to several steps is compared at each of them", () => {
  const conflicts = detect(["a", { obligationDefinitions: [obligation("o1", {}, "source-code", [STEP, "Deliverable|Approved|Released"])] }], ["b", { obligationDefinitions: [obligation("o2", {}, "source-code", ["Deliverable|Approved|Released"])] }]);
  assert.deepEqual(conflicts.map((c) => c.key), [obligationStepKey("source-code", "Deliverable|Approved|Released")]);
});

test("a definition that applies to no Deliverable is never compared", () => {
  assert.deepEqual(detect(["a", { obligationDefinitions: [obligation("o1", { applicabilityDeliverables: [] })] }], ["b", { obligationDefinitions: [obligation("o2", { applicabilityDeliverables: [] })] }]), []);
});

test("a picked conflict is returned with its pick", () => {
  const facts = unravelObligationDefinitions({ composedPacks: packs(["a", { obligationDefinitions: [obligation("o1")] }], ["b", { obligationDefinitions: [obligation("o2")] }]) });
  assert.deepEqual(detectObligationDefinitionConflictsFrom(facts, { [obligationStepKey("source-code", STEP)]: ["o1"] }).map((c) => c.resolution), [["o1"]]);
});
