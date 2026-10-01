BEGIN;
DROP TABLE IF EXISTS schema_definitions CASCADE;
CREATE TABLE schema_definitions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_kind   TEXT NOT NULL,
  version       INTEGER NOT NULL,
  schema        JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_kind, version)
);
ALTER TABLE schema_definitions DROP CONSTRAINT IF EXISTS schema_definitions_entity_kind_check;
ALTER TABLE schema_definitions ADD CONSTRAINT schema_definitions_entity_kind_check
  CHECK (entity_kind IN ('Pack', 'Template', 'Profile', 'TransitionDefinition', 'Deliverable', 'Service', 'Policy', 'Capability'));
ALTER TABLE schema_definitions
  ADD COLUMN IF NOT EXISTS compatible_versions INTEGER[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS incompatible_versions INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE schema_definitions
  ADD COLUMN IF NOT EXISTS lifecycle_state TEXT NOT NULL DEFAULT 'Created',
  ADD COLUMN IF NOT EXISTS author_id UUID,
  ADD COLUMN IF NOT EXISTS author_badge TEXT;
ALTER TABLE schema_definitions DROP CONSTRAINT IF EXISTS schema_definitions_author_id_fkey;
ALTER TABLE schema_definitions
  ADD CONSTRAINT schema_definitions_author_id_fkey FOREIGN KEY (author_id) REFERENCES participants_master(id);
ALTER TABLE schema_definitions
  ALTER COLUMN author_id SET NOT NULL,
  ALTER COLUMN author_badge SET NOT NULL;
GRANT ALL PRIVILEGES ON TABLE schema_definitions TO weirdo;
COMMIT;
