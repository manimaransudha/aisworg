import { commandsDB } from "../../dblayer/commandsDB.js";
import { governanceEvaluationOutcomesDB } from "../../dblayer/governanceEvaluationOutcomesDB.js";
import { seuCapabilitiesDB } from "../../dblayer/seuCapabilitiesDB.js";
import { capabilityFulfilmentsDB } from "../../dblayer/capabilityFulfilmentsDB.js";
import { capabilityFulfilmentPoolsDB } from "../../dblayer/capabilityFulfilmentPoolsDB.js";
import { seusDB } from "../../dblayer/seusDB.js";
import { eventBus } from "./eventBus.js";
import { dependencyDefinitionEngine } from "./dependencyDefinitionEngine.js";
import { qualityGateEngine, type QualityGateCondition } from "./qualityGateEngine.js";
import { originatingPolicyCode } from "./obligationOrigin.js";
import { RESOLVED_OBLIGATION_STATUSES, WAIVER_SCOPE_OBLIGATION, WAIVER_SCOPE_POLICY, WAIVER_SCOPE_POLICY_OBLIGATION } from "../../dblayer/constants.js";
import { policyEngine, type PolicyEvaluationResult } from "./policyEngine.js";
import { loadPolicyChecks } from "./policyChecks.js";
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
import type { CommandRow, DeliverableRow, DependencyDefinitionRow, GovernanceEvaluationOutcomeDraft, ObligationRow, TransitionEntityType } from "../../dblayer/seuTypes.js";
import { getSystemActor, commandTypeFor } from "../../dblayer/constants.js";
import { deliverablesDB } from "../../dblayer/deliverablesDB.js";
import { attestationsDB } from "../../dblayer/attestationsDB.js";
import { transitionEngine, gateRejection, transitionRequiresAttestation, type GateRejectionResult } from "./transitionEngine.js";

export type DeliverableGovernanceResult =
  | { ok: true; fromState: string; governanceOutcome: GovernanceEvaluationOutcomeDraft; actingBadgeType: string }
  | { ok: false; reason: "dependency_not_satisfied"; rows: DependencyDefinitionRow[] }
  | { ok: false; reason: "seu_blocked" | "obligation_blocked" | "decision_blocked"; detail: string }
  | { ok: false; reason: "quality_gate_blocked"; detail: string }
  | { ok: false; reason: "policy_blocked" | "no_transition_definition" | "not_submitted"; detail: string }
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

// What a waiver has to name to cover an open Obligation: its Policy and title when a Policy raised it, its category and title otherwise.
async function obligationWaivable(obligation: ObligationRow): Promise<QualityGateCondition["waivable"]> {
  const policyCode = await originatingPolicyCode(obligation);
  return policyCode
    ? { scope: WAIVER_SCOPE_POLICY_OBLIGATION, policyCode, title: obligation.title }
    : { scope: WAIVER_SCOPE_OBLIGATION, category: obligation.category, title: obligation.title };
}

