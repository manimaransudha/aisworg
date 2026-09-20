// CR-103 — Participant home page. A `general`-role user's own landing view:
// their participants_master identity plus every SEU they're a per-SEU
// Participant engagement on, scoped down to items that originate from or are
// assigned to that engagement (never the full SEU detail — no Capability
// Fulfilment, no other Participants' own work).
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { participantsDB } from "../../../dblayer/participantsDB.js";
import { commandsDB } from "../../../dblayer/commandsDB.js";
import { workItemsDB } from "../../../dblayer/workItemsDB.js";
import { badgeGrantsDB } from "../../../dblayer/badgeGrantsDB.js";
import { getSeuDetailView, type SeuDetailView } from "./seus.js";
import { completeWorkItem, type CompleteWorkItemResult, type WorkItemOutcome } from "./workItems.js";
import type { ParticipantMasterRow, ParticipantRow } from "../../../dblayer/seuTypes.js";

export type ParticipantScopedSeuView = Omit<SeuDetailView, "capabilities" | "participantTypes" | "requiredTechnologyPacks" | "requiredDomainPacks" | "evidenceSupersedeCandidates">;

export interface ParticipantHomeEngagement {
  participant: ParticipantRow;
  detail: ParticipantScopedSeuView;
}

export interface ParticipantHomeView {
  master: ParticipantMasterRow | null;
  engagements: ParticipantHomeEngagement[];
}

// Everything on the SEU detail view that isn't scoped to a specific
// Deliverable already carries its own real link back to this Participant's
// engagement id (evidence provenance, Work Item assignment); reduce those to
// one Deliverable-id set plus one originating-participant check, both keyed
// off the SAME `participants.id` this engagement row's own `id` is (not
// participants_master.id — Evidence/Work Item participant references all
// point at the per-SEU engagement, per migration 195's own comment).
async function scopeToParticipant(detail: SeuDetailView, participantId: string, userId: number): Promise<ParticipantScopedSeuView> {
  const { data: commands } = await commandsDB.findBySeuId(detail.seu.id);
  const { data: workItems } = await workItemsDB.findByCommandIds((commands ?? []).map((c) => c.id));
  const myCommandIds = new Set((workItems ?? []).filter((w) => w.participant_id === participantId).map((w) => w.command_id));
  const myDeliverableIds = new Set(
    (commands ?? []).filter((c) => myCommandIds.has(c.id) && c.entity_type === "Deliverable").map((c) => c.entity_id)
  );

  const deliverables = detail.deliverables.filter((d) => myDeliverableIds.has(d.id));
  // CR-109 Build Plan §7 — a Command carries every Work Item dispatched for
  // it, not just this Participant's own (Ch.32 FR-32.2 fan-out means more
  // than one Participant type can be dispatched against the same Command);
  // scope each retained Command's own workItems list the same way the
  // Command list itself is scoped, so this page never shows another
  // Participant's own row.
  const commandsFiltered = detail.commands
    .filter((c) => myCommandIds.has(c.id))
    .map((c) => ({ ...c, workItems: c.workItems.filter((wi) => wi.participantId === participantId) }));
  const obligations = detail.obligations.filter((o) => myDeliverableIds.has(o.obligation.related_object_id));
  // Ch.17 model cleanup (migration 232) — Evidence carries no
  // originating_participant_id/originating_deliverable_id columns of its
  // own any more; both are just evidence_relationships rows now, same
  // mechanism SEU membership uses.
  const evidence = detail.evidence.filter((e) =>
    e.relationships.some(
      (r) => (r.related_object_type === "Participant" && r.related_object_id === participantId) || (r.related_object_type === "Deliverable" && myDeliverableIds.has(r.related_object_id))
    )
  );
  const knowledgeItems = detail.knowledgeItems.filter((k) => myDeliverableIds.has(k.knowledgeItem.deliverable_id));
  // Decisions are independent of the Participant that executed them — the
  // Participant is replaceable, not absent from the record (Ch.19 §4/§17
  // correction, this session) — so this page scopes Decisions by the
  // authority badge this Participant's own user holds, within this SEU, not
  // by Deliverable ownership: any Decision acted on under a badge this
  // Participant could itself hold is theirs to see, regardless of which
  // Deliverable it attaches to or which Participant actually acted.
  const { data: badgeGrants } = await badgeGrantsDB.findActiveForHolder(String(userId));
  const myBadges = new Set((badgeGrants ?? []).map((g) => g.badge_type));
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
  };
}

export async function getParticipantHomeView(userId: number): Promise<ParticipantHomeView> {
  const { data: master } = await participantsMasterDB.findByUserId(userId);
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

// CR-109 Build Plan §7 — the Participant-scoped write path this page was
// missing (workQueue.ts's own /work-queue is a SEU-wide, unscoped stub —
// "a real tenant replaces this with its own intake"; it has no notion of
// "is this actually your Work Item," which is fine for an operator surface
// but wrong to link to from a Participant's own restricted page). This
// wrapper re-checks ownership — the Work Item's own participant_id must be
// an engagement (`participants` row) belonging to THIS caller's own
// participants_master identity — before delegating to the same governed
// completeWorkItem core (core/workItems.ts) the stub uses; no separate
// transition logic of its own.
export type CompleteMyWorkItemResult = CompleteWorkItemResult | { ok: false; reason: "not_mine"; detail: string };

export async function completeMyWorkItem(input: { userId: number; workItemId: string; outcome: WorkItemOutcome; reference?: string | null }): Promise<CompleteMyWorkItemResult> {
  const { data: master } = await participantsMasterDB.findByUserId(input.userId);
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
