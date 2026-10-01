BEGIN;
DROP TABLE IF EXISTS review_gates CASCADE;
CREATE TABLE review_gates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT NOT NULL,
  name                  TEXT NOT NULL,
  entity_type           TEXT NOT NULL CHECK (entity_type IN ('SEU', 'Deliverable', 'Objective', 'Obligation', 'Evidence', 'Knowledge', 'Decision', 'KnowledgeScope', 'AttentionItem', 'ExternalInteraction', 'Pack', 'Participant', 'Review', 'Finding', 'Template', 'Profile')),
  from_state            TEXT NOT NULL,
  to_state              TEXT NOT NULL,
  originating_pack_id   UUID REFERENCES packs(id),
  version               TEXT NOT NULL DEFAULT '1.0',
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS review_gates_active_scope_key
  ON review_gates (entity_type, from_state, to_state, code)
  WHERE is_active;
ALTER TABLE review_gates ADD COLUMN IF NOT EXISTS checklist_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE review_gates ADD COLUMN IF NOT EXISTS recommended_checklist_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE review_gates
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE review_gates TO weirdo;
COMMIT;
