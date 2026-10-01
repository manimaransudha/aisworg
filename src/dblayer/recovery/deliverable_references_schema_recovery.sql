BEGIN;
DROP TABLE IF EXISTS deliverable_references CASCADE;
CREATE TABLE deliverable_references (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id         UUID NOT NULL REFERENCES seus(id),
  deliverable_id UUID NOT NULL REFERENCES deliverables(id),
  work_item_id   UUID NOT NULL REFERENCES work_items(id),
  participant_id UUID REFERENCES participants(id),
  from_state     TEXT NOT NULL,
  to_state       TEXT NOT NULL,
  reference      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deliverable_references_deliverable ON deliverable_references (deliverable_id);
ALTER TABLE deliverable_references
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE deliverable_references TO weirdo;
COMMIT;
