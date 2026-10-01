BEGIN;
DROP TABLE IF EXISTS capabilities CASCADE;
CREATE TABLE capabilities (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 TEXT NOT NULL,
  name                 TEXT NOT NULL,
  description          TEXT,
  category             TEXT,
  originating_pack_id  UUID REFERENCES packs(id),
  version              INTEGER NOT NULL DEFAULT 1,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE capabilities
  ALTER COLUMN version DROP DEFAULT,
  ALTER COLUMN version TYPE TEXT USING version::text;
ALTER TABLE capabilities DROP CONSTRAINT IF EXISTS capabilities_code_key;
ALTER TABLE capabilities DROP CONSTRAINT IF EXISTS capabilities_pack_code_key;
ALTER TABLE capabilities ADD CONSTRAINT capabilities_pack_code_key UNIQUE (originating_pack_id, code);
ALTER TABLE capabilities
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE capabilities TO weirdo;
COMMIT;
