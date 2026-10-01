BEGIN;
DROP TABLE IF EXISTS evidence_relationships CASCADE;
CREATE TABLE evidence_relationships (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id           UUID NOT NULL REFERENCES evidence(id),
  related_object_type   TEXT NOT NULL,
  related_object_id     UUID NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT evidence_relationships_unique UNIQUE (evidence_id, related_object_type, related_object_id)
);
CREATE INDEX IF NOT EXISTS idx_evidence_relationships_evidence ON evidence_relationships (evidence_id);
CREATE INDEX IF NOT EXISTS idx_evidence_relationships_related ON evidence_relationships (related_object_type, related_object_id);
ALTER TABLE evidence_relationships
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE evidence_relationships TO weirdo;
COMMIT;
