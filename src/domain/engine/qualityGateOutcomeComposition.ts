import {
  QUALITY_GATE_COMPOSITION_RULE_ALL_PASSED, QUALITY_GATE_COMPOSITION_RULE_ANY_BLOCKED, QUALITY_GATE_COMPOSITION_RULE_ANY_WAIVED,
  QUALITY_GATE_COMPOSITION_RULE_NO_GATES, QUALITY_GATE_FULL_CONFIDENCE,
} from "../../dblayer/constants.js";
import type { QualityGateDecisionOutcome, QualityGateOutcomeValue } from "../../dblayer/seuTypes.js";

// The outcome of one evaluated gate, as the composition sees it.
export interface QualityGateOutcomeInputItem {
  gateName: string;
  outcome: QualityGateOutcomeValue;
}

export interface ComposedQualityGateOutcome {
  outcome: QualityGateDecisionOutcome;
  rule: string;
}

// Outcome composition: the outcome of the decision from the outcomes of the gates evaluated for one hop. The rules apply in this order.
//   1. No gate applies: NotApplicable.
//   2. Any gate Blocked: Blocked.
//   3. No gate Blocked and any gate Waived: Waived.
//   4. Every gate Passed: Approved.
// PassedWithConditions and Deferred have no rule yet. No gate produces them, and the function throws if one does until a rule is defined here.
export function composeQualityGateOutcome(items: QualityGateOutcomeInputItem[]): ComposedQualityGateOutcome {
  if (items.length === 0) return { outcome: "NotApplicable", rule: QUALITY_GATE_COMPOSITION_RULE_NO_GATES };
  if (items.some((i) => i.outcome === "Blocked")) return { outcome: "Blocked", rule: QUALITY_GATE_COMPOSITION_RULE_ANY_BLOCKED };
  if (items.some((i) => i.outcome === "Waived")) return { outcome: "Waived", rule: QUALITY_GATE_COMPOSITION_RULE_ANY_WAIVED };
  if (items.every((i) => i.outcome === "Passed")) return { outcome: "Approved", rule: QUALITY_GATE_COMPOSITION_RULE_ALL_PASSED };
  throw new Error(`no outcome composition rule for gate outcomes: ${items.map((i) => `${i.gateName}=${i.outcome}`).join(", ")}`);
}

// Confidence level of a decision, from 0 to 100. The rules are defined as the build proceeds: until then an outcome has full confidence.
export function calculateConfidenceLevel(_composed: ComposedQualityGateOutcome, _items: QualityGateOutcomeInputItem[]): number {
  return QUALITY_GATE_FULL_CONFIDENCE;
}

// The rationale, generated from the composition and the confidence level.
export function generateQualityGateRationale(composed: ComposedQualityGateOutcome, items: QualityGateOutcomeInputItem[], confidenceLevel: number): string {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i.outcome, (counts.get(i.outcome) ?? 0) + 1);
  const summary = [...counts.entries()].map(([outcome, n]) => `${n} ${outcome}`).join(", ") || "no gate evaluated";
  return `${composed.outcome} by rule ${composed.rule}: ${summary}; confidence ${confidenceLevel}%`;
}
