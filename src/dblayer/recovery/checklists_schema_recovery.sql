BEGIN;
DROP TABLE IF EXISTS checklists CASCADE;
CREATE TABLE checklists (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  description           TEXT,
  originating_pack_id   UUID NOT NULL REFERENCES packs(id),
  items                 JSONB NOT NULL DEFAULT '[]',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS checklists_pack_name_key
  ON checklists (originating_pack_id, name);
ALTER TABLE checklists
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE checklists TO weirdo;
COMMIT;
