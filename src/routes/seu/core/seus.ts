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
import { ontologyDB } from "../../../dblayer/ontologyDB.js";
import { findEligibleParticipants, resolveEligibilityPolicies } from "./participantEligibility.js";
import { dependencyDefinitionEngine } from "../../../domain/engine/dependencyDefinitionEngine.js";
import { RESOLVED_OBLIGATION_STATUSES } from "../../../domain/engine/qualityGateEngine.js";
import type { PoolEntry } from "../../../domain/engine/profileCompositionUnravel.js";
import { getSeuEvents } from "./events.js";
import { listObligationsWithNextStates } from "./obligations.js";
import { listAttentionItemsBySeu, listAttentionItemsWithNextStates } from "./attentionItems.js";
import { listEvidenceWithNextStates, listEvidenceRelationships, listEvidenceLinkedToSeu } from "./evidence.js";
import { listKnowledgeItemsWithNextStates } from "./knowledge.js";
import { listDecisionsWithNextStates } from "./decisions.js";
import { listExternalInteractionsWithNextStates } from "./externalInteractions.js";
import type {
  AttentionItemRow,
  CommandRow,
  DecisionRow,
  DependencyType,
  EbmComposedPack,
  EventRow,
  EvidenceRow,
  EvidenceRelationshipRow,
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
  possibleNextStates: string[];
  possibleTransitionVerbs: Record<string, string | null>;
  commissionValidated: boolean;
}

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

async function withCommissionValidated<T extends { id: string; lifecycleState: string }>(rows: T[]): Promise<Array<T & Pick<SeuListItem, "commissionValidated">>> {
  const pendingIds = rows.filter((r) => r.lifecycleState === "Pending").map((r) => r.id);
  const { data: events } = pendingIds.length ? await eventsDB.findByOriginatingObjects("SEU", pendingIds) : { data: [] };
  const validatedIds = new Set((events ?? []).filter((e) => e.event_type === "CommissionValidated").map((e) => e.originating_object_id));
  return rows.map((row) => ({ ...row, commissionValidated: validatedIds.has(row.id) }));
}

