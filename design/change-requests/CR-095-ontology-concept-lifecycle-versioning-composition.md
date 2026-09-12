# CR-095 — Ontology concept governed lifecycle, versioning, and composition

**Raised:** 2026-09-11 · **Origin:** owner: "Ontology has to be added as a new noun in transition definition. And the transitions have to be as per design/foundations Chapter 18. Don't forget the versioning. Allow tenants to compose using the composition strategy that packs already have implemented." · **Status:** ✅ **Built 2026-09-11.**

## The gap

Chapter 18's own implementation audit (§18.7, §18.6, §18.9) already named this exactly: `ontology_concepts` was a flat, mutable, single-row-per-code table with a bare `is_active` boolean — no version, no history, no governed lifecycle, no composition mechanism, and zero of the chapter's own 7 named events (§14) ever published. "Ontology" was already a noun in `authorityVocabulary.json` (`ontology_define` gates the existing add/retire CRUD) but had **zero** `transition_definitions` rows — the noun existed, the transitions did not.

## Design

**Noun**: already present (`authorityVocabulary.json`'s `nouns[]` and `authoringMappings[]`); nothing to add there. Added to the TypeScript `TransitionEntityType` union (`seuTypes.ts`) so `transitionEngine`/`badgeAuthorityEngine` can govern it like every other entity.

**Lifecycle (Ch.18 §11)**: `Active → Deprecated → Retired → Archived`, no Draft/Validated/Published prefix — a concept goes live the moment it's added (no review workflow exists anywhere in this chapter's own build, §18.8), so Active is the initial state, not a birth transition (this codebase's own "creation authority is not a transition" discipline). No skip-ahead edges, matching Pack/Template/Service Definition's own discipline. Real governed transitions via `transitionEngine.evaluate`, badge = `ontology_{verb}` (`ontology_deprecate`/`ontology_retire`/`ontology_archive`), with `alternateBadges: ['ontology_define']` so every existing `ontology_define`/root holder keeps full access with **no new badge grants required**.

**Versioning (Ch.18 §12 — "historical Ontologies shall remain available")**: full multi-version-row model, the same shape as Pack/Template/Profile/Service Definition — one row per Version, unique on `(concept_type, code, tenant_id, version)`. Adding a concept whose code already exists publishes a new Version (auto-bumped patch) and automatically supersedes the previous Active row to Deprecated — never an in-place overwrite. This was the user-confirmed choice over a lighter single-row version counter (which wouldn't have actually closed §18.7's own gap).

**Composition** (owner: "allow tenants to compose using the composition strategy that packs already have implemented"): reuses `domain/engine/compositionEngine.ts` directly — the same module Pack authoring's own `composeAuthoringDraft` calls. Scoped to **Specialization** (copy a source concept's label/description into a new/own code, free to diverge) and **Override** (publish a new Version of the tenant's own existing concept) — user-confirmed over full 6-strategy parity, since Merge/Union/Intersection/Supplement don't have clear meaning over a 2-field entity with a single composition source in the common case.

**Events (Ch.18 §14)**: `ConceptCreated`, `ConceptUpdated`, `ConceptDeprecated`, `OntologyComposed` now publish for real (4 of the 7 named events, up from 0). `OntologyValidated`/`SemanticConflictDetected`/`SemanticConflictResolved` are **not** built — they require real ontology-wide conflict-detection logic (FR-18.6), a materially separate, unscoped piece of work the chapter's own audit already flagged; not fabricated here.

## Built 2026-09-11

**Migration [190](../../src/dblayer/migrations/190_ontology_concept_lifecycle_versioning.sql)**: `ontology_concepts` gets `version` (TEXT, default `'1.0.0'`) and `status` (`Active`/`Deprecated`/`Retired`/`Archived`, backfilled from the old `is_active`), replacing `is_active` outright (its one application-code reader, `assertCanonicalCategory`, updated). Unique constraint widens to include `version`. New `composition_strategy`/`composition_sources` columns. 3 new `transition_definitions` rows for `entity_type = 'Ontology'` with `event_type`/`version_event` per the Version Feature Plan mechanism (migration 183's own convention). 3 new `authority_noun_verbs` rows (reference catalog only — not consulted by the actual authorisation check, kept in sync anyway). Applied directly against the live DB (this repo's own "migration replay is fragile, apply directly" convention), not via `migrate:seu`/`db:clean-slate`.

**`seuTypes.ts`**: `"Ontology"` added to `TransitionEntityType`; `OntologyConceptRow` updated (`is_active` → `version`/`status`/`composition_strategy`/`composition_sources`).

**`ontologyDB.ts`**: `findConcept`/`findConceptsByType` now resolve `status = 'Active'` specifically (the picker/validation view is unchanged in behaviour — a Deprecated/Retired/Archived concept is invisible exactly as a retired one was before). New `findActiveConcept`/`findConceptById`/`findLatestVersion`/`findConceptByCodeAndVersion`, `insertConceptVersion`, `updateConceptStatus`, replacing `upsertConcept`/`retireConcept`.

**`core/ontology.ts`**: `addConcept` is now version-aware (create-or-publish-new-version, auto-superseding). New `deprecateConcept`/`retireConcept`(rewritten)/`archiveConcept` — real governed transitions through `transitionEngine`. New `composeConcept` (Specialization/Override). New `syncConceptFromEntity`/`retireConceptForEntity` — system-sync entry points for `deliverableDefinitions.ts`/`serviceDefinitions.ts`, which used to call `ontologyDB.upsertConcept`/`retireConcept` directly to mirror their own `deliverable-name`/`service-name` concept rows; these bypass `addConcept`'s user-input guards (the `deliverable-name` authoring block) since the code/label already came from an already-governed row.

**Consumer fixups** (`commissioning.ts`, `profiles.ts` ×4, `sdkAuthoring.ts`): `concept.is_active` reads collapsed to a plain non-null check, since `findConcept` now only ever returns the Active row.

**`web/ontology.ts`**: new `/deprecate`, `/archive`, `/compose` POST routes; `actorFrom` now threads `actorId`; row mapping exposes `version`/`status`/`compositionStrategy`/`compositionSources` instead of `isActive`.

**`ontology/index.ejs`**: Version column, 4-state status badges (Active/Deprecated/Retired/Archived, distinct colours), one action button per row (whichever single governed hop its current status allows — no skip-ahead), a collapsible "Compose from an existing concept" panel (Specialization/Override, picking from every Active concept of the current type), and a composition-strategy badge on any row that was composed.

**Seed parity**: `authorityVocabulary.json`'s `transitions[]` and `transitionDefinitions.json` both updated with the same 3 Ontology rows, so a future `db:clean-slate` reseed matches the live migration exactly (migration 137's own dual-write precedent).

