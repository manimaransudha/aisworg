BEGIN;
DROP TABLE IF EXISTS demo_playbooks CASCADE;
CREATE TABLE demo_playbooks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  code          TEXT NOT NULL,
  title         TEXT NOT NULL,
  steps         JSONB NOT NULL DEFAULT '[]',
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  author_id     UUID NOT NULL REFERENCES participants_master(id),
  author_badge  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (code, tenant_id)
);
CREATE INDEX IF NOT EXISTS demo_playbooks_tenant_idx ON demo_playbooks (tenant_id);
GRANT ALL PRIVILEGES ON TABLE demo_playbooks TO weirdo;
COMMIT;
