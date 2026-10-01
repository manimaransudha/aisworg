BEGIN;
DROP TABLE IF EXISTS authority_rules CASCADE;
CREATE TABLE authority_rules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT NOT NULL UNIQUE,
  governed_transition   TEXT NOT NULL,
  authorised_role       TEXT NOT NULL,
  originating_pack_id   UUID REFERENCES packs(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE authority_rules
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE authority_rules TO weirdo;
COMMIT;
