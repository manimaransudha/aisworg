# SQL Performance Review (static)

Scope: `src/dblayer/*DB.ts` queries against `src/dblayer/recovery/*.sql` definitions. No EXPLAIN or live DB was used. Indexes that exist only in the live DB, and not in the recovery files, are not seen here.

## Where SQL lives

| Location | Finding |
|---|---|
| `src/dblayer/*DB.ts` | All table queries (about 9.9k lines). |
| `src/utils/db.ts` | Pool and `bulkInsert`. Pool max is 10 (`MAX_CONNECTIONS`). |
| `src/utils/listQuery.ts` | Generic paginated query, shared by lists (see F6). |
| `src/routes/seu/core/identity.ts` lines 45-67, 208-219 | Direct `query()` calls outside the DB layer: `badge_types`, `users`, `participants_master`. Rule deviation; unbounded `SELECT` of `users` and `participants_master`. |

## Findings (highest impact first)

| # | Finding | Evidence | Fix |
|---|---|---|---|
| F1 | 38 of 76 recovery files define no index. Foreign keys are not indexed in Postgres automatically. | See F2 for the hot columns. | Add the indexes in F2 as a migration plus the recovery files. |
| F2 | Hot filter columns with no index (not leading in any unique or index). | Table below. | Table below. |
| F3 | `$1::uuid IS NULL OR seu_id = $1` pattern. The planner cannot use an index with a generic plan. | `deliverablesDB.ts:70,85`, `knowledgeItemsDB.ts:170`, `qualityGateEvaluationsDB.ts:59,79`, `runtimeTelemetryDB.ts:9,29,53`, `seusDB.ts:136` | Build two statements (all vs. one SEU) in code, or add the clause only when set. |
| F4 | Row-by-row INSERT loops. One round trip and one pool checkout per row, and not atomic. | `objectivesDB.ts:284,302`, `seuCapabilitiesDB.ts:14`, `profilesDB.ts:312`, `templatesDB.ts:283,334` | One statement using `unnest($1::uuid[])` or the existing `bulkInsert`. |
| F5 | `SELECT *` in 246 places. Wide rows (JSONB content, schemas) are fetched when a few columns are needed. | `grep "SELECT \*" *DB.ts` | Narrow it on list and lookup paths first (`packs`, `templates`, `profiles`, `seus`, `deliverables`, `events`). |
| F6 | Paginated lists run a separate `count(*)` and `ILIKE '%q%'` on several columns, including `s.id::text` (`seusDB.ts:129`). None of these can use a B-tree index. | `listQuery.ts:123-136` | Add `pg_trgm` GIN indexes on the searched text columns, drop `id::text` from the search, and run count and page concurrently. |
| F7 | Unbounded `findAll` and global `COUNT(*)` on large tables. | `eventsDB.ts:210`, `evidenceDB.ts:181`, `seusDB.ts:145`, `packsDB.ts:377`, `commandsDB.ts` | Paginate, or use `pg_class.reltuples` for dashboards. |
| F8 | `events` is filtered by `event_type`, `correlation_id` and `consumption_state` (JSONB), and the table grows without bound. Only `seu_id` and `tenant_id` are indexed. | `eventsDB.ts:59,84,221`; `events_schema_recovery.sql` | Add `(event_type, created_at)`, `(correlation_id)`; consider a partial index on pending consumption. |
| F9 | `badge_types` uses `tenant_id IS NULL OR tenant_id = $1`. Two partial unique indexes exist and cover it, but the query is read on most requests. | `badgeTypesDB.ts:87` | Cache per tenant (the Ontology and badge sets change rarely). |
| F10 | Nested `EXISTS` subselects on `participants` for the SEU list. | `seusDB.ts:136`, `decisionsDB.ts:65` | Covered once `participants (participant_id, seu_id)` is indexed (F2). |

## F2 detail: missing indexes

