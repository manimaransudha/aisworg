-- Participant Integration & Attestation — Plan step 4, refined 2026-08-11.
-- The stall SLA is materialized as a concrete target completion time set ON the
-- Work Item when it is assigned to a Participant, rather than re-derived from
-- the Service Level at sweep time. This makes the target a commitment fixed at
-- assignment (editing a Capability's turnaround_time later does not move an
-- already-assigned item's deadline), turns the stall sweep into one indexed
-- set-based query (`status = 'Dispatched' AND target_completion_at < now`), and
-- means pre-existing outstanding Work Items (target NULL) are simply never
-- escalated. It is also the assignment-out contract's deadline (Plan §2.2).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_items' AND column_name = 'target_completion_at') THEN
    ALTER TABLE work_items ADD COLUMN target_completion_at TIMESTAMPTZ;   -- null = no declared SLA -> never stall-escalated
  END IF;
END $$;

-- Partial index for the overdue sweep: only outstanding Work Items with a
-- declared target are ever scanned.
CREATE INDEX IF NOT EXISTS idx_work_items_overdue
  ON work_items (target_completion_at)
  WHERE status = 'Dispatched' AND target_completion_at IS NOT NULL;
