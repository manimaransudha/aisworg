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

// CR-020: category is Ontology-governed (concept_type category:pack) — a data
// change adds a category, not a code change, so this is no longer a fixed
// literal union (that would have to be hand-kept in sync with the Ontology
// Management admin page, defeating the point).
export type PackCategory = string;
export type PackStatus = "Draft" | "Validated" | "Published" | "Active" | "Deprecated" | "Retired" | "Archived";
// CR-020: same Ontology-governed treatment (concept_type installation-classification).
export type PackClassification = string;

// CR-016 (Ch.5 §20) — the per-item executable-verification metadata. `statement`
// is the human-readable standard; `classification` is who/what determines pass/
// fail; `prompt` is the AI instruction; `participant`/`outputContract` shape the
// execution; `assurance` is the optional escalation threshold; `externalEvidence`
// marks a machine-verifiable item verified by an Integration connector (§20.4).
export interface VerifiableItemFields {
  statement?: string;
  classification?: "machine-verifiable" | "judgment" | "human-attested";
  externalEvidence?: boolean;
  prompt?: string;
  participant?: "AI" | "AI+human" | "human";
  outputContract?: "passed-failed-notes" | "assessment-acceptance";
  assurance?: string;
}

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
  // through Packs"). CR-058 — the authored (form-facing) shape:
  // governedTransition replaces the old free-typed entityType/fromState/
  // toState triple ("the pack should not define something beyond what a
  // transition definition already holds") — a delimited
  // "EntityType|fromState|toState" value picked from real
  // transition_definitions rows, parsed back into the 3 real columns at
  // seedContributions time (core/packs.ts). requiredPolicyCode reassembles
  // into quality_gates.criteria's nested shape there too.
  //
  // CR-058 follow-up 2 (owner: "the code isn't a UUID or a freeform
  // Pack-specific string — it's the category identifier itself, drawn from
  // the same Ontology-governed vocabulary as Ch.17 §7's Evidence
  // Categories"): `category` is Ontology-backed via category:evidence
  // (reused directly, not a separate quality-gate vocabulary) and IS the
  // gate's own code — qualityGatesDB.upsert sets `code = category` itself.
  // requires_accepted_evidence_or_approved_decision reads this same
  // `category` directly (qualityGateEngine.ts) — Evidence's own category
  // column shares this vocabulary, so no separate field is needed there.
  //
  // No `code` field here at all — same CR-038 treatment
  // TemplateDeliverableSeed's own `code` got ("dropped outright... nothing
  // functional ever needed a separate identifier once the real identity
  // fields exist").
  // CR-059 — requires_accepted_review no longer takes a free-text
  // `criteriaCategory` (Review's own unvalidated category vocabulary,
  // matched against reviews.category by string). `deliverableName`
  // replaces it: a reference to this SAME Pack's own reviewGates[].code
  // (self-referential picker, sdkAuthoring.ts), resolved to a real
  // review_gates row and then a real reviews.review_gate_id FK at
  // seedContributions time (core/packs.ts) — a strict join, not a
  // coincidence string match (owner: matching by category/string alone
  // "can lead to corrupt data").
  qualityGates?: Array<{
    name: string;
    category: string;
    governedTransition: string;
    criteriaType: "no_unresolved_obligations" | "requires_accepted_evidence_or_approved_decision" | "requires_accepted_review" | "requires_active_policy";
    deliverableName?: string;
    requiredPolicyCode?: string;
  } & VerifiableItemFields>;
  // CR-016 (Ch.5 §20) — verifiable contributions carry their own execution.
  // Classification is per ITEM (a Checklist can hold a machine-verifiable item
  // AND a judgment item — the owner's example), so these fields live on each row.
  // Declaration-only: stored in packs.contributions (JSONB); executing them
  // (dispatch prompt -> Evidence -> gate, etc.) is the §19.14 B-group follow-up.
  checklists?: Array<{ checklist?: string; code?: string } & VerifiableItemFields>;
  // CR-059 — a Review Gate is real and persisted now (review_gates table),
  // unlike the other declaration-only rows in this interface. `code` is the
  // deliverable type it's for (Ontology's deliverable-name vocabulary,
  // same referential picker Template's own Deliverable Catalogue uses) and
  // IS the gate's real identity alongside governedTransition — unlike
  // Quality Gate's own code=category collapse, `code` stays a real,
  // author-visible field (owner: "it should show up on the form"). `name`
  // is a separate, required label (Ch.25 §8's own Name-distinct-from-
  // criteria structure).
  reviewGates?: Array<{ code: string; name: string; governedTransition: string } & VerifiableItemFields>;
  obligationDefinitions?: Array<{ code?: string; obligationType?: string } & VerifiableItemFields>;
  // Compliance Model — Plan (Phase 15, Ch.27 FR-27.1): a Pack contributes
  // Compliance Frameworks and their declarative Requirements. Compliance
  // composes existing primitives (§8), so a requirement's criteria reuses the
  // same predicates as Quality Gates.
  complianceFrameworks?: Array<{ code: string; name: string; description?: string }>;
  complianceRequirements?: Array<{
    code: string;
    frameworkCode: string;
    name: string;
    description?: string;
    criteria: Record<string, unknown>;
    severity?: string;
    conflictsWith?: string[];
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
  dependencies: Array<{ packCode: string; version: string; type: "required" | "optional" | "conditional" | "incompatible" }>;
  // CR-018 — recorded-but-unenforced §8/§13 metadata.
  metadata: Record<string, unknown>;
  // Entity-direct authoring (bug fix correcting CR-014): the real user authoring
  // this Draft. Null for migration/CLI-seeded Packs (no human author).
  authored_by: number | null;
  // Pack ownership (owner: "Packs will have ownership... platform or the
  // tenant"): always a real tenants.id — the reserved Platform tenant for a
  // platform-wide Pack, never NULL (same convention users.tenant_id uses).
  // Set at Draft creation from the real author's own tenant; preserved
  // (never re-derived) across a reactivation-as-new-version.
  tenant_id: string;
  created_at: string;
}

