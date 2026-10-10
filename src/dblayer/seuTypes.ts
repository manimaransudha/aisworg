
export type DbResult<T> = { data: T; error?: undefined } | { data?: undefined; error: Error };

export type ObjectiveTier = "Strategic" | "Operational" | "Engineering";
export type ObjectiveStatus = "Proposed" | "Active" | "Achieved" | "Superseded" | "Retired" | "Archived" | "Reject";

export interface SponsoringAuthority {
  tenant: string | null;
  [key: string]: unknown;
}

export interface ObjectiveRow {
  id: string;
  statement: string;
  tier: ObjectiveTier;
  parent_objective_id: string | null;
  status: ObjectiveStatus;
  version: string;
  requested_by: string;
  display_id: string | null;
  next_child_seq: number;
  sponsoring_authority: SponsoringAuthority | null;
  superseding_objective_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ObjectiveCommentRow {
  id: string;
  objective_id: string;
  comment_text: string;
  actor_id: number | null;
  created_at: string;
}

export interface CapabilityRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  originating_pack_id: string | null;
  version: string;
  created_at: string;
}

export interface RequiredCapability {
  code: string;
  name: string;
  description: string | null;
}

export type ServiceStatus = "Defined" | "Published" | "Active" | "Deprecated" | "Retired" | "Archived";

export interface ServiceRow {
  id: string;
  code: string;
  providing_capability_id: string;
  name: string;
  contract_description: string;
  service_level: ServiceLevelExpectation[];
  status: ServiceStatus;
  version: string;
  is_active: boolean;
  originating_pack_id: string | null;
  author_id: string;
  author_badge: string;
  created_at: string;
}

export type PackCategory = string;
export type PackStatus = "Draft" | "Validated" | "Published" | "Active" | "Deprecated" | "Retired" | "Archived";
export type PackClassification = string;

export interface PackCommentRow {
  id: string;
  pack_id: string;
  comment_text: string;
  actor_id: number | null;
  created_at: string;
}

export interface VerifiableItemFields {
  statement?: string;
  classification?: "machine-verifiable" | "judgment" | "human-attested";
  externalEvidence?: boolean;
  prompt?: string;
  participant?: "AI" | "AI+human" | "human";
  outputContract?: "passed-failed-notes" | "assessment-acceptance";
  assurance?: string;
}

export interface ChecklistItem {
  statement: string;
  group?: string;
  configurableKey?: string;
  configurableValue?: string;
}

export interface PackContributions {
  capabilities?: Array<{ code: string }>;
  services?: Array<{ code: string; serviceLevel?: Array<{ code: string; target: number }> }>;
  authorityRules?: Array<{ code: string; governedTransition: string; authorisedRole: string }>;
  policies?: string[];
  qualityGates?: Array<{
    name: string;
    category: string;
    governedTransition: string;
    criteriaType: "no_unresolved_obligations" | "requires_accepted_evidence_or_approved_decision" | "requires_accepted_review" | "requires_active_policy";
    deliverableName?: string;
    requiredPolicyCodes?: string[];
    checklistIds?: string[];
    recommendedChecklistIds?: string[];
    applicabilityDeliverableNames?: string[];
  } & VerifiableItemFields>;
  checklists?: Array<{ name: string; description?: string; items: ChecklistItem[] }>;
  reviewGates?: Array<{ code: string; name: string; governedTransition: string; checklistIds?: string[]; recommendedChecklistIds?: string[] } & VerifiableItemFields>;
  obligationDefinitions?: Array<{ code: string; applicabilityDeliverables?: PolicyApplicabilityDeliverable[] } & ObligationDefinition & Omit<VerifiableItemFields, "statement">>;
  engineeringCapital?: Array<{ type?: string; url?: string }>;
  competencies?: Array<{ dimension?: string; value?: string }>;
}

export interface PackRow {
  id: string;
  code: string;
  name: string;
  category: PackCategory;
  pack_version: string;
  status: PackStatus;
  installation_classification: PackClassification;
  contributions: PackContributions;
  dependencies: Array<{ packCode: string; version: string; type: "required" | "optional" | "conditional" | "incompatible" }>;
  composition_sources: Array<{ packCode: string }>;
  metadata: Record<string, unknown>;
  authored_by: string;
  author_badge: string;
  tenant_id: string;
  created_at: string;
  schema_definition_id: string | null;
}

