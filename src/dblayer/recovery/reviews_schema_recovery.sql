BEGIN;
DROP TABLE IF EXISTS reviews CASCADE;
CREATE TABLE reviews (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id               UUID NOT NULL REFERENCES seus(id),
  related_object_type  TEXT NOT NULL,
  related_object_id    UUID NOT NULL,
  category             TEXT NOT NULL,
  name                 TEXT NOT NULL,
  criteria             JSONB NOT NULL DEFAULT '{}',
  outcome              TEXT
                         CHECK (outcome IS NULL OR outcome IN ('Passed', 'Passed with Recommendations', 'Rework Required', 'Failed', 'Not Applicable', 'Deferred')),
  status               TEXT NOT NULL DEFAULT 'Planned',
  reviewer             TEXT,
  version              INTEGER NOT NULL DEFAULT 1,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reviews_related_object ON reviews (related_object_type, related_object_id);
CREATE INDEX IF NOT EXISTS idx_reviews_seu ON reviews (seu_id);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS review_gate_id UUID REFERENCES review_gates(id);
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE reviews TO weirdo;
COMMIT;
