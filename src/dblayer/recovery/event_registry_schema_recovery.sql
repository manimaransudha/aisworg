BEGIN;
DROP TABLE IF EXISTS event_registry CASCADE;
CREATE TABLE event_registry (
  event_type   TEXT PRIMARY KEY,
  description  TEXT
);
ALTER TABLE event_registry
  ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE event_registry
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE event_registry TO weirdo;
COMMIT;
