BEGIN;
DROP TABLE IF EXISTS metric_definitions CASCADE;
CREATE TABLE metric_definitions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier            TEXT NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  description           TEXT,
  category              TEXT NOT NULL CHECK (category IN ('Flow', 'Governance', 'Runtime', 'Knowledge', 'Quality', 'Collaboration')),
  unit_of_measure       TEXT NOT NULL,
  aggregation_strategy  TEXT NOT NULL CHECK (aggregation_strategy IN ('Average', 'Count', 'Rate', 'Distribution')),
  calculation_method    TEXT NOT NULL,
  version               INTEGER NOT NULL DEFAULT 1,
  originating_pack_id   UUID REFERENCES packs(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE metric_definitions
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE metric_definitions TO weirdo;
COMMIT;
