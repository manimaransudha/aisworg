BEGIN;
DROP TABLE IF EXISTS policy_evaluations CASCADE;
CREATE TABLE policy_evaluations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_code       TEXT NOT NULL,
  policy_id         UUID NOT NULL,
  constraint_type   TEXT NOT NULL,
  seu_id            UUID NOT NULL REFERENCES seus(id),
  entity_type       TEXT NOT NULL,
  entity_id         UUID NOT NULL,
  from_state        TEXT NOT NULL,
  to_state          TEXT NOT NULL,
  outcome           TEXT NOT NULL,
  evaluated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_policy_evaluations_entity ON policy_evaluations (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_policy_evaluations_seu ON policy_evaluations (seu_id);
GRANT ALL PRIVILEGES ON TABLE policy_evaluations TO weirdo;
COMMIT;
