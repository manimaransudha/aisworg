-- Governance & EBM Sharpening — Plan (design/mvp-build-plan/Governance and EBM
-- Sharpening Plan.md), Phase 16 step 1 (Ch.3 FR-3.3/FR-3.10). Every Engineering
-- Behavior Model shall be versioned. Supersession status already existed; this
-- adds the explicit version integer. ebmsDB.create computes the next version per
-- SEU (1 for the first, prior+1 on a recomposition that supersedes).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ebms' AND column_name = 'version') THEN
    ALTER TABLE ebms ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
  END IF;
END $$;
