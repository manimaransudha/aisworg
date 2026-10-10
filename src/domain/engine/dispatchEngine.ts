import { capabilityFulfilmentPoolsDB } from "../../dblayer/capabilityFulfilmentPoolsDB.js";
import { workItemsDB } from "../../dblayer/workItemsDB.js";
import { participantsDB } from "../../dblayer/participantsDB.js";
import { commandsDB } from "../../dblayer/commandsDB.js";
import { servicesDB } from "../../dblayer/servicesDB.js";
import { eventBus } from "./eventBus.js";
import { createObligation } from "../../routes/seu/core/obligations.js";
import { raiseAttentionItem, resolveSystemActor } from "../../routes/seu/core/attentionItems.js";
import { loadAvailableCandidates, selectParticipant } from "./dispatchStrategies.js";
import type { CommandRow, ServiceRow, WorkItemRow } from "../../dblayer/seuTypes.js";

function resolveTurnaroundSeconds(services: ServiceRow[]): number | null {
  for (const service of services) {
    const item = (service.service_level ?? []).find((i) => /turnaround/i.test(i.label));
    if (!item) continue;
    const t = item.target;
    if (Number.isFinite(Number(t)) && Number(t) > 0) return Number(t);
  }
  return null;
}

async function rejectDispatch(input: { workItem: WorkItemRow; command: CommandRow | null; seuId: string; correlationId: string }, eventType: "DispatchRejected" | "ParticipantUnavailable", reason: string): Promise<void> {
  console.log(`[dispatchEngine] rejectDispatch seuId=${input.seuId} entityType=${input.command?.entity_type} entityId=${input.command?.entity_id} fromState=${input.command?.from_state} toState=${input.command?.to_state} reason=${reason} workItemId=${input.workItem.id}`);
  await workItemsDB.updateStatus(input.workItem.id, "Disposed");
  const systemActor = await resolveSystemActor(input.seuId);
  if (input.command) {
    await commandsDB.updateStatus(input.command.id, "Failed");
    await createObligation({
      relatedObjectType: input.command.entity_type,
      relatedObjectId: input.command.entity_id,
      category: "Operational",
      title: `Dispatch could not find a Participant for Work Item ${input.workItem.id} (${reason})`,
      description: `Command ${input.command.id} (${input.command.from_state} -> ${input.command.to_state}): ${reason}.`,
      actorId: systemActor.actorId,
      authorBadge: systemActor.authorBadge,
    });
    await raiseAttentionItem({
      seuId: input.seuId,
      category: "Action Required",
      priority: "High",
      title: `Work Item ${input.workItem.id} could not be dispatched (${reason})`,
      description: `Command ${input.command.id} (${input.command.from_state} -> ${input.command.to_state}) needs a Participant, and none is available (${reason}). Resolve the Obligation once addressed.`,
      relatedObjectType: input.command.entity_type,
      relatedObjectId: input.command.entity_id,
      ...systemActor,
    });
  }
  await eventBus.publish({
    eventType,
    originatingObjectType: "WorkItem",
    originatingObjectId: input.workItem.id,
    seuId: input.seuId,
    correlationId: input.correlationId,
    actorId: systemActor.actorId,
    authorityBadge: systemActor.authorBadge,
    payload: { reason },
  });
}

export const dispatchEngine = {
  async dispatch(input: {
    workItem: WorkItemRow;
    seuId: string;
    producingCapabilityId: string | null;
    eligibleParticipantPoolId: string | null;
    targetCompletionAt?: Date | null;
    correlationId: string;
    isRedispatch?: boolean;
    strategies?: Array<{ strategy: string; order: number }>;
  }): Promise<void> {
    const command = (await commandsDB.findById(input.workItem.command_id)).data ?? null;
    const systemActor = await resolveSystemActor(input.seuId);

    if (!input.producingCapabilityId) {
      await rejectDispatch({ ...input, command }, "DispatchRejected", "no_producing_capability_declared");
      return;
    }

    const pool = input.eligibleParticipantPoolId ? await capabilityFulfilmentPoolsDB.findById(input.eligibleParticipantPoolId) : { data: null };
    const candidateIds = pool.data?.participant_ids ?? [];

    if (candidateIds.length === 0) {
      await rejectDispatch({ ...input, command }, "DispatchRejected", "empty_eligible_pool");
      return;
    }

    const available = await loadAvailableCandidates(candidateIds);

    if (available.length === 0) {
      if (command) await commandsDB.updateStatus(command.id, "Deferred");
      await eventBus.publish({
        eventType: "DispatchDeferred",
        originatingObjectType: "WorkItem",
        originatingObjectId: input.workItem.id,
        seuId: input.seuId,
        correlationId: input.correlationId,
        actorId: systemActor.actorId,
      authorityBadge: systemActor.authorBadge,
        payload: { reason: "no_available_participant" },
      });
      return;
    }

    const selection = await selectParticipant(available, input.strategies ?? [], input.seuId);
    if (!selection) {
      await rejectDispatch({ ...input, command }, "ParticipantUnavailable", "no_candidate_matched_dispatch_strategy");
      return;
    }
    const { participantId, strategy } = selection;

    if (command) await commandsDB.updateStatus(command.id, "Dispatched");
    await workItemsDB.assign(input.workItem.id, participantId, strategy);

    if (input.targetCompletionAt) {
      await workItemsDB.setTargetCompletionAt(input.workItem.id, input.targetCompletionAt);
    } else {
      const { data: services } = await servicesDB.findByCapabilityId(input.producingCapabilityId);
      const slaSeconds = resolveTurnaroundSeconds(services ?? []);
      if (slaSeconds != null) {
        await workItemsDB.setTargetCompletion(input.workItem.id, slaSeconds);
      }
    }

    await participantsDB.updateStatus(participantId, "Assigned");
    await eventBus.publish({
      eventType: "ParticipantAssigned",
      originatingObjectType: "Participant",
      originatingObjectId: participantId,
      seuId: input.seuId,
      correlationId: input.correlationId,
      actorId: systemActor.actorId,
      authorityBadge: systemActor.authorBadge,
        payload: { workItemId: input.workItem.id },
    });

    await workItemsDB.updateStatus(input.workItem.id, "Dispatched");
    await eventBus.publish({
      eventType: "ParticipantSelected",
      originatingObjectType: "WorkItem",
      originatingObjectId: input.workItem.id,
      seuId: input.seuId,
      correlationId: input.correlationId,
      actorId: systemActor.actorId,
      authorityBadge: systemActor.authorBadge,
        payload: { participantId, strategy },
    });
    await eventBus.publish({
      eventType: "WorkItemDispatched",
      originatingObjectType: "WorkItem",
      originatingObjectId: input.workItem.id,
      seuId: input.seuId,
      correlationId: input.correlationId,
      actorId: systemActor.actorId,
      authorityBadge: systemActor.authorBadge,
        payload: { participantId },
    });
    if (input.isRedispatch) {
      await eventBus.publish({
        eventType: "RedispatchCompleted",
        originatingObjectType: "WorkItem",
        originatingObjectId: input.workItem.id,
        seuId: input.seuId,
        correlationId: input.correlationId,
        actorId: systemActor.actorId,
      authorityBadge: systemActor.authorBadge,
        payload: { participantId },
      });
    }
  },
};
