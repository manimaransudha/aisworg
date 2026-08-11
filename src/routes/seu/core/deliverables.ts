import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { dependencyEdgesDB } from "../../../dblayer/dependencyEdgesDB.js";
import { deliverableReferencesDB } from "../../../dblayer/deliverableReferencesDB.js";
import { badgeGrantsDB } from "../../../dblayer/badgeGrantsDB.js";
import { dependencyEngine } from "../../../domain/engine/dependencyEngine.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { qualityGateEngine } from "../../../domain/engine/qualityGateEngine.js";
import { executionEngine } from "../../../domain/engine/executionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { checkSustainedQualityGateBlocking } from "./telemetry.js";
import { raiseAttentionItem } from "./attentionItems.js";
import { AUTHORING_SCOPE_PACK_CODE } from "../../../domain/sdk/authoringScope.js";
import type { DeliverableRow, DependencyEdgeRow } from "../../../dblayer/seuTypes.js";

// Phase 10 (badge model) — §10's badge-switcher UI isn't built yet (§17.2,
// deliberately deferred to when Participant deployment/provisioning is
// revisited). Interim, honest resolution for this pass: if the actor holds
// exactly one badge that could plausibly satisfy this Deliverable transition
// (root, or a Creator/Approver grant scoped to this SEU+Capability), use it
// without asking — real per-action selection among *multiple* qualifying
// badges is the piece still deferred, not this auto-resolution itself.
async function resolveAutoActingBadge(actorId: string, deliverable: DeliverableRow): Promise<string | null> {
  const { data: grants } = await badgeGrantsDB.findActiveForHolder(actorId);
  if (!grants) return null;

  const root = grants.find((g) => g.badge_type === "root");
  if (root) return root.id;

  const qualifying = grants.filter(
    (g) =>
      (g.badge_type === "creator" || g.badge_type === "approver") &&
      g.governed_entity_type === "Deliverable" &&
      g.capability_id === deliverable.producing_capability_id &&
      // SDK UI Layer Plan — an authoring Deliverable's grant is scoped to the
      // shared sdk-authoring-scope placeholder Pack, not this one bootstrap
      // SEU's id (014_sdk_authoring.sql's header comment: one grant should
      // cover every bootstrap SEU an author touches, not just this one).
      (g.scope_id === deliverable.seu_id || g.scope_id === AUTHORING_SCOPE_PACK_CODE)
  );
  return qualifying.length === 1 ? qualifying[0].id : null;
}

export async function createDeliverable(input: {
  seuId: string;
  name: string;
  category: string;
  dependsOnDeliverableIds?: string[];
  dependsOnServiceIds?: string[];
}): Promise<{ deliverable: DeliverableRow; dependencyEdges: DependencyEdgeRow[] }> {
  const { data: deliverable, error } = await deliverablesDB.create({ seuId: input.seuId, name: input.name, category: input.category });
  if (error || !deliverable) throw error ?? new Error("failed to create deliverable");

  const edges: DependencyEdgeRow[] = [];
  for (const toDeliverableId of input.dependsOnDeliverableIds ?? []) {
    const { data: edge } = await dependencyEdgesDB.createDeliverableEdge({
      seuId: input.seuId,
      fromDeliverableId: deliverable.id,
      toDeliverableId,
      requiredState: "Approved",
    });
    if (edge) edges.push(edge);
  }
  for (const toServiceId of input.dependsOnServiceIds ?? []) {
    const { data: edge } = await dependencyEdgesDB.createCapabilityEdge({ seuId: input.seuId, fromDeliverableId: deliverable.id, toServiceId });
    if (edge) edges.push(edge);
  }

  return { deliverable, dependencyEdges: edges };
}

export type TransitionDeliverableResult =
  // Model A (Participant Integration Plan, Resolution 1/11): a governed
  // transition is no longer applied synchronously. Governance passes, a Work
  // Item is dispatched, and the Deliverable stays in its *current* state until
  // the Participant's result callback lands (completeWorkItem). The success of
  // this call means "dispatched and outstanding," not "transitioned."
  | { ok: true; dispatched: true; workItemId: string; participantId?: string; pendingTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "dependency_not_satisfied"; edges: DependencyEdgeRow[] }
  | { ok: false; reason: "quality_gate_blocked"; detail: string }
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition"; detail: string }
  // Empty-centre presence check (Participant Integration Plan, Resolution 4):
  // an approver cannot approve a Deliverable that has no attached reference —
  // emptiness cannot be certified.
  | { ok: false; reason: "empty_centre"; detail: string }
  | { ok: false; reason: "dispatch_deferred"; detail: string };

