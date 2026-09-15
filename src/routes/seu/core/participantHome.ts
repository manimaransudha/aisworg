// CR-103 — Participant home page. A `general`-role user's own landing view:
// their participants_master identity plus every SEU they're a per-SEU
// Participant engagement on, scoped down to items that originate from or are
// assigned to that engagement (never the full SEU detail — no Capability
// Fulfilment, no other Participants' own work).
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { participantsDB } from "../../../dblayer/participantsDB.js";
import { commandsDB } from "../../../dblayer/commandsDB.js";
import { workItemsDB } from "../../../dblayer/workItemsDB.js";
import { getSeuDetailView, type SeuDetailView } from "./seus.js";
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
async function scopeToParticipant(detail: SeuDetailView, participantId: string): Promise<ParticipantScopedSeuView> {
  const { data: commands } = await commandsDB.findBySeuId(detail.seu.id);
  const { data: workItems } = await workItemsDB.findByCommandIds((commands ?? []).map((c) => c.id));
  const myCommandIds = new Set((workItems ?? []).filter((w) => w.participant_id === participantId).map((w) => w.command_id));
  const myDeliverableIds = new Set(
    (commands ?? []).filter((c) => myCommandIds.has(c.id) && c.entity_type === "Deliverable").map((c) => c.entity_id)
  );

  const deliverables = detail.deliverables.filter((d) => myDeliverableIds.has(d.id));
  const commandsFiltered = detail.commands.filter((c) => myCommandIds.has(c.id));
  const obligations = detail.obligations.filter((o) => myDeliverableIds.has(o.obligation.related_object_id));
  const evidence = detail.evidence.filter(
    (e) => e.evidence.originating_participant_id === participantId || myDeliverableIds.has(e.evidence.originating_deliverable_id ?? "")
  );
  const knowledgeItems = detail.knowledgeItems.filter((k) => myDeliverableIds.has(k.knowledgeItem.deliverable_id));
  const decisions = detail.decisions.filter((d) => myDeliverableIds.has(d.decision.related_object_id));
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
      const detail = await scopeToParticipant(fullDetail, participant.id);
      return { participant, detail };
    })
  );
  return { master, engagements: engagements.filter((e): e is ParticipantHomeEngagement => e != null) };
}
