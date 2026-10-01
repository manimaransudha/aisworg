# Recovery scripts + clean-slate DATA_MIGRATION_TARGETS — session state

## Settled

- `src/dblayer/recovery/*.sql` (68 files): converted `CREATE TABLE IF NOT EXISTS`
  to `DROP TABLE IF EXISTS ... CASCADE` + `CREATE TABLE`, stripped comments,
  added `GRANT ALL PRIVILEGES ON TABLE <table> TO weirdo;` per file.
- `src/dblayer/recovery/run.ts`: runs all scripts in an explicit hardcoded
  dependency-order array (not a directory scan), so a from-scratch run
  doesn't hit "relation does not exist" on FK order.
- Three FK cycles broken by deferring one side's constraint to an
  `ALTER TABLE ... ADD CONSTRAINT` inside the later script in run order:
  - `tenants.author_id → participants_master`: column created without the FK
    in `tenants_schema_recovery.sql`; constraint added at the end of
    `participants_master_schema_recovery.sql`.
  - `seus.active_ebm_id → ebms`: column created without the FK in
    `seus_schema_recovery.sql`; constraint added at the end of
    `ebms_schema_recovery.sql`.
  - `evidence.originating_decision_id → decisions`: FK dropped entirely (not
    deferred) — that column is added then dropped again later in the same
    script, so it never reaches the final schema; the FK was never
    load-bearing.
- `src/dblayer/seed/cleanSlate.ts`: removed the direct
  `DELETE FROM transition_definitions WHERE required_authority_rule_id IN
  (SELECT id FROM authority_rules WHERE originating_pack_id IS NOT NULL)`
  statement (was line ~432). `transition_definitions` is a
  `DATA_MIGRATION_TARGETS` table (`core/dataMigrations.ts`) and clean-slate
  must never delete from it, full stop — no substitute/compensating delete
  logic was added. Consequence left unaddressed on purpose: if a stale
  `transition_definitions` row still references a Pack-attributed
  `authority_rules` row, the plain `DELETE FROM authority_rules WHERE
  originating_pack_id IS NOT NULL` a few lines below may now hit the FK
  error the removed code's comment used to describe. Not patched — owner's
  explicit instruction was "do not delete", not "delete something else
  instead."
- Confirmed: none of the 9 `DATA_MIGRATION_TARGETS` tables
  (`transition_definitions`, `authority_noun_verbs`, `event_registry`,
  `event_subscriptions`, `schema_definitions`, `capability_definitions`,
  `service_definitions`, `route_authority`, `ontology_concepts`) is actively
  seeded by `cleanSlate.ts` — all their seed-function calls are commented out
  or never invoked.
- Requirement confirmed with owner: clean-slate must never seed OR delete
  any of the 9 tables (only the admin Data Migration screen populates them).
  `participants_master` is a separate, softer exception: every row except
  root's (`user_id = 1`) should be deleted/refreshed each run; root's own
  row must survive untouched (same UUID) since the 9 tables' `author_id`/
  `authored_by` columns point at it. Root's participants_master row does
  NOT need re-seeding by clean-slate — a real login already seeds it
  (`seedIdentityBaseline.ts`'s `WHERE NOT EXISTS (... WHERE user_id = 1)`
  insert is already idempotent/no-op once that row exists).

## Found mid-session, NOT yet acted on

- **Recovery scripts vs. real migration history mismatch**: `badge_types`,
  `authority_nouns`, `authority_verbs` recovery scripts each add
  `author_id UUID NOT NULL REFERENCES participants_master(id)`, but **no
  file under `src/dblayer/migrations/` ever adds `author_id`/`authored_by`
  to those three tables** (only `239_knowledge_structure.sql`,
  `281_schema_definition_lifecycle_state.sql`, and
  `285_ontology_concepts_author.sql` touch those columns anywhere, on
  different tables). This means those three recovery scripts do not
  faithfully reconstruct the live schema — pre-existing bug, not introduced
  by this session's edits. Owner's read: "we are missing a cleanup on the
  dblayer" — implies a broader audit of `src/dblayer/recovery/*.sql` against
  `src/dblayer/migrations/*.sql` is needed before trusting any of them
  as the FK-cascade source of truth for the `participants_master` fix.

## Next step (where we left off)

1. Do the dblayer cleanup/audit first: reconcile every `src/dblayer/recovery/
   *_schema_recovery.sql` file's columns/constraints against the actual
   `src/dblayer/migrations/*.sql` history (not against each other), fixing
   any recovery script that invents a column/FK no real migration ever
   created. Scope not yet narrowed to a file list — ask which tables/dirs
   before starting, per repo's "reject overly broad requests" rule, unless
   the whole `src/dblayer/recovery/` directory is the intended scope (it was
   already named this session for the earlier DROP+CREATE work).
2. Only after that audit: revisit the `participants_master` "keep root,
   delete rest" fix in `cleanSlate.ts` using the *migrations* (not the
   recovery scripts) as the true picture of what references
   `participants_master`, then implement:
   - pull `participants_master` out of `USAGE_DATA_TABLES`'s truncate list
     (`cleanSlate.ts` ~line 288),
   - change step 1b's `TRUNCATE TABLE users RESTART IDENTITY CASCADE` so it
     doesn't cascade-wipe root's `participants_master` row via
     `participants_master.user_id → users(id)` (likely `DELETE FROM users
     WHERE id <> 1`, no `RESTART IDENTITY`),
   - add an explicit `DELETE FROM participants_master WHERE user_id IS
     DISTINCT FROM 1` step, placed only after every other table that could
     hold a non-root `author_id`/`authored_by` has already been
     cleared/reseeded (verified Pack/Template/Policy reseed steps 6-9 all
     author as root, `actorId: "1"` — see `seedCapabilityPatternPacks.ts`).
3. Owner's manual test plan once the above lands: run
   `src/dblayer/recovery/run.ts` → log in and run the Data Migration UI on
   all 9 tables → run `pnpm db:clean-slate` → run `pnpm test` themselves
   (never run any of these three commands directly — owner runs them).
