BEGIN;
DROP TABLE IF EXISTS quality_gate_definitions CASCADE;
CREATE TABLE quality_gate_definitions (
  id                                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                              TEXT NOT NULL,
  name                              TEXT NOT NULL,
  description                       TEXT,
  category                          TEXT NOT NULL,
  criteria_type                     TEXT NOT NULL,
  evidence_category                 TEXT,
  version                           TEXT NOT NULL DEFAULT '1.0.0',
  status                            TEXT NOT NULL,
  draft_content                     JSONB,
  authored_by                       UUID NOT NULL REFERENCES participants_master(id),
  author_badge                      TEXT NOT NULL,
  tenant_id                         UUID NOT NULL REFERENCES tenants(id),
  parent_quality_gate_definition_id UUID REFERENCES quality_gate_definitions(id),
  schema_definition_id              UUID REFERENCES schema_definitions(id),
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quality_gate_definitions_code_version_tenant_key UNIQUE (code, version, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_quality_gate_definitions_authored_by ON quality_gate_definitions (authored_by);
CREATE INDEX IF NOT EXISTS idx_quality_gate_definitions_tenant_id ON quality_gate_definitions (tenant_id);
GRANT ALL PRIVILEGES ON TABLE quality_gate_definitions TO weirdo;
COMMIT;
