-- Owner (2026-09-22): "why do we even need this? the intent is to log the
-- badge along with the actor_id." commands.acting_badge_grant_id /
-- attestations.acting_badge_grant_id were a hard FK to badge_grants(id) — a
-- specific, revocable grant ROW. That stopped being resolvable once the real
-- authority check moved to participants_master.authorised_badges (no row
-- identity to point an FK at). The actual need was always simpler: which
-- badge CODE the actor used, alongside requested_by/actor_id already on
-- these tables — not a live reference to a revocable grant. Renamed +
-- retyped to make that plain; no FK (a badge code is a fact about the
-- action at the time, not a live-checked reference).
--
-- Migration 023 now creates acting_badge_type directly (TEXT, no FK) for a
-- fresh install, so the column named acting_badge_grant_id only exists on a
-- database migrated before this pass — guarded, not unconditional.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commands' AND column_name = 'acting_badge_grant_id') THEN
    ALTER TABLE commands DROP CONSTRAINT IF EXISTS commands_acting_badge_grant_id_fkey;
    ALTER TABLE commands ALTER COLUMN acting_badge_grant_id TYPE TEXT USING acting_badge_grant_id::text;
    ALTER TABLE commands RENAME COLUMN acting_badge_grant_id TO acting_badge_type;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attestations' AND column_name = 'acting_badge_grant_id') THEN
    ALTER TABLE attestations DROP CONSTRAINT IF EXISTS attestations_acting_badge_grant_id_fkey;
    ALTER TABLE attestations ALTER COLUMN acting_badge_grant_id TYPE TEXT USING acting_badge_grant_id::text;
    ALTER TABLE attestations RENAME COLUMN acting_badge_grant_id TO acting_badge_type;
  END IF;
END $$;
