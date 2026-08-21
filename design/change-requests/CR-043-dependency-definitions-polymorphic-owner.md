# CR-043 — `dependency_definitions`: polymorphic owning scope (Template / Pack / Profile)

**Raised:** 2026-08-20 · **Origin:** owner, designing CR-041 — Decision/Obligation/Evidence/Knowledge dependency rules are naturally authored wherever those types are actually defined (Pack contributions — `contributionObligationDefinitions` etc.), not on a Template, but `dependency_definitions.template_id` was hardcoded `NOT NULL`, unable to represent that. Owner: "If it is authored in template, we use the template_id. If it is authored in pack, we use pack_id. If it is authored in profile, it uses profile id." · **Status:** ✅ Built 2026-08-20

> **Built 2026-08-20.**

## The problem this fixes

CR-039 built `dependency_definitions` scoped to exactly one owner: `template_id`. That was correct for what it needed at the time (Deliverable/Capability rules, which really are a fact about one Template's own catalogue), but it structurally can't represent a rule authored somewhere else:

- A **Pack**-contributed rule ("no unresolved Obligations blocks any Deliverable's In Progress → Approved transition") applies wherever that Pack gets composed, across every Template that pulls it in — it has no single Template to belong to. This is exactly the shape `qualityGateEngine`'s existing `quality_gates`/`contributionQualityGates`/`contributionObligationDefinitions` mechanism already uses. A hardcoded `template_id` column can't hold it, which is why an earlier pass in this same conversation concluded Decision/Obligation/Evidence/Knowledge rules would have to permanently stay on `qualityGateEngine`, never migrated into `dependency_definitions` — a conclusion this CR reverses by removing the actual blocker.
- A **Profile**-authored rule (environment-specific: "Production configuration requires an extra step Development doesn't") has the same issue — no Template to own it either.

## Design

**Schema.** Replace `template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE` with a polymorphic pair: `owning_entity_type TEXT NOT NULL CHECK (owning_entity_type IN ('Template', 'Pack', 'Profile'))`, `owning_entity_id UUID NOT NULL`. No real FK (Postgres can't conditionally target three different tables from one column) — the same soft-reference pattern this codebase already uses for `related_object_type`/`related_object_id` on Obligation/Evidence/Decision/Review/Finding. This means the real `ON DELETE CASCADE` this table had is gone; cleanup on Template/Profile/Pack deletion becomes an explicit step (see Not in scope / cleanSlate note below), not automatic.

**Evaluation gathers from every scope relevant to the SEU, not one id.** Today `isTargetReady(seuId, templateId, ...)` runs one query filtered by a single `template_id`. Under this CR it needs the SEU's full scope set — its own Template, every Pack actually composed into its active EBM (`ebmsDB`'s `composed_packs`, already a real stored list), and its Profile — and finds rows owned by *any* of them: `WHERE (owning_entity_type='Template' AND owning_entity_id=$templateId) OR (owning_entity_type='Profile' AND owning_entity_id=$profileId) OR (owning_entity_type='Pack' AND owning_entity_id = ANY($composedPackIds))`, further filtered by the same `to_entity_type/to_name/to_state` match as today. Per-row satisfaction (`isRowSatisfied`) is unchanged — only which rows get collected before checking them changes. `isTargetReady`'s signature moves from taking a bare `templateId` to resolving (or being handed) the SEU's own composed-Packs list and Profile alongside its Template.

**This is a schema/engine change only — no new authoring surface.** CR-043 makes the table *capable* of representing Pack/Profile ownership; it does not build a Pack-side or Profile-side authoring UI, and it does not migrate any of `qualityGateEngine`'s existing criteria into `dependency_definitions`. Nothing populates a Pack- or Profile-owned row as a result of this CR alone — `deriveDependencyDefinitionsFromCatalogue.ts` keeps producing `owning_entity_type: "Template"` rows exactly as before, just through the new column shape. CR-041 (Template-side authoring widget) and any future Pack-side authoring both depend on this CR existing, not the other way around.

## What changed

- **Migration 074** — `template_id` replaced with `owning_entity_type TEXT NOT NULL CHECK (IN ('Template','Pack','Profile'))`, `owning_entity_id UUID NOT NULL`; existing rows backfilled as `owning_entity_type='Template'`. Indexes rebuilt without a leading `template_id`: `(to_entity_type, to_name, to_state)`, `(from_entity_type, from_name, from_state)`, `(owning_entity_type, owning_entity_id)`.
- **`dependencyDefinitionsDB.ts`** — `create`/`findByOwner`/`deleteByOwner` (single-scope, authoring shape) alongside `findByTarget`/`findBySource`/`findByTargetName`/`findBySourceName`, now all taking a `DependencyOwningScope { templateId, profileId, packIds }` and matching `(owning_entity_type='Template' AND id=$templateId) OR (owning_entity_type='Profile' AND id=$profileId) OR (owning_entity_type='Pack' AND id = ANY($packIds))`.
- **`dependencyDefinitionEngine.ts`** — every public method now takes a bare `seuId` and resolves its own full scope internally (`resolveOwningScope`: the SEU's Template, every Pack in its active EBM's `composed_packs`, its Profile) — callers no longer assemble or pass a scope themselves. This actually *simplified* every call site: `isTargetReady(seuId, toEntityType, toName, toState)` instead of needing a separately-fetched `templateId`.
- **All four live call sites updated**: `core/deliverables.ts`'s gate, `core/seus.ts`'s display (reuses its own already-fetched `ebm` — no extra query), `core/traceability.ts` (both `explainDeliverable`/`impactOfDeliverable`, via a small local `resolveOwningScope` helper), `assignmentDelivery.ts`.
- **`deriveDependencyDefinitionsFromCatalogue.ts`** — always writes `owning_entity_type: "Template"`.
- **`cleanSlate.ts`** — the old `ON DELETE CASCADE` is gone (no real FK can conditionally target three tables), so Template/Profile-owned rows are now deleted explicitly in step 2a (before their owner), and non-base-Pack-owned rows in step 2c — both logged with real counts.

## Real bug found and fixed during the build (not in the original plan)

`deriveDependencyDefinitionsFromCatalogue`'s delete-then-insert isn't atomic against another process doing the same thing concurrently for the same owner — two `DELETE`s can each see "nothing to remove" before either `INSERT` commits, since there's no row for either to lock against. With 16+ test files each deriving via their own `node --test` process against the shared dev database, this produced real accumulated duplicate rows over the course of this session (caught by a test assertion expecting exactly 2 rows and getting 5). Fixed properly, not papered over: **migration 075** adds a real `UNIQUE NULLS NOT DISTINCT` constraint on the natural key (`owning_entity_type, owning_entity_id, from_entity_type, from_name, from_state, to_entity_type, to_name, to_state`), and `create()` now does `ON CONFLICT ... DO NOTHING` against it — a concurrent duplicate insert is now a safe no-op instead of a silent duplicate. Existing accumulated garbage (396 stale rows, mostly orphaned from earlier `db:clean-slate` runs replacing Template rows with fresh UUIDs before this CR's explicit cleanup existed) was cleared by the `db:clean-slate` run used for verification below.

## Verification

- `npx tsc --noEmit` clean throughout.
- `tests/dependency-definition-engine.test.ts` (3 tests) and `governance-depth.test.ts`'s two "Dependency Engine has nothing to say here" checks updated to the new signature and green.
- Full suite: **149/149** passing, against the real dev database, after migrations 074 and 075 were applied live.
- `pnpm db:clean-slate` run live twice — first run confirmed the explicit cleanup step logs real counts (396 stale rows from before this CR existed); second run confirmed steady state: 0 orphaned Template-owned rows, exactly 44 `dependency_definitions` rows per each of the 9 freshly-reseeded CR-034 standard Templates, no duplication.

## Not in scope

- Any Pack-side or Profile-side authoring UI for `dependency_definitions` rows — CR-041 covers Template-side only; Pack/Profile authoring is unscheduled, future work this CR merely stops blocking.
- Migrating `qualityGateEngine`'s existing Obligation/Evidence/Decision criteria into `dependency_definitions` — this CR removes the structural blocker, it doesn't do the migration itself.
- CR-042's push-evaluation wiring — tracked separately; this CR's scope-gathering logic is a dependency of it (per CR-042's own updated open questions), not the other way around.
