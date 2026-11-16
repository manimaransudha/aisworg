// Outcome composition and confidence level (src/domain/engine/qualityGateOutcomeComposition.ts), and decideQualityGate, which calls both.
// The functions are pure, so no database is used.
import { test } from "node:test";
import assert from "node:assert/strict";

import { calculateConfidenceLevel, composeQualityGateOutcome, generateQualityGateRationale } from "../src/domain/engine/qualityGateOutcomeComposition.js";
import { QUALITY_GATE_COMPOSITION_RULE_ALL_PASSED, QUALITY_GATE_COMPOSITION_RULE_ANY_BLOCKED, QUALITY_GATE_COMPOSITION_RULE_ANY_WAIVED, QUALITY_GATE_COMPOSITION_RULE_NO_GATES, QUALITY_GATE_FULL_CONFIDENCE } from "../src/dblayer/constants.js";

const item = (outcome: "Passed" | "Blocked" | "Waived" | "Deferred", gateName = "gate") => ({ gateName, outcome });

test("no gate is NotApplicable, any Blocked gate blocks, any Waived gate waives, and all Passed approves", () => {
  assert.deepEqual(composeQualityGateOutcome([]), { outcome: "NotApplicable", rule: QUALITY_GATE_COMPOSITION_RULE_NO_GATES });
  assert.deepEqual(composeQualityGateOutcome([item("Passed"), item("Blocked"), item("Waived")]), { outcome: "Blocked", rule: QUALITY_GATE_COMPOSITION_RULE_ANY_BLOCKED });
  assert.deepEqual(composeQualityGateOutcome([item("Passed"), item("Waived")]), { outcome: "Waived", rule: QUALITY_GATE_COMPOSITION_RULE_ANY_WAIVED });
  assert.deepEqual(composeQualityGateOutcome([item("Passed"), item("Passed")]), { outcome: "Approved", rule: QUALITY_GATE_COMPOSITION_RULE_ALL_PASSED });
});

test("an outcome with no composition rule is an error", () => {
  assert.throws(() => composeQualityGateOutcome([item("Passed"), item("Deferred", "late gate")]), /no outcome composition rule.*late gate=Deferred/);
});

test("the confidence level is full until its rules are defined, and the rationale is generated from the composition", () => {
  const items = [item("Passed"), item("Passed")];
  const composed = composeQualityGateOutcome(items);
  const confidence = calculateConfidenceLevel(composed, items);
  assert.equal(confidence, QUALITY_GATE_FULL_CONFIDENCE);
  assert.equal(generateQualityGateRationale(composed, items, confidence), `Approved by rule ${QUALITY_GATE_COMPOSITION_RULE_ALL_PASSED}: 2 Passed; confidence 100%`);
});