// CR-038 — `code` dropped outright: dependencyGraph moved to name-based
// cross-references (bug fix, see TemplateDependencyGraphEntry's own
// comment), and commissioning's own use of it was purely a report-list
// convenience (initialDeliverables, now name-keyed instead) — nothing
// functional ever needed a separate catalogue-local identifier once `name`
// itself is Ontology-backed (deliverable-name concept) and therefore already
// a stable, controlled value. `name` is the real identity throughout the
// runtime system (deliverables.name, dependency_definitions' name-keyed
// columns) — this just stops pretending there's a second one.
export interface TemplateDeliverableSeed {
  name: string;
  category: string;
  producingCapabilityCode?: string;
}

// CR-041 — the dependency graph is authored explicitly, as its own top-level
// list, not embedded per-catalogue-entry (the old dependsOnDeliverableCodes/
// dependsOnCapabilityServiceCodes shape, retired — see migration that
// converted every seed Template's data).
//
// toName/fromName reference deliverableCatalogue's own `name` values within
// the same Template — NAME, not `code` (bug fix, found building CR-038: the
// live widget's self-referential picker resolves against catalogue *names*
// (migration 076's own toName/fromName field names, `x-referential:
// "self:deliverableCatalogue"`, populated from each entry's `.name`), and
// dependency_definitions itself is name-keyed throughout (matches
// deliverables.name at runtime) — code was never the right shape here, only
// ever a leftover from the pre-CR-041 embedded-code model). fromCapabilityCode
// names a required Capability (resolved to that Capability's declared
// Service(s) — Ch.9 §8/Ch.11 §9: a Capability edge asks "is anyone actually
// assigned to this upstream Capability," distinct from a Deliverable edge's
// "did the upstream artefact reach the right state" — both can gate the same
// target). requiredState is optional — absent means a sensible default
// applies (Approved for Deliverable, Fulfilled for Capability); when
// present, it's an explicit author override.
// Ch.15 §12 (CR-049 Phase 2) — dependency is the existing plain edge label;
// derivation/implementation/decomposition are Deliverable-to-Deliverable
// only, structurally identical, just a different edge label. Defaults to
// "dependency" wherever omitted — existing authored content round-trips
// unchanged. Drives exactly one thing downstream: Template Inheritance's
// publish-time check (validateTemplateSeed) — implementation/decomposition
// edges must survive inheritance unaltered (a rename of either end is
// allowed, tracing back through the tenant's own Deliverable Definition
// lineage — CR-049's own resolution); derivation edges are freely editable.
export type DependencyRelationshipKind = "dependency" | "derivation" | "implementation" | "decomposition";

