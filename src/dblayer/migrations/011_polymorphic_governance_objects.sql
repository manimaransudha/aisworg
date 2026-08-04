-- Post-completion fix, logged in Open Design Questions.md #3 — Quality Gates
-- were wired to exactly one entity type (Deliverable), short of Ch.29 §10's
-- own spec ("every Transition Definition shall specify applicable Quality
-- Gates... mandatory Evidence... blocking Obligations", not just
-- Deliverable's). The root of that gap: qualityGateEngine's two criteria
-- types (no_unresolved_obligations, requires_accepted_evidence_or_
-- approved_decision) resolved Obligations/Evidence/Decisions by a single
-- required deliverable_id FK — they could never have meant anything for a
-- Quality Gate on, say, a Knowledge Item or an Attention Item, because
-- nothing could attach an Obligation to one.
--
-- Fix: obligations/evidence/decisions move from a Deliverable-only FK to a
-- polymorphic (related_object_type, related_object_id) pair — the same
-- pattern attention_items already uses, and for the same reason: the related
-- object can now be any governed entity type, so a single FK can't span all
-- of them. No FK constraint is possible here, same tradeoff already accepted
-- for attention_items.related_object_id.
--
-- Every existing row is Deliverable-attached today (that was the only shape
-- the schema allowed), so this migration backfills related_object_type =
-- 'Deliverable' / related_object_id = the old deliverable_id before dropping
-- it. The backfill+drop is wrapped in a existence check (not just DROP
-- COLUMN IF EXISTS) because the UPDATE statement itself references
-- deliverable_id — on a rerun, once that column is already gone, even a
-- correctly-idempotent "WHERE related_object_id IS NULL" clause would still
-- fail to *parse* against a column that no longer exists. Checking
-- information_schema first skips the whole block on every run after the
-- first, matching this codebase's established rerun-safety discipline
-- (every migration file is reapplied on every invocation of run.ts).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'obligations' AND column_name = 'deliverable_id') THEN
    ALTER TABLE obligations ADD COLUMN related_object_type TEXT;
    ALTER TABLE obligations ADD COLUMN related_object_id UUID;
    UPDATE obligations SET related_object_type = 'Deliverable', related_object_id = deliverable_id WHERE related_object_id IS NULL;
    ALTER TABLE obligations ALTER COLUMN related_object_type SET NOT NULL;
    ALTER TABLE obligations ALTER COLUMN related_object_id SET NOT NULL;
    DROP INDEX IF EXISTS idx_obligations_deliverable;
    ALTER TABLE obligations DROP COLUMN deliverable_id;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_obligations_related ON obligations (related_object_type, related_object_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'evidence' AND column_name = 'deliverable_id') THEN
    ALTER TABLE evidence ADD COLUMN related_object_type TEXT;
    ALTER TABLE evidence ADD COLUMN related_object_id UUID;
    UPDATE evidence SET related_object_type = 'Deliverable', related_object_id = deliverable_id WHERE related_object_id IS NULL;
    ALTER TABLE evidence ALTER COLUMN related_object_type SET NOT NULL;
    ALTER TABLE evidence ALTER COLUMN related_object_id SET NOT NULL;
    DROP INDEX IF EXISTS idx_evidence_deliverable;
    ALTER TABLE evidence DROP COLUMN deliverable_id;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_evidence_related ON evidence (related_object_type, related_object_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'decisions' AND column_name = 'deliverable_id') THEN
    ALTER TABLE decisions ADD COLUMN related_object_type TEXT;
    ALTER TABLE decisions ADD COLUMN related_object_id UUID;
    UPDATE decisions SET related_object_type = 'Deliverable', related_object_id = deliverable_id WHERE related_object_id IS NULL;
    ALTER TABLE decisions ALTER COLUMN related_object_type SET NOT NULL;
    ALTER TABLE decisions ALTER COLUMN related_object_id SET NOT NULL;
    DROP INDEX IF EXISTS idx_decisions_deliverable;
    ALTER TABLE decisions DROP COLUMN deliverable_id;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_decisions_related ON decisions (related_object_type, related_object_id);
