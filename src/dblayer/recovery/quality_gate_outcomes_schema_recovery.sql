BEGIN;
DROP TABLE IF EXISTS quality_gate_outcomes CASCADE;
-- The decision over the Quality Gate evaluations of one Deliverable hop. Its outcome values are checked against the
-- Ontology concept quality-gate-decision-outcome in code. `conditions` holds each condition the composition received, with its outcome
-- (Passed, Blocked, or Waived with the id of the waiver that covered it).
CREATE TABLE quality_gate_outcomes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id            UUID NOT NULL REFERENCES seus(id),
  deliverable_id    UUID NOT NULL REFERENCES deliverables(id),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  from_state        TEXT NOT NULL,
  to_state          TEXT NOT NULL,
  actor_id          UUID NOT NULL REFERENCES participants(id),
  actor_badge       TEXT NOT NULL,
  evaluation_ids    UUID[] NOT NULL DEFAULT '{}',
  conditions        JSONB NOT NULL DEFAULT '[]',
  outcome           TEXT NOT NULL,
  confidence_level  NUMERIC(5,2) NOT NULL,
  rationale         TEXT NOT NULL,
  evaluated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quality_gate_outcomes_deliverable ON quality_gate_outcomes (deliverable_id);
CREATE INDEX IF NOT EXISTS idx_quality_gate_outcomes_seu ON quality_gate_outcomes (seu_id);
GRANT ALL PRIVILEGES ON TABLE quality_gate_outcomes TO weirdo;
COMMIT;
