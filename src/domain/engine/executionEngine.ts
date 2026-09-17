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
import { eventBus } from "./eventBus.js";
import { workItemGenerator } from "./workItemGenerator.js";
import { dispatchEngine } from "./dispatchEngine.js";
import { dependencyDefinitionEngine } from "./dependencyDefinitionEngine.js";
import { qualityGateEngine, RESOLVED_OBLIGATION_STATUSES } from "./qualityGateEngine.js";
import { policyEngine } from "./policyEngine.js";
import { badgeAuthorityEngine } from "./badgeAuthorityEngine.js";
import { triggerEngine } from "./triggerEngine.js";
import { transitionDefinitionsDB } from "../../dblayer/transitionDefinitionsDB.js";
import { obligationsDB } from "../../dblayer/obligationsDB.js";
import { deliverableReferencesDB } from "../../dblayer/deliverableReferencesDB.js";
import { checkSustainedQualityGateBlocking } from "../../routes/seu/core/telemetry.js";
import { raiseAttentionItem } from "../../routes/seu/core/attentionItems.js";
import { raiseObligationForBlockedTransition } from "../../routes/seu/core/obligations.js";
import type { CommandRow, DeliverableRow, DependencyDefinitionRow, TransitionEntityType } from "../../dblayer/seuTypes.js";

export interface ExecutionResult {
  command: CommandRow;
  dispatched: boolean;
  participantId?: string;
  workItemId: string;
  deferredReason?: "no_eligible_participant";
}

// CR-107 item 7 — the same discriminated shape deliverables.ts's own
// TransitionDeliverableResult already used for these reasons (that type now
// re-exports this one for its "not ok, not dispatched" cases); kept here
// since this is now where each of these outcomes is actually decided.
export type DeliverableGovernanceResult =
  | { ok: true; fromState: string }
  | { ok: false; reason: "dependency_not_satisfied"; rows: DependencyDefinitionRow[] }
  | { ok: false; reason: "seu_blocked" | "obligation_blocked"; detail: string }
  | { ok: false; reason: "quality_gate_blocked"; detail: string }
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition" | "not_submitted"; detail: string }
  | { ok: false; reason: "empty_centre"; detail: string };

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

    const fromState = deliverable.lifecycle_state;

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
    if (definition.verb) {
      const requiredBadge = `deliverable_${definition.verb}`;
      const auth = await badgeAuthorityEngine.authorise({ actorId: input.actorId ?? "", requiredBadge });
      if (!auth.allowed) {
        return { ok: false, reason: "authority_denied", detail: `acting badge check failed: ${auth.reason}` };
      }
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

    return { ok: true, fromState };
  },

  async execute(input: {
    seuId: string;
    entityType: TransitionEntityType;
    entityId: string;
    fromState: string;
    toState: string;
    producingCapabilityId: string | null;
    requestedBy: number | null;
    actingBadgeGrantId?: string | null;
    targetCompletionAt?: Date | null;
    correlationId: string;
  }): Promise<ExecutionResult> {
    const { data: command, error } = await commandsDB.create({
      seuId: input.seuId,
      entityType: input.entityType,
      entityId: input.entityId,
      commandType: `${input.entityType}.Transition`,
      fromState: input.fromState,
      toState: input.toState,
      requestedBy: input.requestedBy,
      actingBadgeGrantId: input.actingBadgeGrantId ?? null,
      correlationId: input.correlationId,
    });
    if (error || !command) throw error ?? new Error("failed to generate command");

    const commandGeneratedEvent = await eventBus.publish({
      eventType: "CommandGenerated",
      originatingObjectType: "Command",
      originatingObjectId: command.id,
      seuId: input.seuId,
      correlationId: input.correlationId,
      payload: { entityType: input.entityType, entityId: input.entityId, fromState: input.fromState, toState: input.toState },
    });

    // Ch.30 causation fix — WorkItemGenerated is genuinely caused by this
    // CommandGenerated event, threaded through explicitly rather than
    // workItemGenerator.ts fabricating a reference from the Command's own id.
    const workItem = await workItemGenerator.generate({ command, seuId: input.seuId, correlationId: input.correlationId, causationEventId: commandGeneratedEvent.id });

    const dispatch = await dispatchEngine.dispatch({
      workItem,
      seuId: input.seuId,
      producingCapabilityId: input.producingCapabilityId,
      targetCompletionAt: input.targetCompletionAt ?? null,
      correlationId: input.correlationId,
    });

    if (!dispatch.dispatched) {
      const { data: deferred } = await commandsDB.updateStatus(command.id, "Deferred");
      return { command: deferred ?? command, dispatched: false, workItemId: workItem.id, deferredReason: dispatch.deferredReason as "no_eligible_participant" };
    }

    // Participant Integration — Plan step 1 (Model A): the Command is now
    // Dispatched-and-outstanding, not Completed. It reaches Completed only
    // when the Work Item's result callback lands (completeWorkItem), which is
    // also where the governed Deliverable transition is applied.
    const { data: dispatched } = await commandsDB.updateStatus(command.id, "Dispatched");
    return { command: dispatched ?? command, dispatched: true, participantId: dispatch.participantId, workItemId: workItem.id };
  },
};
