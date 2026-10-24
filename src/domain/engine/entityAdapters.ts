import { capabilityDefinitionsDB } from "../../dblayer/capabilityDefinitionsDB.js";
import { packsDB } from "../../dblayer/packsDB.js";
import { templatesDB } from "../../dblayer/templatesDB.js";
import { profilesDB } from "../../dblayer/profilesDB.js";
import { serviceDefinitionsDB } from "../../dblayer/serviceDefinitionsDB.js";
import { policyDefinitionsDB } from "../../dblayer/policyDefinitionsDB.js";
import { deliverableDefinitionsDB } from "../../dblayer/deliverableDefinitionsDB.js";
import { schemaDefinitionsDB } from "../../dblayer/schemaDefinitionsDB.js";
import { objectivesDB } from "../../dblayer/objectivesDB.js";
import { ebmsDB } from "../../dblayer/ebmsDB.js";
import { ontologyDB } from "../../dblayer/ontologyDB.js";
import { seusDB } from "../../dblayer/seusDB.js";
import { obligationsDB } from "../../dblayer/obligationsDB.js";
import { evidenceDB } from "../../dblayer/evidenceDB.js";
import { attentionItemsDB } from "../../dblayer/attentionItemsDB.js";
import { decisionsDB } from "../../dblayer/decisionsDB.js";
import { knowledgeItemsDB } from "../../dblayer/knowledgeItemsDB.js";
import { reviewsDB } from "../../dblayer/reviewsDB.js";
import { findingsDB } from "../../dblayer/findingsDB.js";
import { participantsDB } from "../../dblayer/participantsDB.js";
import type { AttentionItemRow, FindingRow, ReviewRow, DecisionRow, KnowledgeItemRow, ParticipantRow, CapabilityDefinitionRow, EbmRow, EvidenceRow, ObligationRow, SeuRow, OntologyConceptRow, DeliverableDefinitionRow, ObjectiveRow, PackContributions, PackRow, PolicyDefinitionRow, ProfileRow, SchemaDefinitionRow, TemplateRow, ServiceDefinitionRow, TransitionEntityType } from "../../dblayer/seuTypes.js";

// How the generic transition function (entityTransition.ts) reaches one entity's table (CR-128). An adapter holds no rules.
export interface EntityAdapter<Row extends object = object> {
  findById(id: string): Promise<Row | null>;
  getState(row: Row): string;
  setState(id: string, toState: string, authorityBadge: string, authorId: string): Promise<Row>;
  tenantId(row: Row): string | null | Promise<string | null>;
  // Only for entities that live inside an SEU: the transition then also checks the Quality Gate and the actor's participant row in that SEU (evaluateGoverned).
  seuId?(row: Row): string | Promise<string>;
  // Only for entities that keep comments (a comment accompanies a transition).
  addComment?(id: string, comment: { text: string; actorId: string; authorityBadge: string }): Promise<void>;
  // Only for entities whose content is checked against a pinned schema (src/policies/validateSchema.ts).
  schemaDefinitionId?(row: Row): string | null;
  content?(row: Row): Record<string, unknown>;
  // Only for entities with composable Ontology fields (src/policies/ontologyValuesPresent.ts): the values checked against the pinned schema.
  composableFields?(row: Row): Record<string, unknown>;
}

function adapter<Row extends object>(a: EntityAdapter<Row>): EntityAdapter {
  return a as unknown as EntityAdapter;
}

const schemaDefinitionAdapter = adapter<SchemaDefinitionRow>({
  async findById(id) {
    const { data, error } = await schemaDefinitionsDB.findById(id);
    if (error) throw error;
    return data ?? null;
  },
  getState: (row) => row.lifecycle_state,
  async setState(id, toState, authorityBadge, authorId) {
    const { data, error } = await schemaDefinitionsDB.advanceLifecycle(id, toState as SchemaDefinitionRow["lifecycle_state"], authorityBadge, authorId);
    if (error || !data) throw error ?? new Error(`failed to set the state of SchemaDefinition ${id}`);
    return data;
  },
  tenantId: () => null,
});

