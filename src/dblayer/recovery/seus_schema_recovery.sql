BEGIN;
DROP TABLE IF EXISTS seus CASCADE;
CREATE TABLE seus (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id          UUID NOT NULL REFERENCES objectives(id),
  template_id           UUID NOT NULL REFERENCES templates(id),
  profile_id            UUID NOT NULL REFERENCES profiles(id),
  active_ebm_id         UUID,
  lifecycle_state       TEXT NOT NULL DEFAULT 'Pending',
  requested_by          UUID REFERENCES participants_master(id),
  commissioning_report  JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE seus ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE seus DROP COLUMN IF EXISTS validation_report;
ALTER TABLE seus ADD COLUMN IF NOT EXISTS composition_report JSONB;
ALTER TABLE seus DROP CONSTRAINT IF EXISTS seus_lifecycle_state_check;
ALTER TABLE seus ADD CONSTRAINT seus_lifecycle_state_check
  CHECK (lifecycle_state IN ('Pending', 'Commissioned', 'Configured', 'Activated', 'Operational', 'Suspended', 'Retired', 'Archived', 'Failed'));
DROP INDEX IF EXISTS idx_seus_objective_id_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_seus_objective_id_active_unique ON seus (objective_id)
  WHERE lifecycle_state IN ('Pending', 'Commissioned', 'Configured', 'Activated', 'Operational', 'Suspended');
GRANT ALL PRIVILEGES ON TABLE seus TO weirdo;
COMMIT;
