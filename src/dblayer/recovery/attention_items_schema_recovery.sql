BEGIN;
DROP TABLE IF EXISTS attention_items CASCADE;
CREATE TABLE attention_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id                UUID NOT NULL REFERENCES seus(id),
  category              TEXT NOT NULL,
  priority              TEXT NOT NULL DEFAULT 'Medium',
  title                 TEXT NOT NULL,
  description           TEXT,
  related_object_type   TEXT,
  related_object_id     UUID,
  triggering_event_id   UUID REFERENCES events(id),
  status                TEXT NOT NULL DEFAULT 'Created',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attention_items_seu ON attention_items (seu_id);
CREATE INDEX IF NOT EXISTS idx_attention_items_related ON attention_items (related_object_type, related_object_id);
ALTER TABLE attention_items
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE attention_items TO weirdo;
COMMIT;
