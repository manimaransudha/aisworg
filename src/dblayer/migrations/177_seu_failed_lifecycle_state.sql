-- Add the 'Failed' terminal lifecycle_state — a commissioning attempt that
-- died during "Validate Request" or "Compose EBM", before ever reaching
-- Commissioned (design/mvp-build-plan/SEU Composition.md, "Retry after a
-- failed commission"). Distinct from 'Retired' (Chapter 2 §19.5's own real,
-- governed state graph: Retired is reached only from Operational, after a
-- full successful run) — reusing it here would be a semantic misuse. The
-- SEU row itself is never deleted on failure; the authoritative record of
-- what happened is its own CommissionFailed event (seu_id + event type), not
-- this column — this value exists purely so the Objective-level "at most one
-- active SEU" uniqueness check (migration 179) can exclude it.
ALTER TABLE seus DROP CONSTRAINT IF EXISTS seus_lifecycle_state_check;
ALTER TABLE seus ADD CONSTRAINT seus_lifecycle_state_check
  CHECK (lifecycle_state IN ('Pending', 'Commissioned', 'Configured', 'Activated', 'Operational', 'Suspended', 'Retired', 'Archived', 'Failed'));
