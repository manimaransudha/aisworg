BEGIN;
DROP TABLE IF EXISTS demo_areas CASCADE;
CREATE TABLE demo_areas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id),
  area           TEXT NOT NULL,
  stage_title    TEXT NOT NULL,
  how_to_lead    TEXT NOT NULL,
  how_to_steps   JSONB NOT NULL DEFAULT '[]',
  author_id      UUID NOT NULL REFERENCES participants_master(id),
  author_badge   TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (area, tenant_id)
);
CREATE INDEX IF NOT EXISTS demo_areas_tenant_idx ON demo_areas (tenant_id);
GRANT ALL PRIVILEGES ON TABLE demo_areas TO weirdo;
COMMIT;
