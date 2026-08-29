-- CR-068: user-friendly hierarchical display identifier for Objectives
-- (Strategic roots: 1, 2, 3 ... per tenant; their Operational children: N.1,
-- N.2 ...; Engineering grandchildren: N.M.1, N.M.2 ...). System-assigned once
-- at creation, gap-tolerant (never reused/compacted after a delete), frozen
-- on re-parent (CR-069, deferred, covers renumber-on-move).
--
-- No DB-level NOT NULL/UNIQUE constraint on display_id, deliberately, matching
-- this CR's own decision for objectives.requested_by ("the schema does not
-- need the constraint — it has to be imposed by the app"): a root's segment is
-- only unique per-tenant (not globally), which a plain column-level UNIQUE
-- constraint can't express without a real tenant_id column this CR's design
-- explicitly treats as redundant (tenant is reached via requested_by ->
-- users.tenant_id).

-- Counter for THIS Objective's own children — lives on the parent row itself,
-- so assigning a child's segment is a single atomic UPDATE ... RETURNING
-- (Postgres's row lock on the parent row serializes concurrent siblings, no
-- SELECT ... FOR UPDATE needed).
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS next_child_seq INTEGER NOT NULL DEFAULT 1;

-- The full, immutable, human-facing id ("1", "1.2", "1.2.3") — computed once
-- at creation and never recomputed (re-parenting freezes it).
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS display_id TEXT;

-- Per-tenant counter for Strategic (root) segments — a root has no parent row
-- to hold a counter on, so it needs this dedicated table. One row per tenant,
-- created lazily via INSERT ... ON CONFLICT on that tenant's first root.
CREATE TABLE IF NOT EXISTS objective_root_sequences (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id),
  next_seq  INTEGER NOT NULL DEFAULT 1
);
