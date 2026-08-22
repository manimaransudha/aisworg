// Extracted from transitionEngine.ts (CR-058) so qualityGateEngine.ts can
// reuse the same condition evaluation for its new requires_active_policy
// criteria type without a transitionEngine <-> qualityGateEngine import
// cycle (transitionEngine already imports qualityGateEngine).
export type PolicyCondition = { type: "always_true" } | { type: "field_in"; field: string; values: unknown[] } | Record<string, unknown>;

function getField(context: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, context);
}

export function evaluateCondition(condition: PolicyCondition, context: Record<string, unknown>): boolean {
  const type = (condition as { type?: string }).type;
  if (type === "always_true") return true;
  if (type === "field_in") {
    const c = condition as { field: string; values: unknown[] };
    const value = getField(context, c.field);
    return Array.isArray(c.values) && c.values.includes(value);
  }
  return false; // unrecognised condition types fail closed rather than silently pass
}
