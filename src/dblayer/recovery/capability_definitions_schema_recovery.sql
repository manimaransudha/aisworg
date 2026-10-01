BEGIN;
DROP TABLE IF EXISTS capability_definitions CASCADE;
CREATE TABLE capability_definitions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           TEXT NOT NULL,
  default_label  TEXT NOT NULL,
  description    TEXT,
  roles          JSONB NOT NULL DEFAULT '[]',
  tenant_id      UUID NOT NULL REFERENCES tenants(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_capability_definitions_tenant_id ON capability_definitions (tenant_id);
ALTER TABLE capability_definitions DROP CONSTRAINT IF EXISTS capability_definitions_code_tenant_key;
ALTER TABLE capability_definitions
  ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Defined',
  ADD COLUMN IF NOT EXISTS draft_content JSONB,
  ADD COLUMN IF NOT EXISTS parent_capability_definition_id UUID REFERENCES capability_definitions(id),
  ADD COLUMN IF NOT EXISTS schema_definition_id UUID REFERENCES schema_definitions(id);
ALTER TABLE capability_definitions DROP COLUMN IF EXISTS authored_by;
ALTER TABLE capability_definitions DROP COLUMN IF EXISTS author_badge;
ALTER TABLE capability_definitions
  ADD COLUMN authored_by UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN author_badge TEXT NOT NULL;
ALTER TABLE capability_definitions DROP CONSTRAINT IF EXISTS capability_definitions_status_check;
ALTER TABLE capability_definitions ADD CONSTRAINT capability_definitions_status_check
  CHECK (status IN ('Defined', 'Published', 'Active', 'Deprecated', 'Retired', 'Archived'));
ALTER TABLE capability_definitions DROP CONSTRAINT IF EXISTS capability_definitions_code_version_tenant_key;
ALTER TABLE capability_definitions
  ADD CONSTRAINT capability_definitions_code_version_tenant_key UNIQUE (code, version, tenant_id);
ALTER TABLE capability_definitions DROP CONSTRAINT IF EXISTS capability_definitions_schema_definition_id_fkey;
GRANT ALL PRIVILEGES ON TABLE capability_definitions TO weirdo;
COMMIT;
