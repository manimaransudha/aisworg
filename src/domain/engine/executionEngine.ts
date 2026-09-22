// Ch.31 minimal instance. This module owns Command generation onward:
// Command -> Work Item Generator -> Dispatch Engine, matching Ch.31 §12's
// "Execution Engine shall not duplicate dependency logic" and its
// collaboration with Capability Fulfilment through the Dispatch Engine
// (Ch.33). CR-107 — it now also owns Ch.31 §9's own "Evaluate Governance"
// step for Deliverable, ahead of Command generation, rather than leaving it
// to the caller: `evaluateDeliverableTransition` runs dependency readiness,
// the SEU-blocked and per-Deliverable-Obligation checks (item 6), Quality
// Gate, Policy, and Authority, and — like every other event-handler-shaped
// file in this directory (ebmActivated.ts, executionEngineKickoff.ts) —
// calls into routes/seu/core/ for the side effects a block produces
// (raiseObligationForBlockedTransition, raiseAttentionItem,
// checkSustainedQualityGateBlocking, the DeliverableBlocked publish). Ch.30's
// "engine layer never calls back into core" boundary protects the *pure*
// decision engines (policyEngine, qualityGateEngine, transitionEngine,
// dependencyDefinitionEngine) so they stay reusable and side-effect-free;
// this module was never one of those — it already had side effects (Command/
// Work Item/event writes) before this CR, same orchestrator category as the
// handler files above, not the pure-engine one.
import { commandsDB } from "../../dblayer/commandsDB.js";
import { governanceEvaluationOutcomesDB } from "../../dblayer/governanceEvaluationOutcomesDB.js";
import { seuCapabilitiesDB } from "../../dblayer/seuCapabilitiesDB.js";
import { capabilityFulfilmentsDB } from "../../dblayer/capabilityFulfilmentsDB.js";
import { capabilityFulfilmentPoolsDB } from "../../dblayer/capabilityFulfilmentPoolsDB.js";
import { eventBus } from "./eventBus.js";
// workItemGenerator/dispatchEngine calls moved to commandGenerated.ts /
// workItemGenerated.ts (CommandGenerated / WorkItemGenerated consumers) — no
// longer called inline from execute() itself.
// import { workItemGenerator } from "./workItemGenerator.js";
// import { dispatchEngine } from "./dispatchEngine.js";
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
import { raiseAttentionItem } from "../../routes/seu/core/attentionItems.js";
import { raiseObligationForBlockedTransition } from "../../routes/seu/core/obligations.js";
import { attentionItemsDB } from "../../dblayer/attentionItemsDB.js";
import { authorityRulesDB } from "../../dblayer/authorityRulesDB.js";
import type { CommandRow, DeliverableRow, DependencyDefinitionRow, GovernanceEvaluationOutcomeInput, TransitionEntityType } from "../../dblayer/seuTypes.js";

// ExecutionResult removed: execute() is now an event-boundary function, not a
// return-value function. Its caller must be an event consumer (nothing else
// in the platform calls a Command/Work Item/Dispatch step and reads a return
// value back — every HANDLER_REGISTRY entry is typed void|Promise<void>).
// Whatever execute() decides is visible only through the events it publishes
// (CommandGenerated onward), never through what it hands back to a caller.

// CR-107 item 7 — the same discriminated shape deliverables.ts's own
// TransitionDeliverableResult already used for these reasons (that type now
// re-exports this one for its "not ok, not dispatched" cases); kept here
// since this is now where each of these outcomes is actually decided.
export type DeliverableGovernanceResult =
  | { ok: true; fromState: string; governanceOutcome: GovernanceEvaluationOutcomeInput; actingBadgeType: string | null }
  | { ok: false; reason: "dependency_not_satisfied"; rows: DependencyDefinitionRow[] }
  | { ok: false; reason: "seu_blocked" | "obligation_blocked" | "decision_blocked"; detail: string }
  | { ok: false; reason: "quality_gate_blocked"; detail: string }
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition" | "not_submitted"; detail: string }
  | { ok: false; reason: "empty_centre"; detail: string }
  | { ok: false; reason: "already_in_flight"; detail: string };

