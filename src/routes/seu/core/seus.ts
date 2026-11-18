import { coversEntity, namesCondition, type Waivable } from "../../../domain/engine/qualityGateOutcomeComposition.js";
import { rateWaiver } from "../../../domain/engine/waiverConfidence.js";
import { listWaiverSupportOptions, type WaiverSupportOption } from "./qualityGateWaivers.js";
import { CONFLICT_TABLE_LABELS } from "../../../dblayer/constants.js";
import { competencyRequirementsOf, settledOf } from "../../../domain/engine/ebmSettled.js";
import { seusDB } from "../../../dblayer/seusDB.js";
import { listResult, type ListParams, type ListResult } from "../../../utils/listQuery.js";
import { seuCapabilitiesDB } from "../../../dblayer/seuCapabilitiesDB.js";
import { deliverablesDB } from "../../../dblayer/deliverablesDB.js";
import { dependencyDefinitionsDB } from "../../../dblayer/dependencyDefinitionsDB.js";
import { resolveSeuOwningScope } from "../../../domain/engine/deliverableSource.js";
import { transitionDefinitionsDB } from "../../../dblayer/transitionDefinitionsDB.js";
import { nextActionsFor } from "../../../domain/engine/entityTransition.js";
import { BIRTH_STATE, SEU_VALIDATED_STATE, WAIVER_CONTROL_CONCEPT, WAIVER_CONTROL_EXPIRY, WAIVER_CONTROL_OBLIGATION, WAIVER_CONTROL_ACCEPT_RISK, WAIVER_SCOPE_GATE, WAIVER_SCOPE_POLICY, WAIVER_SCOPE_POLICY_OBLIGATION, WAIVER_SCOPE_OBLIGATION, POLICY_EVALUATION_BLOCKED, WAIVER_DEFAULT_EXPIRY_DAYS } from "../../../dblayer/constants.js";
import { ebmsDB } from "../../../dblayer/ebmsDB.js";
import { eventsDB } from "../../../dblayer/eventsDB.js";
import { templatesDB } from "../../../dblayer/templatesDB.js";
import { profilesDB } from "../../../dblayer/profilesDB.js";
import { tenantsDB } from "../../../dblayer/tenantsDB.js";
import { packsDB } from "../../../dblayer/packsDB.js";
import { objectivesDB } from "../../../dblayer/objectivesDB.js";
import { servicesDB } from "../../../dblayer/servicesDB.js";
import { commandsDB } from "../../../dblayer/commandsDB.js";
import { workItemsDB } from "../../../dblayer/workItemsDB.js";
import { participantsDB } from "../../../dblayer/participantsDB.js";
import { capabilityFulfilmentsDB } from "../../../dblayer/capabilityFulfilmentsDB.js";
import { ontologyDB } from "../../../dblayer/ontologyDB.js";
import { findEligibleParticipants, resolveEligibilityPolicies } from "./participantEligibility.js";
import { dependencyDefinitionEngine } from "../../../domain/engine/dependencyDefinitionEngine.js";
import { layoutDependencyGraph, type DependencyGraphLayout } from "./templateView.js";
import { policyDefinitionsDB } from "../../../dblayer/policyDefinitionsDB.js";
import { policyChecksFromDefinitions } from "../../../domain/engine/policyChecks.js";
import { evaluateCondition, type GoverningCondition } from "../../../domain/engine/governingCondition.js";
import { RESOLVED_OBLIGATION_STATUSES } from "../../../dblayer/constants.js";
import type { PoolEntry } from "../../../domain/engine/profileCompositionUnravel.js";
import { getSeuEvents } from "./events.js";
import { listObligationsBySeu } from "./obligations.js";
import { listAttentionItemsBySeu } from "./attentionItems.js";
import { attentionItemsDB } from "../../../dblayer/attentionItemsDB.js";
import { qualityGateEvaluationsDB } from "../../../dblayer/qualityGateEvaluationsDB.js";
import { qualityGateOutcomesDB } from "../../../dblayer/qualityGateOutcomesDB.js";
import { participantsMasterDB } from "../../../dblayer/participantsMasterDB.js";
import { qualityGateWaiversDB } from "../../../dblayer/qualityGateWaiversDB.js";
import { qualityGateWaiverRisksDB } from "../../../dblayer/qualityGateWaiverRisksDB.js";
import { listCanonicalCategories } from "./ontology.js";
import { policyEvaluationsDB } from "../../../dblayer/policyEvaluationsDB.js";
import { originatingPolicyCode } from "../../../domain/engine/obligationOrigin.js";
import { qualityGateDefinitionsDB } from "../../../dblayer/qualityGateDefinitionsDB.js";
import { listEvidenceBySeu, listEvidenceRelationships, listEvidenceLinkedToSeu } from "./evidence.js";
import { listKnowledgeItemsWithNextScopes } from "./knowledge.js";
import { listDecisionsBySeu } from "./decisions.js";
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
  const pendingIds = rows.filter((r) => r.lifecycleState === "Initiated" || r.lifecycleState === SEU_VALIDATED_STATE).map((r) => r.id);
  const { data: events } = pendingIds.length ? await eventsDB.findByOriginatingObjects("SEU", pendingIds) : { data: [] };
  const validatedIds = new Set((events ?? []).filter((e) => e.event_type === "CommissionValidated").map((e) => e.originating_object_id));
  return rows.map((row) => ({ ...row, commissionValidated: validatedIds.has(row.id) }));
}

