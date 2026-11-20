import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { participantsDB } from "../../../dblayer/participantsDB.js";
import { commandsDB } from "../../../dblayer/commandsDB.js";
import { workItemsDB } from "../../../dblayer/workItemsDB.js";
import { PARTICIPANT_TITLE_MAX_LENGTH } from "../../../dblayer/constants.js";
import { badgeAuthorityEngine } from "../../../domain/engine/badgeAuthorityEngine.js";
import { getSeuDetailView, type SeuDetailView } from "./seus.js";
import { completeWorkItem, type CompleteWorkItemResult, type WorkItemOutcome } from "./workItems.js";
import { attentionItemsDB } from "../../../dblayer/attentionItemsDB.js";
import { createAttentionItem } from "./attentionItems.js";
import { getSeuEventsByActor } from "./events.js";
import { holdDeliverableForAttentionItem, listOpenAttentionObligations } from "./attentionObligations.js";
import { assertCanonicalCategory, listConceptsForType } from "./ontology.js";
import type { AttentionItemRow, CommandRow, EventRow, ParticipantMasterRow, ParticipantRow, WorkItemRow } from "../../../dblayer/seuTypes.js";

export type ParticipantScopedSeuView = Omit<SeuDetailView, "capabilities" | "participantTypes" | "requiredTechnologyPacks" | "requiredDomainPacks" | "evidenceSupersedeCandidates" | "qualityGates"> & {
  // The events this Participant caused in the SEU. A Participant reached through an adapter has no screen to act on, so the page shows these as its work.
  actedEvents: EventRow[];
};

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
  const actedEvents = await getSeuEventsByActor(detail.seu.id, userId);

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
    actedEvents,
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
  blocksProgress?: boolean;
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

  if (input.title.length > PARTICIPANT_TITLE_MAX_LENGTH) return { ok: false, reason: "not_mine", detail: `The title is at most ${PARTICIPANT_TITLE_MAX_LENGTH} characters.` };
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
    blocksProgress: input.blocksProgress === true,
    actorId: input.userId,
    authorBadge,
  });
  // A blocking Attention Item holds the hop of the Work Item the Participant is working on through an Obligation.
  if (attentionItem.blocks_progress) {
    const outstanding = await findOutstandingWorkItem(input.seuId, engagement.id, input.deliverableId);
    if (!outstanding) return { ok: false, reason: "not_mine", detail: "The Attention Item was raised, but no outstanding Work Item of yours names the hop it holds." };
    await holdDeliverableForAttentionItem({ attentionItem, fromState: outstanding.command.from_state, toState: outstanding.command.to_state });
  }
  return { ok: true, attentionItem };
}

// The Dispatched Work Item of a Participant on a Deliverable, with its Command. The Command names the hop of the Deliverable the Work Item serves.
async function findOutstandingWorkItem(seuId: string, participantId: string, deliverableId: string): Promise<{ workItem: WorkItemRow; command: CommandRow } | null> {
  const { data: commands } = await commandsDB.findBySeuId(seuId);
  const forDeliverable = (commands ?? []).filter((c) => c.entity_type === "Deliverable" && c.entity_id === deliverableId);
  const { data: workItems } = await workItemsDB.findByCommandIds(forDeliverable.map((c) => c.id));
  const workItem = (workItems ?? []).find((w) => w.participant_id === participantId && w.status === "Dispatched");
  const command = workItem ? forDeliverable.find((c) => c.id === workItem.command_id) : undefined;
  return workItem && command ? { workItem, command } : null;
}

export type ReportedStatus = "completed" | "completed_pending_attention" | "blocked";

export type ReportMyStatusResult = { ok: true; status: ReportedStatus; message: string } | { ok: false; reason: "not_mine" | "rule"; detail: string };

