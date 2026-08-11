-- Participant Integration & Attestation — Plan, Build step 1 (async Work Item
-- + participant callback). Model A (Resolution 11): every Work Item is
-- outstanding *for* a target transition; a result-in callback drives that
-- transition uniformly. The dispatch pipeline stops simulating execution
-- synchronously — a dispatched Work Item now enters a real outstanding state
-- ('Dispatched') and waits for an out-of-process result callback, rather than
-- being run to 'Disposed' in the same call. 'Failed' captures a participant
-- reporting failure/blocked. output_reference holds the VCS reference the
-- participant returns on completion — the raw candidate output (Plan
-- resolution #3: the raw reference, distinct from the later attestation;
-- stored durably here because the Work Item row persists as a historical
-- record even once Disposed, Ch.32 WI-001/WI-003).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_items' AND column_name = 'output_reference') THEN
    ALTER TABLE work_items ADD COLUMN output_reference TEXT;
  END IF;
END $$;

ALTER TABLE work_items DROP CONSTRAINT IF EXISTS work_items_status_check;
ALTER TABLE work_items ADD CONSTRAINT work_items_status_check
  CHECK (status IN ('Generated', 'Assigned', 'Dispatched', 'Executing', 'Completed', 'Failed', 'Cancelled', 'Disposed'));
