import { seusDB } from "../../../dblayer/seusDB.js";
import { listResult, type ListParams, type ListResult } from "../../../utils/listQuery.js";
import { seuCapabilitiesDB } from "../../../dblayer/seuCapabilitiesDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { dependencyDefinitionsDB, type DependencyOwningScope } from "../../../dblayer/dependencyDefinitionsDB.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { ebmsDB } from "../../../dblayer/ebmsDB.js";
import { eventsDB } from "../../../dblayer/eventsDB.js";
import { templatesDB } from "../../../dblayer/templatesDB.js";
import { profilesDB } from "../../../dblayer/profilesDB.js";
import { objectivesDB } from "../../../dblayer/objectivesDB.js";
import { servicesDB } from "../../../dblayer/servicesDB.js";
import { commandsDB } from "../../../dblayer/commandsDB.js";
import { workItemsDB } from "../../../dblayer/workItemsDB.js";
import { participantsDB } from "../../../dblayer/participantsDB.js";
import { capabilityFulfilmentsDB } from "../../../dblayer/capabilityFulfilmentsDB.js";
import { dependencyDefinitionEngine } from "../../../domain/engine/dependencyDefinitionEngine.js";
import type { PoolEntry } from "../../../domain/engine/profileCompositionUnravel.js";
import { getSeuEvents } from "./events.js";
import { listObligationsWithNextStates } from "./obligations.js";
import { listEvidenceWithNextStates, listEvidenceRelationships, listEvidenceLinkedToSeu } from "./evidence.js";
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
  deliverables: Array<{ id: string; name: string; category: string | null; lifecycleState: string }>;
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
  objectiveId: string;
  activeEbmId: string | null;
  objectiveStatement: string;
  lifecycleState: string;
  createdAt: string;
  // Same split as getObjectiveDetail's own possibleNextStates/possibleTransitionVerbs
  // (core/objectives.ts): every governed, trigger==="manual" edge off this row's
  // current lifecycle_state — badge-filtering happens in the web layer
  // (resolveHeldBadges), same "which buttons does THIS viewer see" pattern
  // sdkAuthoring's computeRowActions and objectives.ts's hasObjectiveBadge both
  // already use. Owner: "Depending on the badge of the user, it shows the
  // correct buttons based on transition definition. this is the current
  // implementation. do not mess it up."
  possibleNextStates: string[];
  possibleTransitionVerbs: Record<string, string | null>;
  // Owner: "If CommissionValidated is emitted, in All SEU pages, why does
  // the Validate button still appear, the Compose button should show up" —
  // lifecycle_state alone can't answer this: it stays "Pending" through the
  // ENTIRE Validate Request + Compose EBM sub-flow (nothing moves it until
  // Configured, much later). Whether Validate Request has already passed is
  // an event fact (CommissionValidated), not a transition_definitions edge —
  // checked here, batched, so the view can stop offering "Validate" once
  // it's genuinely done (index.ejs's own "Compose" link is already the
  // real next entry point once this is true — no separate button needed).
  commissionValidated: boolean;
}

// Same shape as core/objectives.ts's own eligibleTransitions filter — a
// transition with no manual trigger, or an unpopulated verb, is never a
// button/link a viewer can click.
async function seuPossibleNextStates(lifecycleState: string): Promise<Pick<SeuListItem, "possibleNextStates" | "possibleTransitionVerbs">> {
  const { data: transitions } = await transitionDefinitionsDB.findPossibleNextTransitions("SEU", lifecycleState);
  const eligible = (transitions ?? []).filter((t) => t.trigger === "manual");
  return {
    possibleNextStates: eligible.map((t) => t.toState),
    possibleTransitionVerbs: Object.fromEntries(eligible.map((t) => [t.toState, t.verb])),
  };
}

async function withPossibleNextStates<T extends { lifecycleState: string }>(rows: T[]): Promise<Array<T & Pick<SeuListItem, "possibleNextStates" | "possibleTransitionVerbs">>> {
  const byState = new Map<string, Pick<SeuListItem, "possibleNextStates" | "possibleTransitionVerbs">>();
  return Promise.all(
    rows.map(async (row) => {
      let resolved = byState.get(row.lifecycleState);
      if (!resolved) {
        resolved = await seuPossibleNextStates(row.lifecycleState);
        byState.set(row.lifecycleState, resolved);
      }
      return { ...row, ...resolved };
    })
  );
}

