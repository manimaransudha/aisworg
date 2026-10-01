BEGIN;
DROP TABLE IF EXISTS deliverable_definitions CASCADE;
CREATE TABLE deliverable_definitions (
  id                                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                              TEXT NOT NULL,
  description                       TEXT,
  version                           TEXT NOT NULL DEFAULT '1.0.0',
  status                            TEXT NOT NULL DEFAULT 'Draft'
                                       CHECK (status IN ('Draft', 'Validated', 'Published', 'Active', 'Deprecated', 'Retired', 'Archived')),
  draft_content                     JSONB,
  authored_by                       UUID NOT NULL REFERENCES participants_master(id),
  author_badge                      TEXT NOT NULL,
  tenant_id                         UUID NOT NULL REFERENCES tenants(id),
  parent_deliverable_definition_id  UUID REFERENCES deliverable_definitions(id),
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT deliverable_definitions_code_version_tenant_key UNIQUE (code, version, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_deliverable_definitions_authored_by ON deliverable_definitions (authored_by);
CREATE INDEX IF NOT EXISTS idx_deliverable_definitions_tenant_id ON deliverable_definitions (tenant_id);
ALTER TABLE deliverable_definitions ADD COLUMN IF NOT EXISTS schema_definition_id UUID REFERENCES schema_definitions(id);
ALTER TABLE deliverable_definitions DROP CONSTRAINT IF EXISTS deliverable_definitions_schema_definition_id_fkey;
GRANT ALL PRIVILEGES ON TABLE deliverable_definitions TO weirdo;
COMMIT;
