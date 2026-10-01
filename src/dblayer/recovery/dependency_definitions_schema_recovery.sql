BEGIN;
DROP TABLE IF EXISTS dependency_definitions CASCADE;
CREATE TABLE dependency_definitions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owning_entity_type TEXT NOT NULL,
  owning_entity_id  UUID NOT NULL,
  from_entity_type  TEXT NOT NULL,
  from_name         TEXT,
  from_state        TEXT NOT NULL,
  to_entity_type    TEXT NOT NULL,
  to_name           TEXT NOT NULL,
  to_state          TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE dependency_definitions DROP CONSTRAINT IF EXISTS dependency_definitions_owning_entity_type_check;
ALTER TABLE dependency_definitions ADD CONSTRAINT dependency_definitions_owning_entity_type_check
  CHECK (owning_entity_type IN ('Template', 'Pack', 'Profile'));
ALTER TABLE dependency_definitions
  ADD COLUMN IF NOT EXISTS relationship_kind TEXT NOT NULL DEFAULT 'dependency';
ALTER TABLE dependency_definitions DROP CONSTRAINT IF EXISTS dependency_definitions_relationship_kind_check;
ALTER TABLE dependency_definitions
  ADD CONSTRAINT dependency_definitions_relationship_kind_check
  CHECK (relationship_kind IN ('dependency', 'derivation', 'implementation', 'decomposition'));
ALTER TABLE dependency_definitions DROP CONSTRAINT IF EXISTS dependency_definitions_natural_key;
ALTER TABLE dependency_definitions ADD CONSTRAINT dependency_definitions_natural_key
  UNIQUE NULLS NOT DISTINCT (owning_entity_type, owning_entity_id, from_entity_type, from_name, from_state, to_entity_type, to_name, to_state, relationship_kind);
ALTER TABLE dependency_definitions
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE dependency_definitions TO weirdo;
COMMIT;
