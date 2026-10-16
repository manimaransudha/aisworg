import { commandsDB } from "../../dblayer/commandsDB.js";
import { governanceEvaluationOutcomesDB } from "../../dblayer/governanceEvaluationOutcomesDB.js";
import { seuCapabilitiesDB } from "../../dblayer/seuCapabilitiesDB.js";
import { capabilityFulfilmentsDB } from "../../dblayer/capabilityFulfilmentsDB.js";
import { capabilityFulfilmentPoolsDB } from "../../dblayer/capabilityFulfilmentPoolsDB.js";
import { eventBus } from "./eventBus.js";
import { dependencyDefinitionEngine } from "./dependencyDefinitionEngine.js";
import { qualityGateEngine, RESOLVED_OBLIGATION_STATUSES } from "./qualityGateEngine.js";
import { policyEngine } from "./policyEngine.js";
import { badgeAuthorityEngine } from "./badgeAuthorityEngine.js";
import { triggerEngine } from "./triggerEngine.js";
import { transitionDefinitionsDB } from "../../dblayer/transitionDefinitionsDB.js";
import { obligationsDB } from "../../dblayer/obligationsDB.js";
import { decisionsDB } from "../../dblayer/decisionsDB.js";
import { deliverableReferencesDB } from "../../dblayer/deliverableReferencesDB.js";
import { checkSustainedQualityGateBlocking } from "../../routes/seu/core/telemetry.js";
import { raiseAttentionItem, resolveAuthor } from "../../routes/seu/core/attentionItems.js";
import { raiseObligationForBlockedTransition } from "../../routes/seu/core/obligations.js";
import { attentionItemsDB } from "../../dblayer/attentionItemsDB.js";
import { authorityRulesDB } from "../../dblayer/authorityRulesDB.js";
import type { CommandRow, DeliverableRow, DependencyDefinitionRow, GovernanceEvaluationOutcomeDraft, TransitionEntityType } from "../../dblayer/seuTypes.js";
import { getSystemActor, commandTypeFor } from "../../dblayer/constants.js";
import { deliverablesDB } from "../../dblayer/deliverablesDB.js";
import { attestationsDB } from "../../dblayer/attestationsDB.js";
import { transitionEngine, gateRejection, transitionRequiresAttestation, type GateRejectionResult } from "./transitionEngine.js";

export type DeliverableGovernanceResult =
  | { ok: true; fromState: string; governanceOutcome: GovernanceEvaluationOutcomeDraft; actingBadgeType: string }
  | { ok: false; reason: "dependency_not_satisfied"; rows: DependencyDefinitionRow[] }
  | { ok: false; reason: "seu_blocked" | "obligation_blocked" | "decision_blocked"; detail: string }
  | { ok: false; reason: "quality_gate_blocked"; detail: string }
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition" | "not_submitted"; detail: string }
  | { ok: false; reason: "empty_centre"; detail: string }
  | { ok: false; reason: "already_in_flight"; detail: string };

export type ApplyDeliverableResult = { ok: true } | GateRejectionResult | { ok: false; reason: "already_in_flight"; detail: string };

const deliverableTurns = new Map<string, Promise<unknown>>();

async function withDeliverableTurn<T>(deliverableId: string, work: () => Promise<T>): Promise<T> {
  const previous = deliverableTurns.get(deliverableId) ?? Promise.resolve();
  const turn = previous.catch(() => undefined).then(work);
  deliverableTurns.set(deliverableId, turn);
  try {
    return await turn;
  } finally {
    if (deliverableTurns.get(deliverableId) === turn) deliverableTurns.delete(deliverableId);
  }
}

