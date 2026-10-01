BEGIN;
DROP TABLE IF EXISTS obligations CASCADE;
CREATE TABLE obligations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id                UUID NOT NULL REFERENCES seus(id),
  related_object_type   TEXT NOT NULL,
  related_object_id     UUID NOT NULL,
  category              TEXT NOT NULL,
  title                 TEXT NOT NULL,
  description           TEXT,
  severity              TEXT NOT NULL DEFAULT 'Medium',
  status                TEXT NOT NULL DEFAULT 'Identified',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS origin TEXT;
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS completion_criteria TEXT;
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS blocked_from_state TEXT;
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS blocked_to_state TEXT;
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS originating_entity_type TEXT;
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS originating_entity_id UUID;
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS assigned_entity_type TEXT;
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS assigned_entity_id UUID;
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS revision_history JSONB NOT NULL DEFAULT '[]';
ALTER TABLE obligations
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE obligations TO weirdo;
COMMIT;
