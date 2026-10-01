BEGIN;
DROP TABLE IF EXISTS policy_definitions CASCADE;
CREATE TABLE policy_definitions (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                            TEXT NOT NULL,
  name                            TEXT NOT NULL,
  description                     TEXT,
  category                        TEXT NOT NULL DEFAULT 'Engineering',
  constraint_type                 TEXT NOT NULL DEFAULT 'Policy'
                                     CHECK (constraint_type IN ('Policy', 'Standard')),
  applicability_deliverable_names TEXT[] NOT NULL DEFAULT '{}',
  applicability_environments      TEXT[] NOT NULL DEFAULT '{}',
  applicability_deliverable_lifecycle TEXT[] NOT NULL DEFAULT '{}',
  conditions                      JSONB NOT NULL DEFAULT '[]',
  version                         TEXT NOT NULL DEFAULT '1.0.0',
  status                          TEXT NOT NULL DEFAULT 'Draft'
                                     CHECK (status IN ('Draft', 'Validated', 'Published', 'Active', 'Deprecated', 'Retired', 'Archived')),
  draft_content                   JSONB,
  authored_by                     UUID NOT NULL REFERENCES participants_master(id),
  author_badge                    TEXT NOT NULL,
  tenant_id                       UUID NOT NULL REFERENCES tenants(id),
  parent_policy_definition_id     UUID REFERENCES policy_definitions(id),
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT policy_definitions_code_version_tenant_key UNIQUE (code, version, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_policy_definitions_authored_by ON policy_definitions (authored_by);
CREATE INDEX IF NOT EXISTS idx_policy_definitions_tenant_id ON policy_definitions (tenant_id);
ALTER TABLE policy_definitions
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'Transition'
    CHECK (scope IN ('Transition', 'Eligibility')),
  ADD COLUMN IF NOT EXISTS governed_transition TEXT,
  ADD COLUMN IF NOT EXISTS governing_condition JSONB;
ALTER TABLE policy_definitions ADD COLUMN IF NOT EXISTS applicability_deliverables JSONB NOT NULL DEFAULT '[]';
ALTER TABLE policy_definitions DROP COLUMN IF EXISTS applicability_deliverable_names;
ALTER TABLE policy_definitions DROP COLUMN IF EXISTS applicability_deliverable_lifecycle;
ALTER TABLE policy_definitions DROP COLUMN IF EXISTS applicability_deliverables;
ALTER TABLE policy_definitions DROP COLUMN IF EXISTS governed_transition;
ALTER TABLE policy_definitions DROP COLUMN IF EXISTS governing_condition;
ALTER TABLE policy_definitions ADD COLUMN IF NOT EXISTS schema_definition_id UUID REFERENCES schema_definitions(id);
ALTER TABLE policy_definitions DROP CONSTRAINT IF EXISTS policy_definitions_schema_definition_id_fkey;
GRANT ALL PRIVILEGES ON TABLE policy_definitions TO weirdo;
COMMIT;
