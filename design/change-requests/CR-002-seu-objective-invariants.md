# CR-002 — Enforce SEU↔Objective invariants (Ch.1 §18.2)

**Raised:** 2026-08-12 · **Origin:** Chapter 1 §18 deep-dive (§18.2) · **Status:** ✅ Built 2026-08-12

### ✅ Built 2026-08-12
Migration `034_seu_objective_unique.sql` adds a `UNIQUE` index on `seus.objective_id` (at most one SEU per Objective, DB-enforced). `commissionSeu` — the single choke point for every commissioning path — now rejects, ahead of the constraint, a non-Engineering-tier Objective (`must be Engineering-tier…`) and an Objective that already has an SEU (`already assigned to an SEU…`, via `seusDB.findByObjectiveId`). **Verified:** tsc · regression **146/146** (clean DB) · dry-run **77/77** · unique index present · HTTP audit — re-commissioning an assigned Objective and commissioning a Strategic Objective are both refused with the clear reasons.

### Decision
The one-to-one SEU↔Objective model must be **enforced**, not merely relied upon. Two invariants, neither present today:
1. **At most one SEU per Objective** — add a `UNIQUE` constraint on `seus.objective_id` (DB-enforced, not an app check). An Objective cannot be commissioned twice.
2. **Engineering-tier only** — the commissioned Objective must be `tier = 'Engineering'`; reject a non-Engineering Objective at commissioning with a clear reason. Optional additional schema enforcement via a composite FK to a unique `(id, tier)` with `CHECK (tier = 'Engineering')`.

### Current state (gap being closed)
- No `UNIQUE`/index on `seus.objective_id` (only indexes on `objectives(parent)`/`objectives(status)`) → the same Objective can currently be commissioned by two SEUs.
- [commissioning.ts](../../src/routes/seu/core/commissioning.ts) looks the Objective up by id + checks existence/status but performs **no tier check** → a Strategic/Operational Objective can be commissioned against.

### Impact (for build, when approved)
- **Migration** — add `UNIQUE (objective_id)` to `seus`. Backfill risk: verify no existing duplicates before applying (clean DB today, but the constraint add must be guarded).
- **Commissioning** — add an Engineering-tier guard (reject early, same shape as the existing Authority rejection). This also becomes the enforcement point CR-003's UI relies on.
- **Tests/dry-run** — commissioning fixtures already use Engineering Objectives; confirm none rely on double-commissioning or non-Engineering tiers.

### Related
Enables CR-003's "already assigned" detection. Chapter 1 §18.2 / §18.7 updated to mark this as decided-and-to-build.
