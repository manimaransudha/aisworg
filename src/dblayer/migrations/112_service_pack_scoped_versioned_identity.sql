-- CR-064 — Service: Pack-scoped identity, real definition-side versioning.
-- Was: services_code_key UNIQUE (code), globally unique, silently clobbered
-- across Packs on republish (ON CONFLICT (code) DO UPDATE, no history).
-- Owner: "service code will be unique within a pack and not unique across
-- packs" — a Development Pack and a Deployment Pack can each declare their
-- own Service under the exact same code, with different content.
--
-- Versioning (owner: "Versioning is definition side") follows Quality
-- Gate's own precedent (migration 091), not Checklist/Policy's in-place
-- upsert: version becomes a real "major.minor" TEXT column (was an inert
-- INTEGER, always 1), bumped on every real content change, a new immutable
-- row per version — matching Ch.11 §13's own "historical Service versions
-- remain available for reconstructing past dependency evaluations."
ALTER TABLE services
  ALTER COLUMN version DROP DEFAULT,
  ALTER COLUMN version TYPE TEXT USING version::text,
  ALTER COLUMN version SET DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ALTER COLUMN service_level SET DEFAULT '[]'::jsonb;

-- Existing rows: only one version has ever existed for any of them (version
-- was always 1, never incremented) — '1.0' for all, all active. service_level
-- was always '{}' (dead, no real consumer ever populated it — Ch.11 §18
-- audit) — CR-064 changes its real shape to an array of {label, target}
-- items, so the empty representation moves from '{}' to '[]' too.
UPDATE services SET version = '1.0', is_active = true, service_level = '[]'::jsonb WHERE service_level = '{}'::jsonb;
UPDATE services SET version = '1.0', is_active = true WHERE version <> '1.0' OR NOT is_active;

ALTER TABLE services DROP CONSTRAINT IF EXISTS services_code_key;
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_pack_code_version_key;
ALTER TABLE services ADD CONSTRAINT services_pack_code_version_key UNIQUE (originating_pack_id, code, version);

-- Partial index: at most one ACTIVE row per (originating_pack_id, code) slot
-- — the real uniqueness guarantee servicesDB.upsertFromPack's lookup relies
-- on — while historical (is_active = false) versions of that same slot
-- coexist as immutable history.
CREATE UNIQUE INDEX IF NOT EXISTS services_active_pack_code_key
  ON services (originating_pack_id, code)
  WHERE is_active;