export interface TemplateDependencyGraphEntry {
  toName: string;
  fromType: "Deliverable" | "Capability";
  fromName?: string;
  fromCapabilityCode?: string;
  requiredState?: string;
  relationshipKind?: DependencyRelationshipKind;
}

export interface TemplateRow {
  id: string;
  code: string;
  name: string;
  // CR-024: semver TEXT now, mirroring Pack's pack_version — was a plain
  // INTEGER counter, never read or written anywhere (migration 059).
  template_version: string;
  status: PackStatus;
  parent_template_id: string | null;
  deliverable_catalogue: TemplateDeliverableSeed[];
  authored_by: number | null;
  draft_content: Record<string, unknown>;
  // CR-026: Template ownership, mirroring packs.tenant_id (migration 044) —
  // always a real tenants.id, the reserved Platform tenant for a
  // platform-wide Template, never NULL.
  tenant_id: string;
  created_at: string;
}

// CR-049 Phase 1 — Deliverable Definition, a first-class authored entity
// mirroring TemplateRow's own shape column-for-column (its own table, not a
// shared one — see 081_deliverable_definitions.sql's own header comment).
export interface DeliverableDefinitionRow {
  id: string;
  code: string;
  description: string | null;
  version: string;
  status: PackStatus;
  draft_content: Record<string, unknown>;
  authored_by: number | null;
  tenant_id: string;
  parent_deliverable_definition_id: string | null;
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
  authored_by: number | null;
  draft_content: Record<string, unknown>;
  // Profile identity foundation (owner, 2026-08-19): mirrors packs.tenant_id /
  // templates.tenant_id + template_version + parent_template_id exactly
  // (migration 064) — always a real tenants.id, the reserved Platform tenant
  // for a platform-wide Profile, never NULL.
  profile_version: string;
  tenant_id: string;
  parent_profile_id: string | null;
  // Ch.7 §8 Profile Categories — Ontology-rooted (concept type
  // profile-categories, migration 065), kept as its OWN field, not folded
  // into `code` the way Template's category is (see migration 064's comment).
  // Nullable: every row created before this field existed has none.
  category: string | null;
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
  version: number;
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
  tenant_id: string | null;
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

// CR-039 — canonical, Template-scoped dependency graph replacing
// dependency_edges' per-SEU-instance rows (migration 072's own header comment
// has the full design rationale). entity_type is deliberately not narrowed to
// TransitionEntityType here: Capability is a valid from/to type but carries no
// transition_definitions state machine of its own (it's a Service-fulfilment
// check, not a lifecycle), so the column stays plain string at the type level
// too, same as the DB column.
export type DependencyDefinitionEntityType = TransitionEntityType | "Capability";

// CR-043 — a rule can be authored on the Template it's a fact about, a Pack
// (applies wherever that Pack gets composed, across every Template that
// pulls it in), or a Profile (environment-specific). No real FK — same
// soft-reference tradeoff as related_object_type/related_object_id.
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
  | "Participant"
  | "Review"
  | "Finding"
  // Entity-direct authoring (bug fix correcting CR-014): Template/Profile are
  // authored as Draft rows driven through their own governed Draft->Active
  // transition (verb `publish` → template_publish/profile_publish).
  | "Template"
  | "Profile";

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
  // CR-006 (035) — the verb this transition requires; the required badge is
  // `entity_type + '_' + verb`. CR-007 (036) — soft-retire flag + timestamp.
  verb: string | null;
  is_active: boolean;
  retired_at: string | null;
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
  acting_badge_grant_id: string | null;
  correlation_id: string;
  created_at: string;
  updated_at: string;
}

