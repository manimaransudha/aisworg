import { obligationsDB } from "../../../dblayer/obligationsDB.js";
import { attentionItemsDB } from "../../../dblayer/attentionItemsDB.js";
import { ATTENTION_ITEM_ENTITY_TYPE, ATTENTION_OBLIGATION_CATEGORY, ATTENTION_OBLIGATION_ORIGIN, OBLIGATION_RESOLUTION_PATH, RESOLVED_OBLIGATION_STATUSES, getSystemActor } from "../../../dblayer/constants.js";
import { createObligation, transitionObligation } from "./obligations.js";
import type { AttentionItemRow, ObligationRow } from "../../../dblayer/seuTypes.js";

// The open Obligations of a Deliverable that originate from an Attention Item. No waiver covers them: an Attention Item needs a person to fix it.
export async function listOpenAttentionObligations(deliverableId: string): Promise<ObligationRow[]> {
  const { data, error } = await obligationsDB.findByRelatedObject("Deliverable", deliverableId);
  if (error) throw error;
  return (data ?? []).filter((o) => o.originating_entity_type === ATTENTION_ITEM_ENTITY_TYPE && !RESOLVED_OBLIGATION_STATUSES.has(o.status));
}

// Holds the hop of a Deliverable for an Attention Item. The Obligation is raised by the SEU's system participant, names the Attention Item as its origin and
// carries the hop, because the Deliverable check holds a hop only for an Obligation that names both states. An Attention Item that already has an open Obligation gets no second one.
export async function holdDeliverableForAttentionItem(input: { attentionItem: AttentionItemRow; fromState: string; toState: string }): Promise<ObligationRow> {
  const { attentionItem } = input;
  if (attentionItem.related_object_type !== "Deliverable" || !attentionItem.related_object_id) throw new Error(`Attention Item ${attentionItem.id} names no Deliverable to hold`);
  const open = (await listOpenAttentionObligations(attentionItem.related_object_id)).find((o) => o.originating_entity_id === attentionItem.id);
  if (open) return open;
  const systemActor = await getSystemActor(attentionItem.seu_id);
  return createObligation({
    relatedObjectType: "Deliverable",
    relatedObjectId: attentionItem.related_object_id,
    category: ATTENTION_OBLIGATION_CATEGORY,
    title: `Attention Item: ${attentionItem.title}`,
    description: attentionItem.description,
    origin: ATTENTION_OBLIGATION_ORIGIN,
    priority: attentionItem.priority,
    completionCriteria: "The Attention Item is resolved.",
    blockedFromState: input.fromState,
    blockedToState: input.toState,
    originatingEntityType: ATTENTION_ITEM_ENTITY_TYPE,
    originatingEntityId: attentionItem.id,
    actorId: systemActor.actorId,
    authorBadge: systemActor.authorBadge,
  });
}

// Resolves the Obligations of an Attention Item that has been resolved. Each is walked to Verified by the SEU's system participant.
export async function resolveObligationsOfAttentionItem(attentionItemId: string): Promise<void> {
  const { data: attentionItem, error } = await attentionItemsDB.findById(attentionItemId);
  if (error) throw error;
  if (!attentionItem || attentionItem.related_object_type !== "Deliverable" || !attentionItem.related_object_id) return;
  const systemActor = await getSystemActor(attentionItem.seu_id);
  for (const obligation of (await listOpenAttentionObligations(attentionItem.related_object_id)).filter((o) => o.originating_entity_id === attentionItemId)) {
    const at = OBLIGATION_RESOLUTION_PATH.indexOf(obligation.status);
    // A Reopened Obligation goes on from In Progress, an Identified one from the start.
    const remaining = at >= 0 ? OBLIGATION_RESOLUTION_PATH.slice(at + 1) : obligation.status === "Reopened" ? OBLIGATION_RESOLUTION_PATH.slice(2) : OBLIGATION_RESOLUTION_PATH;
    for (const targetState of remaining) {
      const result = await transitionObligation({ obligationId: obligation.id, targetState, actorId: systemActor.actorId });
      if (!result.ok) throw new Error(`Obligation ${obligation.id} could not move to ${targetState}: ${result.reason}`);
    }
  }
}
