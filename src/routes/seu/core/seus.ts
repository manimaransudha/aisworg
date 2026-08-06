import { seusDB } from "../../../dblayer/seusDB.js";
import { seuCapabilitiesDB } from "../../../dblayer/seuCapabilitiesDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { dependencyEdgesDB } from "../../../dblayer/dependencyEdgesDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { ebmsDB } from "../../../dblayer/ebmsDB.js";
import { objectivesDB } from "../../../dblayer/objectivesDB.js";
import { servicesDB } from "../../../dblayer/servicesDB.js";
import { commandsDB } from "../../../dblayer/commandsDB.js";
import { workItemsDB } from "../../../dblayer/workItemsDB.js";
import { participantsDB } from "../../../dblayer/participantsDB.js";
import { capabilityFulfilmentsDB } from "../../../dblayer/capabilityFulfilmentsDB.js";
import { dependencyEngine } from "../../../domain/engine/dependencyEngine.js";
import { getSeuEvents } from "./events.js";
import { listObligationsWithNextStates } from "./obligations.js";
import { listEvidenceWithNextStates } from "./evidence.js";
import { listKnowledgeItemsWithNextStates } from "./knowledge.js";
import { listDecisionsWithNextStates } from "./decisions.js";
import { listExternalInteractionsWithNextStates } from "./externalInteractions.js";
import type {
  CommandRow,
  DecisionRow,
  DependencyType,
  EbmComposedPack,
  EventRow,
  EvidenceRow,
  ExternalInteractionRow,
  KnowledgeItemRow,
  ObligationRow,
  ReadinessState,
  SeuRow,
  WorkItemRow,
} from "../../../dblayer/seuTypes.js";

export interface SeuStatusView {
  seu: SeuRow;
  capabilities: Array<{ id: string; capabilityId: string; code: string; name: string; status: string }>;
  deliverables: Array<{ id: string; name: string; category: string; lifecycleState: string }>;
}

export async function getSeuStatus(seuId: string): Promise<SeuStatusView | null> {
  const { data: seu } = await seusDB.findById(seuId);
  if (!seu) return null;

  const { data: capabilities } = await seuCapabilitiesDB.findBySeuId(seuId);
  const { data: deliverables } = await deliverablesDB.findBySeuId(seuId);

  return {
    seu,
    capabilities: (capabilities ?? []).map((c) => ({ id: c.id, capabilityId: c.capability_id, code: c.capability_code, name: c.capability_name, status: c.status })),
    deliverables: (deliverables ?? []).map((d) => ({ id: d.id, name: d.name, category: d.category, lifecycleState: d.lifecycle_state })),
  };
}

export interface SeuListItem {
  id: string;
  objectiveStatement: string;
  lifecycleState: string;
  createdAt: string;
}

// viewer: undefined (or a Platform/Tenant Admin badge holder) sees every
// SEU; otherwise the Registry is scoped to SEUs the viewer requested or is a
// Participant on (SDK UI Layer Plan, "SEU Registry visibility").
export async function listSeus(viewer?: { userId: number | null; isAdmin: boolean }): Promise<SeuListItem[]> {
  const viewerId = viewer && !viewer.isAdmin && viewer.userId != null ? viewer.userId : undefined;
  const { data } = await seusDB.listWithObjectiveStatement(viewerId);
  return (data ?? []).map((row) => ({
    id: row.id,
    objectiveStatement: row.objective_statement,
    lifecycleState: row.lifecycle_state,
    createdAt: row.created_at,
  }));
}

export interface SeuQuickviewItem extends SeuListItem {
  capabilitiesFulfilled: number;
  capabilitiesTotal: number;
  deliverablesAdvanced: number; // moved beyond the default 'Defined' state
  deliverablesTotal: number;
}

