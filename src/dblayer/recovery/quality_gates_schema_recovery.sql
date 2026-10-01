BEGIN;
DROP TABLE IF EXISTS quality_gates CASCADE;
CREATE TABLE quality_gates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT NOT NULL,
  name                  TEXT NOT NULL,
  category              TEXT NOT NULL DEFAULT 'Exit',
  entity_type           TEXT NOT NULL,
  from_state            TEXT NOT NULL,
  to_state              TEXT NOT NULL,
  criteria              JSONB NOT NULL DEFAULT '{"type":"no_unresolved_obligations"}',
  originating_pack_id   UUID REFERENCES packs(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE quality_gates DROP CONSTRAINT IF EXISTS quality_gates_entity_type_check;
ALTER TABLE quality_gates ADD CONSTRAINT quality_gates_entity_type_check
  CHECK (entity_type IN ('SEU', 'Deliverable', 'Objective', 'Obligation', 'Evidence', 'Knowledge', 'Decision', 'KnowledgeScope', 'AttentionItem', 'ExternalInteraction', 'Pack', 'Participant', 'Review', 'Finding'));
ALTER TABLE quality_gates
  ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE quality_gates DROP CONSTRAINT IF EXISTS quality_gates_code_key;
ALTER TABLE quality_gates DROP CONSTRAINT IF EXISTS quality_gates_entity_type_from_state_to_state_key;
ALTER TABLE quality_gates ADD COLUMN IF NOT EXISTS checklist_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE quality_gates ADD COLUMN IF NOT EXISTS recommended_checklist_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE quality_gates
  ADD COLUMN IF NOT EXISTS applicability_deliverable_names TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_quality_gates_originating_pack_id ON quality_gates (originating_pack_id);
ALTER TABLE quality_gates DROP CONSTRAINT IF EXISTS quality_gates_code_version_key;
ALTER TABLE quality_gates DROP CONSTRAINT IF EXISTS quality_gates_scope_category_version_key;
ALTER TABLE quality_gates DROP CONSTRAINT IF EXISTS quality_gates_scope_category_version_pack_key;
ALTER TABLE quality_gates ADD CONSTRAINT quality_gates_scope_category_version_pack_key
  UNIQUE (entity_type, from_state, to_state, category, version, originating_pack_id);
DROP INDEX IF EXISTS quality_gates_active_scope_category_key;
CREATE UNIQUE INDEX IF NOT EXISTS quality_gates_active_scope_category_pack_key
  ON quality_gates (entity_type, from_state, to_state, category, originating_pack_id)
  WHERE is_active;
ALTER TABLE quality_gates
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE quality_gates TO weirdo;
COMMIT;
