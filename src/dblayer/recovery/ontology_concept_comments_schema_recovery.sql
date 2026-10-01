BEGIN;
DROP TABLE IF EXISTS ontology_concept_comments CASCADE;
CREATE TABLE ontology_concept_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id    UUID NOT NULL REFERENCES ontology_concepts(id),
  comment_text  TEXT NOT NULL,
  actor_id      UUID REFERENCES participants_master(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ontology_concept_comments_concept_id ON ontology_concept_comments (concept_id, created_at);
GRANT ALL PRIVILEGES ON TABLE ontology_concept_comments TO weirdo;
COMMIT;
