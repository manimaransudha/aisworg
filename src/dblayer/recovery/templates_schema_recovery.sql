BEGIN;
DROP TABLE IF EXISTS templates CASCADE;
CREATE TABLE templates (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                   TEXT NOT NULL UNIQUE,
  name                   TEXT NOT NULL,
  template_version       INTEGER NOT NULL DEFAULT 1,
  status                 TEXT NOT NULL DEFAULT 'Active'
                            CHECK (status IN ('Draft', 'Validated', 'Published', 'Active', 'Deprecated', 'Retired', 'Archived')),
  parent_template_id     UUID REFERENCES templates(id),
  deliverable_catalogue  JSONB NOT NULL DEFAULT '[]',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS authored_by UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS draft_content JSONB NOT NULL DEFAULT '{}';
ALTER TABLE templates ALTER COLUMN template_version DROP DEFAULT;
ALTER TABLE templates ALTER COLUMN template_version TYPE TEXT USING '1.0.0';
ALTER TABLE templates ALTER COLUMN template_version SET DEFAULT '1.0.0';
ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_code_key;
ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_code_version_key;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
-- ALTER TABLE templates ALTER COLUMN tenant_id SET DEFAULT '11111111-1111-1111-1111-111111111111';
ALTER TABLE templates ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_code_version_key;
ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_code_version_tenant_key;
ALTER TABLE templates ADD CONSTRAINT templates_code_version_tenant_key UNIQUE (code, template_version, tenant_id);
ALTER TABLE templates ALTER COLUMN status SET DEFAULT 'Draft';
ALTER TABLE templates ADD COLUMN IF NOT EXISTS schema_definition_id UUID REFERENCES schema_definitions(id);
ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_schema_definition_id_fkey;
GRANT ALL PRIVILEGES ON TABLE templates TO weirdo;
COMMIT;
