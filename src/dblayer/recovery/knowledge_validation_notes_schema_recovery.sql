BEGIN;
DROP TABLE IF EXISTS knowledge_validation_notes CASCADE;
CREATE TABLE knowledge_validation_notes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_item_id UUID NOT NULL REFERENCES knowledge_items(id),
  note_text         TEXT NOT NULL,
  actor_id          UUID REFERENCES participants_master(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_knowledge_validation_notes_item ON knowledge_validation_notes (knowledge_item_id, created_at);
GRANT ALL PRIVILEGES ON TABLE knowledge_validation_notes TO weirdo;
COMMIT;