export const executionEngine = {
  // CR-107 — moved from transitionDeliverable (deliverables.ts) verbatim,
  // plus the new SEU-blocked/per-Deliverable-Obligation checks (item 6).
  // transitionDeliverable now just loads the Deliverable, calls this, and —
  // once true here — resolves the acting badge (attribution, not a
  // governance input) and calls execute() below.
  async evaluateDeliverableTransition(input: { deliverable: DeliverableRow; targetState: string; actorId?: string }): Promise<DeliverableGovernanceResult> {
    const { deliverable, targetState } = input;

    // CR-039/CR-043 — the canonical graph gates by (name, targetState), not
    // by instance FK, gathered across every scope relevant to this SEU (its
    // Template, every composed Pack, its Profile), and only carries rows for
    // the transitions actually declared. A target state with no rows
    // resolves ready trivially, same as an ungoverned Deliverable always has.
    const readiness = await dependencyDefinitionEngine.isTargetReady(deliverable.seu_id, "Deliverable", deliverable.name, targetState);
    if (!readiness.ready) {
      // CR-042 — mirrors qualityGateEngine.recordAndBlock's own pattern: the
      // real counterpart to evaluateAndPublishFromTransition's
      // DeliverableReady, published at the exact point a gated transition is
      // actually refused.
      const reason = `${readiness.rows.length} governing dependency row(s) not yet satisfied (${readiness.rows.map((r) => `${r.from_entity_type}${r.from_name ? ` "${r.from_name}"` : ""} -> ${r.from_state}`).join(", ")})`;
      await eventBus.publish({
        eventType: "DeliverableBlocked",
        originatingObjectType: "Deliverable",
        originatingObjectId: deliverable.id,
        seuId: deliverable.seu_id,
        correlationId: eventBus.newCorrelationId(),
        payload: { entityType: "Deliverable", entityId: deliverable.id, reason },
      });
      return { ok: false, reason: "dependency_not_satisfied", rows: readiness.rows };
    }

    // CR-107 — the original gap this CR was raised to close: an SEU blocked
    // at its own commence-work hop (a real, open Obligation on record,
    // CR-104/CR-106) had no effect on its head-of-chain Deliverables —
    // dependency readiness alone doesn't see it, since a head-of-chain
    // Deliverable has no incoming dependency_definitions row at all. Checked
    // directly against the Obligation record (not the SEU's own
    // lifecycle_state) — an Obligation that has since resolved
    // (RESOLVED_OBLIGATION_STATUSES) no longer blocks, regardless of what
    // state the SEU happens to be in right now.
    const { data: seuObligations } = await obligationsDB.findByRelatedObject("SEU", deliverable.seu_id);
    const openSeuBlock = (seuObligations ?? []).find((o) => o.blocked_from_state && o.blocked_to_state && !RESOLVED_OBLIGATION_STATUSES.has(o.status));
    if (openSeuBlock) {
      return { ok: false, reason: "seu_blocked", detail: `owning SEU is blocked by an open Obligation ("${openSeuBlock.title}") — cannot start until it resolves` };
    }

    // CR-107 — an Obligation raised directly against this Deliverable itself
    // (this same function's own Policy-block branch below, on an earlier
    // attempt) gates it too, independent of the SEU-wide check above.
    const { data: deliverableObligations } = await obligationsDB.findByRelatedObject("Deliverable", deliverable.id);
    const openDeliverableBlock = (deliverableObligations ?? []).find((o) => o.blocked_from_state && o.blocked_to_state && !RESOLVED_OBLIGATION_STATUSES.has(o.status));
    if (openDeliverableBlock) {
      return { ok: false, reason: "obligation_blocked", detail: `blocked by an open Obligation ("${openDeliverableBlock.title}")` };
    }

    // Ch.9 §10 Decision Dependency ("Execution requires an approved
    // decision"), CR-109 §5a — a standing rule, not a dependency_definitions
    // row: any Decision related to this Deliverable that hasn't yet reached
    // Approved (Ch.19 §9: "Only Approved Decisions may influence Deliverable
    // state transitions") blocks its own next transition. Opening a Decision
    // against Deliverable A therefore also blocks any Deliverable B that
    // already depends on A reaching a later state — B's own existing
    // dependency row never sees A reach it while A is held here, no new
    // graph edge needed. A Decision related to several Deliverables at once
    // (related_objects naming more than one) blocks each of them directly,
    // the same check run independently per Deliverable.
    const { data: deliverableDecisions } = await decisionsDB.findByRelatedObject("Deliverable", deliverable.id);
    for (const decision of deliverableDecisions ?? []) {
      if (!(await dependencyDefinitionEngine.isReachedOrPassed("Decision", "Approved", decision.status))) {
        return { ok: false, reason: "decision_blocked", detail: `blocked by an open Decision ("${decision.title}") not yet Approved` };
      }
    }

    const fromState = deliverable.lifecycle_state;

    // deliverableKickoffHandler (DeliverableTransitioned/SEUOperational) rescans
    // every Deliverable in the SEU on each hop and re-attempts each one's next
    // transition — a Deliverable already Dispatched-and-outstanding for this
    // exact hop would otherwise pass every other check below again and get a
    // second Command/Work Item/Dispatch for work already underway.
    const { data: inFlight } = await commandsDB.findInFlight("Deliverable", deliverable.id, fromState, targetState);
    if (inFlight) {
      return { ok: false, reason: "already_in_flight", detail: `a Command for this exact hop is already ${inFlight.status} (Command ${inFlight.id})` };
    }

    const qualityGateResult = await qualityGateEngine.evaluate({
      entityType: "Deliverable",
      entityId: deliverable.id,
      seuId: deliverable.seu_id,
      fromState,
      toState: targetState,
    });
    if (qualityGateResult.outcome === "Blocked") {
      // Ch.35 §11: a sustained pattern of blocking is Telemetry's concern,
      // not the transition attempt's own.
      await checkSustainedQualityGateBlocking({ qualityGateId: qualityGateResult.gate.id, gateName: qualityGateResult.gate.name, seuId: deliverable.seu_id, deliverableId: deliverable.id });
      // Ch.34: not every Event needs attention (AM-002) — but a genuinely
      // blocked governed transition is exactly the "Execution Engine can't
      // automatically continue" case Ch.34's own worked examples call out as
      // requiring it. Deduplicated per (SEU, Deliverable) so retries of the
      // same blocked attempt don't flood the inbox.
      await raiseAttentionItem({
        seuId: deliverable.seu_id,
        category: "Action Required",
        title: `Deliverable "${deliverable.name}" is blocked by Quality Gate "${qualityGateResult.gate.name}"`,
        description: qualityGateResult.reason,
        relatedObjectType: "Deliverable",
        relatedObjectId: deliverable.id,
      });
      return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${qualityGateResult.gate.name}" blocked: ${qualityGateResult.reason}` };
    }

    // CR-104 — Policy's own live check, same position as Quality Gate above
    // (after dependency readiness, before Authority): reads this SEU's EBM-
    // materialised applicable_policy_ids, not the dead required_policy_ids/
    // findAllActive paths.
    const policyResult = await policyEngine.evaluate({
      entityType: "Deliverable",
      seuId: deliverable.seu_id,
      entityId: deliverable.id,
      fromState,
      toState: targetState,
      context: { deliverable },
    });
    if (policyResult.outcome === "Blocked") {
      // CR-106 Option C — same treatment as the Quality Gate block above:
      // raise a real Obligation + Attention Item instead of leaving this
      // block invisible on the platform-wide inbox.
      await raiseObligationForBlockedTransition({
        seuId: deliverable.seu_id, relatedObjectType: "Deliverable", relatedObjectId: deliverable.id,
        fromState, toState: targetState, policyCode: policyResult.policyCode,
      });
      return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${policyResult.policyCode}` };
    }

    // CR-107 item 10 — Authority checked directly (badgeAuthorityEngine),
    // not via transitionEngine.evaluate's own bundled call: that function
    // doesn't apply state or publish either, so routing through it here
    // bought nothing except also re-running its own required_policy_ids/
    // required_quality_gate_ids checks, which are always empty on every real
    // Deliverable row today (Deliverable keeps using its own separate
    // qualityGateEngine.evaluate/policyEngine.evaluate calls above for the
    // real thing) — dropped here as dead weight, not silently lost coverage.
    // Unlike SEU's own Activated -> Operational row, Deliverable's verbs are
    // real and live (create/approve/baseline, authorityVocabulary.json), so
    // this is an actually-exercised path.
    const { data: definition } = await transitionDefinitionsDB.find("Deliverable", fromState, targetState);
    if (!definition) {
      return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Deliverable ${fromState} -> ${targetState}` };
    }
    let applicableAuthorityRuleId: string | null = null;
    // Owner (2026-09-22): "why do we even need this? the intent is to log
    // the badge along with the actor_id" — the real authority check right
    // here already knows exactly which badge authorised this transition
    // (root, or requiredBadge itself, since Deliverable has no alternates);
    // captured and returned below so the caller (transitionDeliverable)
    // doesn't need a second, separate lookup (the old resolveAutoActingBadge,
    // now removed) to re-derive the same answer.
    let actingBadgeType: string | null = null;
    if (definition.verb) {
      const requiredBadge = `deliverable_${definition.verb}`;
      const auth = await badgeAuthorityEngine.authorise({ actorId: input.actorId ?? "", requiredBadge });
      if (!auth.allowed) {
        return { ok: false, reason: "authority_denied", detail: `acting badge check failed: ${auth.reason}` };
      }
      actingBadgeType = auth.via === "root" ? "root" : (auth.matchedBadge ?? requiredBadge);
      const { data: authorityRule } = await authorityRulesDB.findByCode(requiredBadge);
      applicableAuthorityRuleId = authorityRule?.id ?? null;
    }
    // CR-072 — a manual transition whose row declares submit_verb cannot be
    // attempted until its own from_state has actually been submitted
    // (triggerEngine), regardless of whether the acting actor holds this
    // transition's own badge. No real Deliverable row sets submit_verb
    // today; kept for correctness against a future one that does.
    if (definition.submit_verb) {
      const hasBeenSubmitted = await triggerEngine.hasBeenSubmitted("Deliverable", deliverable.id, fromState);
      if (!hasBeenSubmitted) {
        return { ok: false, reason: "not_submitted", detail: `must be submitted first (requires badge deliverable_${definition.submit_verb})` };
      }
    }

    // Empty-centre presence check (Participant Integration Plan, Resolution
    // 4): approval certifies produced work, so an approval (In Progress ->
    // Approved) cannot even be dispatched unless a real reference was
    // attached when the Deliverable was produced (the Defined -> In Progress
    // completion). Runs after every other governance check so the existing
    // quality-gate/authority reasons still win when both apply.
    if (fromState === "In Progress" && targetState === "Approved") {
      const { data: existingRef } = await deliverableReferencesDB.findLatestWithReference(deliverable.id, "In Progress");
      if (!existingRef) {
        return { ok: false, reason: "empty_centre", detail: "cannot approve a Deliverable with no attached reference — nothing has been produced to approve" };
      }
    }

    // CR-109 §6.1 — the Governance Evaluation Outcome. Built here, from
    // exactly the checks this function already ran above (qualityGateResult,
    // policyResult, applicableAuthorityRuleId), instead of discarding them.
    // Not persisted yet — execute() is the write boundary (migration 233's
    // own header: a blocked attempt is never recorded, only this, the
    // passing evaluation about to become a Command).
    //
    // consultedObligationIds/openAttentionItemIds are NOT "what happened
    // during this run" — they're every Obligation/AttentionItem still open
    // against this Deliverable or its owning SEU right now, none of which
    // blocked this transition, so the Work Item Generator can still surface
    // them to the Participant (Ch.32 §11 activeObligations).
    const consultedObligationIds = [...(seuObligations ?? []), ...(deliverableObligations ?? [])]
      .filter((o) => !RESOLVED_OBLIGATION_STATUSES.has(o.status))
      .map((o) => o.id);
    const [{ data: deliverableAttentionItems }, { data: seuAttentionItems }] = await Promise.all([
      attentionItemsDB.findOpenByRelatedObjectAny("Deliverable", deliverable.id),
      attentionItemsDB.findOpenByRelatedObjectAny("SEU", deliverable.seu_id),
    ]);
    const openAttentionItemIds = [...(deliverableAttentionItems ?? []), ...(seuAttentionItems ?? [])].map((a) => a.id);

    // qualityGateEngine.evaluate returns QualityGateListEvaluationResult, NOT
    // the single-gate QualityGateEvaluationResult: "Passed" here means every
    // candidate gate passed (there may have been several, or none), and
    // carries no single `.gate` — only "Blocked" (already returned above)
    // and "Waived" (the one short-circuiting gate) ever carry one.
    const qualityGateOutcome = qualityGateResult.outcome === "NotApplicable" ? "NotApplicable" : qualityGateResult.outcome === "Waived" ? "Waived" : "Passed";
    const waivedGate = qualityGateResult.outcome === "Waived" ? qualityGateResult.gate : null;
    const outcome: GovernanceEvaluationOutcomeInput["outcome"] =
      qualityGateOutcome === "Waived" ? "Waived" : policyResult.deviatedPolicyIds.length > 0 ? "Approved-with-Conditions" : "Approved";
    const rationaleParts = [
      qualityGateOutcome === "NotApplicable" ? "no applicable Quality Gate" : waivedGate ? `Quality Gate "${waivedGate.name}": Waived` : `Quality Gate(s): ${qualityGateOutcome}`,
      policyResult.outcome === "NotApplicable" ? "no applicable Policy" : `${policyResult.satisfiedPolicyIds.length} Policy(ies) satisfied, ${policyResult.deviatedPolicyIds.length} deviated`,
      applicableAuthorityRuleId ? "Authority check passed" : "no Authority rule required",
    ];

    const governanceOutcome: GovernanceEvaluationOutcomeInput = {
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

  async execute(input: {
    seuId: string;
    entityType: TransitionEntityType;
    entityId: string;
    fromState: string;
    toState: string;
    producingCapabilityId: string | null;
    requestedBy: number | null;
    actingBadgeType?: string | null;
    targetCompletionAt?: Date | null;
    correlationId: string;
    // CR-109 §6.1/§6.2 — the record evaluateDeliverableTransition built on
    // its ok:true path. execute() is the write boundary: it persists this
    // first, then stamps the Command with the resulting id
    // (governanceOutcomeRef). Optional/null for command types that don't
    // route through evaluateDeliverableTransition yet.
    governanceOutcome?: GovernanceEvaluationOutcomeInput | null;
  }): Promise<void> {
    let governanceOutcomeId: string | null = null;
    if (input.governanceOutcome) {
      const { data: outcome, error: outcomeError } = await governanceEvaluationOutcomesDB.create(input.governanceOutcome);
      if (outcomeError || !outcome) throw outcomeError ?? new Error("failed to record governance evaluation outcome");
      governanceOutcomeId = outcome.id;
    }

    // Ch.12 §9 / CR-109 §6.2 — snapshot the real eligible-Participant pool
    // (capabilityFulfilmentsDB.findActiveManyBySeuCapabilityId, Ch.12 §18.2)
    // now, at Command generation, so Dispatch reads what Fulfilment already
    // decided instead of re-resolving it live (CR-109 §5's "connective
    // tissue" principle). No producing Capability declared at all -> no pool
    // concept applies, same as dispatchEngine's own pre-existing
    // NO_CAPABILITY_DECLARED path; eligibleParticipantPoolId stays null.
    let eligibleParticipantPoolId: string | null = null;
    if (input.producingCapabilityId) {
      const { data: seuCapability } = await seuCapabilitiesDB.findBySeuIdAndCapabilityId(input.seuId, input.producingCapabilityId);
      const { data: fulfilments } = seuCapability
        ? await capabilityFulfilmentsDB.findActiveManyBySeuCapabilityId(seuCapability.id)
        : { data: [] };
      const { data: pool, error: poolError } = await capabilityFulfilmentPoolsDB.create({
        seuId: input.seuId,
        seuCapabilityId: seuCapability?.id ?? null,
        capabilityId: input.producingCapabilityId,
        participantIds: (fulfilments ?? []).map((f) => f.participant_id),
      });
      if (poolError || !pool) throw poolError ?? new Error("failed to persist eligible-Participant pool");
      eligibleParticipantPoolId = pool.id;
    }

    const { data: command, error } = await commandsDB.create({
      seuId: input.seuId,
      entityType: input.entityType,
      entityId: input.entityId,
      commandType: `${input.entityType}.Transition`,
      fromState: input.fromState,
      toState: input.toState,
      requestedBy: input.requestedBy,
      actingBadgeType: input.actingBadgeType ?? null,
      correlationId: input.correlationId,
      governanceOutcomeId,
      eligibleParticipantPoolId,
    });
    if (error || !command) throw error ?? new Error("failed to generate command");

    // No code follows this publish (platform event-publishing rule). Work Item
    // generation and Dispatch used to run inline here, synchronously, in the
    // same call stack as whatever requested this Command (an HTTP transition
    // request) — that violated the rule and made execute() a plain function
    // call disguised as an event boundary. commandGeneratedHandler
    // (event_subscriptions row on CommandGenerated) now owns everything that
    // used to run below this line.
    await eventBus.publish({
      eventType: "CommandGenerated",
      originatingObjectType: "Command",
      originatingObjectId: command.id,
      seuId: input.seuId,
      correlationId: input.correlationId,
      payload: {
        entityType: input.entityType,
        entityId: input.entityId,
        fromState: input.fromState,
        toState: input.toState,
        targetCompletionAt: input.targetCompletionAt ? input.targetCompletionAt.toISOString() : null,
      },
    });

    // const workItem = await workItemGenerator.generate({ command, seuId: input.seuId, correlationId: input.correlationId, causationEventId: commandGeneratedEvent.id });
    //
    // const dispatch = await dispatchEngine.dispatch({
    //   workItem,
    //   seuId: input.seuId,
    //   producingCapabilityId: input.producingCapabilityId,
    //   eligibleParticipantPoolId,
    //   targetCompletionAt: input.targetCompletionAt ?? null,
    //   correlationId: input.correlationId,
    // });
    //
    // if (!dispatch.dispatched) {
    //   const { data: deferred } = await commandsDB.updateStatus(command.id, "Deferred");
    //   return { command: deferred ?? command, dispatched: false, workItemId: workItem.id, deferredReason: dispatch.deferredReason as "no_eligible_participant" };
    // }
    //
    // const { data: dispatched } = await commandsDB.updateStatus(command.id, "Dispatched");
    // return { command: dispatched ?? command, dispatched: true, participantId: dispatch.participantId, workItemId: workItem.id };
  },
};
