// Outcome composition and confidence level (src/domain/engine/qualityGateOutcomeComposition.ts). A condition is Passed or Blocked. The composition marks a
// Blocked condition Waived when a waiver covers it (tests/quality-gate-findings.test.ts), so an entity with no SEU has no waiver and these tests use no database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { calculateConfidenceLevel, composeQualityGateOutcome, generateQualityGateRationale } from "../src/domain/engine/qualityGateOutcomeComposition.js";
import { QUALITY_GATE_COMPOSITION_RULE_ALL_PASSED, QUALITY_GATE_COMPOSITION_RULE_ANY_BLOCKED, QUALITY_GATE_COMPOSITION_RULE_NO_GATES, QUALITY_GATE_FULL_CONFIDENCE } from "../src/dblayer/constants.js";

const item = (outcome: "Passed" | "Blocked", gateName = "condition") => ({ gateName, outcome, waivable: null });
const entity = { entityType: "Deliverable", entityId: randomUUID(), seuId: null };

test("no condition is NotApplicable, any Blocked condition blocks, and all Passed approves", async () => {
  assert.deepEqual((await composeQualityGateOutcome([], entity)).rule, QUALITY_GATE_COMPOSITION_RULE_NO_GATES);
  assert.equal((await composeQualityGateOutcome([], entity)).outcome, "NotApplicable");
  const blocked = await composeQualityGateOutcome([item("Passed"), item("Blocked")], entity);
  assert.deepEqual([blocked.outcome, blocked.rule], ["Blocked", QUALITY_GATE_COMPOSITION_RULE_ANY_BLOCKED]);
  const approved = await composeQualityGateOutcome([item("Passed"), item("Passed")], entity);
  assert.deepEqual([approved.outcome, approved.rule], ["Approved", QUALITY_GATE_COMPOSITION_RULE_ALL_PASSED]);
});

test("the confidence level is full until its rules are defined, and the rationale is generated from the composition", async () => {
  const composed = await composeQualityGateOutcome([item("Passed"), item("Passed")], entity);
  const confidence = calculateConfidenceLevel(composed, []);
  assert.equal(confidence, QUALITY_GATE_FULL_CONFIDENCE);
  assert.equal(generateQualityGateRationale(composed, confidence), `Approved by rule ${QUALITY_GATE_COMPOSITION_RULE_ALL_PASSED}: 2 Passed; confidence 100%`);
});
