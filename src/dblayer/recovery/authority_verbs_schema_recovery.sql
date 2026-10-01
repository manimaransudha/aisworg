BEGIN;
DROP TABLE IF EXISTS authority_verbs CASCADE;
CREATE TABLE authority_verbs (
  code        TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE authority_verbs
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE authority_verbs TO weirdo;
COMMIT;
