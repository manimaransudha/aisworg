# CR-111 — Capability Registry

**Raised:** 2026-09-22 · **Origin:** Capability in the current implementation remains as an Ontology. src/dblayer/migrations/046_capability_name_ontology.sql. Expand this to include capability roles and role work types. This is required to expand capability fulfillment feature later. 

**Status:** 🟢 Built 2026-09-25  

## Design

1. Add role codes to Ontology - src/dblayer/migrations/263_capability_role_ontology.sql
2. Add worktype codes to Ontology - src/dblayer/migrations/264_worktypes_code_ontology.sql
3. Create a new table capability_definitions and migrate 265 to populate this table. The table has to be modified to add schema definition id, version etc
4. Create a schema definition for capability
5. Create a new "Capability Registry" under the Registry page. (Dont forget route_authority) to list the capability definitions. Role: general
6. Create a capability authoring using the schema definition. 

## Design (firmed, 2026-09-25)

Precedent used: Service Definition (migration 153) is the closest match — a
standalone catalog entity, no relationship to any other entity structurally
(only referenced BY other entities via its Ontology code, the same way
`service_definitions.capability_code` already points at `capability-name`),
own governed lifecycle, `draft_content` JSONB, `parent_*_id` for versioning.
Policy Definition (167) is the other sibling in this same family. Capability
becomes the 8th `schema_definitions.entity_kind` (Pack, Template, Profile,
TransitionDefinition, Deliverable, Service, Policy, **Capability**), and
gets the full CR-112 write-time validation pass (`validateAgainstSchema` +
`validateOntologyFieldsAgainstSchema`) from day one — built in from the
start, not retrofitted, per the standing rule that new entities get this at
build time.

