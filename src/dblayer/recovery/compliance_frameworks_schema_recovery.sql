BEGIN;
DROP TABLE IF EXISTS compliance_frameworks CASCADE;
CREATE TABLE compliance_frameworks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  description         TEXT,
  originating_pack_id UUID REFERENCES packs(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE compliance_frameworks
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE compliance_frameworks TO weirdo;
COMMIT;
