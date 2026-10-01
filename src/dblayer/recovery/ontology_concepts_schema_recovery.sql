BEGIN;
DROP TABLE IF EXISTS ontology_concepts CASCADE;
CREATE TABLE ontology_concepts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_type        TEXT NOT NULL,
  code                TEXT NOT NULL,
  default_label       TEXT NOT NULL,
  contributed_by_pack UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE ontology_concepts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
-- UPDATE ontology_concepts SET tenant_id = '11111111-1111-1111-1111-111111111111' WHERE tenant_id IS NULL;
ALTER TABLE ontology_concepts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE ontology_concepts ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE ontology_concepts ADD COLUMN IF NOT EXISTS is_mandatory BOOLEAN;
ALTER TABLE ontology_concepts ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE ontology_concepts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE ontology_concepts DROP COLUMN IF EXISTS is_active;
ALTER TABLE ontology_concepts ADD COLUMN IF NOT EXISTS composition_strategy TEXT;
ALTER TABLE ontology_concepts ADD COLUMN IF NOT EXISTS composition_sources JSONB NOT NULL DEFAULT '[]';
ALTER TABLE ontology_concepts ADD COLUMN IF NOT EXISTS text_type TEXT NOT NULL DEFAULT 'markdown';
ALTER TABLE ontology_concepts ADD COLUMN IF NOT EXISTS ui_grouping TEXT;
ALTER TABLE ontology_concepts DROP CONSTRAINT IF EXISTS ontology_concepts_type_code_unique;
ALTER TABLE ontology_concepts DROP CONSTRAINT IF EXISTS ontology_concepts_type_code_tenant_unique;
ALTER TABLE ontology_concepts DROP CONSTRAINT IF EXISTS ontology_concepts_type_code_tenant_version_unique;
ALTER TABLE ontology_concepts ADD CONSTRAINT ontology_concepts_type_code_tenant_version_unique
  UNIQUE (concept_type, code, tenant_id, version);
ALTER TABLE ontology_concepts DROP CONSTRAINT IF EXISTS ontology_concepts_status_check;
ALTER TABLE ontology_concepts ADD CONSTRAINT ontology_concepts_status_check
  CHECK (status IN ('Draft', 'Active', 'Deprecated', 'Retired', 'Archived'));
ALTER TABLE ontology_concepts DROP CONSTRAINT IF EXISTS ontology_concepts_composition_strategy_check;
ALTER TABLE ontology_concepts ADD CONSTRAINT ontology_concepts_composition_strategy_check
  CHECK (composition_strategy IS NULL OR composition_strategy IN ('specialization', 'override'));
ALTER TABLE ontology_concepts DROP CONSTRAINT IF EXISTS ontology_concepts_text_type_check;
ALTER TABLE ontology_concepts ADD CONSTRAINT ontology_concepts_text_type_check
  CHECK (text_type IN ('text', 'markdown'));
ALTER TABLE ontology_concepts DROP CONSTRAINT IF EXISTS ontology_concepts_contributed_by_pack_fkey;
ALTER TABLE ontology_concepts
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE ontology_concepts TO weirdo;
COMMIT;
