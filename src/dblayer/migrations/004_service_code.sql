-- Post-MVP Phase 2 — found via the Phase 2 audit, not introduced by it:
-- services never got a stable `code` column or a unique constraint, unlike
-- every other seed-upserted table (packs, capabilities, authority_rules,
-- policies, templates, profiles all have ON CONFLICT (code) DO UPDATE).
-- servicesDB.upsertFromPack was a plain INSERT, so every `pnpm seed:seu`
-- re-run silently created two new duplicate Service rows. This migration
-- adds the missing column/constraint and dedupes what's already there,
-- re-pointing any dependency_edges that reference a duplicate onto the
-- earliest-created ("canonical") row of the same name first, so no existing
-- SEU's dependency graph breaks.

ALTER TABLE services ADD COLUMN IF NOT EXISTS code TEXT;

UPDATE services
SET code = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE code IS NULL;

WITH ranked AS (
  SELECT id, code, created_at,
         ROW_NUMBER() OVER (PARTITION BY code ORDER BY created_at ASC, id ASC) AS rn
  FROM services
),
canonical AS (
  SELECT code, id AS canonical_id FROM ranked WHERE rn = 1
),
dupes AS (
  SELECT r.id AS dupe_id, c.canonical_id
  FROM ranked r
  JOIN canonical c ON c.code = r.code
  WHERE r.rn > 1
)
UPDATE dependency_edges de
SET to_service_id = d.canonical_id
FROM dupes d
WHERE de.to_service_id = d.dupe_id;

WITH ranked AS (
  SELECT id, code,
         ROW_NUMBER() OVER (PARTITION BY code ORDER BY created_at ASC, id ASC) AS rn
  FROM services
)
DELETE FROM services WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

ALTER TABLE services ALTER COLUMN code SET NOT NULL;
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_code_key;
ALTER TABLE services ADD CONSTRAINT services_code_key UNIQUE (code);