// Participant Integration & Attestation — Plan step 2 (Resolution 3). The raw
// VCS reference a Participant returns at any completion — candidate output, not
// certified. Durable, append-only; the traceability backbone (Ch.20).
export interface DeliverableReferenceRow {
  id: string;
  seu_id: string;
  deliverable_id: string;
  work_item_id: string;
  participant_id: string | null;
  from_state: string;
  to_state: string;
  reference: string | null;
  created_at: string;
}

// Participant Integration — Plan step 5. An outstanding Work Item enriched with
// the Deliverable + transition it drives, for the human-on-UI work queue.
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

// Participant Integration — Plan step 5. Per-Capability execution target: how
// the fulfilling Participant is reached (human-on-UI vs external orchestrator).
// Tenant-scoped in step 6 (Resolution 8): the same pack-global Capability can be
// reached differently per tenant.
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

// Ontology Model — Plan (Phase 17, Ch.18). Canonical vocabulary + per-tenant
// rename-only alias layer resolved at read time.
export interface OntologyConceptRow {
  id: string;
  concept_type: string;
  code: string;
  default_label: string;
  // CR-023: the longer "when to use this" guidance text, separate from the
  // short default_label. Generic to any concept_type; null where unset.
  description: string | null;
  contributed_by_pack: string | null;
  is_active: boolean;
  // CR-022: Platform's tenant_id for the shared canonical set; a tenant's own
  // tenant_id for their own vocabulary.
  tenant_id: string;
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

// Compliance Model — Plan (Phase 15, Ch.27). Compliance composes existing
// primitives; these are the only new persisted models.
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

// Review Model — Plan (Phase 14, Ch.25). A governed evaluation of an engineering
// object; produces an immutable outcome Governance consumes.
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
  // CR-059 — nullable FK to review_gates(id): which Review Gate declaration
  // (if any) this Review was produced against. Null for standalone Reviews
  // unrelated to any gate. qualityGateEngine's requires_accepted_review
  // matches on this directly, not on `category` (a string match couldn't
  // tell which transition's Review was intended, or that the Review
  // actually followed the gate's own declared prompt/participant contract).
  review_gate_id: string | null;
  created_at: string;
  updated_at: string;
}

// Review Model — Plan (Phase 14, Ch.25 §12). A Finding is an observation from a
// Review; an independent, traceable object that can be converted to an Obligation.
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

// Participant Integration — Plan step 6 (Resolution 8). The minimal tenancy
// slice: a tenant owns SEUs and carries the edge configuration their Work Items
// run against.
export interface TenantRow {
  id: string;
  code: string;
  name: string;
  created_at: string;
}

