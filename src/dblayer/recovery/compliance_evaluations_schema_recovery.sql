BEGIN;
DROP TABLE IF EXISTS compliance_evaluations CASCADE;
CREATE TABLE compliance_evaluations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id      UUID NOT NULL REFERENCES seus(id),
  status      TEXT NOT NULL,
  rationale   JSONB NOT NULL DEFAULT '{}',
  results     JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_compliance_evaluations_seu ON compliance_evaluations (seu_id, created_at DESC);
ALTER TABLE compliance_evaluations
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE compliance_evaluations TO weirdo;
COMMIT;