// Drives the post-login landing page — per-SEU progress at a glance. Single-
// tenant for now (Build Plan §5 item 13): this lists every commissioned SEU
// platform-wide, not "this Tenant's SEUs" — that scoping needs a Tenant model
// (Ch.42) this MVP doesn't have yet.
export async function getSeuQuickview(): Promise<SeuQuickviewItem[]> {
  const items = await listSeus();
  return Promise.all(
    items.map(async (item) => {
      const [{ data: capabilities }, { data: deliverables }] = await Promise.all([
        seuCapabilitiesDB.findBySeuId(item.id),
        deliverablesDB.findBySeuId(item.id),
      ]);
      return {
        ...item,
        capabilitiesFulfilled: (capabilities ?? []).filter((c) => c.status === "Fulfilled").length,
        capabilitiesTotal: capabilities?.length ?? 0,
        deliverablesAdvanced: (deliverables ?? []).filter((d) => d.lifecycle_state !== "Defined").length,
        deliverablesTotal: deliverables?.length ?? 0,
      };
    })
  );
}

// Post-MVP Phase 2: names what a dependency edge actually points at, instead
// of a bare "Deliverable" / "Capability" label — the raw target ids meant
// nothing to a human reader (Ch.9 §8 / Ch.11 §9: edges reference the specific
// Deliverable or Service, and that should be visible, not just structurally true).
export interface SeuDetailDependencyEdge {
  id: string;
  dependencyType: DependencyType;
  requiredState: string | null;
  readinessState: ReadinessState;
  targetLabel: string;
}

export interface SeuDetailDeliverable {
  id: string;
  name: string;
  category: string;
  lifecycleState: string;
  acquisitionScope: string;
  possibleNextStates: string[];
  dependencyEdges: SeuDetailDependencyEdge[];
}

// Post-MVP Phase 3: the Command/Work Item/Dispatch pipeline's own audit
// surface — makes the previously-invisible internal steps between "governance
// allowed this transition" and "the Deliverable actually moved" visible,
// same discipline as Phase 2's edge target-naming fix.
export interface SeuDetailWorkItem {
  id: string;
  status: WorkItemRow["status"];
  dispatchStrategy: string | null;
  participantLabel: string | null;
}

export interface SeuDetailCommand {
  id: string;
  entityLabel: string;
  commandType: string;
  fromState: string;
  toState: string;
  status: CommandRow["status"];
  createdAt: string;
  workItems: SeuDetailWorkItem[];
}

// Post-MVP Phase 4: Obligations shown against the Deliverable they're
// attached to, with their own possible next lifecycle states, same shape as
// Deliverables' own transition control.
export interface SeuDetailObligation {
  obligation: ObligationRow;
  deliverableName: string;
  possibleNextStates: string[];
}

// Post-MVP Phase 5: Evidence/Knowledge/Decision shown against the Deliverable
// they're attached to, same shape as Obligations' own display.
export interface SeuDetailEvidence {
  evidence: EvidenceRow;
  deliverableName: string;
  possibleNextStates: string[];
}

export interface SeuDetailKnowledgeItem {
  knowledgeItem: KnowledgeItemRow;
  deliverableName: string;
  possibleNextStates: string[];
  possibleNextScopes: string[];
}

export interface SeuDetailDecision {
  decision: DecisionRow;
  deliverableName: string;
  possibleNextStates: string[];
}

// Post-MVP Phase 8: External Interactions shown against the Deliverable they're
// attached to (optional — unlike Obligation/Evidence/Knowledge/Decision, a
// deliverable_id is not required, since not every interaction is about a
// specific Deliverable, e.g. a general customer status update), same shape
// as the other lifecycle-governed entities' own display.
export interface SeuDetailExternalInteraction {
  interaction: ExternalInteractionRow;
  deliverableName: string | null;
  possibleNextStates: string[];
}

export interface SeuDetailView {
  seu: SeuRow;
  objectiveStatement: string;
  composedPacks: EbmComposedPack[];
  capabilities: Array<{
    id: string;
    capabilityId: string;
    code: string;
    name: string;
    status: string;
    // Participant Lifecycle Governance — Plan, Build order step 5 — the
    // currently fulfilling Participant, so the detail page can offer
    // Replace (Ch.13 §13) alongside the existing Fulfil form, not just show
    // "—" once a Capability is already Fulfilled.
    participant: { id: string; displayName: string; type: string; state: string } | null;
  }>;
  deliverables: SeuDetailDeliverable[];
  commands: SeuDetailCommand[];
  obligations: SeuDetailObligation[];
  evidence: SeuDetailEvidence[];
  knowledgeItems: SeuDetailKnowledgeItem[];
  decisions: SeuDetailDecision[];
  externalInteractions: SeuDetailExternalInteraction[];
  events: EventRow[];
}

