# CR-146 — Version hop: the version number and the previous version, recorded in version_events, for the SDK authoring entities

**Raised:** 2026-11-17 · **Origin:** the owner asked what version number a Pack takes at a hop (Pack 1.0.0 in Draft, then Validated). The code was read to answer. The Version Feature Plan (design/mvp-build-plan/Version Feature Plan.md) describes the version as the row's own `version` field and the version history as the `Version*` events.
**Status:** 🟡 Raised — design in progress

## Fix the following

- A hop whose Transition Definition has `version_hop` true computes the next version number and records it, together with the previous version, in `version_events`.
- The entity keeps one row. A hop does not create a new row and does not change the dependent rows.
- A hop whose `version_hop` is false is unchanged from today.

## What the code does today (read 2026-11-17)

| # | Finding | Evidence |
|---|---|---|
| 1 | `transitionEngine.evaluate` returns `nextVersion` as `bumpPatch(currentVersion)` when the row has a `version_event`, `version_hop` is not false and the caller passed `currentVersion`. | src/domain/engine/transitionEngine.ts:203 |
| 2 | No caller passes `currentVersion`, so `nextVersion` is always null. No code reads `nextVersion` from the outcome. Search: `grep -rn "currentVersion\|nextVersion" src` (ts). | transitionEngine.ts:30, 203; src/domain/engine/entityTransition.ts:41-48 |
| 3 | A governed hop runs the entity adapter's `setState`. For Pack this is `UPDATE packs SET status = $1 WHERE id = $2`. The row keeps its `pack_version`. The Template, Profile and Definition adapters were not read. | src/domain/engine/entityAdapters.ts:129-140; src/dblayer/packsDB.ts:388-396 |
| 4 | `version_event` makes `eventBus.publish` insert one `version_events` row. The table holds `event_id`, `tenant_id`, `entity_type`, `entity_id`, `from_state`, `to_state`, `version_event`, `occurred_at`, `actor_id` and `authority_badge`. It has no version number. It is indexed on (`entity_type`, `entity_id`, `occurred_at`) and on `tenant_id`. | src/domain/engine/eventBus.ts:79-88; src/dblayer/versionEventsDB.ts:26; src/dblayer/recovery/version_events_schema_recovery.sql |
| 5 | The `version_hop` column exists on `transition_definitions`, and the engine is its only reader. A null value counts as true. The Pack seed rows set `versionEvent` on five hops and never set `versionHop`. | transitionEngine.ts:203; transition_definitions_schema_recovery.sql:25; seed/data/transitionDefinitions.json |
| 6 | `PackRow.dependencies` holds `{ packCode, version }`. The branch code checks version numbers with `findByCodeAndVersion`. | seuTypes.ts:116; core/*Definitions.ts, templates.ts, profiles.ts |
| 7 | Every other version moment today is a copy of a row as a new Draft (`copyTemplateAsNewDraft`, `copyProfileAsNewDraft`, `copy<Kind>DefinitionAsNewDraft`, `inheritedPackVersionContent`). It takes the next free patch version and stores no pointer to the source row. | packs.ts:736; sdkAuthoring.ts:628; the copy table below |
| 8 | Pack has no `parent*`, `previous*` or `supersed*` column. Template and Profile have `parent_template_id` and `parent_profile_id`. The five Definitions have `parent_*_definition_id`. These columns mean inheritance. | seuTypes.ts:107-125, 149, 172, 206, 231, 299, 319, 340; sdkAuthoring.ts:603; templates.ts:606 |

## Settled design

| Point | Decision |
|---|---|
| Rows | An entity keeps one row through its hops. A version hop creates no new row and changes no dependent row. |
| Where the version is recorded | `version_events` carries the version information. It is updated with new columns. |
| Entities | Every SDK authoring entity: the eight kinds that src/routes/seu/core/sdkAuthoring.ts handles, which are Pack, Template, Profile, Deliverable, Service, Policy, QualityGate and Capability. `TransitionDefinition` is in `SchemaDefinitionEntityKind` and has no branch in that file. |
| Hop with `version_hop` true | The hop computes the next version number and records it in `version_events` together with the previous version. |
| Hop with `version_hop` false | Unchanged from today. |

Replaced decision: an earlier draft of this CR created a new row at each version hop with a `previous_version_id` column on every entity. The owner replaced it on 2026-11-17 with the single row and the `version_events` columns above.

## Still open

| # | Open point |
|---|---|
| 1 | The columns added to `version_events`. The version number is one. The previous version is either the previous number as text or a link to the previous `version_events` row of the same entity. |
| 2 | Whether the hop also updates the row's own version column (`pack_version`, `template_version`, `profile_version`, `version`). If it does, a reference by code and version (finding 6) no longer finds the earlier number. If it does not, the row keeps its Draft number and the current version is read from the latest `version_events` row. |
| 3 | The chain across a branched copy, which is a new Draft row from an existing version. A pointer to another row is needed there. Whether it is a column on the new row or a field of its first `version_events` row. |
| 4 | The first number of a row. Whether the Draft row is the first entry of its chain, and what the first `version_events` row of an entity holds as its previous version. |
| 5 | The behaviour when the computed number is already taken by a branched copy of the same code. `bumpPatch` does not check it. |
| 6 | The seed value of `version_hop` on every Transition Definition row, since null counts as true today. |
| 7 | The caller that passes `currentVersion` to the engine and the code that writes the number, which today is not read from the outcome. |
| 8 | Migration and recovery SQL for the new columns, the existing `version_events` rows, and the Version Feature Plan wiring. |
| 9 | The scenarios the owner wants to go through. They are recorded here when agreed. |

## Copy paths read 2026-11-17

| Entity | Copy path | What it copies | Version number | Pointer to the source row |
|---|---|---|---|---|
| Template | `copyTemplateAsNewDraft` (src/routes/seu/core/templates.ts:585) | The columns. The `draftContent` is rebuilt from the source's pack selections (`getPackSelectionsByCategory(source.id)`) and the deliverable catalogue. | Next free patch | None. It writes the source's own `parent_template_id`. |
| Profile | `copyProfileAsNewDraft` (src/routes/seu/core/profiles.ts:550) | The columns. The `draftContent` is rebuilt from `getProfilePackSelections(source.id)` and the source's `draft_content`. | Next free patch | None. It writes `source.parent_profile_id`. |
| Capability, Deliverable, Policy, Service and Quality Gate Definitions | `copy<Kind>DefinitionAsNewDraft` in src/routes/seu/core/ | The columns of the row and a `draftContent` built from them. No other table is read. | Next free patch | None. Each writes the source's own `parent_*_definition_id`. |
| Pack | No copy function. `inheritedPackVersionContent` (src/routes/seu/core/sdkAuthoring.ts:628) returns the source's contributions, dependencies and `composition_sources` as the content of a new draft. The route that creates the draft was not read. | Contributions, dependencies, `composition_sources` | `packCodeVersionSummaries(...).nextVersion` | None |

Other findings from the same reading:

- None of the copies carries the source's comments.
- The five Definition copies publish the birth event with `versionEvent: birth.versionEvent` and `tenantId`. The Template and Profile copies pass neither.

## Checked and not a problem

| Point | Result |
|---|---|
| Active supersede logic | `activatePackSupersedingPrevious` reads the earlier Active row of the same code, moves the row to Active and retires the earlier Active row. With one row per entity the function is unchanged (src/routes/seu/core/packs.ts:477-493). |

## Test fixtures

To be listed when the design is complete. The lifecycle-table tests of the entities (for example tests/pack-event-lifecycle-table.test.ts) drive hops and will need review.
