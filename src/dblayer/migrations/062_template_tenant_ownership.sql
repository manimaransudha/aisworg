-- Template ownership (owner, 2026-08-19, CR-026): "Add a tenant_id column.
-- For platform users, this will be platform." Foundation piece for Template
-- Inheritance (Ch.6 §9/§20.4) — a tenant's own inherited variant of a
-- Platform category keeps the SAME `code` as its parent, disambiguated by
-- tenant ownership, mirroring Pack's ownership model exactly (migration 044).
--
-- Backfill: every existing row becomes Platform-owned — the only
-- non-breaking default, same reasoning migration 044 already used.
ALTER TABLE templates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE templates SET tenant_id = '11111111-1111-1111-1111-111111111111' WHERE tenant_id IS NULL;
ALTER TABLE templates ALTER COLUMN tenant_id SET DEFAULT '11111111-1111-1111-1111-111111111111';
ALTER TABLE templates ALTER COLUMN tenant_id SET NOT NULL;

-- (code, template_version) alone is no longer the unique identity — Platform's
-- row and a tenant's own row of the same code+version must coexist. Mirrors
-- how CR-024 already scoped this once (bare code -> (code, version)); this is
-- the same move one dimension further ((code, version) -> (code, version, tenant_id)).
ALTER TABLE templates DROP CONSTRAINT templates_code_version_key;
ALTER TABLE templates ADD CONSTRAINT templates_code_version_tenant_key UNIQUE (code, template_version, tenant_id);
