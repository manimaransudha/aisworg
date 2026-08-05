import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { dependencyEdgesDB } from "../../../dblayer/dependencyEdgesDB.js";
import { badgeGrantsDB } from "../../../dblayer/badgeGrantsDB.js";
import { dependencyEngine } from "../../../domain/engine/dependencyEngine.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { qualityGateEngine } from "../../../domain/engine/qualityGateEngine.js";
import { executionEngine } from "../../../domain/engine/executionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { checkSustainedQualityGateBlocking } from "./telemetry.js";
import { raiseAttentionItem } from "./attentionItems.js";
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
      g.scope_id === deliverable.seu_id
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
  | { ok: true; deliverable: DeliverableRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "dependency_not_satisfied"; edges: DependencyEdgeRow[] }
  | { ok: false; reason: "quality_gate_blocked"; detail: string }
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition"; detail: string }
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
    scopeContext: { seuId: deliverable.seu_id, capabilityId: deliverable.producing_capability_id },
    context: { deliverable },
  });
  if (!gate.allowed) {
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Deliverable ${fromState} -> ${input.targetState}` };
    if (gate.reason === "authority_denied") {
      const detail = gate.badgeDenialReason
        ? `acting badge check failed: ${gate.badgeDenialReason}`
        : `requires role ${gate.requiredRole}, actor has ${gate.actorRole}`;
      return { ok: false, reason: "authority_denied", detail };
    }
    return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
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
    correlationId,
  });

  if (!execution.dispatched) {
    return {
      ok: false,
      reason: "dispatch_deferred",
      detail: "no Participant currently fulfils this Deliverable's producing Capability — assign one before this transition can be dispatched",
    };
  }

  const { data: updated, error } = await deliverablesDB.updateLifecycleState(deliverable.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update deliverable state");

  await eventBus.publish({
    eventType: "DeliverableTransitioned",
    originatingObjectType: "Deliverable",
    originatingObjectId: deliverable.id,
    correlationId,
    causationId: execution.workItemId,
    payload: { fromState, toState: input.targetState, commandId: execution.command.id, workItemId: execution.workItemId, participantId: execution.participantId },
  });

  return { ok: true, deliverable: updated, appliedTransition: { fromState, toState: input.targetState } };
}
