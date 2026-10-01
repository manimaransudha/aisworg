BEGIN;
DROP TABLE IF EXISTS profiles CASCADE;
CREATE TABLE profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  base_template_id    UUID NOT NULL REFERENCES templates(id),
  config_parameters   JSONB NOT NULL DEFAULT '{}',
  environment         TEXT NOT NULL DEFAULT 'development',
  status              TEXT NOT NULL DEFAULT 'Active'
                         CHECK (status IN ('Draft', 'Validated', 'Published', 'Active', 'Deprecated', 'Retired', 'Archived')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS authored_by UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS draft_content JSONB NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
-- ALTER TABLE profiles ALTER COLUMN tenant_id SET DEFAULT '11111111-1111-1111-1111-111111111111';
ALTER TABLE profiles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_version TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS parent_profile_id UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_code_key;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_code_version_tenant_key;
ALTER TABLE profiles ADD CONSTRAINT profiles_code_version_tenant_key UNIQUE (code, profile_version, tenant_id);
ALTER TABLE profiles ALTER COLUMN status SET DEFAULT 'Draft';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS schema_definition_id UUID REFERENCES schema_definitions(id);
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_schema_definition_id_fkey;
GRANT ALL PRIVILEGES ON TABLE profiles TO weirdo;
COMMIT;