// The remaining tenant declarations (§2.1 #1/#3/#4) — opaque JSONB the core
// stores and the edge interprets.
export interface TenantContractRow {
  id: string;
  tenant_id: string;
  vcs_binding: Record<string, unknown>;
  callback_auth: Record<string, unknown>;
  attestation_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Minted only at an acceptance transition (In Progress -> Approved, Approved ->
// Baselined). The SEU-scoped governance outcome bound to a commit (Resolution 3).
export interface AttestationRow {
  id: string;
  seu_id: string;
  deliverable_id: string;
  work_item_id: string;
  participant_id: string | null;
  from_state: string;
  to_state: string;
  reference: string | null;
  acting_badge_grant_id: string | null;
  requested_by: number | null;
  created_at: string;
}

export type WorkItemStatus = "Generated" | "Assigned" | "Dispatched" | "Executing" | "Completed" | "Failed" | "Cancelled" | "Disposed";

export interface WorkItemRow {
  id: string;
  command_id: string;
  participant_id: string | null;
  status: WorkItemStatus;
  dispatch_strategy: string | null;
  // Participant Integration — Plan step 1: the raw VCS reference the
  // Participant returns on completion (candidate output; distinct from the
  // attestation minted at an acceptance transition).
  output_reference: string | null;
  // Participant Integration — Plan step 4: the deadline set when the Work Item
  // is assigned to a Participant (dispatched_at + the Capability's turnaround
  // SLA). Null when no SLA is declared. An outstanding Work Item past this time
  // is stalled and escalates to an Attention Item.
  target_completion_at: string | null;
  created_at: string;
  updated_at: string;
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
  // Ch.30 Event Bus redesign — the SEU this event happened under, distinct
  // from originating_object_type/id (which name the specific entity the
  // event is about, e.g. a single Evidence row — not which SEU it belongs
  // to). Null for entities with no single owning SEU (Objective, Pack,
  // Template, Profile, DeliverableDefinition).
  seu_id: string | null;
  correlation_id: string;
  causation_id: string | null;
  payload: Record<string, unknown>;
  // Accountability record (bug fix correcting CR-014): the real acting user and
  // the resolved `noun_verb` badge the transition was authorised under. Null for
  // pre-existing rows and ungoverned/system events that have no actor.
  actor_id: string | null;
  authority_badge: string | null;
  occurred_at: string;
  sequence: string; // BIGSERIAL comes back as string via pg's default int8 handling
  // Ch.30 Event Bus redesign — per-handler dispatch outcome, keyed by
  // handler_name. Populated at publish time from the same lookup that
  // determines who to notify; {} when nobody subscribes to this event_type.
  consumption_state: Record<string, EventConsumptionEntry>;
}

export interface EventSubscriptionRow {
  event_type: string;
  handler_name: string;
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
  // CR-058 — a Quality Gate versions independently of the contributing
  // Pack's own version (owner: "a pack can still be 1.0, but the quality
  // gate associated with it moves to 1.4"). New immutable row per version,
  // is_active marks the current one for a given (entity_type, from_state,
  // to_state, category) tuple.
  version: string;
  is_active: boolean;
  created_at: string;
}

// CR-059 — Review Gate, real and persisted. No `category`/`criteria`: the
// key IS the identity (entity_type, from_state, to_state, code), same
// reasoning quality_gates' own VerifiableItemFields stay declaration-only
// (never real columns here either — the Pack's raw contributions JSONB is
// still where statement/prompt/participant/etc. live).
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

// CR-058 §13 — a waiver applies to one specific blocked entity instance
// (quality_gate_id + entity_type/entity_id), not the gate definition
// globally: the same gate can be waived for one Deliverable without waiving
// it for every other entity it also applies to. Modeled on
// ComplianceWaiverRow's shape but badge-gated (authority_badge NOT NULL) —
// Compliance's own grantedBy-only waiver has no authority check at all,
// deliberately not mirrored here.
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

// Post-MVP Phase 5 (Ch.17 Evidence Model). status is not a fixed union — same
// dynamic-validation-by-transitionEngine precedent as Deliverable/Obligation.
// CR-051 item 1 (Ch.17 §20.2/§20.8) — related_object_type/id moved off this
// row entirely, onto evidence_relationships (below): one Evidence Item may
// support many engineering artefacts, not just one.
export interface EvidenceRow {
  id: string;
  seu_id: string;
  category: string;
  title: string;
  description: string | null;
  source: string | null;
  confidence_level: string;
  status: string;
  // CR-051 item 3 (Ch.17 §12/§20.10) — provenance. All nullable: captured
  // when known at creation time, not required.
  originating_deliverable_id: string | null;
  originating_participant_id: string | null;
  originating_capability_id: string | null;
  originating_decision_id: string | null;
  originating_activity: string | null;
  // CR-051 item 4 (Ch.17 §15/§20.13) — supersession chain, nullable.
  supersedes_evidence_id: string | null;
  created_at: string;
  updated_at: string;
}

// CR-051 item 1 — one row per (Evidence, related object) pair. Many rows can
// share the same evidence_id (one Evidence supporting many artefacts) or the
// same related_object_type/id (many Evidence Items supporting one artefact).
export interface EvidenceRelationshipRow {
  id: string;
  evidence_id: string;
  related_object_type: TransitionEntityType;
  related_object_id: string;
  created_at: string;
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
  is_system: boolean; // CR-004: reserved non-engineering tenant (the 'platform' home)
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

export type SchemaDefinitionEntityKind = "Pack" | "Template" | "Profile" | "TransitionDefinition" | "Deliverable";

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
