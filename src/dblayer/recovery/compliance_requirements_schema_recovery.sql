BEGIN;
DROP TABLE IF EXISTS compliance_requirements CASCADE;
CREATE TABLE compliance_requirements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT NOT NULL UNIQUE,
  framework_code      TEXT NOT NULL REFERENCES compliance_frameworks(code),
  name                TEXT NOT NULL,
  description         TEXT,
  criteria            JSONB NOT NULL DEFAULT '{}',
  severity            TEXT NOT NULL DEFAULT 'Medium',
  conflicts_with      TEXT[] NOT NULL DEFAULT '{}',
  originating_pack_id UUID REFERENCES packs(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_compliance_requirements_framework ON compliance_requirements (framework_code);
ALTER TABLE compliance_requirements
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE compliance_requirements TO weirdo;
COMMIT;
