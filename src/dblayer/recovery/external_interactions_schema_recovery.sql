BEGIN;
DROP TABLE IF EXISTS external_interactions CASCADE;
CREATE TABLE external_interactions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id             UUID NOT NULL REFERENCES seus(id),
  deliverable_id     UUID REFERENCES deliverables(id),
  interaction_type   TEXT NOT NULL,
  direction          TEXT NOT NULL CHECK (direction IN ('Inbound', 'Outbound')),
  target_system      TEXT NOT NULL,
  purpose            TEXT,
  status             TEXT NOT NULL DEFAULT 'Created',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_external_interactions_seu ON external_interactions (seu_id);
ALTER TABLE external_interactions
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE external_interactions TO weirdo;
COMMIT;
