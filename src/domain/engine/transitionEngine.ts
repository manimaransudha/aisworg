import { policiesDB } from "../../dblayer/policiesDB.js";
import { transitionDefinitionsDB } from "../../dblayer/transitionDefinitionsDB.js";
import { participantsDB } from "../../dblayer/participantsDB.js";
import { participantsMasterDB } from "../../dblayer/participantsMasterDB.js";
import { badgeAuthorityEngine } from "./badgeAuthorityEngine.js";
import { qualityGateEngine } from "./qualityGateEngine.js";
import { eventBus } from "./eventBus.js";
import { triggerEngine } from "./triggerEngine.js";
import { evaluateCondition, type GoverningCondition } from "./governingCondition.js";
import type { TransitionEntityType } from "../../dblayer/seuTypes.js";

export type TransitionOutcome =
  | { allowed: true; entityType: TransitionEntityType; fromState: string; toState: string; createsObligation: string | null; authorityBadge: string | null; eventType: string | null; versionEvent: string | null }
  | { allowed: false; reason: "no_transition_definition" }
  | { allowed: false; reason: "authority_denied"; authorityRuleCode: string; badgeDenialReason?: string }
  | { allowed: false; reason: "policy_blocked"; policyCode: string }
  | { allowed: false; reason: "not_submitted"; submitBadge: string }
  | { allowed: false; reason: "quality_gate_blocked"; gateCode: string; gateName: string; detail: string };

export const transitionEngine = {
  async evaluate(input: {
    entityType: TransitionEntityType;
    fromState: string;
    toState: string;
    actorRole: string;
    actorId: string;
    context?: Record<string, unknown>;
    entityId?: string;
    seuId?: string;
    alternateBadges?: string[];
  }): Promise<TransitionOutcome> {
    const { data: definition } = await transitionDefinitionsDB.find(input.entityType, input.fromState, input.toState);
    if (!definition) return { allowed: false, reason: "no_transition_definition" };

    let authorityBadge: string | null = null;
    if (definition.verb) {
      const canonicalBadge = `${input.entityType.toLowerCase()}_${definition.verb}`;
      const requiredBadge = input.alternateBadges?.length ? [canonicalBadge, ...input.alternateBadges] : canonicalBadge;
      const auth = await badgeAuthorityEngine.authorise({ actorId: input.actorId, requiredBadge });
      if (!auth.allowed) {
        return { allowed: false, reason: "authority_denied", authorityRuleCode: canonicalBadge, badgeDenialReason: auth.reason };
      }
      authorityBadge = auth.via === "badge" ? (auth.matchedBadge ?? canonicalBadge) : canonicalBadge;
    }

    if (definition.submit_verb) {
      const submitBadge = `${input.entityType.toLowerCase()}_${definition.submit_verb}`;
      const hasBeenSubmitted = input.entityId ? await triggerEngine.hasBeenSubmitted(input.entityType, input.entityId, input.fromState) : false;
      if (!hasBeenSubmitted) {
        return { allowed: false, reason: "not_submitted", submitBadge };
      }
    }

    if (definition.required_policy_ids.length > 0) {
      const { data: policies } = await policiesDB.findByIds(definition.required_policy_ids);
      for (const policy of policies ?? []) {
        const satisfied = evaluateCondition(policy.condition as GoverningCondition, input.context ?? {});
        const payload = { policyCode: policy.code, entityType: input.entityType, fromState: input.fromState, toState: input.toState };
        if (satisfied) {
          await eventBus.publish({
            eventType: "PolicyApplied",
            originatingObjectType: "Policy",
            originatingObjectId: policy.id,
            seuId: input.seuId ?? null,
            correlationId: eventBus.newCorrelationId(),
            actorId: input.actorId,
            authorityBadge: authorityBadge ?? "system",
            payload,
          });
          continue;
        }
        await eventBus.publish({
          eventType: "PolicyViolated",
          originatingObjectType: "Policy",
          originatingObjectId: policy.id,
          seuId: input.seuId ?? null,
          correlationId: eventBus.newCorrelationId(),
          actorId: input.actorId,
          authorityBadge: authorityBadge ?? "system",
          payload: { ...payload, constraintType: policy.constraint_type },
        });
        if (policy.constraint_type === "Policy") {
          return { allowed: false, reason: "policy_blocked", policyCode: policy.code };
        }
        await eventBus.publish({
          eventType: "StandardPolicyDeviation",
          originatingObjectType: "Policy",
          originatingObjectId: policy.id,
          seuId: input.seuId ?? null,
          correlationId: eventBus.newCorrelationId(),
          actorId: input.actorId,
          authorityBadge: authorityBadge ?? "system",
          payload,
        });
      }
    }

    if (definition.required_quality_gate_ids.length > 0 && input.entityId && input.seuId) {
      if (!authorityBadge) {
        throw new Error(`Quality Gate evaluation for ${input.entityType} ${input.fromState}->${input.toState} requires a resolved authority badge, but this transition is ungoverned (no verb declared).`);
      }
      const { data: master } = await participantsMasterDB.findById(input.actorId);
      if (!master) throw new Error(`No superuser provisioned.`);
      const { data: participant } = await participantsDB.findBySeuIdAndParticipantMasterId(input.seuId, master.id);
      if (!participant) throw new Error(`No participants row for participants_master ${master.id} in SEU ${input.seuId}.`);
      const qualityGateResult = await qualityGateEngine.evaluateByIds(definition.required_quality_gate_ids, {
        entityType: input.entityType,
        entityId: input.entityId,
        seuId: input.seuId,
        authorId: participant.id,
        authorBadge: authorityBadge,
      });
      if (qualityGateResult.outcome === "Blocked") {
        return { allowed: false, reason: "quality_gate_blocked", gateCode: qualityGateResult.gate.code, gateName: qualityGateResult.gate.name, detail: qualityGateResult.reason };
      }
    }

    return {
      allowed: true,
      entityType: input.entityType,
      fromState: input.fromState,
      toState: input.toState,
      createsObligation: definition.creates_obligation,
      authorityBadge,
      eventType: definition.event_type,
      versionEvent: definition.version_event,
    };
  },
};
