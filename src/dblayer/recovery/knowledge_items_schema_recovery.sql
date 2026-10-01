BEGIN;
DROP TABLE IF EXISTS knowledge_items CASCADE;
CREATE TABLE knowledge_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id             UUID NOT NULL REFERENCES seus(id),
  deliverable_id     UUID NOT NULL REFERENCES deliverables(id),
  evidence_id        UUID REFERENCES evidence(id),
  category           TEXT NOT NULL,
  title              TEXT NOT NULL,
  description        TEXT,
  acquisition_scope  TEXT NOT NULL DEFAULT 'SEU'
                        CHECK (acquisition_scope IN ('SEU', 'Capability', 'Enterprise', 'Platform')),
  status             TEXT NOT NULL DEFAULT 'Observed',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_deliverable ON knowledge_items (deliverable_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_seu ON knowledge_items (seu_id);
ALTER TABLE knowledge_items
  DROP COLUMN IF EXISTS evidence_id,
  ADD COLUMN IF NOT EXISTS deliverable_references JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS evidence_references JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS decision_references JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS knowledge_references JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS confidence_level TEXT,
  ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES participants(id),
  ADD COLUMN IF NOT EXISTS authority_badge TEXT;
GRANT ALL PRIVILEGES ON TABLE knowledge_items TO weirdo;
COMMIT;
