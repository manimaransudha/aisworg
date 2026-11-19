import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { participantsDB } from "../../../dblayer/participantsDB.js";
import { commandsDB } from "../../../dblayer/commandsDB.js";
import { workItemsDB } from "../../../dblayer/workItemsDB.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";
import { getSeuDetailView, type SeuDetailView } from "./seus.js";
import { completeWorkItem, type CompleteWorkItemResult, type WorkItemOutcome } from "./workItems.js";
import { createAttentionItem } from "./attentionItems.js";
import { assertCanonicalCategory } from "./ontology.js";
import type { AttentionItemRow, ParticipantMasterRow, ParticipantRow } from "../../../dblayer/seuTypes.js";

export type ParticipantScopedSeuView = Omit<SeuDetailView, "capabilities" | "participantTypes" | "requiredTechnologyPacks" | "requiredDomainPacks" | "evidenceSupersedeCandidates" | "qualityGates">;

export interface ParticipantHomeEngagement {
  participant: ParticipantRow;
  detail: ParticipantScopedSeuView;
}

export interface ParticipantHomeView {
  master: ParticipantMasterRow | null;
  engagements: ParticipantHomeEngagement[];
}

async function scopeToParticipant(detail: SeuDetailView, participantId: string, userId: string): Promise<ParticipantScopedSeuView> {
  const { data: commands } = await commandsDB.findBySeuId(detail.seu.id);
  const { data: workItems } = await workItemsDB.findByCommandIds((commands ?? []).map((c) => c.id));
  const myCommandIds = new Set((workItems ?? []).filter((w) => w.participant_id === participantId).map((w) => w.command_id));
  const myDeliverableIds = new Set(
    (commands ?? []).filter((c) => myCommandIds.has(c.id) && c.entity_type === "Deliverable").map((c) => c.entity_id)
  );

  const deliverables = detail.deliverables.filter((d) => myDeliverableIds.has(d.id));
  const commandsFiltered = detail.commands
    .filter((c) => myCommandIds.has(c.id))
    .map((c) => ({ ...c, workItems: c.workItems.filter((wi) => wi.participantId === participantId) }));
  const obligations = detail.obligations.filter((o) => myDeliverableIds.has(o.obligation.related_object_id));
  const evidence = detail.evidence.filter((e) =>
    e.relationships.some(
      (r) => (r.related_object_type === "Participant" && r.related_object_id === participantId) || (r.related_object_type === "Deliverable" && myDeliverableIds.has(r.related_object_id))
    )
  );
  const knowledgeItems = detail.knowledgeItems.filter((k) => myDeliverableIds.has(k.knowledgeItem.deliverable_id));
  const { badgeTypes: myBadges } = await badgeAuthorityEngine.getHeldBadges(String(userId));
  const decisions = detail.decisions.filter((d) => d.decision.authority_badge != null && myBadges.has(d.decision.authority_badge));
  const externalInteractions = detail.externalInteractions.filter((ei) => ei.interaction.deliverable_id != null && myDeliverableIds.has(ei.interaction.deliverable_id));
  const relevantObjectIds = new Set<string>([...myDeliverableIds, ...myCommandIds]);
  const events = detail.events.filter((ev) => relevantObjectIds.has(ev.originating_object_id));

  return {
    seu: detail.seu,
    objectiveStatement: detail.objectiveStatement,
    deliverables,
    commands: commandsFiltered,
    obligations,
    participants: detail.participants,
    evidence,
    knowledgeItems,
    decisions,
    externalInteractions,
    events,
    blockedTransition: detail.blockedTransition,
    dependencyGraph: detail.dependencyGraph,
    attentionItems: detail.attentionItems.filter((a) => a.attentionItem.related_object_id != null && relevantObjectIds.has(a.attentionItem.related_object_id)),
  };
}

