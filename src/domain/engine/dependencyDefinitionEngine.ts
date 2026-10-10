import { dependencyDefinitionsDB, type DependencyOwningScope } from "../../dblayer/dependencyDefinitionsDB.js";
import { deliverablesDB } from "../../dblayer/deliverablesDB.js";
import { servicesDB } from "../../dblayer/servicesDB.js";
import { seuCapabilitiesDB } from "../../dblayer/seuCapabilitiesDB.js";
import { seusDB } from "../../dblayer/seusDB.js";
import { obligationsDB } from "../../dblayer/obligationsDB.js";
import { evidenceDB } from "../../dblayer/evidenceDB.js";
import { decisionsDB } from "../../dblayer/decisionsDB.js";
import { knowledgeItemsDB } from "../../dblayer/knowledgeItemsDB.js";
import { transitionDefinitionsDB } from "../../dblayer/transitionDefinitionsDB.js";
import { eventBus } from "./eventBus.js";
import { resolveOwningScope as resolveOwningScopeByEbm } from "./seuCompositionScope.js";
import { resolveSystemActor } from "../../routes/seu/core/attentionItems.js";
import type { DependencyDefinitionEntityType, DependencyDefinitionRow, TransitionEntityType } from "../../dblayer/seuTypes.js";

async function resolveOwningScope(seuId: string): Promise<DependencyOwningScope | null> {
  const { data: seu } = await seusDB.findById(seuId);
  if (!seu) return null;
  if (!seu.active_ebm_id) return { templateId: seu.template_id, profileId: seu.profile_id, packIds: [] };
  return resolveOwningScopeByEbm(seu.active_ebm_id);
}

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

async function resolveNamedNode(seuId: string, entityType: DependencyDefinitionEntityType, name: string): Promise<{ instanceId: string; currentState: string } | null> {
  if (entityType === "Deliverable") {
    const { data: deliverables } = await deliverablesDB.findBySeuId(seuId);
    const match = deliverables?.find((d) => d.name === name);
    return match ? { instanceId: match.id, currentState: match.lifecycle_state } : null;
  }
  if (entityType === "Capability") {
    const { data: services } = await servicesDB.findAll();
    const service = services?.find((s) => s.code === name);
    if (!service) return null;
    const { data: seuCapabilities } = await seuCapabilitiesDB.findBySeuId(seuId);
    const match = seuCapabilities?.find((c) => c.capability_id === service.providing_capability_id);
    if (!match) return null;
    return { instanceId: match.id, currentState: match.status };
  }
  return null;
}

async function isUnnamedNodeSatisfied(fromEntityType: DependencyDefinitionEntityType, fromState: string, gatedEntityType: TransitionEntityType, gatedInstanceId: string): Promise<boolean> {
  if (fromEntityType === "Obligation") {
    const { data: obligations } = await obligationsDB.findByRelatedObject(gatedEntityType, gatedInstanceId);
    if (!obligations || obligations.length === 0) return true;
    const results = await Promise.all(obligations.map((o) => isReachedOrPassed("Obligation", fromState, o.status)));
    return results.every(Boolean);
  }
  if (fromEntityType === "Decision") {
    const { data: decisions } = await decisionsDB.findByRelatedObject(gatedEntityType, gatedInstanceId);
    if (!decisions || decisions.length === 0) return false;
    const results = await Promise.all(decisions.map((d) => isReachedOrPassed("Decision", fromState, d.status)));
    return results.some(Boolean);
  }
  if (fromEntityType === "Evidence") {
    const { data: evidence } = await evidenceDB.findByRelatedObject(gatedEntityType, gatedInstanceId);
    if (!evidence || evidence.length === 0) return false;
    const results = await Promise.all(evidence.map((e) => isReachedOrPassed("Evidence", fromState, e.status)));
    return results.some(Boolean);
  }
  if (fromEntityType === "Knowledge") {
    if (gatedEntityType !== "Deliverable") return false;
    const { data: items } = await knowledgeItemsDB.findByDeliverableId(gatedInstanceId);
    if (!items || items.length === 0) return false;
    const results = await Promise.all(items.map((k) => isReachedOrPassed("Knowledge", fromState, k.status)));
    return results.some(Boolean);
  }
  return false;
}

async function isRowSatisfied(seuId: string, row: DependencyDefinitionRow): Promise<boolean> {
  if (row.from_name) {
    const from = await resolveNamedNode(seuId, row.from_entity_type, row.from_name);
    if (!from) return false;
    if (row.from_entity_type === "Capability") return from.currentState === row.from_state;
    return isReachedOrPassed(row.from_entity_type as TransitionEntityType, row.from_state, from.currentState);
  }
  const to = await resolveNamedNode(seuId, row.to_entity_type, row.to_name);
  if (!to) return false;
  return isUnnamedNodeSatisfied(row.from_entity_type, row.from_state, row.to_entity_type as TransitionEntityType, to.instanceId);
}

export const dependencyDefinitionEngine = {
  isReachedOrPassed,

  async isTargetReady(
    seuId: string,
    toEntityType: DependencyDefinitionEntityType,
    toName: string,
    toState: string
  ): Promise<{ ready: boolean; rows: DependencyDefinitionRow[] }> {
    const scope = await resolveOwningScope(seuId);
    if (!scope) return { ready: true, rows: [] };
    const { data: rows } = await dependencyDefinitionsDB.findByTarget(scope, toEntityType, toName, toState);
    if (!rows || rows.length === 0) return { ready: true, rows: [] };
    const results = await Promise.all(rows.map((row) => this.isRowSatisfied(seuId, row)));
    return { ready: results.every(Boolean), rows };
  },

  isRowSatisfied,

  async evaluateAndPublishFromTransition(input: {
    seuId: string;
    entityType: DependencyDefinitionEntityType;
    name: string | null;
    newState: string;
    correlationId?: string;
  }): Promise<void> {
    const scope = await resolveOwningScope(input.seuId);
    if (!scope) return;
    const { data: sourceRows } = await dependencyDefinitionsDB.findBySource(scope, input.entityType, input.name, input.newState);
    const targets = new Map<string, { toEntityType: DependencyDefinitionEntityType; toName: string; toState: string }>();
    for (const row of sourceRows ?? []) {
      targets.set(`${row.to_entity_type} ${row.to_name} ${row.to_state}`, { toEntityType: row.to_entity_type, toName: row.to_name, toState: row.to_state });
    }

    const systemActor = await resolveSystemActor(input.seuId);
    for (const target of targets.values()) {
      const { ready } = await this.isTargetReady(input.seuId, target.toEntityType, target.toName, target.toState);
      if (!ready) continue;
      const to = await resolveNamedNode(input.seuId, target.toEntityType, target.toName);
      if (!to) continue;
      await eventBus.publish({
        eventType: "DeliverableReady",
        originatingObjectType: target.toEntityType as TransitionEntityType,
        originatingObjectId: to.instanceId,
        seuId: input.seuId,
        actorId: systemActor.actorId,
        authorityBadge: systemActor.authorBadge,
        correlationId: input.correlationId ?? eventBus.newCorrelationId(),
        causationId: input.correlationId ?? null,
        payload: { toEntityType: target.toEntityType, toName: target.toName, toState: target.toState },
      });
    }
  },
};
