-- Participant Lifecycle Governance — Plan (design/mvp-build-plan/Participant
-- Lifecycle Governance — Plan.md), Build order step 1. `participants.state`
-- has carried Ch.13 §9's exact lifecycle as a schema CHECK constraint since
-- 002_seu_platform.sql, but nothing governed it — 'Participant' becomes the
-- 12th TransitionEntityType here (entity_type CHECK widened on
-- transition_definitions/quality_gates across every migration that
-- redeclares it — 003/006/007/008/009/010 — the same rerun-safety fix the
-- last several migrations have each had to repeat for the same reason,
-- since run.ts replays every migration file on every invocation).
--
-- updated_at added to match every other governed entity's own updateStatus
-- shape (obligations/evidence/decisions/attention_items/external_interactions
-- all set updated_at = NOW() on transition; participants had no such column).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'participants' AND column_name = 'updated_at') THEN
    ALTER TABLE participants ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;
