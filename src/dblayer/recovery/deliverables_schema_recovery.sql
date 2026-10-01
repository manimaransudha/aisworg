BEGIN;
DROP TABLE IF EXISTS deliverables CASCADE;
CREATE TABLE deliverables (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id                    UUID NOT NULL REFERENCES seus(id),
  name                      TEXT NOT NULL,
  category                  TEXT NOT NULL,
  lifecycle_state           TEXT NOT NULL DEFAULT 'Defined',
  acceptance_criteria       JSONB NOT NULL DEFAULT '[]',
  acquisition_scope         TEXT NOT NULL DEFAULT 'SEU'
                               CHECK (acquisition_scope IN ('SEU', 'Capability', 'Enterprise', 'Platform')),
  producing_capability_id   UUID REFERENCES capabilities(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE deliverables ALTER COLUMN category DROP NOT NULL;
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE deliverables
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE deliverables TO weirdo;
COMMIT;
