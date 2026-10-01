BEGIN;
DROP TABLE IF EXISTS packs CASCADE;
CREATE TABLE packs (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                          TEXT NOT NULL UNIQUE,
  name                          TEXT NOT NULL,
  category                      TEXT NOT NULL,
  pack_version                  TEXT NOT NULL,
  status                        TEXT NOT NULL DEFAULT 'Active',
  installation_classification   TEXT NOT NULL DEFAULT 'Mandatory',
  contributions                 JSONB NOT NULL DEFAULT '{}',
  dependencies                  JSONB NOT NULL DEFAULT '[]',
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE packs DROP CONSTRAINT IF EXISTS packs_code_key;
ALTER TABLE packs DROP CONSTRAINT IF EXISTS packs_code_version_key;
ALTER TABLE packs ALTER COLUMN status SET DEFAULT 'Draft';
ALTER TABLE packs ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE packs
  ADD COLUMN IF NOT EXISTS authored_by UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
ALTER TABLE packs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
-- ALTER TABLE packs ALTER COLUMN tenant_id SET DEFAULT '11111111-1111-1111-1111-111111111111';
ALTER TABLE packs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE packs DROP CONSTRAINT IF EXISTS packs_code_version_key;
ALTER TABLE packs DROP CONSTRAINT IF EXISTS packs_code_version_tenant_key;
ALTER TABLE packs ADD CONSTRAINT packs_code_version_tenant_key UNIQUE (code, pack_version, tenant_id);
ALTER TABLE packs ADD COLUMN IF NOT EXISTS composition_sources JSONB NOT NULL DEFAULT '[]';
ALTER TABLE packs DROP CONSTRAINT IF EXISTS packs_category_check;
ALTER TABLE packs DROP CONSTRAINT IF EXISTS packs_status_check;
ALTER TABLE packs DROP CONSTRAINT IF EXISTS packs_installation_classification_check;
ALTER TABLE packs ADD CONSTRAINT packs_status_check
  CHECK (status IN ('Draft', 'Validated', 'Published', 'Active', 'Retired', 'Archived'));
ALTER TABLE packs ADD COLUMN IF NOT EXISTS schema_definition_id UUID REFERENCES schema_definitions(id);
ALTER TABLE packs DROP CONSTRAINT IF EXISTS packs_schema_definition_id_fkey;
GRANT ALL PRIVILEGES ON TABLE packs TO weirdo;
COMMIT;
