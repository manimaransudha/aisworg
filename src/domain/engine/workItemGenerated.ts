import { workItemsDB } from "../../dblayer/workItemsDB.js";
import { commandsDB } from "../../dblayer/commandsDB.js";
import { deliverablesDB } from "../../dblayer/deliverablesDB.js";
import { seusDB } from "../../dblayer/seusDB.js";
import { ebmsDB } from "../../dblayer/ebmsDB.js";
import { dispatchEngine } from "./dispatchEngine.js";
import { logger } from "../../utils/logger.js";
import type { EventHandler } from "./eventBus.js";
import type { EventRow } from "../../dblayer/seuTypes.js";

async function resolveDispatchStrategies(seuId: string): Promise<Array<{ strategy: string; order: number }>> {
  const { data: seu } = await seusDB.findById(seuId);
  if (!seu?.active_ebm_id) return [];
  const { data: ebm } = await ebmsDB.findById(seu.active_ebm_id);
  const pool = (ebm?.behaviors as { pool?: Array<{ propertyName: string; value: unknown }> } | null)?.pool ?? [];
  const value = pool.find((e) => e.propertyName === "dispatchStrategyPreference")?.value;
  return Array.isArray(value) ? (value as Array<{ strategy: string; order: number }>) : [];
}

export const workItemGeneratedHandler: EventHandler = async (event: EventRow) => {
  const { data: workItem } = await workItemsDB.findById(event.originating_object_id);
  if (!workItem) {
    logger.error(`[workItemGeneratedHandler] Work Item not found: ${event.originating_object_id}`);
    return;
  }

  const { data: command } = await commandsDB.findById(workItem.command_id);
  if (!command) {
    logger.error(`[workItemGeneratedHandler] Command not found for Work Item ${workItem.id}`);
    return;
  }

  let producingCapabilityId: string | null = null;
  if (command.entity_type === "Deliverable") {
    const { data: deliverable } = await deliverablesDB.findById(command.entity_id);
    producingCapabilityId = deliverable?.producing_capability_id ?? null;
  }

  const payload = event.payload as { targetCompletionAt?: string | null } | null;
  const strategies = await resolveDispatchStrategies(command.seu_id);

  await dispatchEngine.dispatch({
    workItem,
    seuId: command.seu_id,
    producingCapabilityId,
    eligibleParticipantPoolId: command.eligible_participant_pool_id,
    targetCompletionAt: payload?.targetCompletionAt ? new Date(payload.targetCompletionAt) : null,
    correlationId: event.correlation_id,
    strategies,
  });
};