export interface TemplateDeliverableSeed {
  code: string;
}

export type DependencyRelationshipKind = "dependency" | "derivation" | "implementation" | "decomposition";

export interface TemplateDependencyGraphEntry {
  toCode: string;
  fromType: "Deliverable" | "Capability";
  fromCode?: string;
  fromCapabilityCode?: string;
  requiredState?: string;
  relationshipKind?: DependencyRelationshipKind;
}

export interface TemplateRow {
  id: string;
  code: string;
  name: string;
  template_version: string;
  status: PackStatus;
  parent_template_id: string | null;
  deliverable_catalogue: TemplateDeliverableSeed[];
  authored_by: string;
  author_badge: string;
  draft_content: Record<string, unknown>;
  tenant_id: string;
  schema_definition_id: string | null;
  created_at: string;
}

export interface DeliverableDefinitionRow {
  id: string;
  code: string;
  description: string | null;
  version: string;
  status: PackStatus;
  draft_content: Record<string, unknown>;
  authored_by: string;
  author_badge: string;
  tenant_id: string;
  parent_deliverable_definition_id: string | null;
  created_at: string;
  schema_definition_id: string | null;
}

export type ServiceDefinitionStatus = "Defined" | "Published" | "Active" | "Deprecated" | "Retired" | "Archived";

export interface ServiceLevelExpectation {
  code: string;
  label: string;
  target_level: "minimum" | "maximum" | "exact";
  target: number;
  units: string;
}

export interface ServiceDefinitionRow {
  id: string;
  code: string;
  name: string;
  capability_code: string;
  purpose: string | null;
  inputs: string[];
  outputs: string[];
  service_level: ServiceLevelExpectation[];
  governance: string | null;
  success: string | null;
  consumers: string[];
  version: string;
  status: ServiceDefinitionStatus;
  draft_content: Record<string, unknown>;
  authored_by: string;
  author_badge: string;
  tenant_id: string;
  parent_service_definition_id: string | null;
  created_at: string;
  schema_definition_id: string | null;
}

export type CapabilityDefinitionStatus = "Defined" | "Published" | "Active" | "Deprecated" | "Retired" | "Archived";

export interface CapabilityRole {
  name: string;
  worktypes: string[];
}

export interface CapabilityDefinitionRow {
  id: string;
  code: string;
  default_label: string;
  description: string | null;
  roles: CapabilityRole[];
  version: string;
  status: CapabilityDefinitionStatus;
  draft_content: Record<string, unknown>;
  authored_by: string;
  author_badge: string;
  tenant_id: string;
  parent_capability_definition_id: string | null;
  created_at: string;
  schema_definition_id: string | null;
}

export type PolicyDefinitionStatus = "Draft" | "Validated" | "Published" | "Active" | "Deprecated" | "Retired" | "Archived";

export interface EvidenceDefinition {
  title: string;
  category: string;
  description: string;
  collectionMethod: string;
}

export interface ObligationDefinition {
  category: string;
  title: string;
  description: string;
  origin: string;
  priority: string;
  severity: string;
  completionCriteria: string;
  requiredEvidence: EvidenceDefinition;
}

export type PolicyRelatedObligation = ObligationDefinition;

export interface PolicyExceptionRule {
  identifier: string;
  exceptionStatement: string;
  duration: string;
  exceptionScope: string;
  exceptionApprovers: string[];
  exceptionComposition: "all" | "any" | "";
  reviewRequirements: string;
}

export interface PolicyApplicabilityDeliverable {
  name: string;
  transitions: string[];
  governingCondition: Record<string, unknown> | null;
}

export interface PolicyCondition {
  statement: string;
  severity: string;
  applicabilityDeliverables: PolicyApplicabilityDeliverable[];
  requiredEvidence: EvidenceDefinition;
  relatedObligations: PolicyRelatedObligation[];
  exceptionRules: PolicyExceptionRule[];
}

