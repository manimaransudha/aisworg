// Shared row types + enums for the SEU platform tables (002_seu_platform.sql).
// One file so dblayer/, routes/seu/core/ and domain/engine/ agree on shape
// without every dblayer file redeclaring the same enums.

export type DbResult<T> = { data: T; error?: undefined } | { data?: undefined; error: Error };

export type ObjectiveTier = "Strategic" | "Operational" | "Engineering";
export type ObjectiveStatus = "Proposed" | "Active" | "Achieved" | "Superseded" | "Retired" | "Archived";

export interface ObjectiveRow {
  id: string;
  statement: string;
  tier: ObjectiveTier;
  parent_objective_id: string | null;
  status: ObjectiveStatus;
  version: number;
  requested_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface CapabilityRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  originating_pack_id: string | null;
  version: number;
  created_at: string;
}

export type ServiceStatus = "Defined" | "Published" | "Active" | "Deprecated" | "Retired" | "Archived";

export interface ServiceRow {
  id: string;
  providing_capability_id: string;
  name: string;
  contract_description: string;
  service_level: Record<string, unknown>;
  status: ServiceStatus;
  version: number;
  originating_pack_id: string | null;
  created_at: string;
}

export type PackCategory = "Platform" | "Organisation" | "Domain" | "Compliance" | "Technology" | "Integration";
export type PackStatus = "Draft" | "Validated" | "Published" | "Active" | "Deprecated" | "Retired" | "Archived";
export type PackClassification = "Mandatory" | "Recommended" | "Optional" | "Conditional";

export interface PackContributions {
  capabilities?: Array<{ code: string; name: string; description?: string; category?: string }>;
  services?: Array<{ capabilityCode: string; name: string; contractDescription: string; serviceLevel?: Record<string, unknown> }>;
  authorityRules?: Array<{ code: string; governedTransition: string; authorisedRole: string }>;
  policies?: Array<{
    code: string;
    name: string;
    category?: string;
    constraintType?: "Policy" | "Standard";
    governedTransition: string;
    condition?: Record<string, unknown>;
    severity?: string;
  }>;
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
  dependencies: Array<{ packCode: string; version: string; type: "required" }>;
  created_at: string;
}

export interface TemplateDeliverableSeed {
  code: string;
  name: string;
  category: string;
  producingCapabilityCode?: string;
  dependsOnDeliverableCodes?: string[]; // other codes within the same catalogue, required state 'Approved'
}

export interface TemplateRow {
  id: string;
  code: string;
  name: string;
  template_version: number;
  status: PackStatus;
  parent_template_id: string | null;
  deliverable_catalogue: TemplateDeliverableSeed[];
  created_at: string;
}

export interface ProfileRow {
  id: string;
  code: string;
  name: string;
  base_template_id: string;
  config_parameters: Record<string, unknown>;
  environment: string;
  status: PackStatus;
  created_at: string;
}

export type EbmStatus = "Composed" | "Active" | "Superseded";

export interface EbmComposedPack {
  packId: string;
  packCode: string;
  packVersion: string;
}

export interface EbmCompositionReport {
  warnings: string[];
  conflicts: string[];
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
  | "Archived";

export interface CommissioningReport {
  identity: { seuId: string; templateCode: string; profileCode: string; ebmId: string };
  composition: { packsUsed: string[]; warnings: string[]; conflicts: string[] };
  validation: { errors: string[] };
  runtime: { initialCapabilities: string[]; initialDeliverables: string[] };
}

export interface SeuRow {
  id: string;
  objective_id: string;
  template_id: string;
  profile_id: string;
  active_ebm_id: string | null;
  lifecycle_state: SeuLifecycleState;
  requested_by: number | null;
  commissioning_report: CommissioningReport | Record<string, never>;
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

export type ParticipantType = "AI" | "Human" | "External";
export type ParticipantState = "Created" | "Available" | "Assigned" | "Executing" | "Idle" | "Released" | "Archived";

export interface ParticipantRow {
  id: string;
  seu_id: string;
  type: ParticipantType;
  display_name: string;
  state: ParticipantState;
  created_at: string;
}

export type FulfilmentStrategy = "AI" | "Human" | "External" | "Hybrid" | "Composite";

export interface CapabilityFulfilmentRow {
  id: string;
  seu_capability_id: string;
  participant_id: string;
  fulfilment_strategy: FulfilmentStrategy;
  established_at: string;
  revoked_at: string | null;
}

export type AcquisitionScope = "SEU" | "Capability" | "Enterprise" | "Platform";

export interface DeliverableRow {
  id: string;
  seu_id: string;
  name: string;
  category: string;
  lifecycle_state: string; // not a fixed union — see Build Plan §2.3, validated by transitionEngine, not the DB
  acceptance_criteria: unknown[];
  acquisition_scope: AcquisitionScope;
  producing_capability_id: string | null;
  created_at: string;
  updated_at: string;
}

export type DependencyType = "Deliverable" | "Capability";
export type ReadinessState = "Unknown" | "Pending" | "Satisfied" | "Blocked";

export interface DependencyEdgeRow {
  id: string;
  seu_id: string;
  from_deliverable_id: string;
  dependency_type: DependencyType;
  to_deliverable_id: string | null;
  to_service_id: string | null;
  required_state: string | null;
  readiness_state: ReadinessState;
}

export interface AuthorityRuleRow {
  id: string;
  code: string;
  governed_transition: string;
  authorised_role: string;
  originating_pack_id: string | null;
  created_at: string;
}

export type ConstraintType = "Policy" | "Standard";

export interface PolicyRow {
  id: string;
  code: string;
  name: string;
  category: string;
  constraint_type: ConstraintType;
  governed_transition: string;
  condition: Record<string, unknown>;
  severity: string;
  originating_pack_id: string | null;
  created_at: string;
}

export type TransitionEntityType = "SEU" | "Deliverable" | "Objective";

export interface TransitionDefinitionRow {
  id: string;
  entity_type: TransitionEntityType;
  from_state: string;
  to_state: string;
  required_authority_rule_id: string | null;
  required_policy_ids: string[];
}

export interface EventRow {
  id: string;
  event_type: string;
  originating_object_type: string;
  originating_object_id: string;
  correlation_id: string;
  causation_id: string | null;
  payload: Record<string, unknown>;
  occurred_at: string;
  sequence: string; // BIGSERIAL comes back as string via pg's default int8 handling
}
