-- Owner request (2026-09-22): every Participant identity holds the 'general'
-- authorised_role (migration 254) by default, standing/no expiry
-- (effective_till 9999-12-31), unscoped (seu_ids empty = every SEU).
-- Column default so every future participants_master row picks it up
-- automatically, plus a one-time backfill for rows already seeded. The
-- backfill is idempotent (only touches rows with no existing 'general'
-- entry), so a full migration replay never duplicates it.
ALTER TABLE participants_master
  ALTER COLUMN authorised_role SET DEFAULT '[{"role":"general","effective_till":"9999-12-31","seu_ids":[]}]'::jsonb;

UPDATE participants_master
SET authorised_role = authorised_role || '[{"role":"general","effective_till":"9999-12-31","seu_ids":[]}]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM jsonb_array_elements(authorised_role) AS entry
  WHERE entry->>'role' = 'general'
);
