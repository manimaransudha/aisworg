BEGIN;
DROP TABLE IF EXISTS services CASCADE;
CREATE TABLE services (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  providing_capability_id  UUID NOT NULL REFERENCES capabilities(id),
  name                     TEXT NOT NULL,
  contract_description     TEXT NOT NULL,
  service_level            JSONB NOT NULL DEFAULT '{}',
  status                   TEXT NOT NULL DEFAULT 'Active'
                              CHECK (status IN ('Defined', 'Published', 'Active', 'Deprecated', 'Retired', 'Archived')),
  version                  INTEGER NOT NULL DEFAULT 1,
  originating_pack_id      UUID REFERENCES packs(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE services ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE services ALTER COLUMN code SET NOT NULL;
ALTER TABLE services
  ALTER COLUMN version DROP DEFAULT,
  ALTER COLUMN version TYPE TEXT USING version::text,
  ALTER COLUMN version SET DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ALTER COLUMN service_level SET DEFAULT '[]'::jsonb;
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_code_key;
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_pack_code_version_key;
ALTER TABLE services ADD CONSTRAINT services_pack_code_version_key UNIQUE (originating_pack_id, code, version);
CREATE UNIQUE INDEX IF NOT EXISTS services_active_pack_code_key
  ON services (originating_pack_id, code)
  WHERE is_active;
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE services TO weirdo;
COMMIT;
