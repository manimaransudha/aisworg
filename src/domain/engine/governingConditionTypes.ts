// Owner: "it has new condition types and comparison operators... They
// should be in a separate module so we can expand or add later" — every
// recognised governingCondition `type` and its evaluator live here, in one
// registry (CONDITION_EVALUATORS), not as a growing if/else chain in
// governingCondition.ts itself. Adding a future type is adding one entry
// here; nothing else in the platform (transitionEngine.ts/policyEngine.ts/
// qualityGateEngine.ts/participantEligibility.ts, all of which call
// evaluateCondition via governingCondition.ts) needs to change. Renamed
// from policyCondition(Types).ts/PolicyCondition — owner: "call them
// governingCondition because we can reuse Quality gates also to use this"
// (not Policy-specific; Quality Gate's own `policy.condition` already
// reuses this exact evaluator).
export function getField(context: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, context);
}

export type ComparisonOperator = "gt" | "gte" | "lt" | "lte" | "eq" | "neq";

// Owner: "comparison operators" — a numeric/string comparison against a
// single context field. Non-numeric operands fall back to string comparison
// for eq/neq only; gt/gte/lt/lte require both sides to coerce to a finite
// number (a non-numeric field fails closed, same discipline an unrecognised
// condition type already has).
function compare(fieldValue: unknown, operator: ComparisonOperator, target: unknown): boolean {
  if (operator === "eq") return fieldValue === target;
  if (operator === "neq") return fieldValue !== target;
  const a = Number(fieldValue);
  const b = Number(target);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  if (operator === "gt") return a > b;
  if (operator === "gte") return a >= b;
  if (operator === "lt") return a < b;
  return a <= b; // "lte"
}

export type ConditionEvaluator = (condition: Record<string, unknown>, context: Record<string, unknown>) => boolean;

// Ch.24's own implementation notes hinted at "a generic threshold — 80% of X
// must pass" and never built it; `threshold` here is that: a ratio/count
// field compared against a minimum, `gte`/`gt` only (a threshold is a floor,
// never a ceiling — `lt`/`lte`/`eq`/`neq` belong to the general-purpose
// `comparison` type instead, not duplicated here).
export const CONDITION_EVALUATORS: Record<string, ConditionEvaluator> = {
  always_true: () => true,
  field_in: (condition, context) => {
    const c = condition as { field: string; values: unknown[] };
    const value = getField(context, c.field);
    return Array.isArray(c.values) && c.values.includes(value);
  },
  comparison: (condition, context) => {
    const c = condition as { field: string; operator: ComparisonOperator; value: unknown };
    return compare(getField(context, c.field), c.operator, c.value);
  },
  threshold: (condition, context) => {
    const c = condition as { field: string; operator: "gte" | "gt"; value: number };
    return compare(getField(context, c.field), c.operator, c.value);
  },
};
