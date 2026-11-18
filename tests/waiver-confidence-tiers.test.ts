// The confidence of a waiver of a no_unresolved_obligations gate, by the tier of what backs it (src/qualitygates/noUnresolvedObligations.ts), and the confidence
// of a decision, which is the lowest confidence of its waivers. These tests use no database. tests/quality-gate-waiver-risks.test.ts drives the same rule through real waivers.
import { test } from "node:test";
import assert from "node:assert/strict";

import { noUnresolvedObligationsWaiverConfidence as rate } from "../src/qualitygates/noUnresolvedObligations.js";
import { calculateConfidenceLevel } from "../src/domain/engine/qualityGateOutcomeComposition.js";
import { CONFIDENCE_LEVEL_PERCENT, QUALITY_GATE_FULL_CONFIDENCE } from "../src/dblayer/constants.js";

const composed = { outcome: "Waived" as const, rule: "any-waived", items: [] };

test("the four tiers: expiry only 25, expiry with records 50, Obligation control 75, Obligation control with records 100", () => {
  assert.equal(rate({ hasObligationControl: false, supportingRecordConfidences: [] }), 25);
  assert.equal(rate({ hasObligationControl: false, supportingRecordConfidences: [100] }), 50);
  assert.equal(rate({ hasObligationControl: true, supportingRecordConfidences: [] }), 75);
  assert.equal(rate({ hasObligationControl: true, supportingRecordConfidences: [100] }), 100);
});

test("the confidence of the supporting records scales the tier, so Evidence at 10% under tier 2 gives 5 and not 50", () => {
  assert.equal(rate({ hasObligationControl: false, supportingRecordConfidences: [10] }), 5);
  assert.equal(rate({ hasObligationControl: true, supportingRecordConfidences: [40] }), 40);
});

test("with several supporting records the lowest confidence is used", () => {
  assert.equal(rate({ hasObligationControl: false, supportingRecordConfidences: [100, 20, 66] }), 10);
  assert.equal(rate({ hasObligationControl: true, supportingRecordConfidences: [66, 100, 33] }), 33);
});

test("the text confidence levels stand for Low 33, Medium 66 and High 100", () => {
  assert.deepEqual(CONFIDENCE_LEVEL_PERCENT, { Low: 33, Medium: 66, High: 100 });
});

test("a decision takes the lowest confidence of its waivers, and has full confidence when no waiver is rated", () => {
  assert.equal(calculateConfidenceLevel(composed, [75, 25, 50]), 25);
  assert.equal(calculateConfidenceLevel(composed, [100]), 100);
  assert.equal(calculateConfidenceLevel(composed, []), QUALITY_GATE_FULL_CONFIDENCE);
});