// Post-MVP Phase 3 (Ch.31/32/33): governance still gates first — dependency
// readiness, then Authority + Policy, unchanged from Phase 0. Once governance
// allows the transition, it no longer applies directly: the Execution Engine
// generates a Command, a Work Item is derived from it, and the Dispatch
// Engine must actually assign that Work Item to a Participant before the
// Deliverable's lifecycle_state changes. If nobody currently fulfils the
// Deliverable's producing Capability, the transition is deferred rather than
// silently applied — a real behavioural change from the direct-POST MVP.
//
// Post-MVP Phase 4 (Ch.23/Ch.26): the Quality Gate check sits between
// dependency readiness and Authority/Policy — a deliberately separate gate
// from the Dependency Engine (Ch.26 §3's own architectural position: Policies/
// Reviews/Evidence/Knowledge/Decisions/Obligations feed a Quality Gate, which
// is itself an input to Governance). Evaluating it here, after dependency
// readiness has already passed, is what makes an Obligation block
// independently of the dependency graph testable and true at the same time.
export async function transitionDeliverable(input: {
  deliverableId: string;
  targetState: string;
  // Phase 10 (badge model, design/mvp-build-plan/Phase 10 - User Management
  // and Dual Authority Design.md §9/§11): Deliverable is the first entity
  // type migrated off the legacy role check. actingBadgeGrantId/actorId are
  // the real check now — every action declares which one held badge it's
  // performed under, never inferred from everything the actor holds.
  // actorRole is kept only because transitionEngine.evaluate's input still
  // accepts it generically for entity types not yet migrated; it's ignored
  // for Deliverable now that its Authority Rules set required_badge_type.
  actorRole?: string;
  actingBadgeGrantId?: string;
  actorId?: string;
  requestedBy?: number | null;
}): Promise<TransitionDeliverableResult> {
  const { data: deliverable } = await deliverablesDB.findById(input.deliverableId);
  if (!deliverable) return { ok: false, reason: "not_found" };

  const readiness = await dependencyEngine.isDeliverableReady(deliverable.id);
  if (!readiness.ready) return { ok: false, reason: "dependency_not_satisfied", edges: readiness.edges };

  const fromState = deliverable.lifecycle_state;

  const qualityGateResult = await qualityGateEngine.evaluate({
    entityType: "Deliverable",
    entityId: deliverable.id,
    seuId: deliverable.seu_id,
    fromState,
    toState: input.targetState,
  });
  if (qualityGateResult.outcome === "Blocked") {
    // Ch.35 §11: a sustained pattern of blocking is Telemetry's concern, not
    // the transition attempt's own — checked here (not inside
    // qualityGateEngine itself) because raising an Obligation means calling
    // into routes/seu/core/, and the engine layer never calls back into core
    // (Build Plan §2.2's one-way "core orchestrates engine" split).
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

  let actingBadgeGrantId = input.actingBadgeGrantId ?? null;
  if (!actingBadgeGrantId && input.actorId) {
    actingBadgeGrantId = await resolveAutoActingBadge(input.actorId, deliverable);
  }

  const gate = await transitionEngine.evaluate({
    entityType: "Deliverable",
    fromState,
    toState: input.targetState,
    actorRole: input.actorRole ?? "general",
    actingBadge: actingBadgeGrantId && input.actorId ? { grantId: actingBadgeGrantId, actorId: input.actorId } : undefined,
    // packCode: always offered, not just for authoring Deliverables — safe,
    // since matchesPack only ever fires for a grant whose own scope_id is
    // literally this constant, which no non-SDK-authoring grant is (see
    // resolveAutoActingBadge above for the same reasoning).
    scopeContext: { seuId: deliverable.seu_id, capabilityId: deliverable.producing_capability_id, packCode: AUTHORING_SCOPE_PACK_CODE },
    context: { deliverable },
    // Deliverable's own transition_definitions rows never set
    // required_quality_gate_ids (Deliverable keeps using its existing
    // separate qualityGateEngine.evaluate call above), so this never
    // actually fires for Deliverable today — passed for correctness now
    // that the generic mechanism exists (SDK UI Layer Plan).
    entityId: deliverable.id,
    seuId: deliverable.seu_id,
  });
  if (!gate.allowed) {
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Deliverable ${fromState} -> ${input.targetState}` };
    if (gate.reason === "authority_denied") {
      const detail = gate.badgeDenialReason
        ? `acting badge check failed: ${gate.badgeDenialReason}`
        : `requires role ${gate.requiredRole}, actor has ${gate.actorRole}`;
      return { ok: false, reason: "authority_denied", detail };
    }
    if (gate.reason === "quality_gate_blocked") return { ok: false, reason: "quality_gate_blocked", detail: `Quality Gate "${gate.gateName}" blocked: ${gate.detail}` };
    return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
  }

  // Empty-centre presence check (Participant Integration Plan, Resolution 4):
  // approval certifies produced work, so an approval (In Progress -> Approved)
  // cannot even be dispatched unless a real reference was attached when the
  // Deliverable was produced (the Defined -> In Progress completion). This is a
  // small, separate gate — "you cannot approve nothing" — distinct from the
  // attestation it makes certifiable. It runs after every other governance
  // check so the existing quality-gate/authority reasons still win when both
  // apply.
  if (fromState === "In Progress" && input.targetState === "Approved") {
    const { data: existingRef } = await deliverableReferencesDB.findLatestWithReference(deliverable.id, "In Progress");
    if (!existingRef) {
      return { ok: false, reason: "empty_centre", detail: "cannot approve a Deliverable with no attached reference — nothing has been produced to approve" };
    }
  }

  const correlationId = eventBus.newCorrelationId();
  const execution = await executionEngine.execute({
    seuId: deliverable.seu_id,
    entityType: "Deliverable",
    entityId: deliverable.id,
    fromState,
    toState: input.targetState,
    producingCapabilityId: deliverable.producing_capability_id,
    requestedBy: input.requestedBy ?? null,
    actingBadgeGrantId,
    correlationId,
  });

  if (!execution.dispatched) {
    return {
      ok: false,
      reason: "dispatch_deferred",
      detail: "no Participant currently fulfils this Deliverable's producing Capability — assign one before this transition can be dispatched",
    };
  }

  // Dispatched and outstanding. The Deliverable's lifecycle_state is
  // deliberately NOT changed here — the DeliverableTransitioned event and the
  // state change are emitted by completeWorkItem when the Participant reports a
  // `done` result. This is the async control-flow inversion Model A requires:
  // core dispatches, then waits for the result-in callback to drive the
  // transition (Participant Integration Plan, Resolution 11).
  return {
    ok: true,
    dispatched: true,
    workItemId: execution.workItemId,
    participantId: execution.participantId,
    pendingTransition: { fromState, toState: input.targetState },
  };
}
