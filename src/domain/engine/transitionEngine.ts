import { policiesDB } from "../../dblayer/policiesDB.js";
import { policyDefinitionsDB } from "../../dblayer/policyDefinitionsDB.js";
import { ATTESTATION_REQUIRED_POLICY_CODE, getPlatformTenantId } from "../../dblayer/constants.js";
import { transitionDefinitionsDB } from "../../dblayer/transitionDefinitionsDB.js";
import { participantsDB } from "../../dblayer/participantsDB.js";
import { participantsMasterDB } from "../../dblayer/participantsMasterDB.js";
import { badgeAuthorityEngine } from "./badgeAuthorityEngine.js";
import { qualityGateEngine } from "./qualityGateEngine.js";
import { eventBus } from "./eventBus.js";
import { triggerEngine } from "./triggerEngine.js";
import { evaluateCondition, type GoverningCondition } from "./governingCondition.js";
import { bumpPatch } from "../../utils/version.js";
import type { TransitionEntityType, TransitionDefinitionRow } from "../../dblayer/seuTypes.js";

export type TransitionOutcome =
  | { allowed: true; entityType: TransitionEntityType; fromState: string; toState: string; createsObligation: string | null; authorityBadge: string | null; eventType: string | null; versionEvent: string | null; nextVersion: string | null }
  | { allowed: false; reason: "no_transition_definition" }
  | { allowed: false; reason: "authority_denied"; authorityRuleCode: string; badgeDenialReason?: string }
  | { allowed: false; reason: "policy_blocked"; policyCode: string }
  | { allowed: false; reason: "not_submitted"; submitBadge: string }
  | { allowed: false; reason: "quality_gate_blocked"; gateCode: string; gateName: string; detail: string };

export interface EvaluateInput {
  entityType: TransitionEntityType;
  fromState: string;
  toState: string;
  actorRole: string;
  actorId: string;
  context?: Record<string, unknown>;
  entityId?: string;
  seuId?: string;
  currentVersion?: string;
  alternateBadges?: string[];
}

// A Transition Definition requires an attestation when the Policy Definition "policy-attestation-required" is among
// its required policies. The seed stores that Policy Definition's UUID on the hop.
export async function transitionRequiresAttestation(definition: Pick<TransitionDefinitionRow, "required_policy_ids">): Promise<boolean> {
  const { data: policyDefinition } = await policyDefinitionsDB.findActiveByCodeVisibleTo(ATTESTATION_REQUIRED_POLICY_CODE, await getPlatformTenantId());
  return !!policyDefinition && definition.required_policy_ids.includes(policyDefinition.id);
}

export type RejectedOutcome = Exclude<TransitionOutcome, { allowed: true }>;
export type AllowedOutcome = Extract<TransitionOutcome, { allowed: true }>;
export type GovernedOutcome = RejectedOutcome | (Omit<AllowedOutcome, "authorityBadge"> & { authorityBadge: string; authorId: string });

export interface GateRejectionResult {
  ok: false;
  reason: "authority_denied" | "policy_blocked" | "no_transition_definition" | "not_submitted" | "quality_gate_blocked";
  detail: string;
}

// One mapping from a rejected governed outcome to the result every transition function returns.
export function gateRejection(gate: RejectedOutcome, entityLabel: string, fromState: string, toState: string): GateRejectionResult {
  if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for ${entityLabel} ${fromState} -> ${toState}` };
  if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires badge ${gate.authorityRuleCode} (${gate.badgeDenialReason})` };
  if (gate.reason === "quality_gate_blocked") return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${gate.gateName}" blocked: ${gate.detail}` };
  if (gate.reason === "not_submitted") return { ok: false, reason: "not_submitted", detail: `must be submitted first (requires badge ${gate.submitBadge})` };
  return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
}

export const transitionEngine = {
  // Governed evaluation (CR-121): authority, submission, policies and pinned gates through `evaluate`, then the
  // authority-badge requirement, author resolution and the category-matched Quality Gates. It changes no state and
  // publishes nothing; the caller updates the entity and publishes its own events afterwards.
  async evaluateGoverned(input: EvaluateInput & { gateEntityId: string; gateSeuId: string }): Promise<GovernedOutcome> {
    const { gateEntityId, gateSeuId, ...evaluateInput } = input;
    const outcome = await this.evaluate(evaluateInput);
    if (!outcome.allowed) return outcome;
    if (!outcome.authorityBadge) throw new Error(`no authority badge resolved for ${input.entityType} ${input.fromState} -> ${input.toState} — the Transition Definition declares no verb`);
    const { data: master } = await participantsMasterDB.findById(input.actorId);
    if (!master) throw new Error(`No superuser provisioned.`);
    const { data: participant } = await participantsDB.findBySeuIdAndParticipantMasterId(gateSeuId, master.id);
    if (!participant) throw new Error(`No participants row for participants_master ${master.id} in SEU ${gateSeuId}.`);
    const qualityGateResult = await qualityGateEngine.evaluate({
      entityType: input.entityType,
      entityId: gateEntityId,
      seuId: gateSeuId,
      fromState: input.fromState,
      toState: input.toState,
      authorId: participant.id,
      authorBadge: outcome.authorityBadge,
    });
    if (qualityGateResult.outcome === "Blocked") {
      return { allowed: false, reason: "quality_gate_blocked", gateCode: qualityGateResult.gate.code, gateName: qualityGateResult.gate.name, detail: qualityGateResult.reason };
    }
    return { ...outcome, authorityBadge: outcome.authorityBadge, authorId: participant.id };
  },

  // The badge check alone: the Transition Definition's verb, resolved to a badge the actor holds.
  async authorise(input: Pick<EvaluateInput, "entityType" | "fromState" | "toState" | "actorId" | "alternateBadges">): Promise<
    { allowed: true; authorityBadge: string | null; definition: TransitionDefinitionRow } | RejectedOutcome
  > {
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
    return { allowed: true, authorityBadge, definition };
  },

  async evaluate(input: EvaluateInput): Promise<TransitionOutcome> {
    const authorised = await this.authorise(input);
    if (!authorised.allowed) return authorised;
    const { definition, authorityBadge } = authorised;

    if (definition.submit_verb) {
      const submitBadge = `${input.entityType.toLowerCase()}_${definition.submit_verb}`;
      const hasBeenSubmitted = input.entityId ? await triggerEngine.hasBeenSubmitted(input.entityType, input.entityId, input.fromState) : false;
      if (!hasBeenSubmitted) {
        return { allowed: false, reason: "not_submitted", submitBadge };
      }
    }

    if (definition.required_policy_ids.length > 0) {
      if (!authorityBadge) throw new Error(`${input.entityType} ${input.fromState} -> ${input.toState} requires policies but declares no verb — no authority badge can be resolved for the policy events`);
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
            authorityBadge,
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
          authorityBadge,
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
          authorityBadge,
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
      nextVersion: definition.version_event && definition.version_hop !== false && input.currentVersion ? bumpPatch(input.currentVersion) : null,
    };
  },
};
