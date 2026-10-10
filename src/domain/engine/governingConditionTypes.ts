export function getField(context: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, context);
}

export type ComparisonOperator = "gt" | "gte" | "lt" | "lte" | "eq" | "neq";

function compare(fieldValue: unknown, operator: ComparisonOperator, target: unknown): boolean {
  if (operator === "eq") return fieldValue === target;
  if (operator === "neq") return fieldValue !== target;
  const a = Number(fieldValue);
  const b = Number(target);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  if (operator === "gt") return a > b;
  if (operator === "gte") return a >= b;
  if (operator === "lt") return a < b;
  return a <= b;
}

export type ConditionEvaluator = (condition: Record<string, unknown>, context: Record<string, unknown>) => boolean;

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
