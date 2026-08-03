import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { dependencyEdgesDB } from "../../../dblayer/dependencyEdgesDB.js";
import { dependencyEngine } from "../../../domain/engine/dependencyEngine.js";
import { transitionEngine } from "../../../domain/engine/transitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import type { DeliverableRow, DependencyEdgeRow } from "../../../dblayer/seuTypes.js";

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
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition"; detail: string };

export async function transitionDeliverable(input: {
  deliverableId: string;
  targetState: string;
  actorRole: string;
}): Promise<TransitionDeliverableResult> {
  const { data: deliverable } = await deliverablesDB.findById(input.deliverableId);
  if (!deliverable) return { ok: false, reason: "not_found" };

  const readiness = await dependencyEngine.isDeliverableReady(deliverable.id);
  if (!readiness.ready) return { ok: false, reason: "dependency_not_satisfied", edges: readiness.edges };

  const fromState = deliverable.lifecycle_state;
  const gate = await transitionEngine.evaluate({
    entityType: "Deliverable",
    fromState,
    toState: input.targetState,
    actorRole: input.actorRole,
    context: { deliverable },
  });
  if (!gate.allowed) {
    if (gate.reason === "no_transition_definition") return { ok: false, reason: "no_transition_definition", detail: `no Transition Definition for Deliverable ${fromState} -> ${input.targetState}` };
    if (gate.reason === "authority_denied") return { ok: false, reason: "authority_denied", detail: `requires role ${gate.requiredRole}, actor has ${gate.actorRole}` };
    return { ok: false, reason: "policy_blocked", detail: `blocked by policy ${gate.policyCode}` };
  }

  const { data: updated, error } = await deliverablesDB.updateLifecycleState(deliverable.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update deliverable state");

  await eventBus.publish({
    eventType: "DeliverableTransitioned",
    originatingObjectType: "Deliverable",
    originatingObjectId: deliverable.id,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState },
  });

  return { ok: true, deliverable: updated, appliedTransition: { fromState, toState: input.targetState } };
}
