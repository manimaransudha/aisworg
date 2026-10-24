import { attentionItemsDB } from "../../../dblayer/attentionItemsDB.js";
import { participantsDB } from "../../../dblayer/participantsDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { seusDB } from "../../../dblayer/seusDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { transitionEntity, publishTransition } from "../../../domain/engine/entityTransition.js";
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
  // The state and the event come from the birth row. The author badge stays as the caller gave it.
  const { data: birth, error: birthError } = await transitionDefinitionsDB.findBirth("AttentionItem");
  if (birthError) throw birthError;
  if (!birth) throw new Error("no birth Transition Definition for AttentionItem");
  if (!birth.event_type) throw new Error("the AttentionItem birth Transition Definition names no event");

  const { data: attentionItem, error } = await attentionItemsDB.create({ ...input, status: birth.to_state, authorId, authorBadge: input.authorBadge });
  if (error || !attentionItem) throw error ?? new Error("failed to create attention item");

  await eventBus.publish({
    eventType: birth.event_type,
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

export type TransitionAttentionItemResult =
  | { ok: true; attentionItem: AttentionItemRow; appliedTransition: { fromState: string; toState: string } }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "quality_gate_blocked"; detail: string }
  | { ok: false; reason: "policy_blocked" | "no_transition_definition" | "not_submitted"; detail: string };

export async function transitionAttentionItem(input: { attentionItemId: string; targetState: string; actorId: string }): Promise<TransitionAttentionItemResult> {
  const result = await transitionEntity({ entityType: "AttentionItem", entityId: input.attentionItemId, targetState: input.targetState, actorId: input.actorId });
  if (!result.ok) return result;

  const published = await publishTransition(result);
  await eventBus.publish({
    eventType: "AttentionItemTransitioned",
    originatingObjectType: "AttentionItem",
    originatingObjectId: input.attentionItemId,
    seuId: result.event.seuId,
    correlationId: published.correlation_id,
    payload: result.event.payload,
    actorId: input.actorId,
    authorityBadge: result.event.authorityBadge,
  });

  return { ok: true, attentionItem: result.row as AttentionItemRow, appliedTransition: result.appliedTransition };
}
