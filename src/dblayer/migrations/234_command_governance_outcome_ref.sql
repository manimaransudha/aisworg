-- CR-109 Build Plan §6 — step 4: Command's own governanceOutcomeRef (§6.2),
-- pointing at migration 233's governance_evaluation_outcomes. Set once, by
-- executionEngine.execute(), at Command creation — never re-derived
-- downstream (Work Item Generator reads it off the Command instead of
-- re-querying Policy/Obligation state live).
ALTER TABLE commands
  ADD COLUMN IF NOT EXISTS governance_outcome_id UUID REFERENCES governance_evaluation_outcomes(id);
