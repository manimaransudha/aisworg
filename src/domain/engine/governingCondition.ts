import { CONDITION_EVALUATORS } from "./governingConditionTypes.js";

export type GoverningCondition = { type: "always_true" } | { type: "field_in"; field: string; values: unknown[] } | Record<string, unknown>;

export function evaluateCondition(condition: GoverningCondition, context: Record<string, unknown>): boolean {
  const type = (condition as { type?: string }).type;
  const evaluator = type ? CONDITION_EVALUATORS[type] : undefined;
  return evaluator ? evaluator(condition as Record<string, unknown>, context) : false;
}
