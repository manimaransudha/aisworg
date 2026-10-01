BEGIN;
DROP TABLE IF EXISTS decisions CASCADE;
CREATE TABLE decisions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id                 UUID NOT NULL REFERENCES seus(id),
  related_object_type    TEXT NOT NULL,
  related_object_id      UUID NOT NULL,
  knowledge_id           UUID REFERENCES knowledge_items(id),
  evidence_id            UUID REFERENCES evidence(id),
  category                TEXT NOT NULL,
  title                  TEXT NOT NULL,
  engineering_question   TEXT,
  selected_alternative   TEXT,
  rationale              TEXT,
  status                 TEXT NOT NULL DEFAULT 'Identified',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE decisions
  ADD COLUMN IF NOT EXISTS originating_type TEXT,
  ADD COLUMN IF NOT EXISTS originating_id UUID,
  ADD COLUMN IF NOT EXISTS related_objects JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS related_seu JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS knowledge_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS evidence_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS alternatives JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS participant_id UUID REFERENCES participants(id),
  ADD COLUMN IF NOT EXISTS authority_badge TEXT;
ALTER TABLE decisions
  DROP COLUMN IF EXISTS related_object_type,
  DROP COLUMN IF EXISTS related_object_id,
  DROP COLUMN IF EXISTS knowledge_id,
  DROP COLUMN IF EXISTS evidence_id,
  DROP COLUMN IF EXISTS selected_alternative,
  DROP COLUMN IF EXISTS rationale;
GRANT ALL PRIVILEGES ON TABLE decisions TO weirdo;
COMMIT;
