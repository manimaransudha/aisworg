// Ch.29 §10 minimal instance — evaluates a Transition Definition's Authority +
// Policy prerequisites (Build Plan §5 item 4: Evidence/Knowledge/Decision/Quality
// Gate prerequisites are never populated in MVP, even though the schema has
// room for them). Generic over entity type: takes fromState/toState/context,
// never imports SEU or Deliverable — extending which transitions exist is a
// transition_definitions row, not a code change here.
import { authorityRulesDB } from "../../dblayer/authorityRulesDB.js";
import { policiesDB } from "../../dblayer/policiesDB.js";
import { transitionDefinitionsDB } from "../../dblayer/transitionDefinitionsDB.js";
import type { TransitionEntityType } from "../../dblayer/seuTypes.js";

// Mirrors src/middleware/auth.js's ROLE_LEVEL — kept local rather than importing,
// since auth.js doesn't export it and this is 3 stable lines, not worth coupling
// the engine layer to a web-auth middleware module for.
const ROLE_LEVEL: Record<string, number> = { general: 1, power: 2, super: 3 };

type PolicyCondition = { type: "always_true" } | { type: "field_in"; field: string; values: unknown[] } | Record<string, unknown>;

function getField(context: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, context);
}

function evaluateCondition(condition: PolicyCondition, context: Record<string, unknown>): boolean {
  const type = (condition as { type?: string }).type;
  if (type === "always_true") return true;
  if (type === "field_in") {
    const c = condition as { field: string; values: unknown[] };
    const value = getField(context, c.field);
    return Array.isArray(c.values) && c.values.includes(value);
  }
  return false; // unrecognised condition types fail closed rather than silently pass
}

export type TransitionOutcome =
  | { allowed: true; entityType: TransitionEntityType; fromState: string; toState: string }
  | { allowed: false; reason: "no_transition_definition" }
  | { allowed: false; reason: "authority_denied"; authorityRuleCode: string; requiredRole: string; actorRole: string }
  | { allowed: false; reason: "policy_blocked"; policyCode: string };

export const transitionEngine = {
  async evaluate(input: {
    entityType: TransitionEntityType;
    fromState: string;
    toState: string;
    actorRole: string;
    context?: Record<string, unknown>;
  }): Promise<TransitionOutcome> {
    const { data: definition } = await transitionDefinitionsDB.find(input.entityType, input.fromState, input.toState);
    if (!definition) return { allowed: false, reason: "no_transition_definition" };

    if (definition.required_authority_rule_id) {
      const { data: rule } = await authorityRulesDB.findById(definition.required_authority_rule_id);
      if (!rule) return { allowed: false, reason: "no_transition_definition" };
      const requiredLevel = ROLE_LEVEL[rule.authorised_role] ?? 99;
      const actorLevel = ROLE_LEVEL[input.actorRole] ?? 0;
      if (actorLevel < requiredLevel) {
        return { allowed: false, reason: "authority_denied", authorityRuleCode: rule.code, requiredRole: rule.authorised_role, actorRole: input.actorRole };
      }
    }

    if (definition.required_policy_ids.length > 0) {
      const { data: policies } = await policiesDB.findByIds(definition.required_policy_ids);
      for (const policy of policies ?? []) {
        const satisfied = evaluateCondition(policy.condition as PolicyCondition, input.context ?? {});
        if (!satisfied && policy.constraint_type === "Policy") {
          return { allowed: false, reason: "policy_blocked", policyCode: policy.code };
        }
        // Standard (non-blocking) deviations proceed — Ch.24 §11: they surface
        // through Engineering Telemetry, which is deferred for MVP (Build Plan §1).
      }
    }

    return { allowed: true, entityType: input.entityType, fromState: input.fromState, toState: input.toState };
  },
};