// CR-072's own batched analog (eventsDB.findByOriginatingObjects) — one
// query for every still-Pending row on this page, not one per row. Only
// Pending rows are ambiguous (Failed/Configured/etc. already resolve
// unambiguously through possibleNextStates); everything else defaults false
// without a query.
async function withCommissionValidated<T extends { id: string; lifecycleState: string }>(rows: T[]): Promise<Array<T & Pick<SeuListItem, "commissionValidated">>> {
  const pendingIds = rows.filter((r) => r.lifecycleState === "Pending").map((r) => r.id);
  const { data: events } = pendingIds.length ? await eventsDB.findByOriginatingObjects("SEU", pendingIds) : { data: [] };
  const validatedIds = new Set((events ?? []).filter((e) => e.event_type === "CommissionValidated").map((e) => e.originating_object_id));
  return rows.map((row) => ({ ...row, commissionValidated: validatedIds.has(row.id) }));
}

// viewer: undefined (or a Platform/Tenant Admin badge holder) sees every
// SEU; otherwise the Registry is scoped to SEUs the viewer requested or is a
// Participant on (SDK UI Layer Plan, "SEU Registry visibility").
export async function listSeus(viewer?: { userId: number | null; isAdmin: boolean }): Promise<SeuListItem[]> {
  const viewerId = viewer && !viewer.isAdmin && viewer.userId != null ? viewer.userId : undefined;
  const { data } = await seusDB.listWithObjectiveStatement(viewerId);
  const withStates = await withPossibleNextStates(
    (data ?? []).map((row) => ({
      id: row.id,
      objectiveId: row.objective_id,
      activeEbmId: row.active_ebm_id,
      objectiveStatement: row.objective_statement,
      lifecycleState: row.lifecycle_state,
      createdAt: row.created_at,
    }))
  );
  return withCommissionValidated(withStates);
}

