// Extracted from transitionEngine.ts (CR-058) so qualityGateEngine.ts can
// reuse the same condition evaluation for its new requires_active_policy
// criteria type without a transitionEngine <-> qualityGateEngine import
// cycle (transitionEngine already imports qualityGateEngine).
//
// Owner: "instead of calling then policyCondition, call them
// governingCondition because we can reuse Quality gates also to use this" —
// renamed from policyCondition.ts/PolicyCondition (this type is not
// Policy-specific; it's the real, machine-evaluated rule any governed
// mechanism can carry — Quality Gate's own `policy.condition` already
// reuses it, same as Policy's own governingCondition does). Distinct from
// seuTypes.ts's own `PolicyCondition` (Ch.24 §8's whole condition ROW —
// statement/requiredEvidence/severity/etc., of which THIS type is just one
// field, `governingCondition`) — no relation beyond the name they used to
// share.
//
// Owner (governingCondition expansion): "it has new condition types and
// comparison operators... They should be in a separate module so we can
// expand or add later." — every condition type's own evaluator now lives in
// governingConditionTypes.ts's CONDITION_EVALUATORS registry; this file is
// just the lookup, unchanged for every existing caller.
import { CONDITION_EVALUATORS } from "./governingConditionTypes.js";

export type GoverningCondition = { type: "always_true" } | { type: "field_in"; field: string; values: unknown[] } | Record<string, unknown>;

export function evaluateCondition(condition: GoverningCondition, context: Record<string, unknown>): boolean {
  const type = (condition as { type?: string }).type;
  const evaluator = type ? CONDITION_EVALUATORS[type] : undefined;
  return evaluator ? evaluator(condition as Record<string, unknown>, context) : false; // unrecognised condition types fail closed rather than silently pass
}