const capabilityAdapter = adapter<CapabilityDefinitionRow>({
  async findById(id) {
    const { data, error } = await capabilityDefinitionsDB.findById(id);
    if (error) throw error;
    return data ?? null;
  },
  getState: (row) => row.status,
  async setState(id, toState, authorityBadge, authorId) {
    const { data, error } = await capabilityDefinitionsDB.updateStatus(id, toState as CapabilityDefinitionRow["status"], authorityBadge, authorId);
    if (error || !data) throw error ?? new Error(`failed to set the state of Capability ${id}`);
    return data;
  },
  tenantId: (row) => row.tenant_id,
  schemaDefinitionId: (row) => row.schema_definition_id,
  composableFields: (row) => ({ code: row.code, category: row.category, roles: row.roles }),
  content: (row) => ({ ...(row.draft_content ?? {}), code: row.code, defaultLabel: row.default_label, description: row.description ?? "", category: row.category, roles: row.roles, version: row.version }),
});

const serviceAdapter = adapter<ServiceDefinitionRow>({
  async findById(id) {
    const { data, error } = await serviceDefinitionsDB.findById(id);
    if (error) throw error;
    return data ?? null;
  },
  getState: (row) => row.status,
  async setState(id, toState) {
    const { data, error } = await serviceDefinitionsDB.updateStatus(id, toState as ServiceDefinitionRow["status"]);
    if (error || !data) throw error ?? new Error(`failed to set the state of Service ${id}`);
    return data;
  },
  async addComment(id, comment) {
    const { error } = await serviceDefinitionsDB.addComment(id, comment);
    if (error) throw error;
  },
  tenantId: (row) => row.tenant_id,
  schemaDefinitionId: (row) => row.schema_definition_id,
  content: (row) => ({
    ...(row.draft_content ?? {}), code: row.code, name: row.name, capabilityCode: row.capability_code, purpose: row.purpose ?? "", inputs: row.inputs,
    outputs: row.outputs, serviceLevel: row.service_level, governance: row.governance ?? "", success: row.success ?? "", consumers: row.consumers, version: row.version,
  }),
});

// The content a Pack shows in its form and is validated as: its own columns plus the flattened contributions.
export function packContent(pack: PackRow): Record<string, unknown> {
  const c = (pack.contributions ?? {}) as PackContributions & Record<string, unknown[]>;
  return {
    code: pack.code,
    name: pack.name,
    category: pack.category,
    packVersion: pack.pack_version,
    installationClassification: pack.installation_classification,
    tenantId: pack.tenant_id,
    schemaVersion: pack.schema_definition_id,
    contributionCapabilities: c.capabilities ?? [],
    contributionServices: c.services ?? [],
    contributionAuthorityRules: c.authorityRules ?? [],
    contributionPolicies: c.policies ?? [],
    contributionQualityGates: c.qualityGates ?? [],
    contributionChecklists: c.checklists ?? [],
    contributionReviewGates: c.reviewGates ?? [],
    contributionObligationDefinitions: c.obligationDefinitions ?? [],
    contributionEngineeringCapital: c.engineeringCapital ?? [],
    contributionCompetencies: c.competencies ?? [],
    dependencies: pack.dependencies ?? [],
    compositionSources: pack.composition_sources ?? [],
    ...(pack.metadata ?? {}),
  };
}

const packAdapter = adapter<PackRow>({
  async findById(id) {
    const { data, error } = await packsDB.findById(id);
    if (error) throw error;
    return data ?? null;
  },
  getState: (row) => row.status,
  async setState(id, toState) {
    const { data, error } = await packsDB.updateStatus(id, toState as PackRow["status"]);
    if (error || !data) throw error ?? new Error(`failed to set the state of Pack ${id}`);
    return data;
  },
  async addComment(id, comment) {
    const { error } = await packsDB.addComment(id, comment);
    if (error) throw error;
  },
  tenantId: (row) => row.tenant_id,
  schemaDefinitionId: (row) => row.schema_definition_id,
  content: packContent,
  composableFields: (row) => {
    const c = packContent(row);
    return { code: c.code, category: c.category, contributionObligationDefinitions: c.contributionObligationDefinitions, contributionEngineeringCapital: c.contributionEngineeringCapital, contributionQualityGates: c.contributionQualityGates };
  },
});

