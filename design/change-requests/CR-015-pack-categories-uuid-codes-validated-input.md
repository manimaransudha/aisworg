# CR-015 — Pack authoring: data-driven categories, UUID codes, and schema-validated input

**Raised:** 2026-08-13 · **Origin:** owner — reviewing the new Pack authoring form: `code` should not be a hand-typed text field; Pack categories should be data (like nouns/verbs); and every form submission / JSON import must be validated against the schema validator. · **Status:** ✅ Built 2026-08-14

> **Built 2026-08-14.** `tsc` clean; full suite **142 pass / 0 fail / 1 skip**. Smoke-verified over real logins: the Pack form has **no `code` field**, `category` is a **referential select sourced from `pack_category`** (a newly-inserted category appears in the form with no code change), an **invalid import is hard-rejected** / a valid one accepted, and a full author→publish yields a **UUID pack code**. Not committed (owner commits via GitHub Desktop).
>
> **Files:** migration [038_pack_category.sql](../../src/dblayer/migrations/038_pack_category.sql) (table + seed + drop CHECK + grammar update), [packCategoriesDB.ts](../../src/dblayer/packCategoriesDB.js), [core/packs.ts](../../src/routes/seu/core/packs.js) (`validatePackSeed` → table), [core/sdkAuthoring.ts](../../src/routes/seu/core/sdkAuthoring.js) (`toPackSeedInput` UUID `code`), [web/sdkAuthoring.ts](../../src/routes/seu/web/sdkAuthoring.js) (`pack-category` referential options; `validateAgainstSchema` on import [reject] + save [warn]).
>
> **Decisions:** (1) the Pack grammar is updated **in place at v1** (not a v2) — a development-time correction of the shipped baseline; keeps it consistent with `db:clean-slate`'s "trim `schema_definitions` to v1". Nuance: a dev DB carrying stale authored Pack versions (>v1) must be trimmed (clean-slate does this) or `findLatest` serves the stale grammar. (2) Save validates but **doesn't block** (incremental draft); **import hard-rejects**. (3) `PackCategory` stays a doc-only TS union; runtime category is validated dynamically against the table.

### Principle being realised
The versioned **schema validator** (`schema_definitions`, in the DB, authorable via `/aisworg/seu/sdk/schema-registry`, immutable/additive versions — Ch.5 §19.2) is the **single source of truth**: the form is generated *from* it (`formGenerator`) and all input is validated *against* it (`validateAuthoredContent`). This CR closes the places that don't yet honour that, plus makes Pack **category** data-driven. (Templates and Profiles are independent first-class entities that share this machinery — **not** Packs; TransitionDefinition stays a distinct authoring kind as today.)

### 1. `pack_category` as data (drop the hardcoded CHECK)
Today `packs.category` is a hardcoded `CHECK (category IN ('Platform','Organisation','Domain','Compliance','Technology','Integration'))` (migration `002`) — so a new category needs a migration, contradicting Ch.5 §17 "new Pack categories can be introduced without changing the Runtime Kernel" (the gap recorded in §19.6).

- **New table `pack_category`** (`code` PK, `label`, `is_active`, `created_at`), same shape/discipline as `authority_nouns` (migration `035`) — additive, soft-retire via `is_active`, never delete/rename.
- **Migration** seeds the six current categories and **drops the `packs.category` CHECK** (the same move CR-006 made for the noun `entity_type` CHECK). Category is validated in code against active `pack_category` rows.
- The Pack grammar's `category` enum is **sourced from the table**, not a literal enum in the schema JSON (so a new category flows to the form automatically).
- **A new category is a data insert** — no migration, no kernel change. Closes §19.6 / satisfies §17.

### 2. `code` is a system UUID, not an editable field
`code` is the Pack's stable reference identity (§8 Identifier; referenced by `dependencies.packCode`, Templates/Profiles, and the EBM). Hand-typing it invites typos, collisions and drift from `name`.

- **Remove `code` from the Pack authoring grammar's user fields.** It is **system-generated** (a UUID) at create; the author only enters `name` (and the rest).
- Existing seeded packs keep their human-readable codes (`platform-core-engineering`, …) — unchanged; this applies to newly authored packs.
- **Note:** references (`dependencies.packCode`) then carry UUIDs — the dependency picker should display **name** for legibility. Template/Profile codes are **out of scope** here (decide separately if they should follow the same UUID scheme).

### 3. Validate on import *and* save (not only at submit/publish)
`validateAuthoredContent` (structural + referential, per kind) currently runs only at **submit-for-review** and **publish**. The import path (`POST …/import`) does `JSON.parse` + save with **no** schema validation, and `…/save` isn't validated either.

- Run `validateAuthoredContent` at the **import** and **save** entry points, so malformed input is rejected where it enters, not later. Applies to **all** authoring kinds (Pack/Template/Profile/TransitionDefinition) — they share the import/save routes.
- (Decision: whether an invalid *save* hard-rejects or saves-with-warnings; recommend hard-reject on import, and allow-with-surfaced-errors on incremental save — to confirm at build.)

### Files (indicative)
- New migration: `0NN_pack_category.sql` (table + seed + drop CHECK).
- `packsDB` / `core/packs.ts` (`validatePackSeed`) — validate category against `pack_category`; generate UUID `code`.
- Pack `schema_definitions` grammar (migration/authored version) — drop `code` from user fields; `category` sourced from the table.
- `web/sdkAuthoring.ts` import/save routes + `core/sdkAuthoring.ts` — validate on import/save.

### Not in scope
- Structured (schema-defined) **contributions** and the §20 verifiable-item fields — that's **CR-016**.
- Template/Profile code scheme.