export const executionEngine = {
  async evaluateDeliverableTransition(input: { deliverable: DeliverableRow; targetState: string; actorId: string }): Promise<DeliverableGovernanceResult> {
    const { deliverable, targetState } = input;

    const readiness = await dependencyDefinitionEngine.isTargetReady(deliverable.seu_id, "Deliverable", deliverable.name, targetState);
    if (!readiness.ready) {
      const reason = `${readiness.rows.length} governing dependency row(s) not yet satisfied (${readiness.rows.map((r) => `${r.from_entity_type}${r.from_name ? ` "${r.from_name}"` : ""} -> ${r.from_state}`).join(", ")})`;
      const blockedSystemActor = await getSystemActor(deliverable.seu_id);
      await eventBus.publish({
        eventType: "DeliverableBlocked",
        originatingObjectType: "Deliverable",
        originatingObjectId: deliverable.id,
        seuId: deliverable.seu_id,
        correlationId: eventBus.newCorrelationId(),
        actorId: blockedSystemActor.actorId,
        authorityBadge: blockedSystemActor.authorBadge,
        payload: { entityType: "Deliverable", entityId: deliverable.id, reason },
      });
      return { ok: false, reason: "dependency_not_satisfied", rows: readiness.rows };
    }

    const { data: seuObligations } = await obligationsDB.findByRelatedObject("SEU", deliverable.seu_id);
    const openSeuBlock = (seuObligations ?? []).find((o) => o.blocked_from_state && o.blocked_to_state && !RESOLVED_OBLIGATION_STATUSES.has(o.status));
    if (openSeuBlock) {
      return { ok: false, reason: "seu_blocked", detail: `owning SEU is blocked by an open Obligation ("${openSeuBlock.title}") — cannot start until it resolves` };
    }

    const { data: deliverableObligations } = await obligationsDB.findByRelatedObject("Deliverable", deliverable.id);
    const openDeliverableBlock = (deliverableObligations ?? []).find((o) => o.blocked_from_state && o.blocked_to_state && !RESOLVED_OBLIGATION_STATUSES.has(o.status));
    if (openDeliverableBlock) {
      return { ok: false, reason: "obligation_blocked", detail: `blocked by an open Obligation ("${openDeliverableBlock.title}")` };
    }

    const { data: deliverableDecisions } = await decisionsDB.findByRelatedObject("Deliverable", deliverable.id);
    for (const decision of deliverableDecisions ?? []) {
      if (!(await dependencyDefinitionEngine.isReachedOrPassed("Decision", "Approved", decision.status))) {
        return { ok: false, reason: "decision_blocked", detail: `blocked by an open Decision ("${decision.title}") not yet Approved` };
      }
    }

    const fromState = deliverable.lifecycle_state;

    const { data: inFlight } = await commandsDB.findInFlight("Deliverable", deliverable.id, fromState, targetState);
    if (inFlight) {
      return { ok: false, reason: "already_in_flight", detail: `a Command for this exact hop is already ${inFlight.status} (Command ${inFlight.id})` };
    }

    const { data: definition } = await transitionDefinitionsDB.find("Deliverable", fromState, targetState);
    if (!definition) {
      return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Deliverable ${fromState} -> ${targetState}` };
    }
    if (!definition.verb) throw new Error(`Deliverable ${fromState} -> ${targetState} declares no verb — no authority badge can be resolved`);
    const requiredBadge = `deliverable_${definition.verb}`;
    const systemActor = await getSystemActor(deliverable.seu_id);
    const auth = await badgeAuthorityEngine.authorise({ actorId: input.actorId, requiredBadge });
    if (!auth.allowed) {
      return { ok: false, reason: "authority_denied", detail: `acting badge check failed: ${auth.reason}` };
    }
    const actingBadgeType = auth.via === "root" ? "root" : requiredBadge;
    const { data: authorityRule } = await authorityRulesDB.findByCode(requiredBadge);
    const applicableAuthorityRuleId = authorityRule?.id ?? null;

    const qualityGateResult = await qualityGateEngine.evaluate({
      entityType: "Deliverable",
      entityId: deliverable.id,
      seuId: deliverable.seu_id,
      fromState,
      toState: targetState,
      authorId: systemActor.authorId,
      authorBadge: systemActor.authorBadge,
    });
    if (qualityGateResult.outcome === "Blocked") {
      await checkSustainedQualityGateBlocking({ qualityGateId: qualityGateResult.gate.id, gateName: qualityGateResult.gate.name, seuId: deliverable.seu_id, deliverableId: deliverable.id });
      await raiseAttentionItem({
        seuId: deliverable.seu_id,
        category: "Action Required",
        title: `Deliverable "${deliverable.name}" is blocked by Quality Gate "${qualityGateResult.gate.name}"`,
        description: qualityGateResult.reason,
        relatedObjectType: "Deliverable",
        relatedObjectId: deliverable.id,
        ...systemActor,
      });
      return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${qualityGateResult.gate.name}" blocked: ${qualityGateResult.reason}` };
    }

    const policyResult = await policyEngine.evaluate({
      entityType: "Deliverable",
      seuId: deliverable.seu_id,
      entityId: deliverable.id,
      fromState,
      toState: targetState,
      context: { deliverable },
      authorId: input.actorId,
      authorBadge: actingBadgeType,
    });
    if (policyResult.outcome === "Blocked") {
      await raiseObligationForBlockedTransition({
        seuId: deliverable.seu_id, relatedObjectType: "Deliverable", relatedObjectId: deliverable.id,
        fromState, toState: targetState, policyCode: policyResult.policyCode,
      });
      return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${policyResult.policyCode}` };
    }

    if (definition.submit_verb) {
      const hasBeenSubmitted = await triggerEngine.hasBeenSubmitted("Deliverable", deliverable.id, fromState);
      if (!hasBeenSubmitted) {
        return { ok: false, reason: "not_submitted", detail: `must be submitted first (requires badge deliverable_${definition.submit_verb})` };
      }
    }

    if (fromState === "In Progress" && targetState === "Approved") {
      const { data: existingRef } = await deliverableReferencesDB.findLatestWithReference(deliverable.id, "In Progress");
      if (!existingRef) {
        return { ok: false, reason: "empty_centre", detail: "cannot approve a Deliverable with no attached reference — nothing has been produced to approve" };
      }
    }

    const consultedObligationIds = [...(seuObligations ?? []), ...(deliverableObligations ?? [])]
      .filter((o) => !RESOLVED_OBLIGATION_STATUSES.has(o.status))
      .map((o) => o.id);
    const [{ data: deliverableAttentionItems }, { data: seuAttentionItems }] = await Promise.all([
      attentionItemsDB.findOpenByRelatedObjectAny("Deliverable", deliverable.id),
      attentionItemsDB.findOpenByRelatedObjectAny("SEU", deliverable.seu_id),
    ]);
    const openAttentionItemIds = [...(deliverableAttentionItems ?? []), ...(seuAttentionItems ?? [])].map((a) => a.id);

    const qualityGateOutcome = qualityGateResult.outcome === "NotApplicable" ? "NotApplicable" : qualityGateResult.outcome === "Waived" ? "Waived" : "Passed";
    const waivedGate = qualityGateResult.outcome === "Waived" ? qualityGateResult.gate : null;
    const outcome: GovernanceEvaluationOutcomeDraft["outcome"] =
      qualityGateOutcome === "Waived" ? "Waived" : policyResult.deviatedPolicyIds.length > 0 ? "Approved-with-Conditions" : "Approved";
    const rationaleParts = [
      qualityGateOutcome === "NotApplicable" ? "no applicable Quality Gate" : waivedGate ? `Quality Gate "${waivedGate.name}": Waived` : `Quality Gate(s): ${qualityGateOutcome}`,
      policyResult.outcome === "NotApplicable" ? "no applicable Policy" : `${policyResult.satisfiedPolicyIds.length} Policy(ies) satisfied, ${policyResult.deviatedPolicyIds.length} deviated`,
      applicableAuthorityRuleId ? "Authority check passed" : "no Authority rule required",
    ];

    const governanceOutcome: GovernanceEvaluationOutcomeDraft = {
      seu_id: deliverable.seu_id,
      entity_type: "Deliverable",
      entity_id: deliverable.id,
      from_state: fromState,
      to_state: targetState,
      outcome,
      rationale: rationaleParts.join("; "),
      quality_gate_id: waivedGate?.id ?? null,
      quality_gate_outcome: qualityGateOutcome,
      applicable_authority_rule_id: applicableAuthorityRuleId,
      satisfied_policy_ids: policyResult.satisfiedPolicyIds,
      deviated_policy_ids: policyResult.deviatedPolicyIds,
      consulted_obligation_ids: consultedObligationIds,
      open_attention_item_ids: openAttentionItemIds,
      originating_pack_id: waivedGate?.originating_pack_id ?? null,
    };

    return { ok: true, fromState, governanceOutcome, actingBadgeType };
  },

  // The engine's own transition (CR-121 third pass): the Command is the request, governance has passed, and the
  // engine changes the state as the SEU system actor after `transitionEngine.evaluate` has checked the badge.
  // Requests for the same Deliverable are applied one at a time. Inside that turn the Deliverable is read again, so a
  // request whose governance ran against a state that another request has since changed is refused before any
  // Command is recorded. A Deliverable only ever moves together with its Command.
  async applyDeliverableTransition(input: {
    deliverable: DeliverableRow;
    fromState: string;
    toState: string;
    requestedBy: string;
    actingBadgeType: string;
    governanceOutcome: GovernanceEvaluationOutcomeDraft;
    correlationId: string;
  }): Promise<ApplyDeliverableResult> {
    return withDeliverableTurn(input.deliverable.id, async () => {
      const { data: current } = await deliverablesDB.findById(input.deliverable.id);
      if (!current || current.lifecycle_state !== input.fromState) {
        return { ok: false, reason: "already_in_flight", detail: `Deliverable ${input.deliverable.id} is no longer ${input.fromState}; another request has already applied this hop` } as const;
      }
      return executionEngine.applyGovernedDeliverableTransition(input);
    });
  },

  async applyGovernedDeliverableTransition(input: {
    deliverable: DeliverableRow;
    fromState: string;
    toState: string;
    requestedBy: string;
    actingBadgeType: string;
    governanceOutcome: GovernanceEvaluationOutcomeDraft;
    correlationId: string;
  }): Promise<ApplyDeliverableResult> {
    const { deliverable, fromState, toState } = input;
    const systemActor = await getSystemActor(deliverable.seu_id);

    const evaluated = await transitionEngine.authorise({
      entityType: "Deliverable",
      fromState,
      toState,
      actorId: systemActor.actorId,
    });
    if (!evaluated.allowed) {
      return gateRejection(evaluated, "Deliverable", fromState, toState);
    }
    const { verb } = evaluated.definition;
    if (!evaluated.authorityBadge || !verb) throw new Error(`no authority badge resolved for Deliverable ${fromState} -> ${toState}`);

    const { data: outcome, error: outcomeError } = await governanceEvaluationOutcomesDB.create({
      ...input.governanceOutcome,
      author_id: systemActor.authorId,
      author_badge: systemActor.authorBadge,
    });
    if (outcomeError || !outcome) throw outcomeError ?? new Error("failed to record governance evaluation outcome");

    const { data: command, error: commandError } = await commandsDB.create({
      seuId: deliverable.seu_id,
      entityType: "Deliverable",
      entityId: deliverable.id,
      commandType: commandTypeFor("Deliverable", verb),
      fromState,
      toState,
      requestedBy: input.requestedBy,
      actingBadgeType: input.actingBadgeType,
      correlationId: input.correlationId,
      governanceOutcomeId: outcome.id,
      eligibleParticipantPoolId: null,
    });
    if (commandError || !command) throw commandError ?? new Error("failed to record the transition command");

    const { data: updated, error: updateError } = await deliverablesDB.updateLifecycleState(deliverable.id, toState);
    if (updateError || !updated) throw updateError ?? new Error("failed to apply deliverable transition");
    await commandsDB.updateStatus(command.id, "Completed");

    await dependencyDefinitionEngine.evaluateAndPublishFromTransition({
      seuId: deliverable.seu_id,
      entityType: "Deliverable",
      name: updated.name,
      newState: toState,
      correlationId: input.correlationId,
    });

    if (await transitionRequiresAttestation(evaluated.definition)) {
      const { authorId: requesterParticipantId } = await resolveAuthor(deliverable.seu_id, input.requestedBy);
      await attestationsDB.create({
        seuId: deliverable.seu_id,
        deliverableId: deliverable.id,
        commandId: command.id,
        participantId: requesterParticipantId,
        fromState,
        toState,
        reference: null,
        actingBadgeType: input.actingBadgeType,
        requestedBy: input.requestedBy,
      });
    }

    await eventBus.publish({
      eventType: "DeliverableTransitioned",
      originatingObjectType: "Deliverable",
      originatingObjectId: deliverable.id,
      seuId: deliverable.seu_id,
      correlationId: input.correlationId,
      actorId: systemActor.actorId,
      authorityBadge: evaluated.authorityBadge,
      payload: { fromState, toState, commandId: command.id },
    });
    return { ok: true };
  },

  async execute(input: {
    seuId: string;
    entityType: TransitionEntityType;
    entityId: string;
    fromState: string;
    toState: string;
    commandType: string;
    producingCapabilityId: string | null;
    requestedBy: string;
    actorId: string;
    actingBadgeType: string;
    targetCompletionAt?: Date | null;
    correlationId: string;
    governanceOutcome?: GovernanceEvaluationOutcomeDraft | null;
    governanceOutcomeId?: string | null;
  }): Promise<void> {
    let governanceOutcomeId: string | null = input.governanceOutcomeId ?? null;
    if (input.governanceOutcome) {
      const systemActor = await getSystemActor(input.seuId);
      const { data: outcome, error: outcomeError } = await governanceEvaluationOutcomesDB.create({
        ...input.governanceOutcome,
        author_id: systemActor.authorId,
        author_badge: systemActor.authorBadge,
      });
      if (outcomeError || !outcome) throw outcomeError ?? new Error("failed to record governance evaluation outcome");
      governanceOutcomeId = outcome.id;
    }

    let eligibleParticipantPoolId: string | null = null;
    if (input.producingCapabilityId) {
      if (!input.actorId) throw new Error("cannot persist eligible-Participant pool without a real actorId");
      if (!input.actingBadgeType) throw new Error("cannot persist eligible-Participant pool without a resolved acting badge");
      const systemActor = await getSystemActor(input.seuId);
      const { data: seuCapability } = await seuCapabilitiesDB.findBySeuIdAndCapabilityId(input.seuId, input.producingCapabilityId);
      const { data: fulfilments } = seuCapability
        ? await capabilityFulfilmentsDB.findActiveManyBySeuCapabilityId(seuCapability.id)
        : { data: [] };
      const { data: pool, error: poolError } = await capabilityFulfilmentPoolsDB.create({
        seuId: input.seuId,
        seuCapabilityId: seuCapability?.id ?? null,
        capabilityId: input.producingCapabilityId,
        participantIds: (fulfilments ?? []).map((f) => f.participant_id),
        authorId: systemActor.authorId,
        authorBadge: systemActor.authorBadge,
      });
      if (poolError || !pool) throw poolError ?? new Error("failed to persist eligible-Participant pool");
      eligibleParticipantPoolId = pool.id;
    }

    const { data: command, error } = await commandsDB.create({
      seuId: input.seuId,
      entityType: input.entityType,
      entityId: input.entityId,
      commandType: input.commandType,
      fromState: input.fromState,
      toState: input.toState,
      requestedBy: input.requestedBy,
      actingBadgeType: input.actingBadgeType,
      correlationId: input.correlationId,
      governanceOutcomeId,
      eligibleParticipantPoolId,
    });
    if (error || !command) throw error ?? new Error("failed to generate command");

    await eventBus.publish({
      eventType: "CommandGenerated",
      originatingObjectType: "Command",
      originatingObjectId: command.id,
      seuId: input.seuId,
      correlationId: input.correlationId,
      actorId: input.actorId,
      authorityBadge: input.actingBadgeType,
      payload: {
        entityType: input.entityType,
        entityId: input.entityId,
        fromState: input.fromState,
        toState: input.toState,
        targetCompletionAt: input.targetCompletionAt ? input.targetCompletionAt.toISOString() : null,
      },
    });

  },
};