// Template content is its draft content with its own columns on top. The composable fields read the draft content first
// because the catalogue column is filled when the Template is unravelled, which is after the policy runs.
const templateAdapter = adapter<TemplateRow>({
  async findById(id) {
    const { data, error } = await templatesDB.findById(id);
    if (error) throw error;
    return data ?? null;
  },
  getState: (row) => row.status,
  async setState(id, toState) {
    const { data, error } = await templatesDB.updateStatus(id, toState as TemplateRow["status"]);
    if (error || !data) throw error ?? new Error(`failed to set the state of Template ${id}`);
    return data;
  },
  async addComment(id, comment) {
    const { error } = await templatesDB.addComment(id, comment);
    if (error) throw error;
  },
  tenantId: (row) => row.tenant_id,
  schemaDefinitionId: (row) => row.schema_definition_id,
  content: (row) => ({ ...(row.draft_content ?? {}), code: row.code, name: row.name, templateVersion: row.template_version }),
  composableFields: (row) => ({ code: row.code, deliverableCatalogue: (row.draft_content as Record<string, unknown> | null)?.deliverableCatalogue ?? row.deliverable_catalogue }),
});

const profileAdapter = adapter<ProfileRow>({
  async findById(id) {
    const { data, error } = await profilesDB.findById(id);
    if (error) throw error;
    return data ?? null;
  },
  getState: (row) => row.status,
  async setState(id, toState) {
    const { data, error } = await profilesDB.updateStatus(id, toState as ProfileRow["status"]);
    if (error || !data) throw error ?? new Error(`failed to set the state of Profile ${id}`);
    return data;
  },
  async addComment(id, comment) {
    const { error } = await profilesDB.addComment(id, comment);
    if (error) throw error;
  },
  tenantId: (row) => row.tenant_id,
  schemaDefinitionId: (row) => row.schema_definition_id,
  content: (row) => ({ ...(row.draft_content ?? {}), code: row.code, name: row.name, environment: row.environment, profileVersion: row.profile_version }),
  composableFields: (row) => ({ ...(row.draft_content ?? {}), environment: row.environment }),
});

// Policy content is its draft content with its own columns on top. Policy is the entity type of a Policy Definition.
const policyAdapter = adapter<PolicyDefinitionRow>({
  async findById(id) {
    const { data, error } = await policyDefinitionsDB.findById(id);
    if (error) throw error;
    return data ?? null;
  },
  getState: (row) => row.status,
  async setState(id, toState) {
    const { data, error } = await policyDefinitionsDB.updateStatus(id, toState as PolicyDefinitionRow["status"]);
    if (error || !data) throw error ?? new Error(`failed to set the state of Policy ${id}`);
    return data;
  },
  tenantId: (row) => row.tenant_id,
  schemaDefinitionId: (row) => row.schema_definition_id,
  content: (row) => ({
    ...(row.draft_content ?? {}),
    code: row.code, name: row.name, description: row.description ?? "", category: row.category, constraintType: row.constraint_type,
    applicabilityEnvironments: row.applicability_environments, conditions: row.conditions, scope: row.scope, version: row.version,
  }),
  composableFields: (row) => ({ category: row.category, applicabilityEnvironments: row.applicability_environments }),
});

// The Deliverable Definition is the authored catalogue entry. The runtime Deliverable is a different entity and moves through the Execution Engine.
const deliverableDefinitionAdapter = adapter<DeliverableDefinitionRow>({
  async findById(id) {
    const { data, error } = await deliverableDefinitionsDB.findById(id);
    if (error) throw error;
    return data ?? null;
  },
  getState: (row) => row.status,
  async setState(id, toState) {
    const { data, error } = await deliverableDefinitionsDB.updateStatus(id, toState as DeliverableDefinitionRow["status"]);
    if (error || !data) throw error ?? new Error(`failed to set the state of DeliverableDefinition ${id}`);
    return data;
  },
  tenantId: (row) => row.tenant_id,
  schemaDefinitionId: (row) => row.schema_definition_id,
  content: (row) => ({ ...(row.draft_content ?? {}), code: row.code, description: row.description ?? "", definitionVersion: row.version }),
  composableFields: (row) => ({ code: row.code }),
});

