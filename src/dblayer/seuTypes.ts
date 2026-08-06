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
  code: string;
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
  services?: Array<{ code: string; capabilityCode: string; name: string; contractDescription: string; serviceLevel?: Record<string, unknown> }>;
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
  // Post-MVP Phase 4 (Ch.26 FR-26.2: "Quality Gates shall be contributed
  // through Packs"). entityType/fromState/toState scope the gate to one
  // specific governed transition, same granularity as transition_definitions.
  qualityGates?: Array<{
    code: string;
    name: string;
    category?: string;
    entityType: TransitionEntityType;
    fromState: string;
    toState: string;
    criteria?: Record<string, unknown>;
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
  // Post-MVP Phase 2 (Ch.9 §8 / Ch.11 §9): capability codes whose declared
  // Service this Deliverable depends on — distinct from dependsOnDeliverableCodes.
  // A Deliverable edge asks "is the upstream artefact in the right state?"; a
  // Capability edge asks "is anyone actually assigned to that upstream
  // Capability for this SEU?" Both can be true for the same pair of Deliverables.
  dependsOnCapabilityServiceCodes?: string[];
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
  // SDK UI Layer Plan ("SEU Registry visibility") — nullable, AI/External
  // participants aren't real accounts. Stopgap ahead of real Participant
  // deployment; lets the Registry filter to "SEUs I'm a Participant on."
  user_id: number | null;
  created_at: string;
  updated_at: string;
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
  // Phase 10 (badge model, design/mvp-build-plan/Phase 10 - User Management
  // and Dual Authority Design.md §9) — replaces authorised_role for
  // migrated entity types. Deliverable is the first; authorised_role stays
  // live for everything not yet migrated.
  required_badge_type: string | null;
  required_rank: number | null;
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
  | "Participant";

export interface TransitionDefinitionRow {
  id: string;
  entity_type: TransitionEntityType;
  from_state: string;
  to_state: string;
  required_authority_rule_id: string | null;
  required_policy_ids: string[];
  // SDK UI Layer Plan — reference only, never read by transitionEngine or
  // qualityGateEngine (forking the lookup key by category was considered and
  // rejected; Quality Gates apply uniformly regardless of category).
  category: string | null;
  // SDK UI Layer Plan, Transition Definition section — explicit references,
  // opt-in per row (default []), read by transitionEngine.evaluate itself.
  required_quality_gate_ids: string[];
  // An Obligation category to raise on a successful transition, or null for
  // none ("creates, does not block"). Stored; not yet mechanically enforced.
  creates_obligation: string | null;
}

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
  requested_by: number | null;
  correlation_id: string;
  created_at: string;
  updated_at: string;
}

export type WorkItemStatus = "Generated" | "Assigned" | "Executing" | "Completed" | "Cancelled" | "Disposed";

export interface WorkItemRow {
  id: string;
  command_id: string;
  participant_id: string | null;
  status: WorkItemStatus;
  dispatch_strategy: string | null;
  created_at: string;
  updated_at: string;
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

// Post-MVP Phase 4 (Ch.23 Obligation Model). status is not a fixed union —
// see Build Plan §2.3 precedent for Deliverable.lifecycle_state — validated
// by transitionEngine, not the DB.
// Post-completion fix (Open Design Questions.md #3): related_object_type/id
// replace a single Deliverable-only FK, same polymorphic pattern
// attention_items already uses and for the same reason — no FK constraint is
// possible once the related object can be any governed entity type.
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
  created_at: string;
  updated_at: string;
}

export type QualityGateOutcomeValue = "Passed" | "Passed with Conditions" | "Blocked" | "Waived" | "Deferred" | "Not Applicable";

// Post-MVP Phase 4 (Ch.26 Quality Gate Model). criteria is declarative but
// MVP's qualityGateEngine only interprets one shape:
// { type: "no_unresolved_obligations" }.
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
  created_at: string;
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

