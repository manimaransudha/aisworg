BEGIN;
DROP TABLE IF EXISTS evidence CASCADE;
CREATE TABLE evidence (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id    UUID REFERENCES deliverables(id),
  category          TEXT NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT,
  source            TEXT,
  confidence_level  TEXT NOT NULL DEFAULT 'Medium',
  status            TEXT NOT NULL DEFAULT 'Collected',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE evidence
  ADD COLUMN IF NOT EXISTS originating_deliverable_id UUID REFERENCES deliverables(id),
  ADD COLUMN IF NOT EXISTS originating_participant_id UUID REFERENCES participants(id),
  ADD COLUMN IF NOT EXISTS originating_capability_id UUID REFERENCES capabilities(id),
  ADD COLUMN IF NOT EXISTS originating_decision_id UUID,
  ADD COLUMN IF NOT EXISTS originating_activity TEXT;
ALTER TABLE evidence
  ADD COLUMN IF NOT EXISTS supersedes_evidence_id UUID REFERENCES evidence(id);
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS seu_id UUID REFERENCES seus(id);
ALTER TABLE evidence
  ADD COLUMN IF NOT EXISTS validation_dimensions JSONB NOT NULL DEFAULT '[]';
ALTER TABLE evidence
  ALTER COLUMN confidence_level DROP NOT NULL,
  ALTER COLUMN confidence_level DROP DEFAULT;
ALTER TABLE evidence
  DROP COLUMN IF EXISTS seu_id,
  DROP COLUMN IF EXISTS originating_deliverable_id,
  DROP COLUMN IF EXISTS originating_participant_id,
  DROP COLUMN IF EXISTS originating_capability_id,
  DROP COLUMN IF EXISTS originating_decision_id,
  DROP COLUMN IF EXISTS originating_activity;
ALTER TABLE evidence
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE evidence TO weirdo;
COMMIT;