// The Objective keeps its tenant in the sponsoring authority and its comments in the comments column.
const objectiveAdapter = adapter<ObjectiveRow>({
  async findById(id) {
    const { data, error } = await objectivesDB.findById(id);
    if (error) throw error;
    return data ?? null;
  },
  getState: (row) => row.status,
  async setState(id, toState) {
    const { data, error } = await objectivesDB.updateStatus(id, toState as ObjectiveRow["status"]);
    if (error || !data) throw error ?? new Error(`failed to set the state of Objective ${id}`);
    return data;
  },
  async addComment(id, comment) {
    const { error } = await objectivesDB.addComment(id, comment);
    if (error) throw error;
  },
  tenantId: (row) => row.sponsoring_authority?.tenant ?? null,
});

// The author id and badge of a concept stay as its creation set them, so the badge and actor are not written.
const ontologyAdapter = adapter<OntologyConceptRow>({
  async findById(id) {
    const { data, error } = await ontologyDB.findConceptById(id);
    if (error) throw error;
    return data ?? null;
  },
  getState: (row) => row.status,
  async setState(id, toState) {
    const { data, error } = await ontologyDB.updateConceptStatus(id, toState as OntologyConceptRow["status"]);
    if (error || !data) throw error ?? new Error(`failed to set the state of Ontology concept ${id}`);
    return data;
  },
  async addComment(id, comment) {
    const { error } = await ontologyDB.addConceptComment(id, comment.actorId, comment.authorityBadge, comment.text);
    if (error) throw error;
  },
  tenantId: (row) => row.tenant_id,
});

// An EBM has no tenant of its own; its tenant is its SEU's. The adapter reads it when it loads or writes the row.
type EbmAdapterRow = EbmRow & { seu_tenant_id: string | null };

async function withSeuTenant(row: EbmRow): Promise<EbmAdapterRow> {
  const { data: seu, error } = await seusDB.findById(row.seu_id);
  if (error) throw error;
  return { ...row, seu_tenant_id: seu?.tenant_id ?? null };
}

const ebmAdapter = adapter<EbmAdapterRow>({
  async findById(id) {
    const { data, error } = await ebmsDB.findById(id);
    if (error) throw error;
    return data ? withSeuTenant(data) : null;
  },
  getState: (row) => row.status,
  // The author id and badge of an EBM stay as the composition set them, so the badge and actor are not written.
  async setState(id, toState) {
    const { data, error } = await ebmsDB.updateStatus(id, toState as EbmRow["status"]);
    if (error || !data) throw error ?? new Error(`failed to set the state of EBM ${id}`);
    return withSeuTenant(data);
  },
  tenantId: (row) => row.seu_tenant_id,
});

const seuAdapter = adapter<SeuRow>({
  async findById(id) {
    const { data, error } = await seusDB.findById(id);
    if (error) throw error;
    return data;
  },
  getState: (row) => row.lifecycle_state,
  // The requester and badge of an SEU stay as the birth set them, so the badge and actor are not written.
  async setState(id, toState) {
    const { data, error } = await seusDB.updateLifecycleState(id, toState as SeuRow["lifecycle_state"]);
    if (error || !data) throw error ?? new Error(`failed to set the state of SEU ${id}`);
    return data;
  },
  tenantId: (row) => row.tenant_id,
});

