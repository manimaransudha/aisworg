BEGIN;
DROP TABLE IF EXISTS execution_targets CASCADE;
CREATE TABLE execution_targets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_id    UUID NOT NULL REFERENCES capabilities(id),
  mode             TEXT NOT NULL CHECK (mode IN ('human-on-ui', 'external-orchestrator')),
  adapter_endpoint TEXT,
  adapter_auth_ref TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE execution_targets ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE execution_targets DROP CONSTRAINT IF EXISTS execution_targets_capability_unique;
ALTER TABLE execution_targets DROP CONSTRAINT IF EXISTS execution_targets_tenant_capability_unique;
ALTER TABLE execution_targets ADD CONSTRAINT execution_targets_tenant_capability_unique UNIQUE (tenant_id, capability_id);
ALTER TABLE execution_targets
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE execution_targets TO weirdo;
COMMIT;