export async function listSeus(viewer?: { userId: string | null; isAdmin: boolean }): Promise<SeuListItem[]> {
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

export async function listSeusPaginated(
  params: ListParams,
  viewer?: { userId: string | null; isAdmin: boolean }
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
  deliverablesAdvanced: number;
  deliverablesTotal: number;
}

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

export interface SeuDetailWorkItem {
  id: string;
  status: WorkItemRow["status"];
  dispatchStrategy: string | null;
  participantLabel: string | null;
  participantId: string | null;
  executionContext: WorkItemRow["execution_context"];
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

export interface SeuDetailObligation {
  obligation: ObligationRow;
  deliverableName: string;
  possibleNextStates: string[];
}

export interface SeuDetailAttentionItem {
  attentionItem: AttentionItemRow;
  relatedName: string | null;
  possibleNextStates: string[];
}

export interface SeuDetailEvidence {
  evidence: EvidenceRow;
  relatedObjectLabels: string[];
  relationships: EvidenceRelationshipRow[];
  possibleNextStates: string[];
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
  relatedObjectLabels: string[];
  possibleNextStates: string[];
}

export interface SeuDetailExternalInteraction {
  interaction: ExternalInteractionRow;
  deliverableName: string | null;
  possibleNextStates: string[];
}

export interface SeuDetailView {
  seu: SeuRow;
  blockedTransition: { obligationTitle: string; toState: string } | null;
  objectiveStatement: string;
  capabilities: Array<{
    id: string;
    capabilityId: string;
    code: string;
    name: string;
    status: string;
    participantsByType: Array<{ type: string; participants: Array<{ id: string; displayName: string; state: string }> }>;
    eligibleParticipantsByType: Array<{ type: string; participants: Array<{ id: string; displayName: string }> }>;
  }>;
  participantTypes: string[];
  requiredTechnologyPacks: string[];
  requiredDomainPacks: string[];
  deliverables: SeuDetailDeliverable[];
  commands: SeuDetailCommand[];
  obligations: SeuDetailObligation[];
  attentionItems: SeuDetailAttentionItem[];
  participants: Array<{ id: string; displayName: string; type: string }>;
  evidenceSupersedeCandidates: Array<{ id: string; title: string }>;
  evidence: SeuDetailEvidence[];
  knowledgeItems: SeuDetailKnowledgeItem[];
  decisions: SeuDetailDecision[];
  externalInteractions: SeuDetailExternalInteraction[];
  events: EventRow[];
}

export async function getSeuDetailView(seuId: string): Promise<SeuDetailView | null> {
  const { data: seu } = await seusDB.findById(seuId);
  if (!seu) return null;

  const [{ data: objective }, { data: capabilities }, { data: deliverables }, { data: ebm }, events, { data: seuParticipants }, { data: participantTypeConcepts }] = await Promise.all([
    objectivesDB.findById(seu.objective_id),
    seuCapabilitiesDB.findBySeuId(seuId),
    deliverablesDB.findBySeuId(seuId),
    seu.active_ebm_id ? ebmsDB.findById(seu.active_ebm_id) : Promise.resolve({ data: null }),
    getSeuEvents(seuId),
    participantsDB.findBySeuId(seuId),
    ontologyDB.findConceptsByType("participant-types", { isRoot: false, tenantId: null }),
  ]);

  const deliverableNameById = new Map((deliverables ?? []).map((d) => [d.id, d.name]));
  const participantNameById = new Map((seuParticipants ?? []).map((p) => [p.id, `${p.display_name} (${p.type})`]));
  const capabilityNameById = new Map((capabilities ?? []).map((c) => [c.capability_id, `${c.capability_name} (${c.capability_code})`]));
  const participantTypes = (participantTypeConcepts ?? []).map((c) => c.code);

  const competencyRequirements = (ebm?.behaviors as { competencyRequirements?: Record<string, string[]> } | null)?.competencyRequirements ?? {};
  const requiredTechnologyPacks = competencyRequirements.Technology ?? [];
  const requiredDomainPacks = competencyRequirements.Domain ?? [];
  const eligibilityPolicyIds = (await resolveEligibilityPolicies(seu)).map((p) => p.id);

  const capabilityViews = await Promise.all(
    (capabilities ?? []).map(async (c) => {
      let participantsByType: Array<{ type: string; participants: Array<{ id: string; displayName: string; state: string }> }> = participantTypes.map((type) => ({ type, participants: [] }));
      let eligibleParticipantsByType: Array<{ type: string; participants: Array<{ id: string; displayName: string }> }> = participantTypes.map((type) => ({ type, participants: [] }));
      if (c.status === "Fulfilled") {
        const { data: fulfilments } = await capabilityFulfilmentsDB.findActiveManyBySeuCapabilityId(c.id);
        const participantRows = await Promise.all((fulfilments ?? []).map((f) => participantsDB.findById(f.participant_id)));
        const fulfilling = participantRows
          .map((r) => r.data)
          .filter((p): p is NonNullable<typeof p> => p != null);
        participantsByType = participantTypes.map((type) => ({
          type,
          participants: fulfilling.filter((p) => p.type === type).map((p) => ({ id: p.id, displayName: p.display_name, state: p.state })),
        }));
      } else if (seu.tenant_id) {
        const { data: excludeParticipantMasterIds } = await capabilityFulfilmentsDB.findReleasedParticipantMasterIds(c.id);
        const eligible = await findEligibleParticipants({ tenantId: seu.tenant_id, capabilityCode: c.capability_code, competency: competencyRequirements, requiredPolicyIds: eligibilityPolicyIds, excludeParticipantMasterIds: excludeParticipantMasterIds ?? [] });
        eligibleParticipantsByType = participantTypes.map((type) => ({
          type,
          participants: eligible.filter((p) => p.type === type).map((p) => ({ id: p.id, displayName: p.display_name })),
        }));
      }
      return { id: c.id, capabilityId: c.capability_id, code: c.capability_code, name: c.capability_name, status: c.status, participantsByType, eligibleParticipantsByType };
    })
  );

  const { data: allServices } = await servicesDB.findAll();
  const serviceNameByCode = new Map((allServices ?? []).map((s) => [s.code, s.name]));

  const scope: DependencyOwningScope = { templateId: seu.template_id, profileId: seu.profile_id, packIds: (ebm?.composed_packs ?? []).map((p) => p.packId) };

  const deliverableViews: SeuDetailDeliverable[] = await Promise.all(
    (deliverables ?? []).map(async (d) => {
      const [{ data: rows }, { data: nextStates }] = await Promise.all([
        dependencyDefinitionsDB.findByTargetName(scope, "Deliverable", d.name),
        transitionDefinitionsDB.findPossibleNextStates("Deliverable", d.lifecycle_state),
      ]);
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
        participantId: w.participant_id,
        executionContext: w.execution_context,
      })),
  }));

  function relatedObjectLabel(relatedObjectType: string, relatedObjectId: string): string {
    if (relatedObjectType === "Deliverable") return deliverableNameById.get(relatedObjectId) ?? "(unknown Deliverable)";
    if (relatedObjectType === "Participant") return participantNameById.get(relatedObjectId) ?? "(unknown Participant)";
    if (relatedObjectType === "Capability") return capabilityNameById.get(relatedObjectId) ?? "(unknown Capability)";
    return `${relatedObjectType} ${relatedObjectId.slice(0, 8)}`;
  }

  const obligationsWithNextStates = await listObligationsWithNextStates(seuId);
  const obligationViews: SeuDetailObligation[] = obligationsWithNextStates.map(({ obligation, possibleNextStates }) => ({
    obligation,
    deliverableName: relatedObjectLabel(obligation.related_object_type, obligation.related_object_id),
    possibleNextStates,
  }));

  const blockingObligation = obligationViews.find(
    (v) =>
      v.obligation.related_object_type === "SEU" &&
      v.obligation.related_object_id === seuId &&
      v.obligation.blocked_to_state &&
      !RESOLVED_OBLIGATION_STATUSES.has(v.obligation.status)
  );
  const blockedTransition = blockingObligation
    ? { obligationTitle: blockingObligation.obligation.title, toState: blockingObligation.obligation.blocked_to_state! }
    : null;

  const attentionItemsBySeu = await listAttentionItemsBySeu(seuId);
  const attentionItemsWithNextStates = await listAttentionItemsWithNextStates(attentionItemsBySeu);
  const attentionItemViews: SeuDetailAttentionItem[] = attentionItemsWithNextStates.map(({ attentionItem, possibleNextStates }) => ({
    attentionItem,
    relatedName: attentionItem.related_object_type && attentionItem.related_object_id ? relatedObjectLabel(attentionItem.related_object_type, attentionItem.related_object_id) : null,
    possibleNextStates,
  }));

  const [evidenceWithNextStates, knowledgeItemsWithNextStates, decisionsWithNextStates, evidenceSupersedeCandidates] = await Promise.all([
    listEvidenceWithNextStates(seuId),
    listKnowledgeItemsWithNextStates(seuId),
    listDecisionsWithNextStates(seuId),
    listEvidenceLinkedToSeu(seuId),
  ]);
  const evidenceTitleById = new Map([
    ...evidenceWithNextStates.map(({ evidence }) => [evidence.id, evidence.title] as const),
    ...evidenceSupersedeCandidates.map((e) => [e.id, e.title] as const),
  ]);
  const evidenceViews: SeuDetailEvidence[] = await Promise.all(
    evidenceWithNextStates.map(async ({ evidence, possibleNextStates }) => {
      const relationships = await listEvidenceRelationships(evidence.id);
      return {
        evidence,
        relatedObjectLabels: relationships.filter((r) => r.related_object_type !== "SEU").map((r) => relatedObjectLabel(r.related_object_type, r.related_object_id)),
        relationships,
        possibleNextStates,
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
    relatedObjectLabels: decision.related_objects.flatMap((group) => group.related_object_ids.map((id) => relatedObjectLabel(group.related_object_type, id))),
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
    blockedTransition,
    objectiveStatement: objective?.statement ?? "(objective not found)",
    capabilities: capabilityViews,
    participantTypes,
    requiredTechnologyPacks,
    requiredDomainPacks,
    deliverables: deliverableViews,
    commands: commandViews,
    obligations: obligationViews,
    attentionItems: attentionItemViews,
    participants: (seuParticipants ?? []).map((p) => ({ id: p.id, displayName: p.display_name, type: p.type })),
    evidenceSupersedeCandidates: evidenceSupersedeCandidates.map((e) => ({ id: e.id, title: e.title })),
    evidence: evidenceViews,
    knowledgeItems: knowledgeItemViews,
    decisions: decisionViews,
    externalInteractions: externalInteractionViews,
    events,
  };
}

export interface SeuEbmView {
  seuId: string;
  objectiveId: string;
  objectiveStatement: string;
  composedPacks: EbmComposedPack[];
  ebm: { id: string; status: string; possibleNextStates: string[] } | null;
  template: { code: string; name: string; version: string } | null;
  profile: { code: string; name: string; version: string } | null;
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
