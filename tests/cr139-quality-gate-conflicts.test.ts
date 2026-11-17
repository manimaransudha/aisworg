// CR-139, CR-145: the quality gates conflict detector and its unravel. The detector reads the rows the unravel gathers from the Quality Gate Definitions the Packs list.
import { test } from "node:test";
import assert from "node:assert/strict";

import { detectQualityGateConflictsFrom, qualityGateKey } from "../src/domain/engine/conflicts/qualityGates.js";
import { unravelQualityGates, type QualityGateRow } from "../src/domain/engine/conflicts/unravelQualityGates.js";
import type { ComposedPacks } from "../src/domain/engine/conflicts/composedPacks.js";
import type { PackContributions, PackQualityGate, PackRow, QualityGateDefinitionRow } from "../src/dblayer/seuTypes.js";

const STEP = "Deliverable|In Progress|Approved";

const packs = (...entries: Array<[string, PackContributions]>): ComposedPacks => ({
  packs: entries.map(([code, contributions]) => ({ id: `id-${code}`, code, contributions }) as unknown as PackRow),
  directPackCodes: entries.map(([code]) => code),
  warnings: [],
  dependencyConflicts: [],
});
const definition = (over: Partial<QualityGateDefinitionRow> = {}): QualityGateDefinitionRow => ({
  id: "d1", code: "code-review", name: "Code review", description: null, category: "Exit", criteria_type: "requires_accepted_review",
  evidence_category: null,
  version: "1.0.0", status: "Active", draft_content: {}, authored_by: "u", author_badge: "b", tenant_id: "t", parent_quality_gate_definition_id: null, created_at: "", schema_definition_id: null, ...over,
});
// A Pack's entry for a gate: where it applies, and the Checklists and Policies the Pack supplies.
const entry = (over: Partial<PackQualityGate> = {}): PackQualityGate => ({ qualityCode: "code-review", governedTransition: STEP, deliverableName: "source-code", ...over });
const gates = (...entries: Array<[string, PackQualityGate[]]>) => packs(...entries.map(([code, qualityGates]) => [code, { qualityGates }] as [string, PackContributions]));

// A row as the unravel gathers it, for a detector test that needs two different rows with one code.
const row = (pack: string, fields: Record<string, unknown>, deliverable = "source-code", step = STEP): QualityGateRow => ({
  packId: `id-${pack}`, packCode: pack, qualityGateDefinitionId: "definition-code-review", deliverable, step, fields: { code: "code-review", ...fields }, checklistIds: [], recommendedChecklistIds: [],
});

test("a Pack lists a gate by its code: the unravel reads the definition, and a code with no definition is left out", () => {
  const facts = unravelQualityGates({ composedPacks: gates(["a", [entry(), entry({ qualityCode: "no-such-gate" })]]), deliverableCodes: [], definitions: [definition()] });
  assert.equal(facts.gates.length, 1);
  assert.deepEqual([facts.gates[0].packCode, facts.gates[0].deliverable, facts.gates[0].step, facts.gates[0].fields.code], ["a", "source-code", STEP, "code-review"]);
});

test("two Packs that list the same code share one definition, so there is no conflict", () => {
  const facts = unravelQualityGates({ composedPacks: gates(["a", [entry()]], ["b", [entry()]]), deliverableCodes: [], definitions: [definition()] });
  assert.equal(facts.gates.length, 2);
  assert.deepEqual(detectQualityGateConflictsFrom(facts), []);
});

test("gates with different codes are different items, even for one Deliverable at one step", () => {
  const facts = unravelQualityGates({ composedPacks: gates(["a", [entry()]], ["b", [entry({ qualityCode: "other-review" })]]), deliverableCodes: [], definitions: [definition(), definition({ code: "other-review", name: "Other" })] });
  assert.deepEqual(detectQualityGateConflictsFrom(facts), []);
});

test("rows of one code that differ in any field are a conflict", () => {
  const conflicts = detectQualityGateConflictsFrom({ gates: [row("a", { name: "Code review" }), row("b", { name: "Review gate" })] });
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].key, qualityGateKey(STEP, "source-code", "code-review"));
  assert.equal(conflicts[0].kind, "quality-gate-different");
  assert.equal(conflicts[0].options.length, 2);
  for (const over of [{ category: "Entry" }, { criteriaType: "no_unresolved_obligations" }, { requiredPolicyCodes: ["p1"] }, { statement: "s" }, { classification: "judgment" }, { participant: "AI" }]) {
    assert.equal(detectQualityGateConflictsFrom({ gates: [row("a", { name: "n" }), row("b", { name: "n", ...over })] }).length, 1, JSON.stringify(over));
  }
});

