// Ch.29 §10 minimal instance — evaluates a Transition Definition's Authority +
// Policy prerequisites (Build Plan §5 item 4: Evidence/Knowledge/Decision/Quality
// Gate prerequisites are never populated in MVP, even though the schema has
// room for them). Generic over entity type: takes fromState/toState/context,
// never imports SEU or Deliverable — extending which transitions exist is a
// transition_definitions row, not a code change here.
import { authorityRulesDB } from "../../dblayer/authorityRulesDB.js";
import { policiesDB } from "../../dblayer/policiesDB.js";
import { transitionDefinitionsDB } from "../../dblayer/transitionDefinitionsDB.js";
import { badgeAuthorityEngine } from "./badgeAuthorityEngine.js";
import { qualityGateEngine } from "./qualityGateEngine.js";
import { eventBus } from "./eventBus.js";
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
  // createsObligation: the transition_definitions row's own declared value
  // (an Obligation category, or null) — surfaced for the caller to act on,
  // not created here (the engine layer never calls back into core, same
  // boundary raiseAttentionItem already respects). Stored and returned;
  // not yet consumed by any caller (SDK UI Layer Plan, Transition Definition
  // section — logged as not yet mechanically enforced).
  | { allowed: true; entityType: TransitionEntityType; fromState: string; toState: string; createsObligation: string | null }
  | { allowed: false; reason: "no_transition_definition" }
  // requiredRole/actorRole populated on the legacy role path; badgeDenialReason
  // (naming badgeAuthorityEngine's own outcome) populated on the Phase 10
  // badge-model path (§11) — never both, but kept as one variant so existing
  // callers narrowing on `reason === "authority_denied"` don't need a second
  // discriminant to stay type-correct.
  | { allowed: false; reason: "authority_denied"; authorityRuleCode: string; requiredRole?: string; actorRole?: string; badgeDenialReason?: string }
  | { allowed: false; reason: "policy_blocked"; policyCode: string }
  // SDK UI Layer Plan, Transition Definition section — generic Quality Gate
  // check, opt-in per row via required_quality_gate_ids (empty for every
  // pre-existing row, so this reason is unreachable for the 9 entity types
  // that still run their own separate qualityGateEngine.evaluate call before
  // ever reaching this function, e.g. Deliverable's).
  | { allowed: false; reason: "quality_gate_blocked"; gateCode: string; gateName: string; detail: string };

export const transitionEngine = {
  async evaluate(input: {
    entityType: TransitionEntityType;
    fromState: string;
    toState: string;
    actorRole: string;
    // Phase 10 (badge model, §9/§11) — required only when the resolved
    // Authority Rule sets required_badge_type; every action still declares
    // exactly one acting badge (§9), never inferred from everything the
    // actor holds.
    actingBadge?: { grantId: string; actorId: string };
    scopeContext?: { seuId?: string | null; packCode?: string | null; capabilityId?: string | null };
    context?: Record<string, unknown>;
    // Only required when the resolved Transition Definition declares
    // required_quality_gate_ids — every pre-existing row has none, so
    // existing callers that never pass these keep working unchanged.
    entityId?: string;
    seuId?: string;
  }): Promise<TransitionOutcome> {
    const { data: definition } = await transitionDefinitionsDB.find(input.entityType, input.fromState, input.toState);
    if (!definition) return { allowed: false, reason: "no_transition_definition" };

    if (definition.required_authority_rule_id) {
      const { data: rule } = await authorityRulesDB.findById(definition.required_authority_rule_id);
      if (!rule) return { allowed: false, reason: "no_transition_definition" };

      if (rule.required_badge_type) {
        // Badge-model path (§9/§11) — entity types not yet migrated never
        // reach here, since their Authority Rules never set required_badge_type.
        if (!input.actingBadge) {
          return { allowed: false, reason: "authority_denied", authorityRuleCode: rule.code, badgeDenialReason: "no_acting_badge_declared" };
        }
        const badgeOutcome = await badgeAuthorityEngine.evaluate({
          requiredBadgeType: rule.required_badge_type,
          entityType: input.entityType,
          actingBadge: input.actingBadge,
          scopeContext: input.scopeContext ?? {},
        });
        if (!badgeOutcome.allowed) {
          return { allowed: false, reason: "authority_denied", authorityRuleCode: rule.code, badgeDenialReason: badgeOutcome.reason };
        }
      } else {
        // Legacy role path — unchanged, still live for every entity type
        // this pass doesn't migrate.
        const requiredLevel = ROLE_LEVEL[rule.authorised_role] ?? 99;
        const actorLevel = ROLE_LEVEL[input.actorRole] ?? 0;
        if (actorLevel < requiredLevel) {
          return { allowed: false, reason: "authority_denied", authorityRuleCode: rule.code, requiredRole: rule.authorised_role, actorRole: input.actorRole };
        }
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
        // through Engineering Telemetry. Engineering Telemetry — Plan, Build
        // order step 5's own prerequisite: record the discarded value as an
        // event, same eventBus every other engine module already publishes
        // to (qualityGateEngine's QualityGatePassed/Blocked) — not a core-layer
        // call, so the engine-never-calls-back-into-core boundary holds. What
        // actually happens with sustained repeats of this event (raising an
        // Obligation) is core/telemetry.ts's job, checked from the Telemetry
        // dashboard/API itself, not threaded through every caller of evaluate.
        if (!satisfied && policy.constraint_type === "Standard") {
          await eventBus.publish({
            eventType: "StandardPolicyDeviation",
            originatingObjectType: "Policy",
            originatingObjectId: policy.id,
            correlationId: eventBus.newCorrelationId(),
            payload: { policyCode: policy.code, entityType: input.entityType, fromState: input.fromState, toState: input.toState, seuId: input.seuId ?? null },
          });
        }
      }
    }

    if (definition.required_quality_gate_ids.length > 0 && input.entityId && input.seuId) {
      const qualityGateResult = await qualityGateEngine.evaluateByIds(definition.required_quality_gate_ids, {
        entityType: input.entityType,
        entityId: input.entityId,
        seuId: input.seuId,
      });
      if (qualityGateResult.outcome === "Blocked") {
        return { allowed: false, reason: "quality_gate_blocked", gateCode: qualityGateResult.gate.code, gateName: qualityGateResult.gate.name, detail: qualityGateResult.reason };
      }
    }

    return { allowed: true, entityType: input.entityType, fromState: input.fromState, toState: input.toState, createsObligation: definition.creates_obligation };
  },
};
