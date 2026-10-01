BEGIN;
DROP TABLE IF EXISTS tenant_concept_aliases CASCADE;
CREATE TABLE tenant_concept_aliases (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id),
  concept_type   TEXT NOT NULL,
  canonical_code TEXT NOT NULL,
  display_label  TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_concept_aliases_unique UNIQUE (tenant_id, concept_type, canonical_code)
);
ALTER TABLE tenant_concept_aliases
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE tenant_concept_aliases TO weirdo;
COMMIT;
