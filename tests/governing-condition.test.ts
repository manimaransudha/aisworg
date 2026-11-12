// Governing Condition evaluation (src/domain/engine/governingCondition.ts and governingConditionTypes.ts).
// A Policy's condition is evaluated against a context object. The functions are pure, so the tests build the context and the conditions by hand.
import { test } from "node:test";
import assert from "node:assert/strict";

import { evaluateCondition } from "../src/domain/engine/governingCondition.js";
import { getField, CONDITION_EVALUATORS } from "../src/domain/engine/governingConditionTypes.js";

const context = { score: 80, status: "Open", owner: { team: { name: "core" } }, tags: "x", empty: null };

test("getField reads a dotted path and returns undefined when a step is missing or is not an object", () => {
  assert.equal(getField(context, "score"), 80);
  assert.equal(getField(context, "owner.team.name"), "core");
  assert.equal(getField(context, "owner.missing.name"), undefined);
  assert.equal(getField(context, "tags.length"), undefined, "a string is not walked into");
  assert.equal(getField(context, "empty.value"), undefined, "null is not walked into");
  assert.equal(getField(context, "nothing"), undefined);
});

test("evaluateCondition is false for a condition with no type or a type that has no evaluator", () => {
  assert.equal(evaluateCondition({}, context), false);
  assert.equal(evaluateCondition({ type: "no-such-type" }, context), false);
});

test("always_true passes for any context", () => {
  assert.equal(evaluateCondition({ type: "always_true" }, {}), true);
  assert.equal(evaluateCondition({ type: "always_true" }, context), true);
});

test("field_in passes when the field value is one of the listed values", () => {
  assert.equal(evaluateCondition({ type: "field_in", field: "status", values: ["Open", "Closed"] }, context), true);
  assert.equal(evaluateCondition({ type: "field_in", field: "status", values: ["Closed"] }, context), false);
  assert.equal(evaluateCondition({ type: "field_in", field: "owner.team.name", values: ["core"] }, context), true, "a nested field");
  assert.equal(evaluateCondition({ type: "field_in", field: "nothing", values: ["Open"] }, context), false, "a missing field");
  assert.equal(evaluateCondition({ type: "field_in", field: "status", values: "Open" }, context), false, "values that are not a list");
});

test("comparison applies each of the six operators", () => {
  const check = (operator: string, value: unknown, expected: boolean) =>
    assert.equal(evaluateCondition({ type: "comparison", field: "score", operator, value }, context), expected, `score ${operator} ${String(value)}`);
  check("gt", 79, true);
  check("gt", 80, false);
  check("gte", 80, true);
  check("gte", 81, false);
  check("lt", 81, true);
  check("lt", 80, false);
  check("lte", 80, true);
  check("lte", 79, false);
  check("eq", 80, true);
  check("eq", 81, false);
  check("neq", 81, true);
  check("neq", 80, false);
});

test("comparison eq and neq compare without converting types, and the numeric operators convert to numbers", () => {
  assert.equal(evaluateCondition({ type: "comparison", field: "score", operator: "eq", value: "80" }, context), false);
  assert.equal(evaluateCondition({ type: "comparison", field: "score", operator: "neq", value: "80" }, context), true);
  assert.equal(evaluateCondition({ type: "comparison", field: "status", operator: "eq", value: "Open" }, context), true);
  assert.equal(evaluateCondition({ type: "comparison", field: "score", operator: "gte", value: "80" }, context), true, "a numeric string is read as a number");
  assert.equal(evaluateCondition({ type: "comparison", field: "status", operator: "gt", value: 1 }, context), false, "a value that is not a number never passes");
  assert.equal(evaluateCondition({ type: "comparison", field: "nothing", operator: "lt", value: 1 }, context), false, "a missing field never passes");
});

test("threshold passes when the field is at or above the value (gte) or above it (gt), and never for a value that is not a number", () => {
  assert.equal(evaluateCondition({ type: "threshold", field: "score", operator: "gte", value: 80 }, context), true);
  assert.equal(evaluateCondition({ type: "threshold", field: "score", operator: "gt", value: 80 }, context), false);
  assert.equal(evaluateCondition({ type: "threshold", field: "score", operator: "gt", value: 79 }, context), true);
  assert.equal(evaluateCondition({ type: "threshold", field: "score", operator: "gte", value: 81 }, context), false);
  assert.equal(evaluateCondition({ type: "threshold", field: "status", operator: "gte", value: 1 }, context), false);
  assert.equal(evaluateCondition({ type: "threshold", field: "nothing", operator: "gte", value: 1 }, context), false);
});

test("an operator that is not one of the six is evaluated as lte, for comparison and for threshold", () => {
  assert.equal(evaluateCondition({ type: "comparison", field: "score", operator: "unknown", value: 100 }, context), true);
  assert.equal(evaluateCondition({ type: "comparison", field: "score", operator: "unknown", value: 10 }, context), false);
  assert.equal(evaluateCondition({ type: "threshold", field: "score", operator: "unknown", value: 100 }, context), true);
  assert.equal(evaluateCondition({ type: "threshold", field: "score", operator: "unknown", value: 10 }, context), false);
});

test("the evaluator table holds the five condition types", () => {
  assert.deepEqual(Object.keys(CONDITION_EVALUATORS).sort(), ["always_false", "always_true", "comparison", "field_in", "threshold"]);
});
