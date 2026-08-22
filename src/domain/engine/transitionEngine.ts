// Ch.29 §10 minimal instance — evaluates a Transition Definition's Authority +
// Policy prerequisites (Build Plan §5 item 4: Evidence/Knowledge/Decision/Quality
// Gate prerequisites are never populated in MVP, even though the schema has
// room for them). Generic over entity type: takes fromState/toState/context,
// never imports SEU or Deliverable — extending which transitions exist is a
// transition_definitions row, not a code change here.
//
// CR-006: authorisation is noun × verb — the required badge is
// `entity_type + '_' + verb` (from the transition definition), checked by
// badgeAuthorityEngine.authorise (root bypass, or the actor holds the badge).
// The legacy authority_rules lookup + required_badge_type acting-badge path +
// ROLE_LEVEL role fork have been removed.
import { policiesDB } from "../../dblayer/policiesDB.js";
import { transitionDefinitionsDB } from "../../dblayer/transitionDefinitionsDB.js";
import { badgeAuthorityEngine } from "./badgeAuthorityEngine.js";
import { qualityGateEngine } from "./qualityGateEngine.js";
import { eventBus } from "./eventBus.js";
import { evaluateCondition, type PolicyCondition } from "./policyCondition.js";
import type { TransitionEntityType } from "../../dblayer/seuTypes.js";

export type TransitionOutcome =
  // createsObligation: the transition_definitions row's own declared value
  // (an Obligation category, or null) — surfaced for the caller to act on,
  // not created here (the engine layer never calls back into core, same
  // boundary raiseAttentionItem already respects). Stored and returned;
  // not yet consumed by any caller (SDK UI Layer Plan, Transition Definition
  // section — logged as not yet mechanically enforced).
  // authorityBadge: the resolved `noun_verb` badge this transition was
  // authorised under (null when the definition declares no verb — an ungoverned
  // step). The caller records it, with the real actor, on the transition event
  // it publishes — the accountability record (who did this, under what authority).
  | { allowed: true; entityType: TransitionEntityType; fromState: string; toState: string; createsObligation: string | null; authorityBadge: string | null }
  | { allowed: false; reason: "no_transition_definition" }
  // CR-006: authority_denied carries the required noun_verb badge
  // (authorityRuleCode) and the reason (badgeDenialReason, e.g. missing_badge).
  | { allowed: false; reason: "authority_denied"; authorityRuleCode: string; badgeDenialReason?: string }
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
    // Retained because routes still pass it, but NOT consulted for
    // authorisation — CR-006 authorises on the noun_verb badge, not the role.
    actorRole: string;
    // CR-006 — the acting identity; authorisation is "does this actor hold the
    // transition's noun_verb badge (or root)". Required for every governed
    // transition; absent ⇒ denied (the exception).
    actorId?: string;
    context?: Record<string, unknown>;
    // Only required when the resolved Transition Definition declares
    // required_quality_gate_ids — every pre-existing row has none, so
    // existing callers that never pass these keep working unchanged.
    entityId?: string;
    seuId?: string;
  }): Promise<TransitionOutcome> {
    const { data: definition } = await transitionDefinitionsDB.find(input.entityType, input.fromState, input.toState);
    if (!definition) return { allowed: false, reason: "no_transition_definition" };

    // CR-006 — authorisation is one check: root bypass OR the actor holds the
    // transition's `noun_verb` badge (from the definition's verb). No role, no
    // scope (that is a separate gate, not this layer), no acting-badge
    // declaration, no governed_entity_type. Every governed transition requires
    // its badge; a non-root actor without it is denied (the exception).
    let authorityBadge: string | null = null;
    if (definition.verb) {
      const requiredBadge = `${input.entityType.toLowerCase()}_${definition.verb}`;
      const auth = await badgeAuthorityEngine.authorise({ actorId: input.actorId ?? "", requiredBadge });
      if (!auth.allowed) {
        return { allowed: false, reason: "authority_denied", authorityRuleCode: requiredBadge, badgeDenialReason: auth.reason };
      }
      authorityBadge = requiredBadge;
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
            seuId: input.seuId ?? null,
            correlationId: eventBus.newCorrelationId(),
            payload: { policyCode: policy.code, entityType: input.entityType, fromState: input.fromState, toState: input.toState },
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

    return { allowed: true, entityType: input.entityType, fromState: input.fromState, toState: input.toState, createsObligation: definition.creates_obligation, authorityBadge };
  },
};
