BEGIN;
DROP TABLE IF EXISTS compliance_waivers CASCADE;
CREATE TABLE compliance_waivers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id            UUID NOT NULL REFERENCES seus(id),
  requirement_code  TEXT NOT NULL REFERENCES compliance_requirements(code),
  rationale         TEXT NOT NULL,
  granted_by        UUID REFERENCES participants_master(id),
  status            TEXT NOT NULL DEFAULT 'Active',
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_compliance_waivers_seu ON compliance_waivers (seu_id);
ALTER TABLE compliance_waivers
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE compliance_waivers TO weirdo;
COMMIT;