Today's `capability_definitions` (migration 265): `id, code, default_label,
description, roles (JSONB), tenant_id, created_at` — no lifecycle, no
version, no `draft_content`, no `schema_definition_id`, `UNIQUE(code,
tenant_id)`. `roles` is `[{name, worktypes[]}]`, currently unvalidated
against the `role-name`/`worktype-name` Ontology concept types migrations
263/264 just added.

### Step-by-step (mirrors the CR-112/153/167 build sequence)

1. **Table restructure** (new migration, supersedes/alters 265's shape):
   add `version TEXT NOT NULL DEFAULT '1.0.0'`, `status TEXT NOT NULL
   DEFAULT '<initial>' CHECK (...)`, `draft_content JSONB`,
   `schema_definition_id UUID REFERENCES schema_definitions(id)`,
   `authored_by BIGINT`, `parent_capability_definition_id UUID REFERENCES
   capability_definitions(id)`. Constraint becomes `UNIQUE(code, version,
   tenant_id)` (matches Service/Policy), replacing today's `UNIQUE(code,
   tenant_id)`.
2. **`schema_definitions` widened**: drop/re-add
   `schema_definitions_entity_kind_check` to include `'Capability'`, same
   one-line move 081/153/167 each made.
3. **New `schema_definitions` row** (`entity_kind='Capability'`, version 1):
   `code` → `x-ontology: true` sourced from `capability-name` (matches how
   `service_definitions.capability_code` already validates); `default_label`,
   `description` plain; `roles[]` as a `referential-list`-shaped array where
   each item's `name` → `x-ontology: true` → `role-name`, and `worktypes[]`
   (nested array inside the item) → `x-ontology: true` → `worktype-name` —
   this is the same 2-level-array-item depth Policy's
   `conditions[].relatedObligations[]` just proved out in
   `validateOntologyFieldsAgainstSchema`'s new recursive `walk()`, so no
   further extension to that walker is needed.
4. **`core/capabilityDefinitionWriteValidator.ts`** (mirrors
   `core/policyDefinitionWriteValidator.ts`): pinned/latest Capability
   schema, `validateAgainstSchema` + `validateOntologyFieldsAgainstSchema` +
   code+version+tenant uniqueness.
5. **`capabilityDefinitionsDB.ts`** (new, mirrors
   `policyDefinitionsDB.ts`): `createDraft`/`updateDraftContent` call the
   validator before INSERT/UPDATE; `createDraft` stamps
   `schema_definition_id` to latest; `updateDraftContent` pins to the row's
   own existing one.
6. **Registry page** ("Capability Registry", role: general to view) — full
   CR-083 styling, `parseListParams`/`paginateList`/`listControls`/
   `sortLink` per the standing every-list rule, plus its `route_authority`
   row (view route, role: general).
7. **Authoring** via the existing SDK authoring surface
   (`sdkAuthoring.ts`/`formGenerator.ts`), same as Pack/Template/Profile/
   Service/Policy — new Capability branch, badge-gated create/edit actions
   through `requireBadge`/`route_authority`, transition buttons filtered by
   `possibleNextStates`/held badge per the standing badge-gated-transition
   rule.
8. **`transition_definitions`** rows for Capability's lifecycle wired at
   this build time (`event_type`/`version_event`/`entityId`), not deferred —
   per the standing Version Feature Plan rule. No cross-entity event
   subscriber needed: Capability is definition-only, single-entity, linear
   lifecycle (same class as Objective/Pack/Template/Profile/Service/Policy)
   — its own transition rows are the whole effect.

### Decisions

1. **Lifecycle shape — decided**: Service Definition's lean 6-state:
   Defined → Published → Active → Deprecated → Retired → Archived. Same
   `status` CHECK, same verb sequence (`publish`/`activate`/`deprecate`/
   `retire`/`archive`) as `service_definitions`.
2. **`Capability` added as a noun** in the authority vocabulary
   (`src/dblayer/seed/data/authorityVocabulary.json`), same move 167 made
   ahead of the `policy_definitions` table existing — `nouns: [...,
   {"code": "Capability", "label": "Capability"}]`, plus 5 `transitions`
   rows (`entityType: "Capability"`) mirroring Service's own exactly:
   Defined→Published (`publish`), Published→Active (`activate`),
   Active→Deprecated (`deprecate`), Deprecated→Retired (`retire`),
   Retired→Archived (`archive`). This is the seed data step 8's
   `transition_definitions` build-time wiring reads from.

### Decisions (continued)

3. **Versioning: always a new row.** Matches the platform's standing
   Version Feature Plan model (same as Service/Policy) — `parent_
   capability_definition_id`, `UNIQUE(code, version, tenant_id)`, a new
   Draft/Defined row created alongside a still-Active prior version rather
   than mutating a row in place.
4. **Authoring badges — mechanical, no new decision needed.** Follows the
   existing `{noun}_define`/transition-derived-verb convention exactly
   (CR-014, `authorityVocabulary.json`'s `_authoringMappingsComment`):
   `Capability` added to `_authoringMappings` with `verbs: ["define"]`
   (same single-verb entry Service/Policy both use — `capability_publish`/
   `capability_activate`/etc. are already auto-derived from the 5
   lifecycle-transition rows in decision 2, not separately declared).
   Badge-to-role assignment flows through the existing `nounVerbBadges()`
   seed helper the same way every other entity's does — no bespoke
   role-badge wiring needed.

No further blocking open questions — the design is now fully specified
against precedent (Service Definition's lean 6-state lifecycle + versioned
row model, mechanical badge derivation). Ready to build once you confirm.

## Built

- **migration 273** (`src/dblayer/migrations/273_capability_definition_registry.sql`):
  restructured `capability_definitions` (adds `version`, `status` CHECK
  (Defined/Published/Active/Deprecated/Retired/Archived), `draft_content`,
  `authored_by`, `parent_capability_definition_id`, `schema_definition_id`;
  swaps `UNIQUE(code, tenant_id)` for `UNIQUE(code, version, tenant_id)`);
  widens `schema_definitions_entity_kind_check` to include `'Capability'`
  (8th kind); inserts the Capability `schema_definitions` v1 row (`code`
  x-ontology→capability-name, `roles[].name` x-ontology→role-name,
  `roles[].worktypes[]` x-ontology→worktype-name — proves out the 2-level
  array-item Ontology walk CR-112's Policy pass already built, no new
  validator code needed); backfills the 40 pre-existing rows to
  `status='Active'` + the new schema id; adds `route_authority` rows for
  the new Registry routes; **retires** the old `GET /aisworg/seu/capabilities`
  route_authority row (see "Retired" below).
- **`authorityVocabulary.json`**: `Capability` noun, 5 lifecycle transitions
  (Defined→Published→Active→Deprecated→Retired→Archived, verbs
  publish/activate/deprecate/retire/archive), `authoringMappings` entry
  (`verbs: ["define"]` — `capability_publish`/etc. auto-derive from the
  transitions, same as Service/Policy).
- **`transitionDefinitions.json`**: 5 Capability rows with
  `event_type`/`version_event` (CapabilityDefinitionPublished/
  VersionPublished, …Activated/VersionActivated, …Deprecated/
  VersionDeprecated, …Retired/VersionSuperseded, …Archived/VersionArchived)
  — Version Feature Plan wiring done at build time, not deferred.
- **`seuTypes.ts`**: `CapabilityDefinitionStatus`, `CapabilityRole`,
  `CapabilityDefinitionRow`; widened `SchemaDefinitionEntityKind` and
  `TransitionEntityType` to include `"Capability"`.
- **`core/capabilityDefinitionWriteValidator.ts`** (new, mirrors
  `serviceDefinitionWriteValidator.ts`): `validateCapabilityDefinitionWriteAgainstSchema`
  — schema shape + Ontology-field validation + code+version+tenant
  uniqueness, run at every write path.
- **`dblayer/capabilityDefinitionsDB.ts`** (new, mirrors
  `serviceDefinitionsDB.ts`): `createDraft`/`updateDraftContent` call the
  validator before every INSERT/UPDATE.
- **`core/capabilityDefinitions.ts`** (new, mirrors `serviceDefinitions.ts`):
  `validateCapabilityDefinitionSeed` (code/defaultLabel/version + roles[].name
  → role-name, roles[].worktypes[] → worktype-name), `transitionCapabilityDefinition`,
  `advanceCapabilityDefinitionOneStep`, `copyCapabilityDefinitionAsNewDraft`,
  `listCapabilityDefinitionsWithNextStates`. No Ontology sync-on-activate
  (unlike Service) — `code` already IS the capability-name concept, not a
  second independently-synced identity.
- **`core/sdkAuthoring.ts` / `web/sdkAuthoring.ts`**: Capability wired into
  every one of the 6 core dispatch sites and 2 web dispatch sites Policy
  also touches — `validateAuthoredContent`, `listTenantAuthoringRows`,
  `getAuthoringDraft`, `createAuthoringDraft`, `saveAuthoringDraft`,
  `publishAuthoringDraft`, `KIND_BY_SLUG` (`capability-authoring`),
  `requireDraftTenantScope`, the `/transition` route. Authoring badges
  (`capability_define`/`capability_publish`/etc.) and the whole authoring
  FORM are free — mechanical badge derivation + the generic
  `schema_definitions`-driven form generator, same as every other SDK kind.
  `loadReferentialOptions` gained `role-name`/`worktype-name` option
  sources for the roles[] referential-list widget.
- **Registry page**: `web/capabilityDefinitionRegistry.ts` +
  `views/seu/capability-definitions/index.ejs` (full CR-083 styling,
  `parseListParams`/`paginateList`/`listControls`/`sortLink`, status filter
  chips, Copy action) — mirrors `serviceDefinitionRegistry.ts` exactly.
  Mounted in `web/index.ts`; `route_authority` rows added (migration 273);
  `seu_capability_definitions_index.js` viewModel registered.
- **Tests**: `tests/capability-definition-event-lifecycle-table.test.ts`
  (mirrors `service-definition-event-lifecycle-table.test.ts`) — DEFINITION
  check of all 5 transition_definitions rows' event_type/version_event,
  DRIVEN checks exercising every real hop through `transitionCapabilityDefinition`
  and asserting published events, plus two regression tests: roles[]
  round-trips and is rejected when `name`/`worktypes[]` aren't real
  role-name/worktype-name codes, and an unregistered `code` is rejected
  (not composable, unlike Pack's).

### Retired: the old `/aisworg/seu/capabilities` page

Owner: "retire it." Pre-CR-111, `/aisworg/seu/capabilities`
(`capabilityRegistry.ts`) was a thin, read-only list of the `capability-name`
Ontology concept type — now fully superseded by
`/aisworg/seu/capability-definitions`. Removed: `web/capabilityRegistry.ts`,
`views/seu/capabilities/`, `viewModels/seu_capabilities_index.js`; its
`web/index.ts` mount, `route_authority` row (deleted via migration 273), and
every navbar/`app.js` nav-visibility reference swapped to the new route —
including the SDK/Authoring dropdown, which gained a new "Capability
Authoring" entry it never had before (the old page had no authoring surface
at all).

### Not built (out of CR-111's original scope, flagged not silently added)

- No "Inherit from Platform Capability" web UI — `listInheritableCapabilityDefinitions`/
  `inheritedCapabilityDefinitionContent` exist in core (parallel to Service/
  Policy's own identical functions) and are wired into `createAuthoringDraft`,
  but neither Service nor Policy actually exposes this in the web layer
  either (confirmed: `listInheritableServiceDefinitions` is imported in
  `web/sdkAuthoring.ts` but never called) — Capability matches that same
  not-yet-wired state, not a gap introduced here.
- No new capability fulfillment logic — CR-111's own origin note ("required
  to expand capability fulfillment feature later") names this as
  groundwork for a later feature, not something this pass builds.


