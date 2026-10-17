import { attentionItemsDB } from "../../../dblayer/attentionItemsDB.js";
import { participantsDB } from "../../../dblayer/participantsDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { seusDB } from "../../../dblayer/seusDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEngine, gateRejection } from "../../../domain/engine/transitionEngine.js";
import { eventBus } from "../../../domain/engine/eventBus.js";
import type { AttentionItemRow } from "../../../dblayer/seuTypes.js";
import { getSystemActor } from "../../../dblayer/constants.js";

export async function resolveAuthor(seuId: string, actorId: string): Promise<{ authorId: string }> {
  const { data: master } = await participantsMasterDB.findById(actorId);
  if (!master) throw new Error(`No superuser provisioned.`);
  const { data: participant } = await participantsDB.findBySeuIdAndParticipantMasterId(seuId, master.id);
  if (!participant) throw new Error(`No participants row for participants_master ${master.id} in SEU ${seuId}.`);
  return { authorId: participant.id };
}

export async function createAttentionItem(input: {
  seuId: string;
  category: string;
  priority?: string;
  title: string;
  description?: string | null;
  relatedObjectType?: string | null;
  relatedObjectId?: string | null;
  triggeringEventId?: string | null;
  actorId: string;
  authorBadge: string;
}): Promise<AttentionItemRow> {
  const { authorId } = await resolveAuthor(input.seuId, input.actorId);
  const { data: attentionItem, error } = await attentionItemsDB.create({ ...input, authorId, authorBadge: input.authorBadge });
  if (error || !attentionItem) throw error ?? new Error("failed to create attention item");

  await eventBus.publish({
    eventType: "AttentionCreated",
    originatingObjectType: "AttentionItem",
    originatingObjectId: attentionItem.id,
    seuId: input.seuId,
    correlationId: eventBus.newCorrelationId(),
    actorId: input.actorId,
    authorityBadge: input.authorBadge,
    payload: { category: input.category, relatedObjectType: input.relatedObjectType, relatedObjectId: input.relatedObjectId },
  });

  return attentionItem;
}

export async function raiseAttentionItem(input: {
  seuId: string;
  category: string;
  priority?: string;
  title: string;
  description?: string | null;
  relatedObjectType: string;
  relatedObjectId: string;
  triggeringEventId?: string | null;
  actorId: string;
  authorBadge: string;
}): Promise<{ raised: boolean; attentionItem: AttentionItemRow }> {
  const { data: existing } = await attentionItemsDB.findOpenByRelatedObject(input.seuId, input.category, input.relatedObjectType, input.relatedObjectId);
  if (existing) return { raised: false, attentionItem: existing };

  const attentionItem = await createAttentionItem(input);
  return { raised: true, attentionItem };
}

export async function listAttentionItems(): Promise<AttentionItemRow[]> {
  const { data } = await attentionItemsDB.findAll();
  return data ?? [];
}

export async function listAttentionItemsBySeu(seuId: string): Promise<AttentionItemRow[]> {
  const { data } = await attentionItemsDB.findBySeuId(seuId);
  return data ?? [];
}

export interface AttentionItemWithNextStates {
  attentionItem: AttentionItemRow;
  possibleNextStates: string[];
}

export async function listAttentionItemsWithNextStates(items: AttentionItemRow[]): Promise<AttentionItemWithNextStates[]> {
  return Promise.all(
    items.map(async (attentionItem) => {
      const { data: possibleNextStates } = await transitionDefinitionsDB.findPossibleNextStates("AttentionItem", attentionItem.status);
      return { attentionItem, possibleNextStates: possibleNextStates ?? [] };
    })
  );
}

export type TransitionAttentionItemResult =
  | { ok: true; attentionItem: AttentionItemRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "quality_gate_blocked"; detail: string }
  | { ok: false; reason: "authority_denied" | "policy_blocked" | "no_transition_definition" | "not_submitted"; detail: string };

export async function transitionAttentionItem(input: { attentionItemId: string; targetState: string; actorId: string }): Promise<TransitionAttentionItemResult> {
  const { data: attentionItem } = await attentionItemsDB.findById(input.attentionItemId);
  if (!attentionItem) return { ok: false, reason: "not_found" };

  const fromState = attentionItem.status;

  const gate = await transitionEngine.evaluateGoverned({
    entityType: "AttentionItem",
    fromState,
    toState: input.targetState,
    actorId: input.actorId,
    context: { attentionItem },
    gateEntityId: attentionItem.id,
    gateSeuId: attentionItem.seu_id,
  });
  if (!gate.allowed) return gateRejection(gate, "AttentionItem", fromState, input.targetState);

  const { data: updated, error } = await attentionItemsDB.updateStatus(attentionItem.id, input.targetState);
  if (error || !updated) throw error ?? new Error("failed to update attention item status");

  await eventBus.publish({
    eventType: "AttentionItemTransitioned",
    originatingObjectType: "AttentionItem",
    originatingObjectId: attentionItem.id,
    seuId: attentionItem.seu_id,
    correlationId: eventBus.newCorrelationId(),
    payload: { fromState, toState: input.targetState },
    actorId: input.actorId,
    authorityBadge: gate.authorityBadge,
  });

  return { ok: true, attentionItem: updated, appliedTransition: { fromState, toState: input.targetState } };
}