// Everything the SEU detail page renders, composed in one place so the web
// controller stays a thin render step — the same discipline as the API layer,
// just a richer read model for a human instead of a machine client.
export async function getSeuDetailView(seuId: string): Promise<SeuDetailView | null> {
  const { data: seu } = await seusDB.findById(seuId);
  if (!seu) return null;

  const [{ data: objective }, { data: capabilities }, { data: deliverables }, { data: ebm }, events] = await Promise.all([
    objectivesDB.findById(seu.objective_id),
    seuCapabilitiesDB.findBySeuId(seuId),
    deliverablesDB.findBySeuId(seuId),
    seu.active_ebm_id ? ebmsDB.findById(seu.active_ebm_id) : Promise.resolve({ data: null }),
    getSeuEvents(seuId),
  ]);

  const deliverableNameById = new Map((deliverables ?? []).map((d) => [d.id, d.name]));

  const capabilityViews = await Promise.all(
    (capabilities ?? []).map(async (c) => {
      let participant: { id: string; displayName: string; type: string; state: string } | null = null;
      if (c.status === "Fulfilled") {
        const { data: fulfilment } = await capabilityFulfilmentsDB.findActiveBySeuCapabilityId(c.id);
        const { data: participantRow } = fulfilment ? await participantsDB.findById(fulfilment.participant_id) : { data: null };
        participant = participantRow ? { id: participantRow.id, displayName: participantRow.display_name, type: participantRow.type, state: participantRow.state } : null;
      }
      return { id: c.id, capabilityId: c.capability_id, code: c.capability_code, name: c.capability_name, status: c.status, participant };
    })
  );

  const deliverableViews: SeuDetailDeliverable[] = await Promise.all(
    (deliverables ?? []).map(async (d) => {
      const [{ data: edges }, { data: nextStates }] = await Promise.all([
        dependencyEdgesDB.findByFromDeliverable(d.id),
        transitionDefinitionsDB.findPossibleNextStates("Deliverable", d.lifecycle_state),
      ]);
      // Recompute against live data before display — the stored readiness_state
      // is a write-side cache only updated as a side effect of a transition
      // attempt on this exact Deliverable, so reading it raw shows stale status
      // on every plain page load. See design/mvp-build-plan/Open Design
      // Questions.md for the related, still-open scope-of-gating question.
      const refreshedEdges = await Promise.all((edges ?? []).map((edge) => dependencyEngine.refreshEdge(edge)));
      const enrichedEdges: SeuDetailDependencyEdge[] = await Promise.all(
        refreshedEdges.map(async (edge) => {
          let targetLabel: string;
          if (edge.dependency_type === "Deliverable") {
            targetLabel = (edge.to_deliverable_id && deliverableNameById.get(edge.to_deliverable_id)) || "(unknown Deliverable)";
          } else {
            const { data: service } = edge.to_service_id ? await servicesDB.findById(edge.to_service_id) : { data: null };
            targetLabel = service ? `Service: ${service.name}` : "(unknown Service)";
          }
          return {
            id: edge.id,
            dependencyType: edge.dependency_type,
            requiredState: edge.required_state,
            readinessState: edge.readiness_state,
            targetLabel,
          };
        })
      );
      return {
        id: d.id,
        name: d.name,
        category: d.category,
        lifecycleState: d.lifecycle_state,
        acquisitionScope: d.acquisition_scope,
        possibleNextStates: nextStates ?? [],
        dependencyEdges: enrichedEdges,
      };
    })
  );

  const { data: commands } = await commandsDB.findBySeuId(seuId);
  const { data: workItems } = await workItemsDB.findByCommandIds((commands ?? []).map((c) => c.id));
  const participantIds = [...new Set((workItems ?? []).map((w) => w.participant_id).filter((id): id is string => id !== null))];
  const participantLabelById = new Map(
    (await Promise.all(participantIds.map(async (id) => {
      const { data: participant } = await participantsDB.findById(id);
      return [id, participant ? `${participant.display_name} (${participant.type})` : "(unknown Participant)"] as const;
    }))).map(([id, label]) => [id, label])
  );

  const commandViews: SeuDetailCommand[] = (commands ?? []).map((command) => ({
    id: command.id,
    entityLabel: command.entity_type === "Deliverable" ? deliverableNameById.get(command.entity_id) ?? "(unknown Deliverable)" : `${command.entity_type} ${command.entity_id.slice(0, 8)}`,
    commandType: command.command_type,
    fromState: command.from_state,
    toState: command.to_state,
    status: command.status,
    createdAt: command.created_at,
    workItems: (workItems ?? [])
      .filter((w) => w.command_id === command.id)
      .map((w) => ({
        id: w.id,
        status: w.status,
        dispatchStrategy: w.dispatch_strategy,
        participantLabel: w.participant_id ? participantLabelById.get(w.participant_id) ?? null : null,
      })),
  }));

  // Obligation/Evidence/Decision now attach to any governed entity, not just
  // a Deliverable (Open Design Questions.md #3) — the SEU detail page still
  // only ever creates them against a Deliverable today, so this resolves a
  // real Deliverable name in the common case and falls back to a generic
  // label otherwise, same pattern SeuDetailCommand.entityLabel already uses.
  function relatedObjectLabel(relatedObjectType: string, relatedObjectId: string): string {
    if (relatedObjectType === "Deliverable") return deliverableNameById.get(relatedObjectId) ?? "(unknown Deliverable)";
    return `${relatedObjectType} ${relatedObjectId.slice(0, 8)}`;
  }

  const obligationsWithNextStates = await listObligationsWithNextStates(seuId);
  const obligationViews: SeuDetailObligation[] = obligationsWithNextStates.map(({ obligation, possibleNextStates }) => ({
    obligation,
    deliverableName: relatedObjectLabel(obligation.related_object_type, obligation.related_object_id),
    possibleNextStates,
  }));

  const [evidenceWithNextStates, knowledgeItemsWithNextStates, decisionsWithNextStates] = await Promise.all([
    listEvidenceWithNextStates(seuId),
    listKnowledgeItemsWithNextStates(seuId),
    listDecisionsWithNextStates(seuId),
  ]);
  const evidenceViews: SeuDetailEvidence[] = evidenceWithNextStates.map(({ evidence, possibleNextStates }) => ({
    evidence,
    deliverableName: relatedObjectLabel(evidence.related_object_type, evidence.related_object_id),
    possibleNextStates,
  }));
  const knowledgeItemViews: SeuDetailKnowledgeItem[] = knowledgeItemsWithNextStates.map(({ knowledgeItem, possibleNextStates, possibleNextScopes }) => ({
    knowledgeItem,
    deliverableName: deliverableNameById.get(knowledgeItem.deliverable_id) ?? "(unknown Deliverable)",
    possibleNextStates,
    possibleNextScopes,
  }));
  const decisionViews: SeuDetailDecision[] = decisionsWithNextStates.map(({ decision, possibleNextStates }) => ({
    decision,
    deliverableName: relatedObjectLabel(decision.related_object_type, decision.related_object_id),
    possibleNextStates,
  }));

  const externalInteractionsWithNextStates = await listExternalInteractionsWithNextStates(seuId);
  const externalInteractionViews: SeuDetailExternalInteraction[] = externalInteractionsWithNextStates.map(({ interaction, possibleNextStates }) => ({
    interaction,
    deliverableName: interaction.deliverable_id ? deliverableNameById.get(interaction.deliverable_id) ?? "(unknown Deliverable)" : null,
    possibleNextStates,
  }));

  return {
    seu,
    objectiveStatement: objective?.statement ?? "(objective not found)",
    composedPacks: ebm?.composed_packs ?? [],
    capabilities: capabilityViews,
    deliverables: deliverableViews,
    commands: commandViews,
    obligations: obligationViews,
    evidence: evidenceViews,
    knowledgeItems: knowledgeItemViews,
    decisions: decisionViews,
    externalInteractions: externalInteractionViews,
    events,
  };
}