// A Participant reports the status of their Work Item on a Deliverable. Completing needs Evidence and no open blocking Attention Item.
export async function reportMyStatus(input: { userId: string; seuId: string; deliverableId: string; status: ReportedStatus; evidenceIds: string[]; reference?: string | null }): Promise<ReportMyStatusResult> {
  const { data: master } = await participantsMasterDB.findById(input.userId);
  if (!master) return { ok: false, reason: "not_mine", detail: "No participant information." };
  const { data: engagementRows } = await participantsDB.findByParticipantMasterId(master.id);
  const engagement = (engagementRows ?? []).find((p) => p.seu_id === input.seuId);
  if (!engagement) return { ok: false, reason: "not_mine", detail: "You are not a Participant on this SEU." };
  const outstanding = await findOutstandingWorkItem(input.seuId, engagement.id, input.deliverableId);
  if (!outstanding) return { ok: false, reason: "not_mine", detail: "You have no outstanding Work Item on this Deliverable." };

  const { data: openItems } = await attentionItemsDB.findOpenByRelatedObjectAny("Deliverable", input.deliverableId);
  const open = openItems ?? [];
  const blocking = open.filter((a) => a.blocks_progress);

  if (input.status === "blocked") {
    if (blocking.length === 0) return { ok: false, reason: "rule", detail: "Blocked needs an open Attention Item that blocks the Deliverable. Raise one first." };
    return { ok: true, status: "blocked", message: `The Deliverable is blocked by ${blocking.length} Attention Item(s). The Work Item stays open.` };
  }

  // Completing needs Evidence the Participant can see for this SEU.
  const evidenceIds = [...new Set(input.evidenceIds)];
  if (evidenceIds.length === 0) return { ok: false, reason: "rule", detail: "Evidence is needed to claim completion. Pick at least one Evidence item." };
  const home = await getParticipantHomeView(input.userId);
  const visible = new Set(home.engagements.find((e) => e.participant.id === engagement.id)?.detail.evidence.map((e) => e.evidence.id) ?? []);
  if (evidenceIds.some((id) => !visible.has(id))) return { ok: false, reason: "rule", detail: "An Evidence item picked is not one of yours on this SEU." };

  if (input.status === "completed") {
    if (open.length > 0) return { ok: false, reason: "rule", detail: `Completed needs no open Attention Item. ${open.length} are open. Resolve them, or use Completed Pending Attention.` };
  } else {
    if (blocking.length > 0) return { ok: false, reason: "rule", detail: `Completed Pending Attention needs no open Attention Item that blocks the Deliverable. ${blocking.length} do.` };
    if (open.length === 0) return { ok: false, reason: "rule", detail: "No Attention Item is open. Use Completed." };
    // Each open Attention Item holds the hop through its own Obligation. The Obligations exist before the Work Item completes.
    for (const attentionItem of open) {
      await holdDeliverableForAttentionItem({ attentionItem, fromState: outstanding.command.from_state, toState: outstanding.command.to_state });
    }
  }

  const completed = await completeWorkItem({ workItemId: outstanding.workItem.id, outcome: "done", reference: input.reference ?? null });
  if (!completed.ok) return { ok: false, reason: "rule", detail: completed.detail };
  const held = (await listOpenAttentionObligations(input.deliverableId)).length;
  return {
    ok: true,
    status: input.status,
    message: input.status === "completed" ? "Completion recorded." : `Completion recorded. The Deliverable is held by ${held} Obligation(s) until its Attention Items are resolved.`,
  };
}

export interface ParticipantActionOptions {
  categories: string[];
  priorities: string[];
  decisionCategories: string[];
  alternativeStatuses: string[];
}

const codesOf = (concepts: Array<{ code: string }>): string[] => [...new Set(concepts.map((c) => c.code))].sort();

// The Ontology choices of the "My Work" action forms: the Attention Item category and priority, the Decision type and the status of a Decision alternative.
export async function getParticipantActionOptions(viewer: { isRoot: boolean; tenantId: string | null }): Promise<ParticipantActionOptions> {
  const [categories, priorities, decisionCategories, alternativeStatuses] = await Promise.all([
    listConceptsForType("category:attention-item", viewer, false),
    listConceptsForType("category:attention-priority", viewer, false),
    listConceptsForType("category:decision", viewer, false),
    listConceptsForType("decision-alternative-status", viewer, false),
  ]);
  return { categories: codesOf(categories), priorities: codesOf(priorities), decisionCategories: codesOf(decisionCategories), alternativeStatuses: codesOf(alternativeStatuses) };
}
