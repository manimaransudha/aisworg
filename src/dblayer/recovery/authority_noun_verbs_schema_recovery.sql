BEGIN;
DROP TABLE IF EXISTS authority_noun_verbs CASCADE;
CREATE TABLE authority_noun_verbs (
  noun_code  TEXT NOT NULL REFERENCES authority_nouns(code) ON DELETE CASCADE,
  verb_code  TEXT NOT NULL REFERENCES authority_verbs(code) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (noun_code, verb_code)
);
ALTER TABLE authority_noun_verbs ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE authority_noun_verbs
  ADD COLUMN IF NOT EXISTS default_trigger TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE authority_noun_verbs DROP CONSTRAINT IF EXISTS authority_noun_verbs_default_trigger_check;
ALTER TABLE authority_noun_verbs
  ADD CONSTRAINT authority_noun_verbs_default_trigger_check
  CHECK (default_trigger IN ('manual', 'governed'));
ALTER TABLE authority_noun_verbs
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE authority_noun_verbs TO weirdo;
COMMIT;