export async function listSeusPaginated(
  params: ListParams,
  viewer?: { userId: string | null; isAdmin: boolean; tenantId?: string | null; lifecycleState?: string | null }
): Promise<ListResult<SeuListItem>> {
  const viewerId = viewer && !viewer.isAdmin && viewer.userId != null ? viewer.userId : undefined;
  // const { items, total } = await seusDB.listWithObjectiveStatementPaginated(params, viewerId);
  const { items, total } = await seusDB.listWithObjectiveStatementPaginated(params, viewerId, viewer?.tenantId ?? undefined, viewer?.lifecycleState ?? undefined);
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

// The SEU lifecycle states, in lifecycle order: the birth state first, then each state reached by the SEU's transition_definitions rows.
export async function listSeuLifecycleStates(): Promise<string[]> {
  const [{ data: definitions }, { data: birth }] = await Promise.all([transitionDefinitionsDB.findAllRows(), transitionDefinitionsDB.findBirth("SEU")]);
  const edges = (definitions ?? []).filter((d) => d.entity_type === "SEU" && d.is_active && d.from_state !== BIRTH_STATE);
  const ordered: string[] = birth ? [birth.to_state] : [];
  for (let i = 0; i < ordered.length; i++) {
    for (const edge of edges) if (edge.from_state === ordered[i] && !ordered.includes(edge.to_state)) ordered.push(edge.to_state);
  }
  for (const edge of edges) for (const state of [edge.from_state, edge.to_state]) if (!ordered.includes(state)) ordered.push(state);
  return ordered;
}

export interface SeuQuickviewItem extends SeuListItem {
  capabilitiesFulfilled: number;
  capabilitiesTotal: number;
  deliverablesAdvanced: number;
  deliverablesTotal: number;
}

// export async function getSeuQuickview(): Promise<SeuQuickviewItem[]> { ... } — loaded every SEU of every tenant, then paginated in memory.
// One page of the Commissioned SEUs, scoped to the viewer's tenant (null for a root viewer); the counts are read for that page only.
export async function getSeuQuickviewPage(params: ListParams, viewer: { tenantId: string | null }): Promise<ListResult<SeuQuickviewItem>> {
  const page = await listSeusPaginated(params, { userId: null, isAdmin: true, tenantId: viewer.tenantId });
  const items = await Promise.all(
    page.items.map(async (item) => {
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
  return { ...page, items };
}

export interface SeuDetailDependencyEdge {
  id: string;
  dependencyType: DependencyType;
  requiredState: string | null;
  readinessState: ReadinessState;
  targetLabel: string;
}

// One item of the Quality Gate decision of a Deliverable hop: a Policy, a Standard, an Obligation or a Quality Gate, with its result and whether a waiver covers it.
export interface SeuDeliverableItem { kind: "Policy" | "Standard" | "Obligation" | "Quality Gate"; item: string; toState: string; result: string; waived: boolean }

export interface SeuDetailDeliverable {
  id: string;
  name: string;
  category: string | null;
  lifecycleState: string;
  acquisitionScope: string;
  possibleNextStates: string[];
  dependencyEdges: SeuDetailDependencyEdge[];
  // What the Quality Gate decision of a hop out of the Deliverable's current state is made of: the Policies and Standards that govern the hop, the open Obligations that hold it
  // and the Quality Gates the EBM settled for it. Each has the result of its latest recorded evaluation for that hop ("Not evaluated" when there is none) and whether an Active waiver covers it.
  // Read only: nothing is evaluated through an engine that publishes.
  qualityGateItems: SeuDeliverableItem[];
  // The latest stored Quality Gate decision of each hop out of the current state.
  qualityGateOutcomes: Array<{ toState: string; outcome: string; confidenceLevel: string }>;
  // The open Attention Items related to the Deliverable or to its SEU. The execution engine records them on the governance outcome and does not refuse a hop for them.
  attentionItems: Array<{ title: string; category: string; priority: string; status: string; relatedTo: "Deliverable" | "SEU" }>;
  // The Participants on the work items of the Deliverable's Commands.
  participants: string[];
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
}

export interface SeuDetailAttentionItem {
  attentionItem: AttentionItemRow;
  relatedName: string | null;
}

export interface SeuDetailEvidence {
  evidence: EvidenceRow;
  relatedObjectLabels: string[];
  relationships: EvidenceRelationshipRow[];
  predecessorTitle: string | null;
}

export interface SeuDetailKnowledgeItem {
  knowledgeItem: KnowledgeItemRow;
  deliverableName: string;
  possibleNextScopes: string[];
}

export interface SeuDetailDecision {
  decision: DecisionRow;
  relatedObjectLabels: string[];
}

export interface SeuDetailExternalInteraction {
  interaction: ExternalInteractionRow;
  deliverableName: string | null;
  possibleNextStates: string[];
}

// The Quality Gate tab: the gates the EBM settled, the latest recorded outcome of each, the waivers of the SEU and the entities a waiver can name.
// One result that fed the Quality Gate decision of a Deliverable at its current state: a Policy evaluation, an open Obligation holding a hop, or a gate. The scope and the
// fields name what a waiver for the line has to name. Lines of different Deliverables with the same key are the same line.
export interface WaiverLine {
  key: string;
  scope: string;
  kind: string;
  name: string;
  outcome: string;
  hop: string;
  waivable: boolean;
  note: string | null;
  gateId: string | null;
  policyCode: string | null;
  category: string | null;
  title: string | null;
}

export interface SeuDetailQualityGates {
  // The lines of each Deliverable of the SEU (by id), and the number of SEUs that use the Profile of this SEU.
  waiverLines: Record<string, WaiverLine[]>;
  deliverableNames: Record<string, string>;
  profileSeuCount: number;
  gates: Array<{ id: string; code: string; name: string; category: string; criteriaType: string; steps: Array<{ step: string; deliverables: string[] }>; latestOutcome: string | null; latestEntity: string | null; latestAt: string | null }>;
  // Each Gate that blocks an entity now: its latest recorded evaluation for that entity is Blocked.
  // Everything that blocks an entity now: for a Deliverable, each Blocked or Waived condition of the latest decision of a hop out of its current state (the Quality Gates and the other checks that go into the composition).
  // `waivable` is true when a waiver can cover the item. `lineKey` names the waiver line to preselect in the waiver modal, null when the modal offers no matching line.
  blocking: Array<{ item: string; kind: string; entityValue: string; entity: string; entityState: string; hop: string; why: string; evaluatedAt: string; waived: boolean; waivable: boolean; lineKey: string | null }>;
  waivers: Array<{ confidence: number | null; supportingRecords: string[]; covers: string; risks: Array<{ risk: string; controls: Array<{ type: string; obligationTitle: string | null; obligationStatus: string | null; obligationOn: string | null }> }>; gateName: string; entity: string; grantedBy: string; rationale: string; status: string; authorityBadge: string; expiresAt: string | null; createdAt: string }>;
  waivableEntities: Array<{ value: string; label: string }>;
  // The latest decision of each Deliverable: the composed outcome and the conditions it was composed from.
  decisions: Array<{ hop: string; deliverable: string; deliverableState: string; outcome: string; confidenceLevel: string; rationale: string; conditions: Array<{ name: string; outcome: string }>; evaluatedAt: string }>;
  // What the waiver modal offers: the controls of a risk and the Ontology lists an Obligation control draws from.
  controlTypes: string[];
  controlCodes: { expiry: string; obligation: string; acceptRisk: string };
  obligationOptions: { categories: string[]; severities: string[]; priorities: string[] };
  // The Evidence, Knowledge and Decision records of the SEU that the waiver modal offers as support.
  supportOptions: WaiverSupportOption[];
  // The days after which a waiver granted with no expiry time expires. The modal offers that time.
  defaultExpiryDays: number;
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
  // The dependency graph of the SEU's Deliverable Catalogue, drawn as the Template and Profile pages draw it, or null when there is none.
  dependencyGraph: DependencyGraphLayout | null;
  qualityGates: SeuDetailQualityGates;
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

  const competencyRequirements = ebm ? competencyRequirementsOf(settledOf(ebm.behaviors)) : {};
  const requiredTechnologyPacks = competencyRequirements.Technology ?? [];
  const requiredDomainPacks = competencyRequirements.Domain ?? [];
  const eligibilityPolicies = await resolveEligibilityPolicies(seu);

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
        const eligible = await findEligibleParticipants({ tenantId: seu.tenant_id, capabilityCode: c.capability_code, competency: competencyRequirements, requiredPolicies: eligibilityPolicies, excludeParticipantMasterIds: excludeParticipantMasterIds ?? [] });
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

  const scope = await resolveSeuOwningScope(seu);

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
        qualityGateItems: [],
        qualityGateOutcomes: [],
        attentionItems: [],
        participants: [],
      };
    })
  );

  // The dependency rows of the SEU's Deliverable source, as graph entries. A Deliverable row names the Deliverable by name, the graph by code.
  const { data: graphRows } = await dependencyDefinitionsDB.findByIds(scope.dependencyDefinitionIds);
  const codeByName = new Map((deliverables ?? []).filter((d) => d.code !== null).map((d) => [d.name, d.code as string]));
  const nameByCode = new Map((deliverables ?? []).filter((d) => d.code !== null).map((d) => [d.code as string, d.name]));
  const codeOf = (type: string, name: string | null): string => (type === "Capability" ? name ?? "" : codeByName.get(name ?? "") ?? name ?? "");
  const dependencyGraph = layoutDependencyGraph(
    (graphRows ?? []).map((row) => ({ fromType: row.from_entity_type, fromCode: codeOf(row.from_entity_type, row.from_name), fromCapabilityCode: codeOf(row.from_entity_type, row.from_name), toCode: codeOf("Deliverable", row.to_name) })),
    [...nameByCode.keys()],
    (kind, code) => ({ label: kind === "Capability" ? `Service: ${serviceNameByCode.get(code) ?? code}` : nameByCode.get(code) ?? code, href: null })
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

  const obligationViews: SeuDetailObligation[] = (await listObligationsBySeu(seuId)).map((obligation) => ({
    obligation,
    deliverableName: relatedObjectLabel(obligation.related_object_type, obligation.related_object_id),
  }));

  // The Policies of the EBM that govern a next transition of a Deliverable, read as the policy engine reads them and tested with the context the execution engine gives them.
  const { data: ebmPolicies } = await policyDefinitionsDB.findByIds(ebm?.applicable_policy_ids ?? []);
  const { data: seuOpenAttentionItems } = await attentionItemsDB.findOpenByRelatedObjectAny("SEU", seuId);
  // The latest recorded evaluation of each Quality Gate for a Deliverable, read from the recorded evaluations (newest first). Nothing is evaluated here.
  const { data: gateEvaluations } = await qualityGateEvaluationsDB.findBySeuId(seuId);
  // The gates the EBM settled, by Deliverable code: what applies to a Deliverable is read from the EBM, not from what has been evaluated.
  const settledForGates = ebm ? settledOf(ebm.behaviors) : null;
  const { data: ebmGateDefinitions } = await qualityGateDefinitionsDB.findByIds(ebm?.applicable_quality_gate_ids ?? []);
  // What the Quality Gate items of each Deliverable are read from: the recorded evaluations of Policies and gates, the stored decisions, the Active waivers and the Policy that raised each Obligation.
  const { data: policyEvaluationRows } = await policyEvaluationsDB.findBySeuId(seuId);
  const { data: gateDecisionRows } = await qualityGateOutcomesDB.findBySeuId(seuId);
  const { data: activeWaivers } = await qualityGateWaiversDB.findActiveBySeu(seuId);
  const obligationPolicyCodes = new Map<string, string | null>();
  for (const v of obligationViews) obligationPolicyCodes.set(v.obligation.id, await originatingPolicyCode(v.obligation));
  for (const view of deliverableViews) {
    const deliverable = (deliverables ?? []).find((row) => row.id === view.id)!;
    const state = view.lifecycleState;
    const waiverCovers = (...alternatives: Waivable[]): boolean =>
      (activeWaivers ?? []).some((w) => coversEntity(w, { entityType: "Deliverable", entityId: deliverable.id, seuId }, deliverable.code) && alternatives.some((alt) => namesCondition(w, alt)));
    // The open Obligations that hold a hop out of the current state.
    const openHolding = obligationViews.map((v) => v.obligation).filter((o) =>
      o.related_object_type === "Deliverable" && o.related_object_id === view.id && o.blocked_from_state === state && o.blocked_to_state && !RESOLVED_OBLIGATION_STATUSES.has(o.status));
    const items: SeuDeliverableItem[] = [];
    for (const toState of view.possibleNextStates) {
      const hop = `Deliverable|${state}|${toState}`;
      // The Policies and Standards of the EBM that govern the hop. The result is the latest recorded Policy evaluation of the hop.
      for (const check of policyChecksFromDefinitions(ebmPolicies ?? [], hop, deliverable.code)) {
        const plainCode = check.code.split("::")[0];
        const evaluation = (policyEvaluationRows ?? []).find((e) => e.entity_type === "Deliverable" && e.entity_id === view.id && e.policy_code === plainCode && e.from_state === state && e.to_state === toState);
        const raised = openHolding.filter((o) => o.blocked_to_state === toState && obligationPolicyCodes.get(o.id) === plainCode);
        items.push({
          kind: check.constraint_type === "Policy" ? "Policy" : "Standard",
          item: (ebmPolicies ?? []).find((d) => d.id === check.id)?.name ?? plainCode, toState,
          result: evaluation?.outcome ?? "Not evaluated",
          waived: evaluation?.outcome === POLICY_EVALUATION_BLOCKED && waiverCovers({ scope: WAIVER_SCOPE_POLICY, policyCode: plainCode }, ...raised.map((o) => ({ scope: WAIVER_SCOPE_POLICY_OBLIGATION, policyCode: plainCode, title: o.title }) as Waivable)),
        });
      }
    }
    for (const o of openHolding) {
      const policyCode = obligationPolicyCodes.get(o.id) ?? null;
      items.push({
        kind: "Obligation", item: o.title, toState: o.blocked_to_state!, result: "Blocked",
        waived: waiverCovers(policyCode ? { scope: WAIVER_SCOPE_POLICY_OBLIGATION, policyCode, title: o.title } : { scope: WAIVER_SCOPE_OBLIGATION, category: o.category, title: o.title }),
      });
    }
    // The Quality Gates the EBM settled for the hop, each with the latest evaluation of that gate for that hop.
    for (const row of settledForGates?.qualityGates?.result ?? []) {
      const [entityType, from, toState] = row.step.split("|");
      if (entityType !== "Deliverable" || from !== state || !toState || !(row.deliverable === "" || row.deliverable === deliverable.code)) continue;
      for (const g of row.gates) {
        const definition = (ebmGateDefinitions ?? []).find((d) => d.code === String(g.code));
        if (!definition) continue;
        const evaluation = (gateEvaluations ?? []).find((e) => e.quality_gate_id === definition.id && e.entity_type === "Deliverable" && e.entity_id === view.id && e.from_state === state && e.to_state === toState);
        items.push({ kind: "Quality Gate", item: definition.name, toState, result: evaluation?.outcome ?? "Not evaluated", waived: evaluation?.outcome === "Blocked" && waiverCovers({ scope: WAIVER_SCOPE_GATE, qualityGateId: definition.id }) });
      }
    }
    view.qualityGateItems = items.sort((x, y) => x.toState.localeCompare(y.toState) || x.kind.localeCompare(y.kind) || x.item.localeCompare(y.item));
    const seenToState = new Set<string>();
    for (const decision of (gateDecisionRows ?? []).filter((r) => r.deliverable_id === view.id && r.from_state === state)) {
      if (seenToState.has(decision.to_state)) continue;
      seenToState.add(decision.to_state);
      view.qualityGateOutcomes.push({ toState: decision.to_state, outcome: decision.outcome, confidenceLevel: decision.confidence_level });
    }
    const { data: deliverableOpenAttentionItems } = await attentionItemsDB.findOpenByRelatedObjectAny("Deliverable", view.id);
    view.attentionItems = [
      ...(deliverableOpenAttentionItems ?? []).map((a) => ({ title: a.title, category: a.category, priority: a.priority, status: a.status, relatedTo: "Deliverable" as const })),
      ...(seuOpenAttentionItems ?? []).map((a) => ({ title: a.title, category: a.category, priority: a.priority, status: a.status, relatedTo: "SEU" as const })),
    ];
    const commandIds = new Set((commands ?? []).filter((c) => c.entity_type === "Deliverable" && c.entity_id === view.id).map((c) => c.id));
    const labels = (workItems ?? []).filter((w) => commandIds.has(w.command_id) && w.participant_id).map((w) => participantLabelById.get(w.participant_id!) ?? "(unknown Participant)");
    view.participants = [...new Set(labels)];
  }

  // The Quality Gate tab. The gates are the ones the active EBM names, with the steps its settled result gives them. Nothing is evaluated here.
  const { data: waiverRows } = await qualityGateWaiversDB.findBySeuId(seuId);
  const waiverSupportOptions = await listWaiverSupportOptions(seuId);
  const { data: waiverRisks } = await qualityGateWaiverRisksDB.findRisksBySeuId(seuId);
  const { data: waiverControls } = await qualityGateWaiverRisksDB.findControlsBySeuId(seuId);
  const { data: waivedGateDefinitions } = await qualityGateDefinitionsDB.findByIds([...new Set((waiverRows ?? []).flatMap((w) => (w.quality_gate_id ? [w.quality_gate_id] : [])))]);
  const waivedGateNameById = new Map((waivedGateDefinitions ?? []).map((g) => [g.id, g.name]));
  const grantorNameById = new Map<string, string>();
  for (const id of new Set((waiverRows ?? []).map((w) => w.granted_by))) {
    const { data: grantor } = await participantsMasterDB.findById(id);
    grantorNameById.set(id, grantor?.display_name ?? id);
  }
  const entityLabel = (entityType: string, entityId: string): string =>
    entityType === "Deliverable" ? `Deliverable ${deliverableNameById.get(entityId) ?? entityId}` : entityType === "SEU" ? "SEU" : `${entityType} ${entityId}`;
  const stateByEntity = new Map<string, string>([[`SEU|${seuId}`, seu.lifecycle_state], ...(deliverables ?? []).map((d) => [`Deliverable|${d.id}`, d.lifecycle_state] as [string, string])]);
  const deliverableCodeById = new Map((deliverables ?? []).map((d) => [d.id, d.code ?? ""]));
  const obligationTitleById = new Map(obligationViews.map((v) => [v.obligation.id, v.obligation.title]));
  const seenGateEntity = new Set<string>();
  const blocking: SeuDetailQualityGates["blocking"] = [];
  const { data: profileSeuCount } = await seusDB.countByProfileId(seu.profile_id);
  const waiverLines: Record<string, WaiverLine[]> = {};
  for (const d of deliverables ?? []) {
    const lines: WaiverLine[] = [];
    const openHolding = obligationViews
      .map((v) => v.obligation)
      .filter((o) => !RESOLVED_OBLIGATION_STATUSES.has(o.status) && o.blocked_from_state === d.lifecycle_state && o.blocked_to_state && ((o.related_object_type === "Deliverable" && o.related_object_id === d.id) || (o.related_object_type === "SEU" && o.related_object_id === seuId)));
    const seenPolicy = new Set<string>();
    for (const e of policyEvaluationRows ?? []) {
      if (e.entity_type !== "Deliverable" || e.entity_id !== d.id || e.from_state !== d.lifecycle_state) continue;
      const code = e.policy_code;
      if (seenPolicy.has(`${code}|${e.to_state}`)) continue;
      seenPolicy.add(`${code}|${e.to_state}`);
      const raised = openHolding.some((o) => obligationPolicyCodes.get(o.id) === code && o.blocked_to_state === e.to_state);
      lines.push({
        key: `${WAIVER_SCOPE_POLICY}|${code}`, scope: WAIVER_SCOPE_POLICY, kind: "Policy", name: code, outcome: e.outcome, hop: `${e.from_state} → ${e.to_state}`,
        waivable: e.outcome === POLICY_EVALUATION_BLOCKED && !raised,
        note: raised ? "The Policy raised an Obligation. Waive the Obligation." : null,
        gateId: null, policyCode: code, category: null, title: null,
      });
    }
    for (const o of openHolding) {
      const code = obligationPolicyCodes.get(o.id) ?? null;
      lines.push({
        key: code ? `${WAIVER_SCOPE_POLICY_OBLIGATION}|${code}|${o.title}` : `${WAIVER_SCOPE_OBLIGATION}|${o.category}|${o.title}`,
        scope: code ? WAIVER_SCOPE_POLICY_OBLIGATION : WAIVER_SCOPE_OBLIGATION, kind: "Obligation", name: o.title, outcome: "Blocked", hop: `${o.blocked_from_state} → ${o.blocked_to_state}`,
        waivable: true, note: null, gateId: null, policyCode: code, category: o.category, title: o.title,
      });
    }
    for (const definition of ebmGateDefinitions ?? []) {
      const steps = (settledForGates?.qualityGates?.result ?? [])
        .filter((row) => row.deliverable === (d.code ?? "") && row.step.startsWith(`Deliverable|${d.lifecycle_state}|`) && row.gates.some((g) => String(g.code) === definition.code))
        .map((row) => row.step.split("|").slice(1).join(" → "));
      if (steps.length === 0) continue;
      // The latest evaluation of the gate for a hop out of the Deliverable's current state.
      const latest = (gateEvaluations ?? []).find((ev) => ev.quality_gate_id === definition.id && ev.entity_type === "Deliverable" && ev.entity_id === d.id && ev.from_state === d.lifecycle_state);
      lines.push({
        key: `${WAIVER_SCOPE_GATE}|${definition.id}`, scope: WAIVER_SCOPE_GATE, kind: "Quality Gate", name: definition.name, outcome: latest?.outcome ?? "not evaluated", hop: steps.join(", "),
        waivable: latest?.outcome === "Blocked", note: null, gateId: definition.id, policyCode: null, category: null, title: null,
      });
    }
    waiverLines[d.id] = lines;
  }
  for (const e of gateEvaluations ?? []) {
    // Only the latest evaluation of a gate for one hop of one entity counts, and only when the entity is still in the state that hop leaves.
    const key = `${e.quality_gate_id}|${e.entity_type}|${e.entity_id}|${e.from_state}|${e.to_state}`;
    if (seenGateEntity.has(key)) continue;
    seenGateEntity.add(key);
    if (e.outcome !== "Blocked") continue;
    const definition = (ebmGateDefinitions ?? []).find((d) => d.id === e.quality_gate_id);
    const entityState = stateByEntity.get(`${e.entity_type}|${e.entity_id}`);
    // A Deliverable's blocks are read from its decisions below, which hold every condition that went into the composition.
    if (!definition || !entityState || e.from_state !== entityState || e.entity_type === "Deliverable") continue;
    const deliverableCode = e.entity_type === "Deliverable" ? deliverableCodeById.get(e.entity_id) ?? "" : "";
    const steps = (settledForGates?.qualityGates?.result ?? [])
      .filter((row) => row.deliverable === deliverableCode && row.step === `${e.entity_type}|${e.from_state}|${e.to_state}` && row.gates.some((g) => String(g.code) === definition.code))
      .map((row) => row.step).sort();
    const detail = e.detail ?? {};
    const details: string[] = [];
    if (Array.isArray(detail.unresolvedObligationIds)) for (const id of detail.unresolvedObligationIds) details.push(`Open Obligation: ${obligationTitleById.get(String(id)) ?? String(id)}`);
    if (detail.policyCode) details.push(`Policy not satisfied: ${String(detail.policyCode)}`);
    if (detail.requiredCategory) details.push(`No accepted Evidence of category "${String(detail.requiredCategory)}" and no approved Decision`);
    if (detail.reviewGateId) details.push("No accepted, passing Review against the required Review Gate");
    blocking.push({
      item: definition.name, kind: "Quality Gate", entityValue: `${e.entity_type}|${e.entity_id}`, entity: entityLabel(e.entity_type, e.entity_id), entityState,
      hop: steps.map((st) => st.split("|").slice(1).join(" → ")).join(", "), why: details.join("; ") || "no detail recorded", evaluatedAt: e.evaluated_at, lineKey: `${WAIVER_SCOPE_GATE}|${definition.id}`, waivable: true,
      waived: (waiverRows ?? []).some((w) => w.status === "Active" && w.scope === WAIVER_SCOPE_GATE && w.quality_gate_id === e.quality_gate_id && w.entity_type === e.entity_type && (w.entity_id === e.entity_id || (deliverableCode !== "" && w.deliverable_codes.includes(deliverableCode))) && (!w.expires_at || new Date(w.expires_at) > new Date())),
    });
  }
  // The Deliverables: every Blocked or Waived condition of the latest decision of each hop out of the current state. The waiver line to preselect is the first alternative the modal offers for the Deliverable.
  const waivableKey = (w: Waivable): string =>
    w.scope === WAIVER_SCOPE_GATE ? `${w.scope}|${w.qualityGateId}` : w.scope === WAIVER_SCOPE_POLICY ? `${w.scope}|${w.policyCode}` : w.scope === WAIVER_SCOPE_POLICY_OBLIGATION ? `${w.scope}|${w.policyCode}|${w.title}` : `${w.scope}|${w.category}|${w.title}`;
  for (const d of deliverables ?? []) {
    const seenToState = new Set<string>();
    for (const decision of (gateDecisionRows ?? []).filter((r) => r.deliverable_id === d.id && r.from_state === d.lifecycle_state)) {
      if (seenToState.has(decision.to_state)) continue;
      seenToState.add(decision.to_state);
      for (const c of decision.conditions.filter((cond) => cond.outcome !== "Passed")) {
        const alternatives = c.waivable ? (Array.isArray(c.waivable) ? c.waivable : [c.waivable]) : [];
        const offered = alternatives.map(waivableKey).find((key) => (waiverLines[d.id] ?? []).some((l) => l.key === key && l.waivable));
        const first = alternatives[0];
        blocking.push({
          item: c.name, kind: !first ? "Check" : first.scope === WAIVER_SCOPE_GATE ? "Quality Gate" : first.scope === WAIVER_SCOPE_POLICY ? "Policy" : "Obligation",
          entityValue: `Deliverable|${d.id}`, entity: entityLabel("Deliverable", d.id), entityState: d.lifecycle_state, hop: `${decision.from_state} → ${decision.to_state}`,
          why: c.reason || "no detail recorded", evaluatedAt: decision.evaluated_at, waived: c.outcome === "Waived", waivable: alternatives.length > 0, lineKey: offered ?? null,
        });
      }
    }
  }
  blocking.sort((a, b) => a.item.localeCompare(b.item) || a.entity.localeCompare(b.entity) || a.hop.localeCompare(b.hop));
  const decisions: SeuDetailQualityGates["decisions"] = [];
  for (const d of deliverables ?? []) {
    // The latest decision of each hop of the Deliverable (the rows are newest first).
    const seenHop = new Set<string>();
    for (const latest of (gateDecisionRows ?? []).filter((row) => row.deliverable_id === d.id)) {
      const hop = `${latest.from_state} → ${latest.to_state}`;
      if (seenHop.has(hop)) continue;
      seenHop.add(hop);
    decisions.push({
      hop, deliverable: d.name, deliverableState: d.lifecycle_state, outcome: latest.outcome, confidenceLevel: latest.confidence_level, rationale: latest.rationale,
      conditions: latest.conditions.map((c) => ({ name: c.name, outcome: c.outcome })), evaluatedAt: latest.evaluated_at,
    });
    }
  }
  decisions.sort((a, b) => a.deliverable.localeCompare(b.deliverable) || a.hop.localeCompare(b.hop));
  const qualityGates: SeuDetailQualityGates = {
    decisions,
    waiverLines,
    deliverableNames: Object.fromEntries((deliverables ?? []).map((d) => [d.id, d.name])),
    profileSeuCount: profileSeuCount ?? 1,
    blocking,
    gates: (ebmGateDefinitions ?? []).map((definition) => {
      const deliverablesByStep = new Map<string, string[]>();
      for (const row of settledForGates?.qualityGates?.result ?? []) {
        if (!row.gates.some((g) => String(g.code) === definition.code)) continue;
        const list = deliverablesByStep.get(row.step) ?? [];
        if (row.deliverable) list.push(row.deliverable);
        deliverablesByStep.set(row.step, list);
      }
      const steps = [...deliverablesByStep].map(([step, deliverables]) => ({ step, deliverables: deliverables.sort() }));
      const latest = (gateEvaluations ?? []).find((e) => e.quality_gate_id === definition.id);
      return {
        id: definition.id, code: definition.code, name: definition.name, category: definition.category, criteriaType: definition.criteria_type, steps,
        latestOutcome: latest?.outcome ?? null,
        latestEntity: latest ? entityLabel(latest.entity_type, latest.entity_id) : null,
        latestAt: latest?.evaluated_at ?? null,
      };
    }),
    waivers: await Promise.all((waiverRows ?? []).map(async (w) => ({
      confidence: await rateWaiver(w, waivedGateDefinitions?.find((d) => d.id === w.quality_gate_id)?.criteria_type),
      supportingRecords: Object.entries(w.supporting_records ?? {}).flatMap(([type, ids]) => ids.map((id) => `${type}: ${waiverSupportOptions.find((o) => o.type === type && o.id === id)?.label ?? id}`)),
      covers: `${w.deliverable_codes.join(", ")}${w.shared_profile_id ? " (shared with the SEUs of the Profile)" : ""}`,
      risks: (waiverRisks ?? []).filter((r) => r.waiver_id === w.id).map((r) => ({
        risk: r.risk,
        controls: (waiverControls ?? []).filter((c) => c.risk_id === r.id).map((c) => {
          const obligation = c.obligation_id ? obligationViews.find((v) => v.obligation.id === c.obligation_id)?.obligation : undefined;
          return { type: c.control_type, obligationTitle: obligation?.title ?? null, obligationStatus: obligation?.status ?? null, obligationOn: obligation ? entityLabel(obligation.related_object_type, obligation.related_object_id) : null };
        }),
      })),
      gateName: w.scope === WAIVER_SCOPE_POLICY ? `Policy ${w.policy_code}` : w.scope === WAIVER_SCOPE_POLICY_OBLIGATION ? `Obligation of Policy ${w.policy_code}: ${w.obligation_title}` : w.scope === WAIVER_SCOPE_OBLIGATION ? `Obligation ${w.obligation_category}: ${w.obligation_title}` : waivedGateNameById.get(w.quality_gate_id ?? "") ?? String(w.quality_gate_id),
      entity: entityLabel(w.entity_type, w.entity_id),
      grantedBy: grantorNameById.get(w.granted_by) ?? w.granted_by,
      rationale: w.rationale, status: w.status, authorityBadge: w.authority_badge, expiresAt: w.expires_at, createdAt: w.created_at,
    }))),
    controlTypes: await listCanonicalCategories(WAIVER_CONTROL_CONCEPT),
    controlCodes: { expiry: WAIVER_CONTROL_EXPIRY, obligation: WAIVER_CONTROL_OBLIGATION, acceptRisk: WAIVER_CONTROL_ACCEPT_RISK },
    obligationOptions: { categories: await listCanonicalCategories("category:obligation"), severities: await listCanonicalCategories("category:obligation-severity"), priorities: await listCanonicalCategories("category:obligation-priority") },
    supportOptions: waiverSupportOptions,
    defaultExpiryDays: WAIVER_DEFAULT_EXPIRY_DAYS,
    waivableEntities: [
      { value: `SEU|${seuId}`, label: "SEU" },
      ...(deliverables ?? []).map((d) => ({ value: `Deliverable|${d.id}`, label: `Deliverable ${d.name}` })),
    ],
  };

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
  const attentionItemViews: SeuDetailAttentionItem[] = attentionItemsBySeu.map((attentionItem) => ({
    attentionItem,
    relatedName: attentionItem.related_object_type && attentionItem.related_object_id ? relatedObjectLabel(attentionItem.related_object_type, attentionItem.related_object_id) : null,
  }));

  const [evidenceItems, knowledgeItemsWithNextScopes, decisionRows, evidenceSupersedeCandidates] = await Promise.all([
    listEvidenceBySeu(seuId),
    listKnowledgeItemsWithNextScopes(seuId),
    listDecisionsBySeu(seuId),
    listEvidenceLinkedToSeu(seuId),
  ]);
  const evidenceTitleById = new Map([
    ...evidenceItems.map((evidence) => [evidence.id, evidence.title] as const),
    ...evidenceSupersedeCandidates.map((e) => [e.id, e.title] as const),
  ]);
  const evidenceViews: SeuDetailEvidence[] = await Promise.all(
    evidenceItems.map(async (evidence) => {
      const relationships = await listEvidenceRelationships(evidence.id);
      return {
        evidence,
        relatedObjectLabels: relationships.filter((r) => r.related_object_type !== "SEU").map((r) => relatedObjectLabel(r.related_object_type, r.related_object_id)),
        relationships,
        predecessorTitle: evidence.supersedes_evidence_id ? evidenceTitleById.get(evidence.supersedes_evidence_id) ?? "(unknown Evidence)" : null,
      };
    })
  );
  const knowledgeItemViews: SeuDetailKnowledgeItem[] = knowledgeItemsWithNextScopes.map(({ knowledgeItem, possibleNextScopes }) => ({
    knowledgeItem,
    deliverableName: deliverableNameById.get(knowledgeItem.deliverable_id) ?? "(unknown Deliverable)",
    possibleNextScopes,
  }));
  const decisionViews: SeuDetailDecision[] = decisionRows.map((decision) => ({
    decision,
    relatedObjectLabels: decision.related_objects.flatMap((group) => group.related_object_ids.map((id) => relatedObjectLabel(group.related_object_type, id))),
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
    dependencyGraph,
    qualityGates,
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

// Each composed Pack with the name and code of the tenant that owns it.
export async function withPackTenants(composedPacks: EbmComposedPack[]): Promise<Array<EbmComposedPack & { tenant: string }>> {
  if (composedPacks.length === 0) return [];
  const [{ data: packs }, { data: tenants }] = await Promise.all([packsDB.findByIds(composedPacks.map((p) => p.packId)), tenantsDB.findAll()]);
  const tenantOfPack = new Map((packs ?? []).map((pack) => [pack.id, pack.tenant_id]));
  return composedPacks.map((p) => {
    const tenantId = tenantOfPack.get(p.packId);
    const t = (tenants ?? []).find((row) => row.id === tenantId);
    return { ...p, tenant: t ? `${t.name} (${t.code})` : (tenantId ?? "(Pack not found)") };
  });
}

export interface SeuEbmView {
  seuId: string;
  objectiveId: string;
  objectiveStatement: string;
  composedPacks: Array<EbmComposedPack & { tenant: string }>;
  ebm: { id: string; status: string; actions: Array<{ toState: string; verb: string }> } | null;
  template: { code: string; name: string; version: string; tenant: string } | null;
  profile: { code: string; name: string; version: string; tenant: string } | null;
  // Commented out (owner): nothing reads the EBM's pool. The EBM is shown from its settled result.
  // ebmPool: PoolEntry[];
  // One tab for each table of the EBM's settled result, with the result, the conflicts with the picks, and what is left out.
  settledTabs: Array<{ table: string; label: string; result: unknown[]; conflicts: unknown[]; leftOut: unknown[] }>;
}

export async function getSeuEbmView(seuId: string, actorId: string): Promise<SeuEbmView | null> {
  const { data: seu } = await seusDB.findById(seuId);
  if (!seu) return null;

  const [{ data: objective }, { data: ebm }, { data: templateRow }, { data: profileRow }] = await Promise.all([
    objectivesDB.findById(seu.objective_id),
    seu.active_ebm_id ? ebmsDB.findById(seu.active_ebm_id) : Promise.resolve({ data: null }),
    templatesDB.findById(seu.template_id),
    profilesDB.findById(seu.profile_id),
  ]);

  const { data: tenants } = await tenantsDB.findAll();
  const tenantLabel = (tenantId: string) => {
    const t = (tenants ?? []).find((row) => row.id === tenantId);
    return t ? `${t.name} (${t.code})` : tenantId;
  };
  const template = templateRow ? { code: templateRow.code, name: templateRow.name, version: templateRow.template_version, tenant: tenantLabel(templateRow.tenant_id) } : null;
  const profile = profileRow ? { code: profileRow.code, name: profileRow.name, version: profileRow.profile_version, tenant: tenantLabel(profileRow.tenant_id) } : null;
  // Commented out (owner): nothing reads the EBM's pool.
  // const ebmPool = ((ebm?.behaviors as { pool?: PoolEntry[] } | null)?.pool ?? []) as PoolEntry[];
  const settledAll = (ebm ? settledOf(ebm.behaviors) : {}) as unknown as Record<string, { result?: unknown[]; conflicts?: unknown[]; leftOut?: unknown[] }>;
  const settledTabs = Object.keys(CONFLICT_TABLE_LABELS).map((table) => ({ table, label: CONFLICT_TABLE_LABELS[table], result: settledAll?.[table]?.result ?? [], conflicts: settledAll?.[table]?.conflicts ?? [], leftOut: settledAll?.[table]?.leftOut ?? [] }));
  const ebmActions = ebm ? (await nextActionsFor("EBM", ebm.status, actorId)).map((a) => ({ toState: a.toState, verb: a.verb })) : [];

  return {
    seuId: seu.id,
    objectiveId: seu.objective_id,
    objectiveStatement: objective?.statement ?? "(objective not found)",
    composedPacks: await withPackTenants(ebm?.composed_packs ?? []),
    ebm: ebm ? { id: ebm.id, status: ebm.status, actions: ebmActions } : null,
    template,
    profile,
    settledTabs,
  };
}