| Table | Filter or join column used | Proposed index |
|---|---|---|
| `deliverables` | `seu_id`, `lifecycle_state`, `producing_capability_id` | `(seu_id, lifecycle_state)` |
| `commands` | `seu_id`, `requested_by` | `(seu_id, created_at DESC)` |
| `decisions` | `seu_id`, `knowledge_id`, `evidence_id` | `(seu_id)` |
| `obligations` | `seu_id` | `(seu_id)` |
| `participants` | `seu_id`, `participant_id` | `(seu_id)`, `(participant_id, seu_id)` |
| `participants_master` | `tenant_id`, `user_id` | `(tenant_id)`, `(user_id) WHERE user_id IS NOT NULL` |
| `capability_fulfilments` | `seu_capability_id` and `revoked_at IS NULL` ordered by `established_at`; `participant_id` | `(seu_capability_id, established_at) WHERE revoked_at IS NULL`, `(participant_id) WHERE revoked_at IS NULL` |
| `work_items` | `status = 'Dispatched'` with `target_completion_at`; `participant_id` with status | `(target_completion_at) WHERE status = 'Dispatched'`, `(participant_id, status)` |
| `evidence` | `deliverable_id`, `seu_id`, `supersedes_evidence_id` | one index each |
| `seus` | `tenant_id`, `lifecycle_state`, `template_id`, `profile_id` | `(tenant_id, lifecycle_state)`, plus FK columns |
| `packs`, `templates`, `profiles` | `tenant_id` (the unique key leads with `code`) | `(tenant_id)` |
| `objectives` | `parent_objective_id`, `status` | `(parent_objective_id)`, `(status)` |
| `transition_definitions` | `entity_type`, `from_state` | covered by `UNIQUE(entity_type, from_state, to_state)` |
| `events` | see F8 | see F8 |

## Suggested order

1. F2 and F8 indexes (largest effect, lowest risk, data change only).
2. F3 (rewrite the `IS NULL OR` filters).
3. F4 (batch inserts).
4. F6 and F7 (list search, counts).
5. F5 and F9 (column narrowing, badge cache).

## Implementation status

Not run: tsc, tests, and any SQL against the live DB.

| # | Status | Not updated, and why |
|---|---|---|
| F1 | Done | None. The 38 files are covered by the F2 and F8 indexes. |
| F2 | Done | `evidence (seu_id)` omitted: `evidence_schema_recovery.sql` drops that column. |
| F3 | Done | None. |
| F4 | Done | None. The DELETE before each insert is a separate statement; callers needing delete-plus-insert atomic must use `withTransaction`. |
| F5 | Partly | `packs`, `templates`, `profiles`, `seus` narrowed through new `listOptionRows`, `listActiveOptionRows` and `listSummaryRows` methods. `deliverables` and `events` unchanged: small rows, and `events` consumers read `payload`. The shared `findAll` functions still return full rows because their callers render them. |
| F6 | Done | `pg_trgm` index covers `objectives.statement` only. `lifecycle_state` has too few values to benefit. |
| F7 | Partly | Only `eventsDB.count()` uses `pg_class.reltuples`. `seusDB.count`, `packsDB.count` and the `evidenceDB` count stay exact. `packsDB.findAll` stays unpaginated: its callers need the full list. The other named `findAll` functions do not exist or already have a `LIMIT`. |
| F8 | Done | The pending-consumption partial index is omitted: no query filters on `consumption_state`. Added `(originating_object_type, originating_object_id)` instead. |
| F9 | Done | In-process cache with a 60 second expiry (`BADGE_TYPES_CACHE_TTL_MS`). A write made by another process is seen after the expiry. |
| F10 | Done | Covered by the `participants` indexes. |
| Direct `query()` in `identity.ts` | Done | Moved to `userDB`, `participantsMasterDB`. The identity dashboard is paginated in SQL. The `role` sort on the users page is removed. |

Open items:

- Apply the new indexes and `CREATE EXTENSION pg_trgm` to the live DB. `src/dblayer/migrations` does not exist, so only the recovery files carry them.
- Run `EXPLAIN (ANALYZE, BUFFERS)` and the `pg_stat_user_tables` check listed below.

## To confirm before building

- Run `EXPLAIN (ANALYZE, BUFFERS)` on the SEU list, deliverables list and telemetry queries against the live DB.
- Query `pg_stat_user_tables` (`seq_scan` vs `idx_scan`) and `pg_indexes` to confirm which indexes already exist.