// Paginated / searchable / sortable list for the SEUs Registry view.
export async function listSeusPaginated(
  params: ListParams,
  viewer?: { userId: number | null; isAdmin: boolean }
): Promise<ListResult<SeuListItem>> {
  const viewerId = viewer && !viewer.isAdmin && viewer.userId != null ? viewer.userId : undefined;
  const { items, total } = await seusDB.listWithObjectiveStatementPaginated(params, viewerId);
  const withStates = await withPossibleNextStates(
    items.map((row) => ({
      id: row.id,
      objectiveId: row.objective_id,
      activeEbmId: row.active_ebm_id,
      objectiveStatement: row.objective_statement,
      lifecycleState: row.lifecycle_state,
      createdAt: row.created_at,
    }))
  );
  const withValidated = await withCommissionValidated(withStates);
  return listResult(withValidated, total, params);
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
  category: string | null;
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
// CR-051 item 1 (Ch.17 §20.2/§20.8) — an Evidence row can now support many
// artefacts, not just one; relatedObjectLabels replaces the old singular
// deliverableName to show all of them, not just the first.
export interface SeuDetailEvidence {
  evidence: EvidenceRow;
  relatedObjectLabels: string[];
  possibleNextStates: string[];
  // CR-051 item 3 (Ch.17 §12/§20.10) — resolved provenance labels for
  // display; null where that provenance field wasn't captured.
  provenance: {
    deliverableName: string | null;
    participantName: string | null;
    capabilityName: string | null;
    decisionTitle: string | null;
    activity: string | null;
  };
  // CR-051 item 4 (Ch.17 §15/§20.13) — title of the Evidence Item this one
  // corrects, if any. Deliberately one-directional: the predecessor's own
  // row shows nothing (no cross-SEU signal, per the owner's own decision).
  predecessorTitle: string | null;
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
  // design/mvp-build-plan/SEU Composition.md — owner: "There should be a
  // viewEBM button... create a new one. EBM page." The EBM's own composed
  // content (Metadata/Parameters/Engineering Practices/Quality Gates/
  // Services/Capability codes/Governance/declared Deliverable Catalogue) —
  // and its own Validate/Activate transition form — moved to its own page
  // (getSeuEbmView/seus/ebm.ejs); this view stays SEU-runtime only. Reuses
  // seu.active_ebm_id directly (already on SeuRow) rather than a redundant
  // field here, for whichever page wants to link to it.
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
  // CR-051 item 3 — options for the Evidence collection form's provenance
  // fields (Participant/Capability/Decision selects).
  participants: Array<{ id: string; displayName: string; type: string }>;
  // CR-051 item 4 — options for the Evidence collection form's "Corrects"
  // select. Includes cross-SEU-shared Evidence, not just this SEU's own.
  evidenceSupersedeCandidates: Array<{ id: string; title: string }>;
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

  const [{ data: objective }, { data: capabilities }, { data: deliverables }, { data: ebm }, events, { data: seuParticipants }] = await Promise.all([
    objectivesDB.findById(seu.objective_id),
    seuCapabilitiesDB.findBySeuId(seuId),
    deliverablesDB.findBySeuId(seuId),
    // Still needed here even though Metadata itself moved to getSeuEbmView —
    // this view's own Deliverables tab (the instantiated table) resolves
    // dependency-edge readiness against the composed Pack scope below.
    seu.active_ebm_id ? ebmsDB.findById(seu.active_ebm_id) : Promise.resolve({ data: null }),
    getSeuEvents(seuId),
    participantsDB.findBySeuId(seuId),
  ]);

  const deliverableNameById = new Map((deliverables ?? []).map((d) => [d.id, d.name]));
  // CR-051 item 3 — provenance display lookups.
  const participantNameById = new Map((seuParticipants ?? []).map((p) => [p.id, `${p.display_name} (${p.type})`]));
  const capabilityNameById = new Map((capabilities ?? []).map((c) => [c.capability_id, `${c.capability_name} (${c.capability_code})`]));

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

  // CR-039 — resolved once, outside the per-Deliverable loop, so a Capability-
  // type row's Service name doesn't cost an extra query per Deliverable.
  const { data: allServices } = await servicesDB.findAll();
  const serviceNameByCode = new Map((allServices ?? []).map((s) => [s.code, s.name]));

  // CR-043 — the SEU's full owning scope (Template + every composed Pack +
  // Profile), built from data already fetched above — ebm.composed_packs is
  // already loaded, so this costs no extra query.
  const scope: DependencyOwningScope = { templateId: seu.template_id, profileId: seu.profile_id, packIds: (ebm?.composed_packs ?? []).map((p) => p.packId) };

  const deliverableViews: SeuDetailDeliverable[] = await Promise.all(
    (deliverables ?? []).map(async (d) => {
      const [{ data: rows }, { data: nextStates }] = await Promise.all([
        dependencyDefinitionsDB.findByTargetName(scope, "Deliverable", d.name),
        transitionDefinitionsDB.findPossibleNextStates("Deliverable", d.lifecycle_state),
      ]);
      // Recomputed against live data on every page load, not cached — the
      // canonical row itself carries no per-SEU state to go stale (unlike
      // dependency_edges' old readiness_state column).
      const enrichedEdges: SeuDetailDependencyEdge[] = await Promise.all(
        (rows ?? []).map(async (row) => {
          const satisfied = await dependencyDefinitionEngine.isRowSatisfied(seu.id, row);
          const targetLabel = row.from_entity_type === "Capability" ? `Service: ${serviceNameByCode.get(row.from_name ?? "") ?? row.from_name}` : row.from_name ?? "(any)";
          return {
            id: row.id,
            dependencyType: row.from_entity_type as DependencyType,
            requiredState: row.from_state,
            readinessState: satisfied ? "Satisfied" : "Pending",
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

  const [evidenceWithNextStates, knowledgeItemsWithNextStates, decisionsWithNextStates, evidenceSupersedeCandidates] = await Promise.all([
    listEvidenceWithNextStates(seuId),
    listKnowledgeItemsWithNextStates(seuId),
    listDecisionsWithNextStates(seuId),
    // CR-051 item 4 — every Evidence Item linked to anything in this SEU,
    // including cross-SEU-shared Evidence originating elsewhere; powers the
    // "Corrects" select and resolves predecessorTitle below.
    listEvidenceLinkedToSeu(seuId),
  ]);
  // CR-051 item 3 — decision titles, for Evidence provenance display.
  const decisionTitleById = new Map(decisionsWithNextStates.map(({ decision }) => [decision.id, decision.title]));
  // CR-051 item 4 — this SEU's own Evidence plus every cross-SEU candidate
  // covers every Evidence Item that could legitimately appear as a
  // predecessor from this SEU's own page.
  const evidenceTitleById = new Map([
    ...evidenceWithNextStates.map(({ evidence }) => [evidence.id, evidence.title] as const),
    ...evidenceSupersedeCandidates.map((e) => [e.id, e.title] as const),
  ]);
  const evidenceViews: SeuDetailEvidence[] = await Promise.all(
    evidenceWithNextStates.map(async ({ evidence, possibleNextStates }) => {
      const relationships = await listEvidenceRelationships(evidence.id);
      return {
        evidence,
        relatedObjectLabels: relationships.map((r) => relatedObjectLabel(r.related_object_type, r.related_object_id)),
        possibleNextStates,
        provenance: {
          deliverableName: evidence.originating_deliverable_id ? deliverableNameById.get(evidence.originating_deliverable_id) ?? "(unknown Deliverable)" : null,
          participantName: evidence.originating_participant_id ? participantNameById.get(evidence.originating_participant_id) ?? "(unknown Participant)" : null,
          capabilityName: evidence.originating_capability_id ? capabilityNameById.get(evidence.originating_capability_id) ?? "(unknown Capability)" : null,
          decisionTitle: evidence.originating_decision_id ? decisionTitleById.get(evidence.originating_decision_id) ?? "(unknown Decision)" : null,
          activity: evidence.originating_activity,
        },
        predecessorTitle: evidence.supersedes_evidence_id ? evidenceTitleById.get(evidence.supersedes_evidence_id) ?? "(unknown Evidence)" : null,
      };
    })
  );
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
    capabilities: capabilityViews,
    deliverables: deliverableViews,
    commands: commandViews,
    obligations: obligationViews,
    participants: (seuParticipants ?? []).map((p) => ({ id: p.id, displayName: p.display_name, type: p.type })),
    evidenceSupersedeCandidates: evidenceSupersedeCandidates.map((e) => ({ id: e.id, title: e.title })),
    evidence: evidenceViews,
    knowledgeItems: knowledgeItemViews,
    decisions: decisionViews,
    externalInteractions: externalInteractionViews,
    events,
  };
}

// design/mvp-build-plan/SEU Composition.md — owner: "There should be a
// viewEBM button. It should be the same as detail.ejs. Dont use the same
// page. create a new one. EBM page. We will need this to advance the EBM
// states." A dedicated page for the EBM's own composed content (Metadata/
// Parameters/Engineering Practices/Quality Gates/Services/Capability codes/
// Governance/declared Deliverable Catalogue) and its own Validate/Activate
// transition — split out of SeuDetailView/getSeuDetailView, which stays
// SEU-runtime only.
export interface SeuEbmView {
  seuId: string;
  objectiveId: string;
  objectiveStatement: string;
  composedPacks: EbmComposedPack[];
  // Same generic transitionDefinitionsDB lookup every other entity on
  // these two pages already uses for its own transition form.
  ebm: { id: string; status: string; possibleNextStates: string[] } | null;
  // Sourced from the SEU's own template_id/profile_id (fixed at commission
  // time), not the EBM's — real from the moment Validate Request passes,
  // not only once Compose EBM also succeeds (same bug fix as before the
  // page split — carries over unchanged).
  template: { code: string; name: string; version: string } | null;
  profile: { code: string; name: string; version: string } | null;
  // The EBM's own persisted behaviors.pool (migration 182) — the same flat,
  // source-agnostic pool unravelComposition/compose.ejs already render.
  // Empty (not null) when there's no EBM yet — every tab below already
  // treats an empty pool as "not composed yet".
  ebmPool: PoolEntry[];
}

export async function getSeuEbmView(seuId: string): Promise<SeuEbmView | null> {
  const { data: seu } = await seusDB.findById(seuId);
  if (!seu) return null;

  const [{ data: objective }, { data: ebm }, { data: templateRow }, { data: profileRow }] = await Promise.all([
    objectivesDB.findById(seu.objective_id),
    seu.active_ebm_id ? ebmsDB.findById(seu.active_ebm_id) : Promise.resolve({ data: null }),
    templatesDB.findById(seu.template_id),
    profilesDB.findById(seu.profile_id),
  ]);

  const template = templateRow ? { code: templateRow.code, name: templateRow.name, version: templateRow.template_version } : null;
  const profile = profileRow ? { code: profileRow.code, name: profileRow.name, version: profileRow.profile_version } : null;
  const ebmPool = ((ebm?.behaviors as { pool?: PoolEntry[] } | null)?.pool ?? []) as PoolEntry[];
  // Bug fix (owner: "I see the buttons Retire and Apply") — findPossibleNextStates
  // returns EVERY structurally-defined edge off this status, including
  // EBM: Composed -> Retired, a SYSTEM-only outcome (checkEbmLiveness failing
  // during a Validate attempt, handled inside transitionEbm's own Validated
  // branch) that a human should never pick from this dropdown themselves.
  // findPossibleNextTransitions (same mechanism the SEU list's own Validate
  // button already uses) carries verb, which Composed -> Retired deliberately
  // has none of (only Composed -> Validated/Validated -> Active do) — the
  // same real signal "genuinely human-actionable" already uses elsewhere,
  // not a hardcoded "exclude Retired" special case.
  const { data: ebmTransitions } = ebm ? await transitionDefinitionsDB.findPossibleNextTransitions("EBM", ebm.status) : { data: [] };
  const ebmPossibleNextStates = (ebmTransitions ?? []).filter((t) => t.verb).map((t) => t.toState);

  return {
    seuId: seu.id,
    objectiveId: seu.objective_id,
    objectiveStatement: objective?.statement ?? "(objective not found)",
    composedPacks: ebm?.composed_packs ?? [],
    ebm: ebm ? { id: ebm.id, status: ebm.status, possibleNextStates: ebmPossibleNextStates } : null,
    template,
    profile,
    ebmPool,
  };
}
