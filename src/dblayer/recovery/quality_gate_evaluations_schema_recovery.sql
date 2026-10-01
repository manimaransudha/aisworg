BEGIN;
DROP TABLE IF EXISTS quality_gate_evaluations CASCADE;
CREATE TABLE quality_gate_evaluations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quality_gate_id   UUID NOT NULL REFERENCES quality_gates(id),
  seu_id            UUID REFERENCES seus(id),
  entity_type       TEXT NOT NULL,
  entity_id         UUID NOT NULL,
  outcome           TEXT NOT NULL
                       CHECK (outcome IN ('Passed', 'Passed with Conditions', 'Blocked', 'Waived', 'Deferred', 'Not Applicable')),
  detail            JSONB NOT NULL DEFAULT '{}',
  evaluated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quality_gate_evaluations_entity ON quality_gate_evaluations (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_quality_gate_evaluations_seu ON quality_gate_evaluations (seu_id);
ALTER TABLE quality_gate_evaluations DROP CONSTRAINT IF EXISTS quality_gate_evaluations_scope_check;
ALTER TABLE quality_gate_evaluations ADD CONSTRAINT quality_gate_evaluations_scope_check
  CHECK (
    (entity_type IN ('Pack', 'Objective') AND seu_id IS NULL)
    OR
    (entity_type NOT IN ('Pack', 'Objective') AND seu_id IS NOT NULL)
  );
ALTER TABLE quality_gate_evaluations
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE quality_gate_evaluations TO weirdo;
COMMIT;