export async function getParticipantHomeView(userId: string): Promise<ParticipantHomeView> {
  const { data: master } = await participantsMasterDB.findById(userId);
  if (!master) return { master: null, engagements: [] };

  const { data: engagementRows } = await participantsDB.findByParticipantMasterId(master.id);
  const engagements = await Promise.all(
    (engagementRows ?? []).map(async (participant): Promise<ParticipantHomeEngagement | null> => {
      const fullDetail = await getSeuDetailView(participant.seu_id);
      if (!fullDetail) return null;
      const detail = await scopeToParticipant(fullDetail, participant.id, userId);
      return { participant, detail };
    })
  );
  return { master, engagements: engagements.filter((e): e is ParticipantHomeEngagement => e != null) };
}

export type CompleteMyWorkItemResult = CompleteWorkItemResult | { ok: false; reason: "not_mine"; detail: string };

export async function completeMyWorkItem(input: { userId: string; workItemId: string; outcome: WorkItemOutcome; reference?: string | null }): Promise<CompleteMyWorkItemResult> {
  const { data: master } = await participantsMasterDB.findById(input.userId);
  if (!master) return { ok: false, reason: "not_mine", detail: "No Participant identity is registered for your account." };

  const { data: workItem } = await workItemsDB.findById(input.workItemId);
  if (!workItem) return { ok: false, reason: "not_found", detail: `Work Item not found: ${input.workItemId}` };
  if (!workItem.participant_id) return { ok: false, reason: "not_mine", detail: "This Work Item is not assigned to a Participant yet." };

  const { data: engagement } = await participantsDB.findById(workItem.participant_id);
  if (!engagement || engagement.participant_id !== master.id) {
    return { ok: false, reason: "not_mine", detail: "This Work Item is not assigned to you." };
  }

  return completeWorkItem({ workItemId: input.workItemId, outcome: input.outcome, reference: input.reference });
}

export type RaiseMyAttentionItemResult = { ok: true; attentionItem: AttentionItemRow } | { ok: false; reason: "not_mine"; detail: string };

// A Participant raises an Attention Item on a Deliverable assigned to them. A Participant cannot raise an Obligation.
export async function raiseMyAttentionItem(input: {
  userId: string;
  seuId: string;
  deliverableId: string;
  category: string;
  title: string;
  description?: string;
  priority?: string;
}): Promise<RaiseMyAttentionItemResult> {
  const { data: master } = await participantsMasterDB.findById(input.userId);
  if (!master) return { ok: false, reason: "not_mine", detail: "No participant information." };

  const { data: engagementRows } = await participantsDB.findByParticipantMasterId(master.id);
  const engagement = (engagementRows ?? []).find((p) => p.seu_id === input.seuId);
  if (!engagement) return { ok: false, reason: "not_mine", detail: "You are not a Participant on this SEU." };

  const { data: commands } = await commandsDB.findBySeuId(input.seuId);
  const { data: workItems } = await workItemsDB.findByCommandIds((commands ?? []).map((c) => c.id));
  const myCommandIds = new Set((workItems ?? []).filter((w) => w.participant_id === engagement.id).map((w) => w.command_id));
  const myDeliverableIds = new Set((commands ?? []).filter((c) => myCommandIds.has(c.id) && c.entity_type === "Deliverable").map((c) => c.entity_id));
  if (!myDeliverableIds.has(input.deliverableId)) {
    return { ok: false, reason: "not_mine", detail: "This Deliverable is not assigned to you." };
  }

  await assertCanonicalCategory("category:attention-item", input.category);
  if (input.priority) await assertCanonicalCategory("category:attention-priority", input.priority);

  const authorBadge = await badgeAuthorityEngine.resolveAuthorBadge(input.userId, "attentionitem_raise");

  const attentionItem = await createAttentionItem({
    seuId: input.seuId,
    category: input.category,
    priority: input.priority,
    title: input.title,
    description: input.description,
    relatedObjectType: "Deliverable",
    relatedObjectId: input.deliverableId,
    actorId: input.userId,
    authorBadge,
  });
  return { ok: true, attentionItem };
}