const obligationAdapter = adapter<ObligationRow>({
  async findById(id) {
    const { data, error } = await obligationsDB.findById(id);
    if (error) throw error;
    return data;
  },
  getState: (row) => row.status,
  // The author and badge of an Obligation stay as the birth set them, so they are not written.
  async setState(id, toState) {
    const { data, error } = await obligationsDB.updateStatus(id, toState);
    if (error || !data) throw error ?? new Error(`failed to set the state of Obligation ${id}`);
    return data;
  },
  // An Obligation has no tenant column; its tenant is the SEU's, which the version event needs.
  async tenantId(row) {
    const { data: seu } = await seusDB.findById(row.seu_id);
    return seu?.tenant_id ?? null;
  },
  seuId: (row) => row.seu_id,
});

// A Knowledge Item records the SEU participant that took the hop; its tenant is the SEU's. Its Acquisition Scope is a
// separate lifecycle (KnowledgeScope) and is not written here.
const knowledgeAdapter = adapter<KnowledgeItemRow>({
  async findById(id) {
    const { data, error } = await knowledgeItemsDB.findById(id);
    if (error) throw error;
    return data;
  },
  getState: (row) => row.status,
  async setState(id, toState, authorityBadge, actorId) {
    const { data: current, error: findError } = await knowledgeItemsDB.findById(id);
    if (findError || !current) throw findError ?? new Error(`Knowledge Item ${id} not found`);
    const { data: participant } = await participantsDB.findBySeuIdAndParticipantMasterId(current.seu_id, actorId);
    if (!participant) throw new Error(`No participants row for participants_master ${actorId} in SEU ${current.seu_id}.`);
    const { data, error } = await knowledgeItemsDB.updateStatus(id, toState, participant.id, authorityBadge);
    if (error || !data) throw error ?? new Error(`failed to set the state of Knowledge Item ${id}`);
    return data;
  },
  async tenantId(row) {
    const { data: seu } = await seusDB.findById(row.seu_id);
    return seu?.tenant_id ?? null;
  },
  seuId: (row) => row.seu_id,
});

// A Review and a Finding keep the author the birth set. Their tenant is the SEU's. The Review outcome is written by the
// complete-review action.
const reviewAdapter = adapter<ReviewRow>({
  async findById(id) {
    const { data, error } = await reviewsDB.findById(id);
    if (error) throw error;
    return data;
  },
  getState: (row) => row.status,
  async setState(id, toState) {
    const { data, error } = await reviewsDB.updateStatus(id, toState);
    if (error || !data) throw error ?? new Error(`failed to set the state of Review ${id}`);
    return data;
  },
  async tenantId(row) {
    const { data: seu } = await seusDB.findById(row.seu_id);
    return seu?.tenant_id ?? null;
  },
  seuId: (row) => row.seu_id,
});

const findingAdapter = adapter<FindingRow>({
  async findById(id) {
    const { data, error } = await findingsDB.findById(id);
    if (error) throw error;
    return data;
  },
  getState: (row) => row.status,
  async setState(id, toState) {
    const { data, error } = await findingsDB.updateStatus(id, toState);
    if (error || !data) throw error ?? new Error(`failed to set the state of Finding ${id}`);
    return data;
  },
  async tenantId(row) {
    const { data: seu } = await seusDB.findById(row.seu_id);
    return seu?.tenant_id ?? null;
  },
  seuId: (row) => row.seu_id,
});

// A Participant's tenant is its SEU's.
const participantAdapter = adapter<ParticipantRow>({
  async findById(id) {
    const { data, error } = await participantsDB.findById(id);
    if (error) throw error;
    return data;
  },
  getState: (row) => row.state,
  async setState(id, toState) {
    const { data, error } = await participantsDB.updateStatus(id, toState);
    if (error || !data) throw error ?? new Error(`failed to set the state of Participant ${id}`);
    return data;
  },
  async tenantId(row) {
    const { data: seu } = await seusDB.findById(row.seu_id);
    return seu?.tenant_id ?? null;
  },
  seuId: (row) => row.seu_id,
});

