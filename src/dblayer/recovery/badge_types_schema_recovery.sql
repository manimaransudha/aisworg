BEGIN;
DROP TABLE IF EXISTS badge_types CASCADE;
CREATE TABLE badge_types (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID REFERENCES tenants(id),
  code                      TEXT NOT NULL,
  name                      TEXT NOT NULL,
  scope_kind                TEXT NOT NULL CHECK (scope_kind IN ('None', 'Tenant', 'SEU', 'Pack', 'SEU_or_Pack')),
  derived_from              TEXT,
  tiered                    BOOLEAN NOT NULL DEFAULT FALSE,
  is_registration_default   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT badge_types_derived_from_requires_tenant CHECK (tenant_id IS NOT NULL OR derived_from IS NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_badge_types_platform_code ON badge_types (code) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_badge_types_tenant_code ON badge_types (tenant_id, code) WHERE tenant_id IS NOT NULL;
ALTER TABLE badge_types
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE badge_types TO weirdo;
COMMIT;