export const executionEngine = {
  async evaluateDeliverableTransition(input: { deliverable: DeliverableRow; targetState: string; actorId: string }): Promise<DeliverableGovernanceResult> {
    const { deliverable, targetState } = input;

    // The dependency, Obligation, Decision, in-flight, Policy, submit verb and empty centre checks do not return. Each check adds a condition, Passed or Blocked, that goes
    // to the Quality Gate decision with the Quality Gate line items. The composition decides which Blocked conditions a waiver covers, and the decision decides the state change.
    type Refusal = Extract<DeliverableGovernanceResult, { ok: false }>;
    const found: Array<QualityGateCondition & { refusal: Refusal | null }> = [];

    const readiness = await dependencyDefinitionEngine.isTargetReady(deliverable.seu_id, "Deliverable", deliverable.name, targetState);
    let dependencyBlockReason: string | null = null;
    if (!readiness.ready) {
      dependencyBlockReason = `${readiness.rows.length} governing dependency row(s) not yet satisfied (${readiness.rows.map((r) => `${r.from_entity_type}${r.from_name ? ` "${r.from_name}"` : ""} -> ${r.from_state}`).join(", ")})`;
      found.push({ name: "Dependencies", reason: dependencyBlockReason, outcome: "Blocked", waivable: null, refusal: { ok: false, reason: "dependency_not_satisfied", rows: readiness.rows } });
    } else {
      found.push({ name: "Dependencies", reason: "", outcome: "Passed", waivable: null, refusal: null });
    }

    const { data: seuObligations } = await obligationsDB.findByRelatedObject("SEU", deliverable.seu_id);
    const openSeuBlock = (seuObligations ?? []).find((o) => o.blocked_from_state && o.blocked_to_state && !RESOLVED_OBLIGATION_STATUSES.has(o.status));
    if (openSeuBlock) {
      const detail = `owning SEU is blocked by an open Obligation ("${openSeuBlock.title}") — cannot start until it resolves`;
      found.push({ name: `SEU Obligation "${openSeuBlock.title}"`, reason: detail, outcome: "Blocked", waivable: await obligationWaivable(openSeuBlock), refusal: { ok: false, reason: "seu_blocked", detail } });
    } else {
      found.push({ name: "SEU Obligations", reason: "", outcome: "Passed", waivable: null, refusal: null });
    }

    const { data: deliverableObligations } = await obligationsDB.findByRelatedObject("Deliverable", deliverable.id);
    const openDeliverableBlock = (deliverableObligations ?? []).find((o) => o.blocked_from_state && o.blocked_to_state && !RESOLVED_OBLIGATION_STATUSES.has(o.status));
    if (openDeliverableBlock) {
      const detail = `blocked by an open Obligation ("${openDeliverableBlock.title}")`;
      found.push({ name: `Obligation "${openDeliverableBlock.title}"`, reason: detail, outcome: "Blocked", waivable: await obligationWaivable(openDeliverableBlock), refusal: { ok: false, reason: "obligation_blocked", detail } });
    } else {
      found.push({ name: "Obligations", reason: "", outcome: "Passed", waivable: null, refusal: null });
    }

    const { data: deliverableDecisions } = await decisionsDB.findByRelatedObject("Deliverable", deliverable.id);
    let blockingDecisionFound = false;
    for (const decision of deliverableDecisions ?? []) {
      if (!(await dependencyDefinitionEngine.isReachedOrPassed("Decision", "Approved", decision.status))) {
        const detail = `blocked by an open Decision ("${decision.title}") not yet Approved`;
        found.push({ name: `Decision "${decision.title}"`, reason: detail, outcome: "Blocked", waivable: null, refusal: { ok: false, reason: "decision_blocked", detail } });
        blockingDecisionFound = true;
        break;
      }
    }
    if (!blockingDecisionFound) found.push({ name: "Decisions", reason: "", outcome: "Passed", waivable: null, refusal: null });

    const fromState = deliverable.lifecycle_state;

    const { data: inFlight } = await commandsDB.findInFlight("Deliverable", deliverable.id, fromState, targetState);
    if (inFlight) {
      const detail = `a Command for this exact hop is already ${inFlight.status} (Command ${inFlight.id})`;
      found.push({ name: "Command in flight", reason: detail, outcome: "Blocked", waivable: null, refusal: { ok: false, reason: "already_in_flight", detail } });
    } else {
      found.push({ name: "Command in flight", reason: "", outcome: "Passed", waivable: null, refusal: null });
    }

    const { data: definition } = await transitionDefinitionsDB.find("Deliverable", fromState, targetState);
    if (!definition) {
      // A hop already in flight is reported as that, since it names the Command that holds the hop.
      const heldByCommand = found.find((f) => f.name === "Command in flight" && f.outcome === "Blocked");
      if (heldByCommand?.refusal) return heldByCommand.refusal;
      return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Deliverable ${fromState} -> ${targetState}` };
    }
    if (!definition.verb) throw new Error(`Deliverable ${fromState} -> ${targetState} declares no verb — no authority badge can be resolved`);
    const requiredBadge = `deliverable_${definition.verb}`;
    const systemActor = await getSystemActor(deliverable.seu_id);
    const actingBadgeType = await badgeAuthorityEngine.resolveAuthorBadge(input.actorId, requiredBadge);
    const { data: authorityRule } = await authorityRulesDB.findByCode(requiredBadge);
    const applicableAuthorityRuleId = authorityRule?.id ?? null;

    // A Policy condition reads the producing Capability's status here; null when the Deliverable has no producing Capability.
    const { data: producingSeuCapability } = deliverable.producing_capability_id
      ? await seuCapabilitiesDB.findBySeuIdAndCapabilityId(deliverable.seu_id, deliverable.producing_capability_id)
      : { data: null };

    // The Policies of the SEU's EBM, then the Policies the Transition Definition requires. Either can block the hop.
    const policyContext = { deliverable, producingCapabilityStatus: producingSeuCapability?.status ?? null };
    const ebmPolicyResult = await policyEngine.evaluate({
      entityType: "Deliverable",
      seuId: deliverable.seu_id,
      entityId: deliverable.id,
      fromState,
      toState: targetState,
      context: policyContext,
      authorId: input.actorId,
      authorBadge: actingBadgeType,
    });
    const hopPolicyResult = ebmPolicyResult.outcome === "Blocked"
      ? ebmPolicyResult
      : await policyEngine.evaluateChecks(await loadPolicyChecks(definition.required_policy_ids, `Deliverable|${fromState}|${targetState}`), {
        entityType: "Deliverable",
        seuId: deliverable.seu_id,
        entityId: deliverable.id,
        fromState,
        toState: targetState,
        context: policyContext,
        authorId: input.actorId,
        authorBadge: actingBadgeType,
      });
    const blockedResult = [ebmPolicyResult, hopPolicyResult].find((r) => r.outcome === "Blocked");
    if (blockedResult && blockedResult.outcome === "Blocked") {
      await raiseObligationForBlockedTransition({
        seuId: deliverable.seu_id, relatedObjectType: "Deliverable", relatedObjectId: deliverable.id,
        fromState, toState: targetState, policyCode: blockedResult.policyCode,
      });
      const detail = `blocked by policy ${blockedResult.policyCode}`;
      const plainPolicyCode = blockedResult.policyCode.split("::")[0];
      found.push({ name: `Policy ${plainPolicyCode}`, reason: detail, outcome: "Blocked", waivable: { scope: WAIVER_SCOPE_POLICY, policyCode: plainPolicyCode }, refusal: { ok: false, reason: "policy_blocked", detail } });
    } else if (ebmPolicyResult.outcome !== "NotApplicable" || hopPolicyResult.outcome !== "NotApplicable") {
      found.push({ name: "Policies", reason: "", outcome: "Passed", waivable: null, refusal: null });
    }
    const policyResult: PolicyEvaluationResult = ebmPolicyResult.outcome === "NotApplicable" && hopPolicyResult.outcome === "NotApplicable"
      ? ebmPolicyResult
      : { outcome: "Passed", satisfiedPolicyIds: [...ebmPolicyResult.satisfiedPolicyIds, ...hopPolicyResult.satisfiedPolicyIds], deviatedPolicyIds: [...ebmPolicyResult.deviatedPolicyIds, ...hopPolicyResult.deviatedPolicyIds] };

    if (definition.submit_verb) {
      const hasBeenSubmitted = await triggerEngine.hasBeenSubmitted("Deliverable", deliverable.id, fromState);
      if (!hasBeenSubmitted) {
        const detail = `must be submitted first (requires badge deliverable_${definition.submit_verb})`;
        found.push({ name: "Submission", reason: detail, outcome: "Blocked", waivable: null, refusal: { ok: false, reason: "not_submitted", detail } });
      } else {
        found.push({ name: "Submission", reason: "", outcome: "Passed", waivable: null, refusal: null });
      }
    }

    if (fromState === "In Progress" && targetState === "Approved") {
      const { data: existingRef } = await deliverableReferencesDB.findLatestWithReference(deliverable.id, "In Progress");
      if (!existingRef) {
        const detail = "cannot approve a Deliverable with no attached reference — nothing has been produced to approve";
        found.push({ name: "Reference", reason: detail, outcome: "Blocked", waivable: null, refusal: { ok: false, reason: "empty_centre", detail } });
      } else {
        found.push({ name: "Reference", reason: "", outcome: "Passed", waivable: null, refusal: null });
      }
    }

    // The Quality Gates are evaluated whatever the checks above found, just before the state change: an Obligation a Policy raised is seen here. The decision below is made once, with every result.
    const { data: gateSeu } = await seusDB.findById(deliverable.seu_id);
    if (!gateSeu) throw new Error(`SEU ${deliverable.seu_id} not found for Deliverable ${deliverable.id}`);
    const qualityGateResult = await qualityGateEngine.decideQualityGate(await qualityGateEngine.evaluate({
      entityType: "Deliverable",
      entityId: deliverable.id,
      seuId: deliverable.seu_id,
      fromState,
      toState: targetState,
      authorId: systemActor.authorId,
      authorBadge: systemActor.authorBadge,
      tenantId: gateSeu.tenant_id,
    }), found, { entityType: "Deliverable", entityId: deliverable.id, seuId: deliverable.seu_id });
    // The decision is stored for every hop, Blocked included, before the hop is refused or goes on.
    await qualityGateEngine.recordDecision(qualityGateResult, {
      seuId: deliverable.seu_id,
      deliverableId: deliverable.id,
      tenantId: gateSeu.tenant_id,
      actorId: systemActor.authorId,
      actorBadge: systemActor.authorBadge,
    });
    // What the hop is refused with: the first block a check found, in the order the checks run, then the first blocked gate.
    let refusal: Refusal | null = null;
    if (qualityGateResult.outcome === "Blocked") refusal = found.find((f, i) => qualityGateResult.conditions[i].outcome === "Blocked")?.refusal ?? null;
    if (qualityGateResult.blocked.length > 0) {
      const [first] = qualityGateResult.blocked;
      await checkSustainedQualityGateBlocking({ qualityGateId: first.gate.id, gateName: first.gate.name, seuId: deliverable.seu_id, deliverableId: deliverable.id });
      await raiseAttentionItem({
        seuId: deliverable.seu_id,
        category: "Action Required",
        title: `Deliverable "${deliverable.name}" is blocked by Quality Gate "${first.gate.name}"`,
        description: first.reason,
        relatedObjectType: "Deliverable",
        relatedObjectId: deliverable.id,
        ...systemActor,
      });
      if (!refusal) refusal = { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${first.gate.name}" blocked: ${first.reason}` };
    }
    if (refusal) {
      if (dependencyBlockReason) {
        await eventBus.publish({
          eventType: "DeliverableBlocked",
          originatingObjectType: "Deliverable",
          originatingObjectId: deliverable.id,
          seuId: deliverable.seu_id,
          correlationId: eventBus.newCorrelationId(),
          actorId: systemActor.actorId,
          tenantId: systemActor.tenantId,
          authorityBadge: systemActor.authorBadge,
          payload: { entityType: "Deliverable", entityId: deliverable.id, reason: dependencyBlockReason },
        });
      }
      return refusal;
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
    // The Quality Gate a waiver covered, when one did. A waiver of another condition names no gate.
    const waivedGate = qualityGateResult.waived[0]?.gate ?? null;
    const waivedParts = [
      ...qualityGateResult.waived.map((r) => `Quality Gate "${r.gate.name}": Waived`),
      ...qualityGateResult.conditions.slice(0, found.length).filter((c) => c.outcome === "Waived").map((c) => `${c.name}: Waived`),
    ];
    const outcome: GovernanceEvaluationOutcomeDraft["outcome"] =
      qualityGateOutcome === "Waived" ? "Waived" : policyResult.deviatedPolicyIds.length > 0 ? "Approved-with-Conditions" : "Approved";
    const rationaleParts = [
      qualityGateOutcome === "NotApplicable" ? "no applicable Quality Gate" : waivedParts.length > 0 ? waivedParts.join(", ") : `Quality Gate(s): ${qualityGateOutcome}`,
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

    // Commented out (owner): the badge of the system actor is the author badge of getSystemActor, and the definition is read directly.
    // const evaluated = await transitionEngine.authorise({
    //   entityType: "Deliverable",
    //   fromState,
    //   toState,
    //   actorId: systemActor.actorId,
    // });
    // if (!evaluated.allowed) {
    //   return gateRejection(evaluated, "Deliverable", fromState, toState);
    // }
    // const { verb } = evaluated.definition;
    // if (!evaluated.authorityBadge || !verb) throw new Error(`no authority badge resolved for Deliverable ${fromState} -> ${toState}`);
    const { data: definition } = await transitionDefinitionsDB.find("Deliverable", fromState, toState);
    if (!definition) throw new Error(`no Transition Definition for Deliverable ${fromState} -> ${toState}`);
    const { verb } = definition;
    if (!verb) throw new Error(`Deliverable ${fromState} -> ${toState} declares no verb`);

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

    if (await transitionRequiresAttestation(definition)) {
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

    // The hop's own domain event (a Transition Definition names one), then DeliverableTransitioned, which every Deliverable transition publishes.
    const domainEventType = definition.event_type;
    if (!domainEventType) throw new Error(`Deliverable ${fromState} -> ${toState} names no event`);
    await eventBus.publishOnce({
      eventType: domainEventType,
      originatingObjectType: "Deliverable",
      originatingObjectId: deliverable.id,
      seuId: deliverable.seu_id,
      correlationId: input.correlationId,
      actorId: systemActor.actorId,
      tenantId: systemActor.tenantId,
      authorityBadge: systemActor.authorBadge,
      payload: { fromState, toState, commandId: command.id },
    });
    await eventBus.publishOnce({
      eventType: "DeliverableTransitioned",
      originatingObjectType: "Deliverable",
      originatingObjectId: deliverable.id,
      seuId: deliverable.seu_id,
      correlationId: input.correlationId,
      actorId: systemActor.actorId,
      tenantId: systemActor.tenantId,
      authorityBadge: systemActor.authorBadge,
      payload: { deliverableName: deliverable.name, fromState, toState, commandId: command.id },
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
