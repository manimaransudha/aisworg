# Change Requests

A running register of change requests raised against the platform — feature additions, behavioural changes, and dev-tooling requests that fall outside the numbered MVP build phases. Each CR is its own file in [change-requests/](change-requests/); this page is the index (newest first). Each file records the request as raised, the agreed scope, the design decisions, and (once built) a Built banner.

| CR | Title | Status |
|----|-------|--------|
| [CR-050](change-requests/CR-050-commissioning-active-definition-check.md) | SEU commissioning must check referenced Definitions are Active at commissioning time | 🟡 Proposed (not scheduled) |
| [CR-049](change-requests/CR-049-deliverable-authoring-and-relationships.md) | Deliverable authoring: tenant specialisation from Ontology-defined Platform "code," and the Derivation/Implementation/Decomposition relationship types | 🟡 Proposed (design in progress) |
| [CR-048](change-requests/CR-048-constraint-detection-flow-optimisation.md) | Constraint Detection (§11) + Flow Optimisation (§14): continuous incoming-edge-unsatisfied checking | 🟡 Proposed (not scheduled) |
| [CR-047](change-requests/CR-047-dependency-graph-widget-full-vocabulary-pack-profile.md) | dependencyGraph authoring widget: full type vocabulary, symmetric TO side, and Pack/Profile schemas | 🟡 Proposed (not scheduled) |
| [CR-046](change-requests/CR-046-registry-view-button-and-ontology-code-validation.md) | Registry "View" button, view-page data-source fix, Capability dependency widget fix, real server-side Ontology code validation | ✅ Built 2026-08-20 |
| [CR-045](change-requests/CR-045-authoring-view-mode-plain-read-rendering.md) | Authoring view mode: plain read text, not disabled dropdowns/inputs | ✅ Built 2026-08-20 |
| [CR-044](change-requests/CR-044-template-form-reorder-pack-deliverable-tabs.md) | Template authoring form: Code/Name/Purpose/Version first, dedicated Pack Codes and Deliverable Catalogue tabs | ✅ Built 2026-08-20 |
| [CR-043](change-requests/CR-043-dependency-definitions-polymorphic-owner.md) | `dependency_definitions`: polymorphic owning scope (Template / Pack / Profile) | ✅ Built 2026-08-20 |
| [CR-042](change-requests/CR-042-wire-dependency-push-evaluation.md) | Wire dependency push-evaluation into live transition-completion paths; publish `DeliverableReady`/`DeliverableBlocked` (CR-040's surviving residue) | ✅ Built 2026-08-20 |
| [CR-041](change-requests/CR-041-dependency-graph-authoring-widget.md) | Dependency graph authoring widget — generic self-referential repeatable-list mechanism, prerequisite for CR-038's Deliverable Catalogue redesign | ✅ Built 2026-08-20 |
| [CR-040](change-requests/CR-040-dependency-engine-full-event-taxonomy.md) | Dependency Engine: full nine-event taxonomy (Ch.9 §15) | ❌ Closed 2026-08-20 — not needed, residue moved to CR-042 |
| [CR-039](change-requests/CR-039-dependency-engine-canonical-form.md) | Dependency Engine: canonical `(entity_type, name?, state)` node form, Template-scoped, push-evaluated | ✅ Built 2026-08-20 |
| [CR-038](change-requests/CR-038-template-form-category-tabbed-packs-derived-capabilities.md) | Template form: category-tabbed Pack pickers, derived Required Capabilities, Ontology-backed Deliverable Catalogue | ✅ Built 2026-08-20 |
| [CR-037](change-requests/CR-037-authoring-tabs-verb-queue.md) | Authoring tabs: "I defined" (any status) + per-verb queues only | ✅ Built 2026-08-20 |
| [CR-036](change-requests/CR-036-registry-view-only-copy-state-filter.md) | Pack/Template/Profile Registry: view-only + state filters + badge-gated Copy; lifecycle governance moved to Authoring | ✅ Built 2026-08-20 |
| [CR-035](change-requests/CR-035-template-candidate-tenant-scoping.md) | `findCandidateTemplates` scoped to Platform + caller's tenant (was fully unscoped) | ✅ Built 2026-08-19 |
| [CR-034](change-requests/CR-034-sdlc-templates-standard-packs.md) | SDLC Templates: 16 phase Packs + 9 standard category Templates | ✅ Built 2026-08-19 |
| [CR-033](change-requests/CR-033-remove-vestigial-sdk-bootstrap-templates.md) | Remove the 4 vestigial SDK-authoring bootstrap Templates/Profiles | ✅ Built 2026-08-19 |
| [CR-032](change-requests/CR-032-dev-act-as-noun-verb-badges.md) | Dev Act-As switcher: assume real noun_verb badges, not the retired Creator/Reviewer/Approver family | ✅ Built 2026-08-19 |
| [CR-031](change-requests/CR-031-pack-composition-strategy-engine.md) | Pack `compositionStrategy`: wire `compositionEngine` to the chosen strategy | 🟡 Proposed (not scheduled) |
| [CR-030](change-requests/CR-030-pack-composition-strategy-ontology.md) | Pack `compositionStrategy`: a real, Ontology-backed dropdown | ✅ Built 2026-08-19 |
| [CR-029](change-requests/CR-029-template-profile-registries.md) | Template Registry + Profile Registry, Pack Registry re-tabbed | ✅ Built 2026-08-19 |
| [CR-028](change-requests/CR-028-profile-identity-schema-events.md) | Profile: versioning, inheritance, full §7 schema, real events | ✅ Built 2026-08-19 |
| [CR-027](change-requests/CR-027-sdk-authoring-vertical-tabs.md) | SDK / Authoring surfaces: horizontal tabs → vertical side tabs | ✅ Built 2026-08-19 |
| [CR-026](change-requests/CR-026-template-inheritance-and-pack-tenant-scoped-versioning.md) | Template Inheritance (Ch.6 §9) + Pack tenant-scoped `(code, packVersion)` versioning | ✅ Built 2026-08-19 |
| [CR-025](change-requests/CR-025-template-named-events.md) | Real named Template events, mirroring Pack | ✅ Built 2026-08-19 |
| [CR-024](change-requests/CR-024-template-versioning-immutability.md) | Template versioning and immutability, mirroring Pack | ✅ Built 2026-08-19 |
| [CR-023](change-requests/CR-023-template-purpose-field.md) | Template `purpose` field, seeded from per-category Ontology guidance | ✅ Built 2026-08-19 |
| [CR-022](change-requests/CR-022-ontology-tenant-scoped-badge-gated.md) | Ontology becomes tenant-scoped and badge-gated (not root-only) | ✅ Built 2026-08-19 |
| [CR-021](change-requests/CR-021-template-categories-ontology.md) | Template `code` rooted in a new `template-categories` Ontology concept type | ✅ Built 2026-08-19 |
| [CR-020](change-requests/CR-020-ontology-management-crud.md) | Ontology Management: seed `capability-name`, admin CRUD on `ontology_concepts` | ✅ Built 2026-08-18 |
| [CR-019](change-requests/CR-019-consolidate-transition-definition-authoring.md) | Consolidate transition-definition authoring on the CR-007 form (drop the stale SDK grammar path) | ✅ Built 2026-08-14 |
| [CR-018](change-requests/CR-018-complete-pack-validator-metadata.md) | Complete the Pack validator: §8 metadata, §10 dependency types, §13 compatibility fields | ✅ Built 2026-08-14 |
| [CR-017](change-requests/CR-017-form-based-schema-registry.md) | Form-based schema-registry authoring (author validators from a meta-schema) | ✅ Built 2026-08-14 |
| [CR-016](change-requests/CR-016-schema-structured-pack-contributions.md) | Schema-structured Pack contributions (the §20 executable-verification grammar) | ✅ Built 2026-08-14 |
| [CR-015](change-requests/CR-015-pack-categories-uuid-codes-validated-input.md) | Pack authoring: data-driven categories, UUID codes, and schema-validated input | ✅ Built 2026-08-14 |
| [CR-014](change-requests/CR-014-noun-verb-sdk-authoring.md) | Retire `sdk_*` Platform badges; gate SDK authoring by the authored entity's noun × verb | ✅ Built 2026-08-13 |
| [CR-013](change-requests/CR-013-objectives-ui-restyle.md) | Objectives tree UI: styling & layout pass | 🟡 Proposed (not scheduled) |
| [CR-012](change-requests/CR-012-objective-delete-and-retire.md) | Objective delete (Proposed leaf) and retire (Active subtree) | ✅ Built 2026-08-13 |
| [CR-011](change-requests/CR-011-pack-based-capability-derivation.md) | Pack-based automated Capability derivation for Objectives (Ch.1 §10) | 🟡 Proposed (not scheduled) |
| [CR-010](change-requests/CR-010-objective-lifecycle-events.md) | Objective lifecycle & decomposition events (Ch.1 §14) | 🟡 Proposed (not scheduled) |
| [CR-009](change-requests/CR-009-objective-hierarchy.md) | Objective hierarchy: mandatory parent + contextual creation + tree view + re-parenting | ✅ Built 2026-08-13 |
| [CR-008](change-requests/CR-008-tenant-user-landing-page.md) | Tenant-user landing page (redesign) | 🟡 Proposed (not scheduled) |
| [CR-007](change-requests/CR-007-transition-definitions-surface.md) | Transition Definitions as a manageable, visible authority surface | ✅ Closed 2026-08-13 |
| [CR-006](change-requests/CR-006-authority-noun-verb.md) | Authority as noun × verb (clean, data-driven; Phase 10 preserved) | ✅ Closed 2026-08-13 |
| [CR-005](change-requests/CR-005-decouple-tenant-creation.md) | Decouple tenant creation from tenant-admin assignment | ✅ Built 2026-08-12 |
| [CR-004](change-requests/CR-004-user-home-membership.md) | Every user belongs to a Platform or a Tenant | ✅ Built 2026-08-12 |
| [CR-003](change-requests/CR-003-commission-from-objectives-screen.md) | Commission an SEU from the Objectives screen (not the navbar) | ✅ Built 2026-08-12 |
| [CR-002](change-requests/CR-002-seu-objective-invariants.md) | Enforce SEU↔Objective invariants (Ch.1 §18.2) | ✅ Built 2026-08-12 |
| [CR-001](change-requests/CR-001-dev-act-as-switcher.md) | Dev-only "Act As" switcher (tenant + badge impersonation) | ✅ Built 2026-08-12 |

## Adding a CR
Create `change-requests/CR-0NN-<short-slug>.md` (H1 = the CR title), then add a row here (newest first). Keep the file's `**Status:**` line and this table's Status cell in sync.