export interface PolicyDefinitionRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  constraint_type: "Policy" | "Standard";
  applicability_environments: string[];
  conditions: PolicyCondition[];
  scope: PolicyScope;
  version: string;
  status: PolicyDefinitionStatus;
  draft_content: Record<string, unknown>;
  authored_by: string;
  author_badge: string;
  tenant_id: string;
  parent_policy_definition_id: string | null;
  created_at: string;
  schema_definition_id: string | null;
}

export interface ProfileRow {
  id: string;
  code: string;
  name: string;
  base_template_id: string;
  config_parameters: Record<string, unknown>;
  environment: string;
  status: PackStatus;
  authored_by: string;
  author_badge: string;
  draft_content: Record<string, unknown>;
  profile_version: string;
  tenant_id: string;
  parent_profile_id: string | null;
  category: string | null;
  schema_definition_id: string | null;
  created_at: string;
}

export type EbmStatus = "Composed" | "Validated" | "Active" | "Superseded" | "Retired";

export interface EbmComposedPack {
  packId: string;
  packCode: string;
  packVersion: string;
}

export interface ParameterConflictOption {
  profileId: string;
  profileCode: string;
  profileName: string;
  value: string;
}
export interface ParameterConflict {
  key: string;
  sourceType: "service" | "policy" | "checklist" | "dependency";
  sourceCode: string;
  parameterName: string;
  options: ParameterConflictOption[];
}

export interface EbmCompositionReport {
  warnings: string[];
  conflicts: string[];
  parameterConflicts: ParameterConflict[];
  resolutions: string[];
}

export interface EbmRow {
  id: string;
  seu_id: string;
  template_id: string;
  profile_id: string;
  composed_packs: EbmComposedPack[];
  composition_report: EbmCompositionReport;
  status: EbmStatus;
  version: number;
  behaviors: Record<string, unknown> | null;
  applicable_quality_gate_ids: string[];
  applicable_policy_ids: string[];
  seu_scoped_policy_ids: string[];
  created_at: string;
}

export type SeuLifecycleState =
  | "Pending"
  | "Commissioned"
  | "Configured"
  | "Activated"
  | "Operational"
  | "Suspended"
  | "Retired"
  | "Archived"
  | "Failed";

export interface CommissioningReport {
  identity: { seuId: string; templateCode: string; profileCode: string; templateCodes: string[]; profileCodes: string[]; ebmId: string };
  composition: { packsUsed: string[]; warnings: string[]; conflicts: string[] };
  validation: { errors: string[] };
  runtime: { initialCapabilities: string[]; initialDeliverables: string[] };
}

