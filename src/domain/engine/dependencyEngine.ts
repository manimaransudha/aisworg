// Ch.9 minimal instance — Deliverable and Capability dependency-edge types only
// (Build Plan §1, §5 item 9). Generic over the edge, not over any specific
// Deliverable: decides whether an edge's target satisfies it, never how to
// make it satisfied — the same "decides whether, never how" discipline Ch.9
// itself calls out.
import { deliverablesDB } from "../../dblayer/deliverablesDB.js";
import { dependencyEdgesDB } from "../../dblayer/dependencyEdgesDB.js";
import { seuCapabilitiesDB } from "../../dblayer/seuCapabilitiesDB.js";
import { servicesDB } from "../../dblayer/servicesDB.js";
import { transitionDefinitionsDB } from "../../dblayer/transitionDefinitionsDB.js";
import type { DependencyEdgeRow, ReadinessState, TransitionEntityType } from "../../dblayer/seuTypes.js";

// Bug fix (found auditing Phase 5's Evidence-gated transition against a
// Deliverable dependency): the original check was exact-equality against
// required_state, so once an upstream Deliverable moved PAST the state a
// downstream edge required — not behind it — the edge flipped back to
// Pending permanently, with no way to re-satisfy short of moving the
// upstream Deliverable backward (which the engine also disallows). "Has
// reached or passed" is the correct semantics for a dependency, not "is
// currently exactly at." Determined generically, without hardcoding any
// Deliverable state name here: walk the real transition_definitions graph
// forward from required_state and check whether the target's current state
// is reachable — the same "no hardcoded state names, only declared data"
// discipline findPossibleNextStates already follows for the transition
// dropdown. A plain BFS, not a cache — the state graph is a handful of
// nodes, and nothing else in this codebase caches at MVP scale either.
async function isReachedOrPassed(entityType: TransitionEntityType, requiredState: string, currentState: string): Promise<boolean> {
  if (requiredState === currentState) return true;
  const visited = new Set<string>([requiredState]);
  let frontier = [requiredState];
  while (frontier.length > 0) {
    const results = await Promise.all(frontier.map((state) => transitionDefinitionsDB.findPossibleNextStates(entityType, state)));
    const nextStates = [...new Set(results.flatMap((r) => r.data ?? []))].filter((state) => !visited.has(state));
    if (nextStates.includes(currentState)) return true;
    for (const state of nextStates) visited.add(state);
    frontier = nextStates;
  }
  return false;
}

export const dependencyEngine = {
  async evaluateEdge(edge: DependencyEdgeRow): Promise<ReadinessState> {
    if (edge.dependency_type === "Deliverable") {
      if (!edge.to_deliverable_id) return "Unknown";
      const { data: target } = await deliverablesDB.findById(edge.to_deliverable_id);
      if (!target) return "Unknown";
      if (edge.required_state) {
        const satisfied = await isReachedOrPassed("Deliverable", edge.required_state, target.lifecycle_state);
        return satisfied ? "Satisfied" : "Pending";
      }
      // No specific required state declared: any movement past the default start state counts.
      return target.lifecycle_state !== "Defined" ? "Satisfied" : "Pending";
    }

    // Capability-type edge — satisfied once the SEU's requirement for the
    // Service's providing Capability is Fulfilled (Ch.9 §8: edges reference the
    // specific Service, not the bare Capability).
    if (!edge.to_service_id) return "Unknown";
    const { data: service } = await servicesDB.findById(edge.to_service_id);
    if (!service) return "Unknown";
    const { data: seuCapabilities } = await seuCapabilitiesDB.findBySeuId(edge.seu_id);
    const match = seuCapabilities?.find((c) => c.capability_id === service.providing_capability_id);
    if (!match) return "Unknown";
    return match.status === "Fulfilled" ? "Satisfied" : "Pending";
  },

  async refreshEdge(edge: DependencyEdgeRow): Promise<DependencyEdgeRow> {
    const readiness = await this.evaluateEdge(edge);
    if (readiness === edge.readiness_state) return edge;
    const { data } = await dependencyEdgesDB.updateReadiness(edge.id, readiness);
    return data ?? edge;
  },

  /** A Deliverable is ready to progress once every one of its outgoing edges resolves Satisfied. */
  async isDeliverableReady(deliverableId: string): Promise<{ ready: boolean; edges: DependencyEdgeRow[] }> {
    const { data: edges } = await dependencyEdgesDB.findByFromDeliverable(deliverableId);
    if (!edges || edges.length === 0) return { ready: true, edges: [] };
    const refreshed = await Promise.all(edges.map((edge) => this.refreshEdge(edge)));
    return { ready: refreshed.every((edge) => edge.readiness_state === "Satisfied"), edges: refreshed };
  },
};
