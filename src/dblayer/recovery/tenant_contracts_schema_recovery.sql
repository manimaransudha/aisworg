BEGIN;
DROP TABLE IF EXISTS tenant_contracts CASCADE;
CREATE TABLE tenant_contracts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL UNIQUE REFERENCES tenants(id),
  vcs_binding        JSONB NOT NULL DEFAULT '{}',
  callback_auth      JSONB NOT NULL DEFAULT '{}',
  attestation_config JSONB NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE tenant_contracts
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE tenant_contracts TO weirdo;
COMMIT;
