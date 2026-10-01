BEGIN;
DROP TABLE IF EXISTS findings CASCADE;
CREATE TABLE findings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id            UUID NOT NULL REFERENCES reviews(id),
  seu_id               UUID NOT NULL REFERENCES seus(id),
  related_object_type  TEXT NOT NULL,
  related_object_id    UUID NOT NULL,
  severity             TEXT NOT NULL DEFAULT 'Medium',
  title                TEXT NOT NULL,
  description          TEXT,
  status               TEXT NOT NULL DEFAULT 'Open',
  obligation_id        UUID REFERENCES obligations(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_findings_review ON findings (review_id);
CREATE INDEX IF NOT EXISTS idx_findings_related_object ON findings (related_object_type, related_object_id);
ALTER TABLE findings
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE findings TO weirdo;
COMMIT;
