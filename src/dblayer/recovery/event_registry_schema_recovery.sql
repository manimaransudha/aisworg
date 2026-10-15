BEGIN;
DROP TABLE IF EXISTS event_registry CASCADE;
CREATE TABLE event_registry (
  event_type   TEXT NOT NULL,
  description  TEXT
);
ALTER TABLE event_registry
  ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE event_registry
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
ALTER TABLE event_registry
  ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE event_registry ADD CONSTRAINT event_registry_pkey PRIMARY KEY (event_type, version);
CREATE UNIQUE INDEX IF NOT EXISTS event_registry_one_active_per_type ON event_registry (event_type) WHERE is_active;
GRANT ALL PRIVILEGES ON TABLE event_registry TO weirdo;
COMMIT;
