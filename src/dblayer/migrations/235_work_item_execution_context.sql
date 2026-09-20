-- CR-109 Build Plan §6 — Work Item Generator design, step 7: Ch.32 §7/§11's
-- Execution Context, resolved once by workItemGenerator.generate and stored
-- here — not re-derived by the Participant chasing command_id through other
-- tables (Ch.32 19.7's own gap). WI-006 (reproducible): this is a stored
-- snapshot, not a live view.
ALTER TABLE work_items
  ADD COLUMN IF NOT EXISTS execution_context JSONB;
