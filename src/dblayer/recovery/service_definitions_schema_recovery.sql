BEGIN;
DROP TABLE IF EXISTS service_definitions CASCADE;
CREATE TABLE service_definitions (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                          TEXT NOT NULL,
  name                          TEXT NOT NULL,
  capability_code               TEXT NOT NULL,
  purpose                       TEXT,
  inputs                        TEXT,
  outputs                       TEXT,
  service_level                 TEXT,
  governance                    TEXT,
  success                       TEXT,
  consumers                     TEXT[] NOT NULL DEFAULT '{}',
  version                       TEXT NOT NULL DEFAULT '1.0.0',
  status                        TEXT NOT NULL DEFAULT 'Defined',
  draft_content                 JSONB,
  authored_by                   UUID NOT NULL REFERENCES participants_master(id),
  author_badge                   TEXT NOT NULL,
  tenant_id                     UUID NOT NULL REFERENCES tenants(id),
  parent_service_definition_id  UUID REFERENCES service_definitions(id),
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE service_definitions DROP CONSTRAINT IF EXISTS service_definitions_status_check;
ALTER TABLE service_definitions ADD CONSTRAINT service_definitions_status_check
  CHECK (status IN ('Defined', 'Published', 'Active', 'Deprecated', 'Retired', 'Archived'));
ALTER TABLE service_definitions DROP CONSTRAINT IF EXISTS service_definitions_code_version_tenant_key;
ALTER TABLE service_definitions ADD CONSTRAINT service_definitions_code_version_tenant_key
  UNIQUE (code, version, tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_definitions_authored_by ON service_definitions (authored_by);
CREATE INDEX IF NOT EXISTS idx_service_definitions_tenant_id ON service_definitions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_definitions_capability_code ON service_definitions (capability_code);
ALTER TABLE service_definitions ALTER COLUMN service_level DROP DEFAULT;
ALTER TABLE service_definitions ALTER COLUMN service_level TYPE JSONB USING
  CASE WHEN service_level IS NULL OR service_level::text = '' THEN '[]'::jsonb
       ELSE service_level::jsonb END;
ALTER TABLE service_definitions ALTER COLUMN service_level SET DEFAULT '[]'::jsonb;
ALTER TABLE service_definitions ALTER COLUMN service_level SET NOT NULL;
ALTER TABLE service_definitions ALTER COLUMN inputs DROP DEFAULT;
ALTER TABLE service_definitions ALTER COLUMN inputs TYPE TEXT[] USING '{}'::text[];
ALTER TABLE service_definitions ALTER COLUMN inputs SET DEFAULT '{}'::text[];
ALTER TABLE service_definitions ALTER COLUMN inputs SET NOT NULL;
ALTER TABLE service_definitions ALTER COLUMN outputs DROP DEFAULT;
ALTER TABLE service_definitions ALTER COLUMN outputs TYPE TEXT[] USING '{}'::text[];
ALTER TABLE service_definitions ALTER COLUMN outputs SET DEFAULT '{}'::text[];
ALTER TABLE service_definitions ALTER COLUMN outputs SET NOT NULL;
ALTER TABLE service_definitions ADD COLUMN IF NOT EXISTS schema_definition_id UUID REFERENCES schema_definitions(id);
GRANT ALL PRIVILEGES ON TABLE service_definitions TO weirdo;
COMMIT;