**Verified**: `npx tsc --noEmit` clean throughout. Migration applied directly and confirmed via `psql` (schema + 3 transition rows + 3 authority_noun_verbs rows all present as designed). Not run: the existing `tests/ontology-model.test.ts` suite (no test-fixture changes were needed — it never touches `is_active`/`upsertConcept`/`retireConcept` directly — but the suite itself wasn't executed this pass; worth a real test run before this is considered fully verified). Not manually smoke-tested in a browser — this session's own dev-server processes were stopped after discovering several long-running pre-existing `tsx watch` processes already serving this app; starting a competing instance risked port/DB-pool conflicts with the user's own environment.

## Not in scope

- `OntologyValidated`/`SemanticConflictDetected`/`SemanticConflictResolved` (FR-18.6) — real conflict-detection logic, unscoped, still open per the chapter's own audit.
- Merge/Union/Intersection/Supplement composition strategies for concepts (user-confirmed cut).
- Per-SEU Ontology snapshots (FR-18.1's own gap, §18.7) — untouched; every SEU under a tenant still shares that tenant's (+ Platform's) vocabulary.
- Splitting `ontology_deprecate`/`ontology_retire`/`ontology_archive` into separately-grantable badges distinct from `ontology_define` — the `alternateBadges` mechanism keeps today's single-badge reality working; a future tenant that wants finer-grained authority can grant those badges directly with no code change.
