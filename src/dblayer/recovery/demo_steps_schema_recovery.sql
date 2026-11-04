BEGIN;
DROP TABLE IF EXISTS demo_steps CASCADE;
CREATE TABLE demo_steps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  code          TEXT NOT NULL,
  kind          TEXT NOT NULL,
  area          TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  annotation    TEXT,
  target        JSONB NOT NULL DEFAULT '{}',
  payload       JSONB NOT NULL DEFAULT '{}',
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  author_id     UUID NOT NULL REFERENCES participants_master(id),
  author_badge  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (code, tenant_id)
);
CREATE INDEX IF NOT EXISTS demo_steps_tenant_idx ON demo_steps (tenant_id);
GRANT ALL PRIVILEGES ON TABLE demo_steps TO weirdo;
COMMIT;