// Post-MVP Phase 5 (Ch.17 Evidence Model). status is not a fixed union — same
// dynamic-validation-by-transitionEngine precedent as Deliverable/Obligation.
export interface EvidenceRow {
  id: string;
  seu_id: string;
  related_object_type: TransitionEntityType;
  related_object_id: string;
  category: string;
  title: string;
  description: string | null;
  source: string | null;
  confidence_level: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// Post-MVP Phase 5 (Ch.16 Knowledge Model). acquisition_scope reuses
// AcquisitionScope (Ch.15 §9) — inherited by default from the producing
// Deliverable.
export interface KnowledgeItemRow {
  id: string;
  seu_id: string;
  deliverable_id: string;
  evidence_id: string | null;
  category: string;
  title: string;
  description: string | null;
  acquisition_scope: AcquisitionScope;
  status: string;
  created_at: string;
  updated_at: string;
}

// Post-MVP Phase 6 (Ch.16 §13 / Book 1 Ch.21 §21.6) — a KnowledgeItemRow
// joined with just enough to display Engineering Capital meaningfully:
// which Capability it's attributable to (via its Deliverable) and which SEU
// it originated from.
export interface EngineeringCapitalRow extends KnowledgeItemRow {
  deliverable_name: string;
  capability_code: string | null;
  capability_name: string | null;
  objective_statement: string;
}

// Post-MVP Phase 5 (Ch.19 Decision Model).
export interface DecisionRow {
  id: string;
  seu_id: string;
  related_object_type: TransitionEntityType;
  related_object_id: string;
  knowledge_id: string | null;
  evidence_id: string | null;
  category: string;
  title: string;
  engineering_question: string | null;
  selected_alternative: string | null;
  rationale: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

// Post-MVP Phase 7 (Ch.35 §7 Flow Telemetry — "Deliverable cycle time").
export interface DeliverableCycleTimeRow {
  id: string;
  name: string;
  seu_id: string;
  lifecycle_state: string;
  created_at: string;
  last_transition_at: string;
  cycle_time_seconds: number;
}

// Post-MVP Phase 7 (Ch.35 §7 Governance Telemetry — "Quality Gate latency").
export interface QualityGateLatencyRow {
  quality_gate_id: string;
  gate_name: string;
  entity_id: string;
  seu_id: string;
  first_blocked_at: string | null;
  passed_at: string;
  latency_seconds: number;
}

// Post-MVP Phase 8 (Ch.34 Attention Management Model). status is not a fixed
// union — same dynamic-validation-by-transitionEngine precedent as every
// other governed entity. related_object_type/id are informational only, no
// FK (see 009_attention_and_interaction.sql for why).
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

// Post-MVP Phase 8 (Ch.36 External Interaction Model).
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
}

// Phase 10 (badge model) — design/mvp-build-plan/Phase 10 - User Management
// and Dual Authority Design.md. An identity holds a *set* of badges
// (badge_grants), not one flat role. §8: Layer 1 Platform, Layer 2a Tenant
// Admin, Layer 2b Engineering (Creator/Reviewer/Approver).

export interface TenantRow {
  id: string;
  code: string;
  name: string;
  status: string;
  created_at: string;
}

// scope_kind: what a grant of this badge type must be scoped by.
// 'SEU_or_Pack' is an implementation resolution, not in the design doc's own
// table verbatim — see 012_badge_model.sql's header comment for why: §8.4
// allows a Creator/Reviewer/Approver grant to be scoped to either one SEU or
// one Pack, which only reconciles with §9's "one scope_kind per badge type"
// framing if that badge type's scope_kind itself spans both.
export type BadgeScopeKind = "None" | "Tenant" | "SEU" | "Pack" | "SEU_or_Pack";

export interface BadgeTypeRow {
  id: string;
  tenant_id: string | null;
  code: string;
  name: string;
  scope_kind: BadgeScopeKind;
  derived_from: string | null; // not a real FK — badge_types.code isn't globally unique; see badgeTypesDB.ts
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

export type BadgeGrantStatus = "Active" | "Suspended" | "Revoked";

export interface BadgeGrantRow {
  id: string;
  holder_type: string; // "User" is the only real value built now (§9)
  holder_id: string;
  badge_type: string; // badge_types.code — not a real FK, see badgeTypesDB.ts
  governed_entity_type: TransitionEntityType | null;
  capability_id: string | null;
  tier: string | null; // reserved, unused for now
  scope_id: string | null;
  status: BadgeGrantStatus;
  created_at: string;
}

// SDK UI Layer Plan (design/mvp-build-plan/SDK UI Layer Plan.md) — Pack,
// Template, Profile and Transition Definition are authored as Deliverables
// via their own bootstrap Template ("Core principle"), not a new
// TransitionEntityType. These four support tables are what's actually new.

export type SchemaDefinitionEntityKind = "Pack" | "Template" | "Profile" | "TransitionDefinition";

// One row per (entity kind, schema version) — the grammar and its validator
// share one version (see the plan's versioning section); schema is a
// standard JSON Schema document.
export interface SchemaDefinitionRow {
  id: string;
  entity_kind: SchemaDefinitionEntityKind;
  version: number;
  schema: Record<string, unknown>;
  created_at: string;
}

// The bootstrap Deliverable only carries lifecycle state — this is where the
// actual in-progress authored document lives while In Progress.
// schema_definition_id is permanent once set: an instance is checked against
// exactly the grammar it was authored against, never silently against
// whatever's newest.
export interface DeliverableAuthoringContentRow {
  id: string;
  deliverable_id: string;
  schema_definition_id: string;
  content: Record<string, unknown>;
  updated_at: string;
}

// Engineering Telemetry — Plan (design/mvp-build-plan/Engineering Telemetry
// — Plan.md), Ch.35 §8 Metric Registry, scoped to a metadata catalog — see
// the plan's own "Scope, resolved 2026-08-06." calculation_method is a code
// selecting hardcoded evaluator logic in metricRegistryEngine.ts, the same
// shape as quality_gates.criteria.type, not a runtime-interpreted formula.
export type TelemetryCategory = "Flow" | "Governance" | "Runtime" | "Knowledge" | "Quality" | "Collaboration";
export type MetricAggregationStrategy = "Average" | "Count" | "Rate" | "Distribution";

// Build order step 3 — Runtime Telemetry. dispatch_latency/work_item_duration
// read the `events` table for the specific timestamps neither `commands` nor
// `work_items` can give directly: both rows are mutated in place on every
// status change (Assigned/Executing/Completed/Disposed), so their own
// `updated_at` only ever reflects the most recent status, not "when did it
// become Dispatched" or "when did it start Executing" specifically.
export interface DispatchLatencyRow {
  command_id: string;
  seu_id: string;
  command_type: string;
  generated_at: string;
  dispatched_at: string;
  latency_seconds: number;
}

// Build order step 6 — Quality Telemetry's "rework rate": per (entity,
// SEU), how many Blocked evaluations it accumulated before its eventual
// Pass. Only entities with at least one Pass are counted — same "only what
// actually completed the step" discipline the latency query already uses.
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
