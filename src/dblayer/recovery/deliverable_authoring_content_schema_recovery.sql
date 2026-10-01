BEGIN;
DROP TABLE IF EXISTS deliverable_authoring_content CASCADE;
CREATE TABLE deliverable_authoring_content (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id        UUID NOT NULL UNIQUE REFERENCES deliverables(id),
  schema_definition_id  UUID NOT NULL REFERENCES schema_definitions(id),
  content               JSONB NOT NULL DEFAULT '{}',
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE deliverable_authoring_content DROP CONSTRAINT IF EXISTS deliverable_authoring_content_schema_definition_id_fkey;
ALTER TABLE deliverable_authoring_content
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE deliverable_authoring_content TO weirdo;
COMMIT;
