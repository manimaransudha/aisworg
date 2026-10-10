import { workItemsDB } from "../../../dblayer/workItemsDB.js";
import { commandsDB } from "../../../dblayer/commandsDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { attentionItemsDB } from "../../../dblayer/attentionItemsDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { raiseAttentionItem, resolveSystemActor } from "./attentionItems.js";

export interface StallSweepResult {
  scanned: number;
  escalated: number;
  escalatedWorkItemIds: string[];
}

export async function sweepStalledWorkItems(input?: { now?: Date; seuId?: string }): Promise<StallSweepResult> {
  const now = input?.now ?? new Date();
  const { data: overdue } = await workItemsDB.findOverdue(now, input?.seuId);

  let escalated = 0;
  const escalatedWorkItemIds: string[] = [];

  for (const workItem of overdue ?? []) {
    const { data: command } = await commandsDB.findById(workItem.command_id);
    if (!command || command.entity_type !== "Deliverable") continue;

    const { data: deliverable } = await deliverablesDB.findById(command.entity_id);

    const { data: existing } = await attentionItemsDB.findOpenByRelatedObject(command.seu_id, "Escalation", "Deliverable", command.entity_id);
    if (existing) continue;

    const overdueBy = Math.round((now.getTime() - new Date(workItem.target_completion_at!).getTime()) / 1000);
    const stallSystemActor = await resolveSystemActor(command.seu_id);
    await raiseAttentionItem({
      seuId: command.seu_id,
      category: "Escalation",
      priority: "High",
      title: `Work Item stalled on Deliverable "${deliverable?.name ?? command.entity_id}"`,
      description: `Outstanding ~${overdueBy}s past its committed target completion time with no result reported. The ${command.from_state} -> ${command.to_state} transition is waiting on a Participant.`,
      relatedObjectType: "Deliverable",
      relatedObjectId: command.entity_id,
      ...stallSystemActor,
    });
    await eventBus.publish({
      eventType: "WorkItemStalled",
      originatingObjectType: "WorkItem",
      originatingObjectId: workItem.id,
      seuId: command.seu_id,
      correlationId: command.correlation_id,
      actorId: stallSystemActor.actorId,
      authorityBadge: stallSystemActor.authorBadge,
      payload: { deliverableId: command.entity_id, targetCompletionAt: workItem.target_completion_at, overdueBySeconds: overdueBy },
    });

    escalated++;
    escalatedWorkItemIds.push(workItem.id);
  }

  return { scanned: (overdue ?? []).length, escalated, escalatedWorkItemIds };
}
