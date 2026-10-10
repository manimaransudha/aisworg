import { workItemsDB } from "../../dblayer/workItemsDB.js";
import { commandsDB } from "../../dblayer/commandsDB.js";
import { deliverablesDB } from "../../dblayer/deliverablesDB.js";
import { seusDB } from "../../dblayer/seusDB.js";
import { ebmsDB } from "../../dblayer/ebmsDB.js";
import { dispatchEngine } from "./dispatchEngine.js";
import { createObligation } from "../../routes/seu/core/obligations.js";
import { raiseAttentionItem, resolveSystemActor } from "../../routes/seu/core/attentionItems.js";
import { eventBus } from "./eventBus.js";
import { logger } from "../../utils/logger.js";
import type { EventHandler } from "./eventBus.js";
import type { EventRow } from "../../dblayer/seuTypes.js";

async function resolveEbmPool(seuId: string): Promise<Array<{ propertyName: string; value: unknown }>> {
  const { data: seu } = await seusDB.findById(seuId);
  if (!seu?.active_ebm_id) return [];
  const { data: ebm } = await ebmsDB.findById(seu.active_ebm_id);
  return (ebm?.behaviors as { pool?: Array<{ propertyName: string; value: unknown }> } | null)?.pool ?? [];
}

async function resolveRedispatchThresholds(seuId: string): Promise<{ maxAttempts: number | null; attentionThreshold: number | null }> {
  const pool = await resolveEbmPool(seuId);
  const maxAttempts = pool.find((e) => e.propertyName === "redispatchMaxAttempts")?.value;
  const attentionThreshold = pool.find((e) => e.propertyName === "redispatchAttentionThreshold")?.value;
  return {
    maxAttempts: typeof maxAttempts === "number" ? maxAttempts : null,
    attentionThreshold: typeof attentionThreshold === "number" ? attentionThreshold : null,
  };
}

async function resolveDispatchStrategies(seuId: string): Promise<Array<{ strategy: string; order: number }>> {
  const pool = await resolveEbmPool(seuId);
  const value = pool.find((e) => e.propertyName === "dispatchStrategyPreference")?.value;
  return Array.isArray(value) ? (value as Array<{ strategy: string; order: number }>) : [];
}

export const redispatchHandler: EventHandler = async (event: EventRow) => {
  const { data: workItem } = await workItemsDB.findById(event.originating_object_id);
  if (!workItem) {
    logger.error(`[redispatchHandler] Work Item not found: ${event.originating_object_id}`);
    return;
  }
  const { data: command } = await commandsDB.findById(workItem.command_id);
  if (!command) {
    logger.error(`[redispatchHandler] Command not found for Work Item ${workItem.id}`);
    return;
  }

  const { data: updated } = await workItemsDB.incrementDispatchAttempts(workItem.id);
  const attempts = updated?.dispatch_attempts ?? workItem.dispatch_attempts + 1;
  const { maxAttempts, attentionThreshold } = await resolveRedispatchThresholds(command.seu_id);

  if (maxAttempts != null && attempts >= maxAttempts) {
    await workItemsDB.updateStatus(workItem.id, "Disposed");
    await commandsDB.updateStatus(command.id, "Failed");
    const systemActor = await resolveSystemActor(command.seu_id);
    await createObligation({
      relatedObjectType: command.entity_type,
      relatedObjectId: command.entity_id,
      category: "Operational",
      title: `Dispatch gave up on Work Item ${workItem.id} after ${attempts} attempts`,
      description: `Command ${command.id} (${command.from_state} -> ${command.to_state}): no Participant became Available after ${attempts} redispatch attempts (limit ${maxAttempts}).`,
      actorId: systemActor.actorId,
      authorBadge: systemActor.authorBadge,
    });
    await raiseAttentionItem({
      seuId: command.seu_id,
      category: "Action Required",
      priority: "High",
      title: `Work Item ${workItem.id} could not be dispatched after ${attempts} attempts`,
      description: `Command ${command.id} (${command.from_state} -> ${command.to_state}) needs a Participant. Redispatch stopped at the configured limit (${maxAttempts}). Resolve the Obligation once addressed.`,
      relatedObjectType: command.entity_type,
      relatedObjectId: command.entity_id,
      ...systemActor,
    });
    await eventBus.publish({
      eventType: "DispatchRejected",
      originatingObjectType: "WorkItem",
      originatingObjectId: workItem.id,
      seuId: command.seu_id,
      correlationId: event.correlation_id,
      actorId: systemActor.actorId,
      authorityBadge: systemActor.authorBadge,
      payload: { reason: "redispatch_exhausted", attempts },
    });
    return;
  }

  if (attentionThreshold != null && attempts === attentionThreshold) {
    await raiseAttentionItem({
      seuId: command.seu_id,
      category: "Escalation",
      priority: "Medium",
      title: `Work Item ${workItem.id} still not dispatched after ${attempts} attempts`,
      description: `Command ${command.id} (${command.from_state} -> ${command.to_state}) is still waiting for an available Participant. Redispatch continues (limit ${maxAttempts ?? "none configured"}).`,
      relatedObjectType: command.entity_type,
      relatedObjectId: command.entity_id,
      ...(await resolveSystemActor(command.seu_id)),
    });
  }

  let producingCapabilityId: string | null = null;
  if (command.entity_type === "Deliverable") {
    const { data: deliverable } = await deliverablesDB.findById(command.entity_id);
    producingCapabilityId = deliverable?.producing_capability_id ?? null;
  }
  const strategies = await resolveDispatchStrategies(command.seu_id);

  await dispatchEngine.dispatch({
    workItem,
    seuId: command.seu_id,
    producingCapabilityId,
    eligibleParticipantPoolId: command.eligible_participant_pool_id,
    targetCompletionAt: null,
    correlationId: event.correlation_id,
    isRedispatch: true,
    strategies,
  });
};