export interface SeuRow {
  id: string;
  objective_id: string;
  template_id: string;
  profile_id: string;
  tenant_id: string | null;
  active_ebm_id: string | null;
  lifecycle_state: SeuLifecycleState;
  requested_by: string | null;
  commissioning_report: CommissioningReport | Record<string, never>;
  composition_report: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export type SeuCapabilityStatus = "Unfulfilled" | "Fulfilled";

export interface SeuCapabilityRow {
  id: string;
  seu_id: string;
  capability_id: string;
  status: SeuCapabilityStatus;
}

export type ParticipantType = string;
export type ParticipantState = "Created" | "Available" | "Assigned" | "Executing" | "Idle" | "Released" | "Archived";

export interface ParticipantRow {
  id: string;
  seu_id: string;
  type: ParticipantType;
  display_name: string;
  state: ParticipantState;
  participant_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParticipantMasterRow {
  id: string;
  tenant_id: string;
  type: ParticipantType;
  display_name: string;
  capabilities: string[];
  competency: Record<string, Array<{ code: string; proficiency: string }>>;
  cost: number | null;
  behaviour_context: Array<{ policy: string; payload: Record<string, unknown> }>;
  authorised_role: Array<{ role: string; effective_till: string; seu_ids: string[] }>;
  authorised_badges: Array<{ badge: string; effective_till: string; seu_ids: string[] }>;
  is_active: boolean;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export type FulfilmentStrategy = ParticipantType | "Hybrid" | "Composite";

export interface CapabilityFulfilmentRow {
  id: string;
  seu_capability_id: string;
  participant_id: string;
  fulfilment_strategy: FulfilmentStrategy;
  established_at: string;
  revoked_at: string | null;
  author_id: string;
  author_badge: string;
}

export type AcquisitionScope = "SEU" | "Capability" | "Enterprise" | "Platform";

export interface DeliverableRow {
  id: string;
  seu_id: string;
  name: string;
  category: string | null;
  code: string | null;
  lifecycle_state: string;
  acceptance_criteria: unknown[];
  acquisition_scope: AcquisitionScope;
  producing_capability_id: string | null;
  created_at: string;
  updated_at: string;
}

export type DependencyType = "Deliverable" | "Capability";
export type ReadinessState = "Unknown" | "Pending" | "Satisfied" | "Blocked";

export type DependencyDefinitionEntityType = TransitionEntityType | "Capability";

export type DependencyDefinitionOwnerType = "Template" | "Pack" | "Profile";

export interface DependencyDefinitionRow {
  id: string;
  owning_entity_type: DependencyDefinitionOwnerType;
  owning_entity_id: string;
  from_entity_type: DependencyDefinitionEntityType;
  from_name: string | null;
  from_state: string;
  to_entity_type: DependencyDefinitionEntityType;
  to_name: string;
  to_state: string;
  relationship_kind: DependencyRelationshipKind;
  created_at: string;
}

export interface AuthorityRuleRow {
  id: string;
  code: string;
  governed_transition: string;
  authorised_role: string;
  originating_pack_id: string | null;
  created_at: string;
  required_badge_type: string | null;
  required_rank: number | null;
}

export type ConstraintType = "Policy" | "Standard";

export type PolicyScope = "Transition" | "Eligibility";

export interface PolicyRow {
  id: string;
  code: string;
  name: string;
  category: string;
  constraint_type: ConstraintType;
  scope: PolicyScope;
  governed_transition: string | null;
  condition: Record<string, unknown>;
  severity: string;
  originating_pack_id: string | null;
  applicability_deliverable_names: string[];
  created_at: string;
}

export type TransitionEntityType =
  | "SEU"
  | "Deliverable"
  | "Objective"
  | "Obligation"
  | "Evidence"
  | "Knowledge"
  | "Decision"
  | "KnowledgeScope"
  | "AttentionItem"
  | "ExternalInteraction"
  | "Pack"
  | "Participant"
  | "Review"
  | "Finding"
  | "Template"
  | "Profile"
  | "Service"
  | "Policy"
  | "Capability"
  | "EBM"
  | "Ontology"
  | "SchemaDefinition";

export interface TransitionDefinitionRow {
  id: string;
  entity_type: TransitionEntityType;
  from_state: string;
  to_state: string;
  required_authority_rule_id: string | null;
  required_policy_ids: string[];
  category: string | null;
  required_quality_gate_ids: string[];
  creates_obligation: string | null;
  verb: string | null;
  is_active: boolean;
  retired_at: string | null;
  trigger: "manual" | "governed";
  submit_verb: string | null;
  event_type: string | null;
  version_event: string | null;
  submit_version_event: string | null;
}

export type GovernedEntityType = TransitionEntityType;
export type GovernanceOutcome = "Approved" | "Approved-with-Conditions" | "Deferred" | "Rejected" | "Escalated" | "Waived";
export type QualityGateOutcomeCode = "Passed" | "NotApplicable" | "Waived";

export interface GovernanceEvaluationOutcomeRow {
  id: string;
  seu_id: string;
  entity_type: GovernedEntityType;
  entity_id: string;
  from_state: string;
  to_state: string;
  outcome: GovernanceOutcome;
  rationale: string;
  quality_gate_id: string | null;
  quality_gate_outcome: QualityGateOutcomeCode | null;
  applicable_authority_rule_id: string | null;
  satisfied_policy_ids: string[];
  deviated_policy_ids: string[];
  consulted_obligation_ids: string[];
  open_attention_item_ids: string[];
  originating_pack_id: string | null;
  author_id: string;
  author_badge: string;
  evaluated_at: string;
  created_at: string;
}

export type GovernanceEvaluationOutcomeInput = Omit<GovernanceEvaluationOutcomeRow, "id" | "created_at" | "evaluated_at">;

export type GovernanceEvaluationOutcomeDraft = Omit<GovernanceEvaluationOutcomeInput, "author_id" | "author_badge">;

export type CommandStatus = "Generated" | "Dispatched" | "Completed" | "Deferred" | "Cancelled" | "Failed";

export interface CommandRow {
  id: string;
  seu_id: string;
  entity_type: TransitionEntityType;
  entity_id: string;
  command_type: string;
  from_state: string;
  to_state: string;
  status: CommandStatus;
  requested_by: string;
  acting_badge_type: string | null;
  correlation_id: string;
  governance_outcome_id: string | null;
  eligible_participant_pool_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CapabilityFulfilmentPoolRow {
  id: string;
  seu_id: string;
  seu_capability_id: string | null;
  capability_id: string | null;
  participant_ids: string[];
  resolved_at: string;
  author_id: string;
  author_badge: string;
}

export interface DeliverableReferenceRow {
  id: string;
  seu_id: string;
  deliverable_id: string;
  work_item_id: string;
  participant_id: string | null;
  from_state: string;
  to_state: string;
  reference: string | null;
  author_id: string;
  author_badge: string;
  created_at: string;
}

export interface OutstandingWorkItemDetail {
  id: string;
  seu_id: string;
  deliverable_id: string;
  deliverable_name: string;
  producing_capability_id: string | null;
  from_state: string;
  to_state: string;
  participant_id: string | null;
  target_completion_at: string | null;
  created_at: string;
}

export type ExecutionMode = "human-on-ui" | "external-orchestrator";

export interface ExecutionTargetRow {
  id: string;
  tenant_id: string;
  capability_id: string;
  mode: ExecutionMode;
  adapter_endpoint: string | null;
  adapter_auth_ref: string | null;
  created_at: string;
  updated_at: string;
}

export interface OntologyConceptRow {
  id: string;
  concept_type: string;
  code: string;
  default_label: string;
  description: string | null;
  text_type: "text" | "markdown";
  ui_grouping: string | null;
  contributed_by_pack: string | null;
  version: string;
  status: "Draft" | "Active" | "Deprecated" | "Retired" | "Archived";
  composition_strategy: "specialization" | "override" | null;
  composition_sources: Array<{ conceptId: string; code: string }>;
  tenant_id: string;
  created_at: string;
  is_mandatory: boolean | null;
  author_id: string;
  author_badge: string;
}

export interface OntologyConceptCommentRow {
  id: string;
  concept_id: string;
  comment_text: string;
  actor_id: number | null;
  created_at: string;
}

export interface TenantConceptAliasRow {
  id: string;
  tenant_id: string;
  concept_type: string;
  canonical_code: string;
  display_label: string;
  created_at: string;
  updated_at: string;
}

export type ComplianceStatus = "Compliant" | "Compliant with Exceptions" | "Partially Compliant" | "Non-Compliant" | "Compliance Unknown";

export interface ComplianceFrameworkRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  originating_pack_id: string | null;
  created_at: string;
}

export interface ComplianceRequirementRow {
  id: string;
  code: string;
  framework_code: string;
  name: string;
  description: string | null;
  criteria: Record<string, unknown>;
  severity: string;
  conflicts_with: string[];
  originating_pack_id: string | null;
  created_at: string;
}

export interface ComplianceWaiverRow {
  id: string;
  seu_id: string;
  requirement_code: string;
  rationale: string;
  granted_by: number | null;
  status: string;
  expires_at: string | null;
  created_at: string;
}

export interface ComplianceEvaluationRow {
  id: string;
  seu_id: string;
  status: ComplianceStatus;
  rationale: Record<string, unknown>;
  results: unknown[];
  created_at: string;
}

export type ReviewOutcome = "Passed" | "Passed with Recommendations" | "Rework Required" | "Failed" | "Not Applicable" | "Deferred";

export interface ReviewRow {
  id: string;
  seu_id: string;
  related_object_type: TransitionEntityType;
  related_object_id: string;
  category: string;
  name: string;
  criteria: Record<string, unknown>;
  outcome: ReviewOutcome | null;
  status: string;
  reviewer: string | null;
  version: number;
  review_gate_id: string | null;
  author_id: string;
  author_badge: string;
  created_at: string;
  updated_at: string;
}

export interface FindingRow {
  id: string;
  review_id: string;
  seu_id: string;
  related_object_type: TransitionEntityType;
  related_object_id: string;
  severity: string;
  title: string;
  description: string | null;
  status: string;
  obligation_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantRow {
  id: string;
  code: string;
  name: string;
  created_at: string;
}

export interface TenantContractRow {
  id: string;
  tenant_id: string;
  vcs_binding: Record<string, unknown>;
  callback_auth: Record<string, unknown>;
  attestation_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AttestationRow {
  id: string;
  seu_id: string;
  deliverable_id: string;
  work_item_id: string;
  participant_id: string | null;
  from_state: string;
  to_state: string;
  reference: string | null;
  acting_badge_type: string | null;
  requested_by: string | null;
  created_at: string;
}

export type WorkItemStatus = "Generated" | "Assigned" | "Dispatched" | "Executing" | "Completed" | "Failed" | "Cancelled" | "Disposed";

export interface WorkItemRow {
  id: string;
  command_id: string;
  participant_id: string | null;
  status: WorkItemStatus;
  dispatch_strategy: string | null;
  dispatch_attempts: number;
  output_reference: string | null;
  target_completion_at: string | null;
  execution_context: WorkItemExecutionContext | null;
  created_at: string;
  updated_at: string;
}

export interface WorkItemExecutionContext {
  engineeringObjective: string;
  relevantDeliverable: { id: string; name: string; lifecycleState: string };
  service: { capabilityId: string; code: string; name: string } | null;
  inputLocation: string | null;
  outputLocation: string | null;
  relevantDecisions: Array<{ id: string; title: string; engineeringQuestion: string | null; status: string }>;
  supportingEvidence: Array<{ id: string; title: string; status: string; confidenceLevel: string | null }>;
  relevantKnowledge: Array<{ id: string; title: string; status: string }>;
  governingPolicies: Array<{ id: string; code: string; name: string }>;
  applicableAuthority: { ruleId: string; code: string } | null;
  activeObligations: Array<{ id: string; title: string; status: string }>;
  openAttentionItems: Array<{ id: string; title: string; status: string }>;
  qualityGate: { id: string; name: string; outcome: string } | null;
  applicableChecklists: Array<{ packCode: string; checklistName: string; statement: string }>;
  engineeringCapital: Array<{ packCode: string; type?: string; url?: string }>;
  profileConfiguration: Partial<{
    developmentMethodology: string; environment: string; primaryProgrammingLanguage: string; sourceControlProvider: string;
    targetCloudProvider: string; deploymentStrategy: string; aiProviderPreference: string; defaultRepositoryStructure: string;
    documentationLevel: string; readme: string; domain: string; participatingOrganisationCodes: string[];
    environmentConfiguration: unknown; deploymentTargets: unknown;
  }>;
}

export type EventConsumptionStatus = "pending" | "consumed" | "failed";
export interface EventConsumptionEntry {
  status: EventConsumptionStatus;
  consumedAt: string | null;
  error?: string;
}

export interface EventRow {
  id: string;
  event_type: string;
  originating_object_type: string;
  originating_object_id: string;
  seu_id: string | null;
  correlation_id: string;
  causation_id: string | null;
  payload: Record<string, unknown>;
  actor_id: string;
  authority_badge: string;
  occurred_at: string;
  sequence: string;
  consumption_state: Record<string, EventConsumptionEntry>;
}

export interface VersionEventRow {
  id: string;
  event_id: string;
  tenant_id: string;
  entity_type: string;
  entity_id: string;
  from_state: string | null;
  to_state: string | null;
  version_event: string;
  occurred_at: string;
  actor_id: string;
  authority_badge: string | null;
}

export interface EventSubscriptionRow {
  event_type: string;
  handler_name: string;
}

export interface ObligationRow {
  id: string;
  seu_id: string;
  related_object_type: TransitionEntityType;
  related_object_id: string;
  category: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  origin: string | null;
  priority: string | null;
  completion_criteria: string | null;
  blocked_from_state: string | null;
  blocked_to_state: string | null;
  version: number;
  originating_entity_type: string | null;
  originating_entity_id: string | null;
  assigned_entity_type: string | null;
  assigned_entity_id: string | null;
  revision_history: Array<Record<string, unknown>>;
  author_id: string;
  author_badge: string;
  created_at: string;
  updated_at: string;
}

export type QualityGateOutcomeValue = "Passed" | "Passed with Conditions" | "Blocked" | "Waived" | "Deferred" | "Not Applicable";

export interface QualityGateRow {
  id: string;
  code: string;
  name: string;
  category: string;
  entity_type: TransitionEntityType;
  from_state: string;
  to_state: string;
  criteria: Record<string, unknown>;
  originating_pack_id: string | null;
  version: string;
  is_active: boolean;
  created_at: string;
  checklist_ids: string[];
  recommended_checklist_ids: string[];
  applicability_deliverable_names: string[];
}

export interface ReviewGateRow {
  id: string;
  code: string;
  name: string;
  entity_type: TransitionEntityType;
  from_state: string;
  to_state: string;
  originating_pack_id: string | null;
  version: string;
  is_active: boolean;
  checklist_ids: string[];
  recommended_checklist_ids: string[];
  created_at: string;
}

export interface ChecklistRow {
  id: string;
  name: string;
  description: string | null;
  originating_pack_id: string;
  items: ChecklistItem[];
  created_at: string;
  updated_at: string;
  author_id: string;
  author_badge: string;
}

export interface QualityGateEvaluationRow {
  id: string;
  quality_gate_id: string;
  seu_id: string;
  entity_type: string;
  entity_id: string;
  outcome: QualityGateOutcomeValue;
  detail: Record<string, unknown>;
  evaluated_at: string;
}

export interface QualityGateWaiverRow {
  id: string;
  quality_gate_id: string;
  seu_id: string;
  entity_type: string;
  entity_id: string;
  rationale: string;
  granted_by: number | null;
  authority_badge: string;
  status: "Active" | "Expired" | "Revoked";
  expires_at: string | null;
  created_at: string;
}

export interface EvidenceValidationAssessment {
  dimension: string;
  status: string;
  notes: string | null;
  assessedAt: string;
}

export interface EvidenceRow {
  id: string;
  category: string;
  title: string;
  description: string | null;
  source: string | null;
  confidence_level: string | null;
  status: string;
  validation_dimensions: EvidenceValidationAssessment[];
  supersedes_evidence_id: string | null;
  author_id: string;
  author_badge: string;
  created_at: string;
  updated_at: string;
}

export interface EvidenceRelationshipRow {
  id: string;
  evidence_id: string;
  related_object_type: TransitionEntityType;
  related_object_id: string;
  author_id: string;
  author_badge: string;
  created_at: string;
}

export interface KnowledgeRelationshipReferences {
  "derives from"?: string[];
  supports?: string[];
  contradicts?: string[];
  refines?: string[];
  references?: string[];
  "depends upon"?: string[];
}
export interface KnowledgeSelfReferences extends KnowledgeRelationshipReferences {
  supersedes?: string[];
}

export interface KnowledgeItemRow {
  id: string;
  seu_id: string;
  deliverable_id: string;
  deliverable_references: KnowledgeRelationshipReferences;
  evidence_references: KnowledgeRelationshipReferences;
  decision_references: KnowledgeRelationshipReferences;
  knowledge_references: KnowledgeSelfReferences;
  category: string;
  title: string;
  description: string | null;
  acquisition_scope: AcquisitionScope;
  status: string;
  version: string;
  confidence_level: string | null;
  author_id: string | null;
  authority_badge: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeValidationNoteRow {
  id: string;
  knowledge_item_id: string;
  note_text: string;
  actor_id: number | null;
  created_at: string;
}

export interface EngineeringCapitalRow extends KnowledgeItemRow {
  deliverable_name: string;
  capability_code: string | null;
  capability_name: string | null;
  objective_statement: string;
}

export interface DecisionRelatedObjectGroup {
  related_object_type: string;
  related_object_ids: string[];
}

export interface DecisionAlternative {
  statement: string;
  assumptions: string[];
  consequences: string[];
  status: string;
  rationale: string | null;
}

export interface DecisionRow {
  id: string;
  seu_id: string;
  originating_type: string | null;
  originating_id: string | null;
  related_objects: DecisionRelatedObjectGroup[];
  related_seu: DecisionRelatedObjectGroup[];
  knowledge_ids: string[];
  evidence_ids: string[];
  alternatives: DecisionAlternative[];
  participant_id: string | null;
  authority_badge: string | null;
  category: string;
  title: string;
  engineering_question: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DeliverableCycleTimeRow {
  id: string;
  name: string;
  seu_id: string;
  lifecycle_state: string;
  created_at: string;
  last_transition_at: string;
  cycle_time_seconds: number;
}

export interface QualityGateLatencyRow {
  quality_gate_id: string;
  gate_name: string;
  entity_id: string;
  seu_id: string;
  first_blocked_at: string | null;
  passed_at: string;
  latency_seconds: number;
}

export interface AttentionItemRow {
  id: string;
  seu_id: string;
  category: string;
  priority: string;
  title: string;
  description: string | null;
  related_object_type: string | null;
  related_object_id: string | null;
  triggering_event_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export type InteractionDirection = "Inbound" | "Outbound";

export interface ExternalInteractionRow {
  id: string;
  seu_id: string;
  deliverable_id: string | null;
  interaction_type: string;
  direction: InteractionDirection;
  target_system: string;
  purpose: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  author_id: string;
  author_badge: string;
}

export interface TenantRow {
  id: string;
  code: string;
  name: string;
  status: string;
  is_system: boolean;
  author_id: string;
  author_badge: string;
  created_at: string;
}

export type BadgeScopeKind = "None" | "Tenant" | "SEU" | "Pack" | "SEU_or_Pack";

export interface BadgeTypeRow {
  id: string;
  tenant_id: string | null;
  code: string;
  name: string;
  scope_kind: BadgeScopeKind;
  derived_from: string | null;
  tiered: boolean;
  is_registration_default: boolean;
  created_at: string;
}

export interface CanonicalRankRow {
  rank: number;
  name: string;
}

export interface BadgeTierRow {
  id: string;
  tenant_id: string | null;
  code: string;
  name: string;
  rank: number;
  created_at: string;
}

export type SchemaDefinitionEntityKind = "Pack" | "Template" | "Profile" | "TransitionDefinition" | "Deliverable" | "Service" | "Policy" | "Capability";

export interface SchemaDefinitionRow {
  id: string;
  entity_kind: SchemaDefinitionEntityKind;
  version: number;
  schema: Record<string, unknown>;
  compatible_versions: number[];
  incompatible_versions: number[];
  created_at: string;
  lifecycle_state: "Created" | "Validated" | "Tested" | "Packaged" | "Published" | "PublicationRejected";
  author_id: string | null;
  author_badge: string | null;
}

export interface DeliverableAuthoringContentRow {
  id: string;
  deliverable_id: string;
  schema_definition_id: string;
  content: Record<string, unknown>;
  author_id: string;
  author_badge: string;
  updated_at: string;
}

export type TelemetryCategory = "Flow" | "Governance" | "Runtime" | "Knowledge" | "Quality" | "Collaboration";
export type MetricAggregationStrategy = "Average" | "Count" | "Rate" | "Distribution";

export interface DispatchLatencyRow {
  command_id: string;
  seu_id: string;
  command_type: string;
  generated_at: string;
  dispatched_at: string;
  latency_seconds: number;
}

export interface ReworkRow {
  entity_type: string;
  entity_id: string;
  seu_id: string;
  blocked_count: number;
}

export interface WorkItemDurationRow {
  work_item_id: string;
  seu_id: string;
  started_at: string;
  completed_at: string;
  duration_seconds: number;
}

export interface MetricDefinitionRow {
  id: string;
  identifier: string;
  name: string;
  description: string | null;
  category: TelemetryCategory;
  unit_of_measure: string;
  aggregation_strategy: MetricAggregationStrategy;
  calculation_method: string;
  version: number;
  originating_pack_id: string | null;
  created_at: string;
}
