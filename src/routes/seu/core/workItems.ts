import { workItemsDB } from "../../../dblayer/workItemsDB.js";
import { commandsDB } from "../../../dblayer/commandsDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { deliverableReferencesDB } from "../../../dblayer/deliverableReferencesDB.js";
import { attestationsDB } from "../../../dblayer/attestationsDB.js";
import { participantsDB } from "../../../dblayer/participantsDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { dependencyDefinitionEngine } from "../../../domain/engine/dependencyDefinitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import { raiseAttentionItem } from "./attentionItems.js";
import type { DeliverableRow, WorkItemRow } from "../../../dblayer/seuTypes.js";

export type WorkItemOutcome = "done" | "failed" | "blocked";

export const ACCEPTANCE_TRANSITIONS: ReadonlyArray<{ from: string; to: string }> = [
  { from: "In Progress", to: "Approved" },
  { from: "Approved", to: "Baselined" },
];

export function isAcceptanceTransition(fromState: string, toState: string): boolean {
  return ACCEPTANCE_TRANSITIONS.some((t) => t.from === fromState && t.to === toState);
}

export type CompleteWorkItemResult =
  | { ok: true; outcome: "done"; workItem: WorkItemRow; deliverable: DeliverableRow; appliedTransition: { fromState: string; toState: string } }
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
    if (workItem.participant_id) await participantsDB.updateStatus(workItem.participant_id, "Idle");

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
      description: `A Participant reported "${input.outcome}" for the ${command.from_state} -> ${command.to_state} transition. The transition was not applied.`,
      relatedObjectType: "Deliverable",
      relatedObjectId: command.entity_id,
      actorId: String(command.requested_by),
      authorBadge: command.acting_badge_type,
    });

    return { ok: true, outcome: input.outcome, workItem: currentWorkItem };
  }

  const { data: updated, error } = await deliverablesDB.updateLifecycleState(command.entity_id, command.to_state);
  if (error || !updated) throw error ?? new Error("failed to apply deliverable transition on work item completion");

  await dependencyDefinitionEngine.evaluateAndPublishFromTransition({
    seuId: command.seu_id,
    entityType: "Deliverable",
    name: updated.name,
    newState: command.to_state,
    correlationId,
  });

  if (command.requested_by == null) throw new Error(`Command ${command.id} has no requested_by — cannot author the deliverable_references row for its completion`);
  if (!command.acting_badge_type) throw new Error(`Command ${command.id} has no acting_badge_type — cannot author the deliverable_references row for its completion`);
  const { data: authorMaster } = await participantsMasterDB.findById(command.requested_by);
  if (!authorMaster) throw new Error(`No superuser provisioned.`);
  const { data: authorParticipant } = await participantsDB.findBySeuIdAndParticipantMasterId(command.seu_id, authorMaster.id);
  if (!authorParticipant) throw new Error(`No participants row for participant master ${authorMaster.id} in SEU ${command.seu_id} — cannot author the deliverable_references row for Command ${command.id}`);

  await deliverableReferencesDB.record({
    seuId: command.seu_id,
    deliverableId: command.entity_id,
    workItemId: workItem.id,
    participantId: workItem.participant_id,
    fromState: command.from_state,
    toState: command.to_state,
    reference: input.reference ?? null,
    authorId: authorParticipant.id,
    authorBadge: command.acting_badge_type,
  });

  if (isAcceptanceTransition(command.from_state, command.to_state)) {
    await attestationsDB.create({
      seuId: command.seu_id,
      deliverableId: command.entity_id,
      workItemId: workItem.id,
      participantId: workItem.participant_id,
      fromState: command.from_state,
      toState: command.to_state,
      reference: input.reference ?? null,
      actingBadgeType: command.acting_badge_type,
      requestedBy: command.requested_by,
    });
  }

  const { data: deliverableTd } = await transitionDefinitionsDB.find("Deliverable", command.from_state, command.to_state);
  const deliverableTransitionedEvent = await eventBus.publish({
    eventType: "DeliverableTransitioned",
    originatingObjectType: "Deliverable",
    originatingObjectId: command.entity_id,
    seuId: command.seu_id,
    correlationId,
    payload: { fromState: command.from_state, toState: command.to_state, commandId: command.id, workItemId: workItem.id, participantId: workItem.participant_id, reference: input.reference ?? null },
    actorId: String(command.requested_by),
    authorityBadge: command.acting_badge_type,
  });

  await workItemsDB.updateStatus(workItem.id, "Completed");
  await eventBus.publish({
    eventType: "WorkItemCompleted", originatingObjectType: "WorkItem", originatingObjectId: workItem.id, seuId: command.seu_id,
    correlationId, causationId: deliverableTransitionedEvent.id, actorId: String(command.requested_by), authorityBadge: command.acting_badge_type, payload: {},
  });
  await workItemsDB.updateStatus(workItem.id, "Disposed");
  await eventBus.publish({ eventType: "WorkItemDisposed", originatingObjectType: "WorkItem", originatingObjectId: workItem.id, seuId: command.seu_id, correlationId, actorId: String(command.requested_by), authorityBadge: command.acting_badge_type, payload: {} });
  await commandsDB.updateStatus(command.id, "Completed");

  if (workItem.participant_id) {
    await participantsDB.updateStatus(workItem.participant_id, "Idle");
    await eventBus.publish({
      eventType: "ParticipantIdle",
      originatingObjectType: "Participant",
      originatingObjectId: workItem.participant_id,
      seuId: command.seu_id,
      correlationId,
      actorId: String(command.requested_by),
      authorityBadge: command.acting_badge_type,
      payload: { workItemId: workItem.id },
    });
  }

  return { ok: true, outcome: "done", workItem: { ...currentWorkItem, status: "Disposed" }, deliverable: updated, appliedTransition: { fromState: command.from_state, toState: command.to_state } };
}
