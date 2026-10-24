import { workItemsDB } from "../../../dblayer/workItemsDB.js";
import { commandsDB } from "../../../dblayer/commandsDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { deliverableReferencesDB } from "../../../dblayer/deliverableReferencesDB.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { raiseAttentionItem } from "./attentionItems.js";
import { applyParticipantHop } from "./participants.js";
import { getSystemActor } from "../../../dblayer/constants.js";
import type { DeliverableRow, WorkItemRow } from "../../../dblayer/seuTypes.js";

export type WorkItemOutcome = "done" | "failed" | "blocked";

export type CompleteWorkItemResult =
  | { ok: true; outcome: "done"; workItem: WorkItemRow; deliverable: DeliverableRow }
  | { ok: true; outcome: "failed" | "blocked"; workItem: WorkItemRow }
  | { ok: false; reason: "not_found" | "not_outstanding" | "unsupported_entity_type"; detail: string };

export async function completeWorkItem(input: {
  workItemId: string;
  outcome: WorkItemOutcome;
  reference?: string | null;
}): Promise<CompleteWorkItemResult> {
  const { data: workItem } = await workItemsDB.findById(input.workItemId);
  if (!workItem) return { ok: false, reason: "not_found", detail: `Work Item not found: ${input.workItemId}` };
  if (workItem.status !== "Dispatched") {
    return { ok: false, reason: "not_outstanding", detail: `Work Item ${workItem.id} is not outstanding (status: ${workItem.status})` };
  }

  const { data: command } = await commandsDB.findById(workItem.command_id);
  if (!command) return { ok: false, reason: "not_found", detail: `Command not found for Work Item ${workItem.id}` };
  if (command.entity_type !== "Deliverable") {
    return { ok: false, reason: "unsupported_entity_type", detail: `Work Item completion only drives Deliverable transitions today, not ${command.entity_type}` };
  }

  const correlationId = command.correlation_id;

  const { data: withRef } = await workItemsDB.setOutputReference(workItem.id, input.reference ?? null);
  const currentWorkItem = withRef ?? workItem;

  if (input.outcome !== "done") {
    await workItemsDB.updateStatus(workItem.id, "Failed");
    await commandsDB.updateStatus(command.id, "Failed");
    if (workItem.participant_id) {
      const idled = await applyParticipantHop({
        participantId: workItem.participant_id,
        targetState: "Idle",
        actorId: (await getSystemActor(command.seu_id)).actorId,
        payload: { workItemId: workItem.id },
        correlationId,
      });
      if (!idled.ok) throw new Error(`Participant ${workItem.participant_id} could not be set Idle: ${idled.detail}`);
    }

    const { data: deliverable } = await deliverablesDB.findById(command.entity_id);
    if (command.requested_by == null) throw new Error(`Command ${command.id} has no requested_by — cannot author the Attention Item raised off its failure`);
    if (!command.acting_badge_type) throw new Error(`Command ${command.id} has no acting_badge_type — cannot author the Attention Item raised off its failure`);
    await eventBus.publish({
      eventType: "WorkItemFailed",
      originatingObjectType: "WorkItem",
      originatingObjectId: workItem.id,
      seuId: command.seu_id,
      correlationId,
      actorId: String(command.requested_by),
      authorityBadge: command.acting_badge_type,
      payload: { outcome: input.outcome, deliverableId: command.entity_id },
    });
    await raiseAttentionItem({
      seuId: command.seu_id,
      category: "Exception",
      priority: "High",
      title: `Work Item ${input.outcome} on Deliverable "${deliverable?.name ?? command.entity_id}"`,
      description: `A Participant reported "${input.outcome}" for the ${command.from_state} -> ${command.to_state} transition. The work was not completed.`,
      relatedObjectType: "Deliverable",
      relatedObjectId: command.entity_id,
      actorId: String(command.requested_by),
      authorBadge: command.acting_badge_type,
    });

    return { ok: true, outcome: input.outcome, workItem: currentWorkItem };
  }

  if (!workItem.participant_id) throw new Error(`Work Item ${workItem.id} has no assigned Participant — cannot author the deliverable_references row for its completion`);
  const { data: deliverable } = await deliverablesDB.findById(command.entity_id);
  if (!deliverable) return { ok: false, reason: "not_found", detail: `Deliverable not found for Work Item ${workItem.id}` };

  await deliverableReferencesDB.record({
    seuId: command.seu_id,
    deliverableId: command.entity_id,
    commandId: command.id,
    participantId: workItem.participant_id,
    fromState: command.from_state,
    toState: command.to_state,
    reference: input.reference ?? null,
    authorId: workItem.participant_id,
    authorBadge: command.acting_badge_type,
  });

  await workItemsDB.updateStatus(workItem.id, "Completed");
  await eventBus.publish({
    eventType: "WorkItemCompleted", originatingObjectType: "WorkItem", originatingObjectId: workItem.id, seuId: command.seu_id,
    correlationId, actorId: String(command.requested_by), authorityBadge: command.acting_badge_type, payload: {},
  });
  await workItemsDB.updateStatus(workItem.id, "Disposed");
  await eventBus.publish({ eventType: "WorkItemDisposed", originatingObjectType: "WorkItem", originatingObjectId: workItem.id, seuId: command.seu_id, correlationId, actorId: String(command.requested_by), authorityBadge: command.acting_badge_type, payload: {} });
  await commandsDB.updateStatus(command.id, "Completed");

  if (workItem.participant_id) {
    const idled = await applyParticipantHop({
      participantId: workItem.participant_id,
      targetState: "Idle",
      actorId: (await getSystemActor(command.seu_id)).actorId,
      payload: { workItemId: workItem.id },
      correlationId,
    });
    if (!idled.ok) throw new Error(`Participant ${workItem.participant_id} could not be set Idle: ${idled.detail}`);
  }

  return { ok: true, outcome: "done", workItem: { ...currentWorkItem, status: "Disposed" }, deliverable };
}
