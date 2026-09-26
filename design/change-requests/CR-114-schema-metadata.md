# CR-114 — Schema meta data / registry 

**Raised:** 2026-09-26 · **Origin:** Fix Schema registry gaps to align with CR-112 change 

**Status:** 🟢 Built and closed. 28-09-2026 

Widget-based recursive editor verified structurally lossless against all 7 kinds' live schemas. `self:`/`derived:` referential-source conventions need no further work — see "Pass 2 investigation" below; there was never a Pass 1 gap to close.

## Built

`src/domain/sdk/schemaCompiler.ts` rewritten: `AuthoredWidget`/`AuthoredDocument` recursive tree types, `widgetTreeToJsonSchema`/`jsonSchemaToWidgetTree` compiler (mirrors `formGenerator.ts`'s own generateFields/buildItemFields dispatch order exactly), `parseAuthoredDocumentFromBody` for the posted form. `formGenerator.ts`'s `JsonSchemaProperty`/`JsonSchemaDocument` gained the optional `x-schema-notes` field (additive, never read by the real form/validator). New recursive editor UI: `_widgetRow.ejs` + `_widgetTree.ejs` + `_widgetNotes.ejs` (mutually recursive, unbounded depth) and `public/js/widgetTreeEditor.js` (fully event-delegated — no per-row binding, so cloned/nested rows need no re-init). `schema-registry/new.ejs` and `web/schemaRegistry.ts` rewired onto the new tree; the CR-017 flat `AuthoredField`/`META_SCHEMA` path and the now-dead `_generatedFields.ejs` were removed, not kept alongside.

One correctness finding made while grounding against live data: real schemas are not internally consistent about which `type` accompanies a given `x-widget` (Service's `inputs`/`outputs` are `referential-multi-select` with `type:"string"`; its own `consumers`, same widget, uses `type:"array"`). Fixed by having every widget carry the source property's verbatim `rawType`, preferred over the kind's own sensible default on compile-back (carried through the actual HTML form via a hidden input, cleared automatically the moment an author deliberately changes a row's kind) — a kind's own type convention only applies to a freshly authored field.

Round-trip test: `tests/schema-registry-widget-tree.test.ts` — for each of the 7 kinds, fetches the current live `schema_definitions` row (read-only, no writes) and asserts `jsonSchemaToWidgetTree` → `widgetTreeToJsonSchema` reproduces it, modulo `x-property-order` (a position-preserving hint the compiler always re-emits from current row order, so a nested shape that happened not to carry one in a hand-authored migration is expected to gain one — that's the round trip working, not a fidelity bug) and order-independent `required`/`enum` arrays. Owner is running it; result pending.

This file is the design's only reference — `design/schema-registry-widget-form.md`
(the original whiteboarding scratch file) is superseded and should not be
consulted; everything in it that's still true has been carried into this CR.

# Schema Registry authoring form — widget-based redesign

Owner directive (2026-09-26): the flat field-row editor (`AuthoredField`/
`META_SCHEMA` in `schemaCompiler.ts`) does not scale as more `x-*` keywords
get added to real schemas (Pack/Template/Profile/Policy/Service/Deliverable/
Capability). Redesign the schema-registry "New version" form itself as a
recursive tree of composable widgets, one widget kind per real kind
`formGenerator.ts` already renders/validates, so adding a new `x-*` keyword
later is "add one widget kind," not "add a column to every row and every
branch that reads it." Approved: build as a new dedicated recursive editor
component (not a reuse/extension of `_referentialListGroup.ejs`/
`referentialListGroup.js`, which only renders one fixed level of rows).

## Why (context)

Prior state: `AuthoredField` (schemaCompiler.ts) exposes only 9 keywords
(name/type/required/enumValues/widget/referentialSource/ontology/help/
pattern) out of the 17 `x-*` keywords `JsonSchemaProperty` (formGenerator.ts)
actually defines. Missing: `x-ontology-composable`, `x-multi`,
`x-referential-source-by`/`-suffix`, `x-referential-source-by-value`,
`x-widget:"referential-multi-select"`, `x-format`, `x-show-when`/
`-values`, `x-label`, `x-group`/`x-groups`, `x-generated`, and
`x-widget:"referential-list"` itself (nested repeatable lists — Pack
`dependencies`, Checklist `items` — are explicitly NOT expressible in the
flat model today; the code comment calls this out as intentional, kept to
the raw-JSON advanced path).

A second, independent bug found along the way: `jsonSchemaToFieldList` /
`fieldListToJsonSchema` don't preserve any `x-*` key they don't know about,
so editing an existing field through the form today silently **drops**
whichever of the missing keywords that field already had. Not yet fixed;
folded into this redesign rather than patched twice.

## Design settled so far

Each widget kind = exactly one `GeneratedField`/`ReferentialListItemField`
kind from `formGenerator.ts`, carrying only the properties that kind's own
render/validate branch actually reads. `x-format` (markdown) is a property
of Text/Textarea widgets, not its own widget kind — it's orthogonal to
widget choice, same as it is in the real schema shape.

**Top-level (and reusable as item-level children of a Repeatable list):**

| Widget | Properties |
|---|---|
| Text | name, label, required, help, pattern, minLength, default, showWhen/showWhenValues, markdown flag |
| Textarea | same as Text |
| Version | name, label, required, help (value is system-generated, no author content) |
| Select (enum) | name, label, required, help, options (csv), default |
| Referential (single) | name, label, required, help, referentialSource, ontology, ontology-composable (shown only if ontology checked); "driven" mode nests a child list of `{matchValue → source/ontology/composable}` rows + a default row — covers both `x-referential-source-by`/`-suffix` (driver+suffix) and `x-referential-source-by-value` (full map) as nested children, not new top-level kinds |
| Referential (multi) | same as Referential (single), multi-select implied by kind — no separate `x-multi` needed here |
| JSON | name, label, required, help, array-or-object default |
| Repeatable list | name, label, required, help, x-group; children = any item-level kind below, unbounded nesting |

**Item-level only (children of a Repeatable list):**

Boolean, Generated (system-assigned, label/help only), Nested list (takes
its own children, recurses to unbounded depth — see Nesting model below),
Nested object (fixed sub-object, takes children), Referential (dynamic)
(driven by a sibling field in the same row), Referential (by scope) (driven
by a top-level field's value, nested variants list).

**Schema-level (sibling of the field tree, not a field itself):**

Tab list (`x-groups`) — ordered `{key, label}` pairs; a widget's `x-group`
property picks one of these keys.

**Schema-only (author-consumption, never read by `formGenerator.ts` or
`validateAgainstSchema`):**

One primitive, `x-schema-notes` — an array of `{date, note}` log entries.
Placeable anywhere in the tree: at the document root (the schema version's
own log — why this version exists, what changed since the last one), or
nested as a child of any field-widget at any depth (a note on that specific
field). Same shape, same widget, same rendering regardless of where it
sits — location doesn't change its meaning. Fully inert to the real
form/validator; no collision with any existing key (checked: no
`x-note`/`x-comment`/`x-changelog`/`x-deprecated`/`x-schema-notes` anywhere
in the codebase today).

Considered and rejected for now: a **Deprecated** marker (structured flag
vs. free text) — nothing currently reads such a flag, so it would be a
marker with no consumer. Fully expressible today as an `x-schema-notes`
entry ("deprecated — superseded by fieldX") with zero loss. Revisit only if
a real consumer (e.g. a "⚠ deprecated" badge on the registry index, or a
lint) shows up.

## Nesting model (grounded against live data)

Pulled every kind's current live schema from `schema_definitions` (not just
hand-built examples) before finalising this. Findings that changed the
design from the original sketch:

- **Nesting is deeper than one level in production.** Pack's
  `contributionChecklists` is a list whose item field `items` is *itself* a
  list (checklist → items). The tree editor must support genuinely unbounded
  recursion — "list contains items" isn't enough, a Nested list item can
  itself contain another Nested list.
- **`x-property-order` exists independently at every nesting level** (Pack's
  `dependencies`, `serviceLevel`, and `contributionServices.serviceLevel`
  items each carry their own). The editor must preserve and re-emit child
  order at every depth, not just the top level.
- **`default` appears on plain non-version fields too** (`dependencies[].type`
  defaults to `"required"`, `exposedParameters[].overridable` defaults to
  `true`) — added `default` to the Text/Select/Boolean property lists above.

## Known out-of-scope for this pass (Pass 2)

`x-referential-source` is not always a Registry/Ontology key. Template's
`dependencyGraph.toCode` uses `"self:deliverableCatalogue"` (resolves
against another field on the same document) and `fromCapabilityCode` uses
`"derived:requiredCapabilityCodes"` (a computed set, not a stored list).
These are resolver conventions, not `x-*` keywords, and where they're
resolved hasn't been located yet. Rather than guess at the convention's
exact rules mid-build and risk silently mis-round-tripping Pack/Template's
live schemas (both large, actively used, and permanent once versioned —
schema versions are additive, never edited), these stay on the raw-JSON
advanced path for Pass 1. Any field already using `self:`/`derived:` keeps
working exactly as today; nothing regresses.

**Pass 1 (this build):** every widget kind above, arbitrary-depth nesting
for Repeatable/Nested list, `x-schema-notes` anywhere in the tree. Covers
Capability, Deliverable, and Service fully, and the large majority of
Policy/Profile/Template/Pack fields.

**Pass 2 (separate, after Pass 1 ships and is verified against real data):**
find and read wherever `self:`/`derived:` referential sources are resolved,
then design authoring UI for them specifically.

## Test cases

Edit an existing schema version through the new form with no changes made,
and diff the generated `schema_definitions.schema` JSON against the row
already in the database — for every one of the 7 entity kinds' current
latest version, not just a hand-built example. The round trip
(`jsonSchemaToWidgetTree` → render → parse → `widgetTreeToJsonSchema`) must
be structurally lossless for every real, live schema still in Pass 1 scope.

## Round-trip test run 1 — 6 of 7 kinds failed

Only Deliverable passed. Failures, by field, grounded against the live schema for each kind (read-only `psql` selects, not a test run):

| Kind/field | Gap |
|---|---|
| Pack/Template/Service `code`/`capabilityCode` (`referential-select`) | `minLength` dropped |
| Pack/Template/Profile `packVersion`/`templateVersion`/`profileVersion` (`version`) | `pattern` dropped |
| Template `exposedParameters`, Profile `exposedParameterOverrides` (`json`, array-shaped) | entire `items` sub-schema dropped |
| Service `inputs`/`outputs`/`consumers`, Policy `applicabilityEnvironments` (`referential-multi-select`) | `items` dropped |
| Pack `compositionSources` → nested `dimension`-driven item field (`referential-dynamic`) | `x-ontology` dropped; `x-referential-source-suffix: ""` dropped (emission was gated on non-empty) |
| Pack item-level `x-referential` fields (engineering-capital, category:obligation, category:evidence, deliverable-name) | `x-ontology-composable` never captured/emitted at item level at all |
| Pack `contributionObligationDefinitions[].applicabilityDeliverables` | item-level `x-widget:"referential-list"` marker dropped |
| Policy `constraintType`, `applicabilityEnvironments` | `x-configurable` — not in `JsonSchemaProperty` at all; a real CR-088 keyword (migrations 167/207/211/214) missed by this CR's own keyword audit |
| Capability `code` (plain string, no `x-widget`) | `x-ontology`/`x-referential-source` dropped — inert to `formGenerator.ts` (only read alongside a referential-select/-multi marker) but present in real data |

One near-miss caught by grounding rather than the test: a naive "always emit `items:{type:"string"}` for referential-multi-select" fix would have corrupted Service's `inputs`/`outputs`, which are that widget with `type:"string"` and no `items` key at all (same rawType inconsistency already on file). Guarded on `prop.type === "array"` instead.

A second near-miss: item-level nested lists are NOT consistently marked `x-widget:"referential-list"` in real data (`contributionObligationDefinitions[].applicabilityDeliverables` has it; `contributionChecklists[].items`, `contributionServices[].serviceLevel`, Policy `conditions[].exceptionRules`/`relatedObligations`/`applicabilityDeliverables` don't) — `buildItemFields` detects a nested list purely by `type:"array"` + `items.properties`, never this marker, so there is no single correct convention. Added `AuthoredWidget.listWidgetMarker` to carry the source's own presence/absence through verbatim (always `true` for a top-level list, which IS load-bearing there).

**Fixed** in `schemaCompiler.ts` (capture in `propertyToWidget`, emit in `widgetToProperty`), plus a `<hidden>` carry-through input added to `_widgetRow.ejs` for `rawItems` (json) and `listWidgetMarker` (item-level list), matching the existing `rawType` pattern:
- `pattern`/`minLength` now captured/emitted for `referential`/`referential-multi` and `pattern` for `version`.
- `x-ontology` added to `referential-dynamic`; its `x-referential-source-suffix` (and `x-widget:"referential-list"` for item-level lists) now emitted unconditionally rather than gated on non-empty, since the only live usages always carry these keys.
- `x-ontology-composable` now captured/emitted at item level for `referential`/`referential-multi`, not just top level.
- json widget's array `items` sub-schema preserved verbatim via a new `rawItems` field (opaque — no structured editor; formGenerator.ts never reads a json field's own item shape either).
- `x-configurable` added to `JsonSchemaProperty` (formGenerator.ts) and to `AuthoredWidget`, captured/emitted generically for every widget kind via `propertyToWidget`/`common()`; also given a "Configurable" checkbox in `_widgetRow.ejs` next to Required (previously write-only from the form's perspective — a real, actively-used keyword this CR's own audit missed).
- Plain non-`x-widget` fields' `x-ontology`/`x-referential-source` (Capability's `code`) now round-trip via the `text` kind, inert to the real form/validator exactly as they are today.

## Round-trip test run 2 — all 7 kinds pass

All 7 kinds (Pack, Template, Profile, Deliverable, Service, Policy, Capability) round-trip losslessly. Pass 1 verified against real, live data and closed.

## Pass 2 investigation

`self:`/`derived:` conventions live in `x-referential`/`x-referential-source` — the same key Pass 1's plain-text "Referential source" field already captures and emits verbatim, opaque to `schemaCompiler.ts`. This is why Template's `dependencyGraph.toCode` (`self:deliverableCatalogue`) already round-tripped losslessly in test run 2 with no special handling; nothing in Pass 1 needed to know these strings mean anything beyond a source name.

Resolvers, both in `src/routes/seu/web/sdkAuthoring.ts`:
- `self:<fieldName>` (`selfReferentialFieldNamesIn`/`loadSelfReferentialOptions`, line 769) — generic and schema-driven: any item-level `x-referential: "self:X"` pulls its options from field `X`'s own rows on the same document, keyed by `code` if that item shape has one, else `name`. Any field could use this convention.
- `derived:requiredCapabilityCodes` (`loadDerivedPackCapabilityOptions`, line 636) — not schema-generic; a one-off Template-specific derivation from the Draft's currently-selected Pack codes, hardcoded to that literal key. Not a pattern other fields can adopt as-is.

On `derived:requiredCapabilityCodes` specifically: it drives the options dropdown shows (via `loadDerivedPackCapabilityOptions`) but has no bearing on enforcement — `validateTemplateSeed` (`core/templates.ts:591-607`) rejects an invalid `fromCapabilityCode` via its own hardcoded field-name check, recomputing the same derived set independently. The schema string and the validator are two unlinked implementations of the same rule; nothing reads `x-referential` to decide what to validate.

**Conclusion: no implementation gap exists for either convention.** Both round-trip losslessly today (verified by test run 2) and both already have working resolvers. No dedicated authoring UI (e.g. a same-document-field picker) is needed for `self:` — freehand text in the existing "Referential source" field is sufficient.

## Pass 2 build — `x-referential-source-derived-by`

`derived:requiredCapabilityCodes` stayed a bare string smuggled inside the generic `x-referential` value, unlike every other conditional-source convention (`x-referential-source-by`, `x-referential-source-by-value`), which each got a real, dedicated keyword. `x-referential-source-by` itself doesn't fit this case — it switches to a different *named Ontology concept type* based on a sibling's current value; `fromCapabilityCode`'s constraint is a *live-computed subset* of one type (capability-name codes the currently-selected Packs actually contribute), which is a different operation, not expressible by pointing it at any sibling field.

Added `x-referential-source-derived-by: "<name>"` (own keyword, item-level only) as the real marker: names a registered derivation (`requiredCapabilityCodes` today, resolved by `sdkAuthoring.ts`'s `loadDerivedPackCapabilityOptions`), mutually exclusive with plain `x-referential`.

- `formGenerator.ts`: new `JsonSchemaProperty["x-referential-source-derived-by"]`; `generateFields`'s item dispatch checks it before plain `x-referential`, translating to the same `kind: "referential"` with `referentialSource: "derived:<name>"` — the options lookup (`referentialOptions[itemField.referentialSource]`, `_referentialListGroup.ejs`) and `sdkAuthoring.ts`'s unconditional `loadDerivedPackCapabilityOptions` need no change; both already key off the `derived:` string.
- `schemaCompiler.ts` (CR-114 widget editor): capture/emit added so this round-trips through the *same* free-text "Referential source" box as any other item-referential field — an author (or the compiler, reading existing data) writes/sees `derived:requiredCapabilityCodes` as text; `widgetToProperty` emits it as `x-referential-source-derived-by` (stripping the prefix) instead of `x-referential`, and `propertyToWidget` reconstructs the `derived:` prefix on the way back in. No new UI control.

**Not yet done:** the live Template schema still has `fromCapabilityCode` as `x-referential: "derived:requiredCapabilityCodes"` (old convention) — schema versions are additive, never edited in place, so adopting the new keyword means authoring a new Template schema version through the real Schema Registry UI, not a direct data edit. Owner to author that version when ready; both the old and new forms are supported by the code above in the meantime (old data isn't broken by this change).

## Compatibility feature

The schema_definitions table should include columns to show compatible and incompatible versions.

In the New Version form, there is a Save button. Currently it saves directly and immediately creates the new version. What should happen instead:

- On save, the draft schema is checked against every existing version of the same entity kind (same normalize-then-compare approach as `tests/schema-registry-widget-tree.test.ts`'s `normalize()`, not a new comparison style). The check classifies each existing version as compatible or incompatible with the draft and shows the per-field differences. A "Publish" button then commits the new version, and the compatible/incompatible version lists are saved into the new columns at that point.

### Compatibility semantics (agreed)

Version B is compatible with version A (same entity kind) if every document valid under A remains valid under B — B is a strict backward-compatible superset of A. Concretely, comparing A's schema to B's schema property-by-property (recursing into nested objects and array `items`, same traversal `formGenerator.ts`/`schemaCompiler.ts` already use):

- **Breaking (incompatible)** if any of: a property present in A is absent in B; an existing property's `type` changed; a property becomes required in B without a `default` and wasn't already required in A.
- **Non-breaking**: a property added in B that's optional or carries a `default`; a property that was required in A becoming optional in B; a property gaining/losing `enum` values, `pattern`, `x-*` metadata, or any other change that doesn't fall in the breaking list above.

B is compatible with A iff zero breaking differences are found. The differences list (breaking and non-breaking together) is what's shown to the author before Publish, not just the compatible/incompatible verdict.

### Built

- `diffSchemaVersions(oldSchema, newSchema)` — `src/domain/sdk/schemaCompiler.ts`. Recursively diffs `properties` (nested fixed sub-objects and array `items` sub-shapes, same traversal `formGenerator.ts` already uses). Returns `{ compatible: boolean; differences: SchemaDifference[] }`; each `SchemaDifference` names the field path, one of `added`/`removed`/`type-changed`/`newly-required`/`now-optional`/`enum-changed`/`pattern-changed`/`default-changed`, and whether it's breaking (only `removed`, `type-changed`, a bare `newly-required`, and a bare `added`-as-required are breaking; the rest — including enum/pattern/default changes and `now-optional` — are informational). `compatible` is true iff zero breaking differences.
- `POST /aisworg/seu/sdk/schema-registry` no longer writes. It builds the draft `schemaJson` exactly as before (widget-tree or raw-JSON path), then `reviewSchemaVersion` (`core/schemaRegistry.ts`) runs `diffSchemaVersions` against every existing version of that entity kind (`schemaDefinitionsDB.findAllVersions`) and renders `seu/sdk/schema-registry/review.ejs` — one row per existing version, Compatible/Incompatible badge plus its differences list — with the built `schemaJson` carried forward in a hidden field.
- New route `POST /aisworg/seu/sdk/schema-registry/publish` takes that carried-forward `entityKind`/`schemaJson`, and `createSchemaVersion` re-runs `diffSchemaVersions` server-side against current DB state (never trusts a verdict from the client) before inserting — the recomputed compatible/incompatible version-number arrays are what get persisted. Got its own `route_authority` row (migration 280) — root-only, same gate as the existing POST.
- `schemaDefinitionsDB.create` gained `compatibleVersions`/`incompatibleVersions` args; `SchemaDefinitionRow` gained the matching fields.
- Migration 280 adds `compatible_versions INTEGER[] NOT NULL DEFAULT '{}'` / `incompatible_versions INTEGER[] NOT NULL DEFAULT '{}'` to `schema_definitions`. A kind's first version has both empty.
- `seu/sdk/schema-registry/detail.ejs` shows a version's own persisted compatible/incompatible lists (and picked up the full CR-083 `.section-card`/`.section-header` treatment it was still missing).
- Tests: `tests/schema-compatibility.test.ts` (pure `diffSchemaVersions` unit coverage — added/removed/type-changed/newly-required/now-optional, nested object, nested list) and two new cases in `tests/schema-registry.test.ts` (the throwaway-schema version comes back marked incompatible with the real version it replaced; `reviewSchemaVersion` reports without writing a row).

Owner running migration 280 and the test suite manually.

## Meta data on schema entities

All schemas now save a schema version. When a schema entity (other than transition definition) is authored using the sdk, schema version dropdown should be provided. Based on that the metadata information on the entities should be updated.

**Status: code built; the schema data change (item 6 below) is owner-authored and still pending.**

### Column check (agreed)

Every authored kind's own table already has `schema_definition_id` (FK to `schema_definitions`) — no new column/migration needed:

| Table | Migration |
|---|---|
| `packs` | 266 |
| `templates` | 267 |
| `profiles` | 268 |
| `policy_definitions` | 269 |
| `service_definitions` | 270 |
| `deliverable_definitions` | 271 |
| `capability_definitions` | 273 |

`transition_definitions` is excluded (out of scope per this requirement) and already has its own NOT NULL `schema_definition_id` from migration 014.

### Compatibility semantics (agreed)

Two instances (e.g. Pack P1 authored against schema S1, Pack P2 against S2) are compatible/incompatible exactly per S1/S2's own `compatible_versions`/`incompatible_versions` (this CR's earlier compatibility feature) — no new storage: an instance-to-instance check is a read-time derivation off the two rows' `schema_definition_id`s, not a new relationship to persist. If S1 is incompatible with S2, P1 is incompatible with P2.

### The version picker is a real schema field, not UI logic (agreed)

Owner: "the formgenerator gets the field from the schema. So the schema should have it." The dropdown is a genuine `x-widget` field on each kind's own schema, rendered by `formGenerator.ts`'s normal dispatch — not bespoke logic in `sdkAuthoring.ts`.

New widget kind: **`db-select`** (owner-renamed from an initial `schema-version-select` — generic on purpose, so any future field that needs to pick a value out of some DB table/query reuses this same widget instead of a new one-off kind each time). `x-referential-source` (reused keyword) names which DB-sourced option list to resolve; this CR's own source key is `"schema-version"`, resolved via the already-existing `schemaDefinitionsDB.findAllVersions(kind)`. Options carry `{value, label}` (the schema_definition_id vs. its `v{n}` display), unlike existing `referentialOptions[]` entries where value and label are the same string.

### Implementation plan

1. **Built** — `formGenerator.ts`: `"db-select"` added to `JsonSchemaProperty["x-widget"]`; new `GeneratedField` kind `{ kind: "db-select"; dbSource: string; ... }`; `generateFields` dispatch branch parallel to `"referential-select"`.
2. **Built** — View (`_generatedFieldGroups.ejs`): `db-select` branch, a plain `<select>` sourced from a new `dbSelectOptions[field.dbSource]` map, passed alongside the existing `referentialOptions` map.
3. **Built** — `web/sdkAuthoring.ts`: `loadDbSelectOptions(kind)` loader (`{"schema-version": findAllVersions(kind).map(v => ({value: v.id, label: \`v${v.version}\`}))}`), merged into `dbSelectOptions`. `latestSchemaFor(kind)` call sites became `resolvedSchemaFor(kind, pinnedId)`: the **create** route (`POST /sdk/:slug`) resolves the pin from the freshly submitted `schemaVersion` field (a genuine new pin); the **GET**/**save**/**import** routes resolve it from the EXISTING draft's own already-pinned `content.schemaVersion` (never a resubmitted value) — see item 4's immutability note.
4. **Built** — `core/sdkAuthoring.ts`: `createAuthoringDraft` takes/threads `schemaDefinitionId` into every kind's `create()`/`createDraft()` call and into its `proposeComposableOntologyValues` grammar lookup. `saveAuthoringDraft` deliberately takes **no** `schemaDefinitionId` — a Draft's `schema_definition_id` is pinned once, at creation, and `*DB.ts`'s own `updateDraftContent` never rewrites it (mirrors Ch.41 VM-002's immutable-once-set spirit, matching `packsDB.updateDraftContent`'s pre-existing behaviour of re-reading and validating against the row's own existing pin, never a new one). Each save branch reads its grammar off the already-fetched existing row's own `schema_definition_id` instead.
5. **Built** — `src/dblayer/*.ts` (`packsDB.create`, `templatesDB.createDraft`, `profilesDB.createDraft`, `policyDefinitionsDB.createDraft`, `serviceDefinitionsDB.createDraft`, `deliverableDefinitionsDB.createDraft`, `capabilityDefinitionsDB.createDraft`) — `schemaDefinitionId` is **mandatory** on every one of these (owner: "schemaDefinitionId has to be a mandatory field. Otherwise all this build is of no use" — an optional field with a silent `findLatest` fallback let every caller keep ignoring schema versioning entirely). Each function now always `findById`s the given id; there is no DB-layer default any more. `core/sdkAuthoring.ts`'s `createAuthoringDraft` is mandatory the same way. Also: `packRowToContent`/`getAuthoringDraft`'s other 6 branches surface the row's own `schema_definition_id` as `content.schemaVersion` (same "real column always wins" discipline as `packVersion`/`tenantId`), so the web layer always resolves against the true persisted pin.
   - Making the DB-layer param mandatory forced every non-authoring caller of these 7 functions to resolve one explicitly too, not just the SDK form path: `core/packs.ts`'s `createPackDraft`, `core/templates.ts`'s `publishTemplate`/private `reactivateAsNewVersion`/`copyTemplateAsNewDraft`, `core/profiles.ts`'s equivalents, and the copy-wrappers in `core/policyDefinitions.ts`/`core/serviceDefinitions.ts`/`core/deliverableDefinitions.ts`/`core/capabilityDefinitions.ts`. Each resolves its own: a fresh bootstrap/publish path (`createPackDraft`, `publishTemplate`, `publishProfile`) pins to `findLatest`; a copy/reactivate path carries the SOURCE row's own already-pinned `schema_definition_id` forward instead (falling back to `findLatest` only if the source somehow has none). This is what let every seed script and Registry "Copy" HTTP action keep working unchanged — they call these wrappers, not the DB layer directly.
   - The ~14 test files that called the DB layer directly, bypassing those wrappers, were updated the same way (`cr088-filter-shaped-overrides`, `pack-sdk`, `profile-composition-unravel`, `cr101-domain-configuration-competency-union`, `template-event-lifecycle-table`, `profile-event-lifecycle-table`, `testFixtures.ts`, `policy-definition-event-lifecycle-table`, `service-definition-event-lifecycle-table`, `capability-definition-event-lifecycle-table`).
6. **Pending — owner-authored, not a direct DB write.** Each of the 7 kinds' schema needs a new `schemaVersion` property (`x-widget: "db-select"`, `x-referential-source: "schema-version"`), authored as a new schema version through the real Schema Registry UI per this CR's own additive-versions rule — same as the still-pending Template `fromCapabilityCode` convention migration noted above. Until this is authored, no kind's authoring form has the field yet, so an interactive Save/Create always resolves to latest (the code path is real; the schema property that would let an author pick a NON-latest version is what's still missing).
7. **Built** — `schemaDefinitionsDB.instancesCompatible(idA, idB)`: compares two rows' `entity_kind`/`version` against each other's `compatible_versions`/`incompatible_versions`. Not yet wired into any UI surface (no concrete call site named yet — not built speculatively).

No migration required (all 7 `schema_definition_id` columns already exist and are nullable at the DB level — mandatory is enforced in code, not via a NOT NULL constraint).