test("the required Policy codes of a Pack entry are read in order, so a different order is the same", () => {
  const facts = unravelQualityGates({ composedPacks: gates(["a", [entry({ requiredPolicyCodes: ["y", "x"] })]]), deliverableCodes: [], definitions: [definition()] });
  assert.deepEqual(facts.gates[0].fields.requiredPolicyCodes, ["x", "y"]);
});

test("checklists are a union, mandatory ones apart from optional ones: they are kept apart from the fields and never compared", () => {
  const facts = unravelQualityGates({ composedPacks: gates(["a", [entry({ checklists: [{ checklistId: "y", mandatory: true }, { checklistId: "x", mandatory: true }, { checklistId: "r2" }, { checklistId: "r1", mandatory: false }] })]]), deliverableCodes: [], definitions: [definition()] });
  assert.deepEqual([facts.gates[0].checklistIds, facts.gates[0].recommendedChecklistIds], [["x", "y"], ["r1", "r2"]]);
  assert.equal("checklistIds" in facts.gates[0].fields, false);
});

test("gates for different Deliverables or different steps are not compared", () => {
  assert.deepEqual(detectQualityGateConflictsFrom({ gates: [row("a", { name: "A" }), row("b", { name: "B" }, "api-spec")] }), []);
  assert.deepEqual(detectQualityGateConflictsFrom({ gates: [row("a", { name: "A" }), row("b", { name: "B" }, "source-code", "Deliverable|Approved|Released")] }), []);
});

test("a Pack that lists a gate for several Deliverables is gathered once for each of them", () => {
  const facts = unravelQualityGates({ composedPacks: gates(["a", [entry({ deliverableName: "d1" }), entry({ deliverableName: "d2" })]]), deliverableCodes: [], definitions: [definition()] });
  assert.deepEqual(facts.gates.map((g) => g.deliverable), ["d1", "d2"]);
});

test("a gate that names no Deliverable on a Deliverable transition applies to every Deliverable of the catalogue, in code order", () => {
  const facts = unravelQualityGates({ composedPacks: gates(["a", [entry({ deliverableName: undefined })]]), deliverableCodes: ["d2", "d1"], definitions: [definition()] });
  assert.deepEqual(facts.gates.map((g) => g.deliverable), ["d1", "d2"]);
});

test("a gate that names no Deliverable and a catalogue with none gives no row", () => {
  const facts = unravelQualityGates({ composedPacks: gates(["a", [entry({ deliverableName: undefined })]]), deliverableCodes: [], definitions: [definition()] });
  assert.deepEqual(facts.gates, []);
});

test("a gate that names a Deliverable applies to it, whatever the catalogue holds", () => {
  const facts = unravelQualityGates({ composedPacks: gates(["a", [entry({ deliverableName: "source-code" })]]), deliverableCodes: ["d1"], definitions: [definition()] });
  assert.deepEqual(facts.gates.map((g) => g.deliverable), ["source-code"]);
});

test("a gate that names no Deliverable on another entity's transition keeps the Deliverable \"\"", () => {
  const facts = unravelQualityGates({ composedPacks: gates(["a", [entry({ governedTransition: "Pack|Draft|Validated", deliverableName: undefined })]]), deliverableCodes: ["d1"], definitions: [definition()] });
  assert.deepEqual(facts.gates.map((g) => g.deliverable), [""]);
});

test("gates that carry the Deliverable \"\" are compared with each other", () => {
  const conflicts = detectQualityGateConflictsFrom({ gates: [row("a", { name: "A" }, ""), row("b", { name: "B" }, "")] });
  assert.deepEqual(conflicts.map((c) => c.key), [qualityGateKey(STEP, "", "code-review")]);
});

test("a picked conflict is returned with its pick", () => {
  const facts = { gates: [row("a", { name: "Code review" }), row("b", { name: "Review gate" })] };
  assert.deepEqual(detectQualityGateConflictsFrom(facts, { [qualityGateKey(STEP, "source-code", "code-review")]: ["a"] }).map((c) => c.resolution), [["a"]]);
});