// A Decision records the SEU participant that took the hop; its tenant is the SEU's.
const decisionAdapter = adapter<DecisionRow>({
  async findById(id) {
    const { data, error } = await decisionsDB.findById(id);
    if (error) throw error;
    return data;
  },
  getState: (row) => row.status,
  async setState(id, toState, authorityBadge, actorId) {
    const { data: current, error: findError } = await decisionsDB.findById(id);
    if (findError || !current) throw findError ?? new Error(`Decision ${id} not found`);
    const { data: participant } = await participantsDB.findBySeuIdAndParticipantMasterId(current.seu_id, actorId);
    if (!participant) throw new Error(`No participants row for participants_master ${actorId} in SEU ${current.seu_id}.`);
    const { data, error } = await decisionsDB.updateStatus(id, toState, { participantId: participant.id, authorityBadge });
    if (error || !data) throw error ?? new Error(`failed to set the state of Decision ${id}`);
    return data;
  },
  async tenantId(row) {
    const { data: seu } = await seusDB.findById(row.seu_id);
    return seu?.tenant_id ?? null;
  },
  seuId: (row) => row.seu_id,
});

// Evidence has no SEU column: its SEU is the `SEU` row of its relationships, and its tenant is that SEU's.
async function evidenceSeuId(row: EvidenceRow): Promise<string> {
  const { data: relationships, error } = await evidenceDB.findRelationshipsByEvidenceId(row.id);
  if (error) throw error;
  const seuId = relationships?.find((r) => r.related_object_type === "SEU")?.related_object_id;
  if (!seuId) throw new Error(`Evidence ${row.id} has no SEU relationship — cannot resolve a governed author for its Quality Gate evaluation`);
  return seuId;
}

const evidenceAdapter = adapter<EvidenceRow>({
  async findById(id) {
    const { data, error } = await evidenceDB.findById(id);
    if (error) throw error;
    return data;
  },
  getState: (row) => row.status,
  // The author and badge of an Evidence item stay as the birth set them, so they are not written.
  async setState(id, toState) {
    const { data, error } = await evidenceDB.updateStatus(id, toState);
    if (error || !data) throw error ?? new Error(`failed to set the state of Evidence ${id}`);
    return data;
  },
  async tenantId(row) {
    const { data: seu } = await seusDB.findById(await evidenceSeuId(row));
    return seu?.tenant_id ?? null;
  },
  seuId: evidenceSeuId,
});

const attentionItemAdapter = adapter<AttentionItemRow>({
  async findById(id) {
    const { data, error } = await attentionItemsDB.findById(id);
    if (error) throw error;
    return data;
  },
  getState: (row) => row.status,
  // The author and badge of an Attention Item stay as the birth set them, so they are not written.
  async setState(id, toState) {
    const { data, error } = await attentionItemsDB.updateStatus(id, toState);
    if (error || !data) throw error ?? new Error(`failed to set the state of AttentionItem ${id}`);
    return data;
  },
  // An Attention Item has no tenant column; its tenant is the SEU's.
  async tenantId(row) {
    const { data: seu } = await seusDB.findById(row.seu_id);
    return seu?.tenant_id ?? null;
  },
  seuId: (row) => row.seu_id,
});

// Each entity adds its adapter in its own pass.
const entityAdapters: Partial<Record<TransitionEntityType, EntityAdapter>> = {
  SchemaDefinition: schemaDefinitionAdapter,
  Capability: capabilityAdapter,
  Service: serviceAdapter,
  Pack: packAdapter,
  Template: templateAdapter,
  Profile: profileAdapter,
  Policy: policyAdapter,
  DeliverableDefinition: deliverableDefinitionAdapter,
  Objective: objectiveAdapter,
  EBM: ebmAdapter,
  SEU: seuAdapter,
  Obligation: obligationAdapter,
  Evidence: evidenceAdapter,
  AttentionItem: attentionItemAdapter,
  Decision: decisionAdapter,
  Participant: participantAdapter,
  Knowledge: knowledgeAdapter,
  Review: reviewAdapter,
  Finding: findingAdapter,
  Ontology: ontologyAdapter,
};

export function getEntityAdapter(entityType: TransitionEntityType): EntityAdapter {
  const found = entityAdapters[entityType];
  if (!found) throw new Error(`no entity adapter for ${entityType}`);
  return found;
}
