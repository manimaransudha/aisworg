-- Pack ownership (owner, 2026-08-18): "Packs will have ownership. It will be
-- either platform or the tenant. Platform packs will be available to all
-- users of the platform. Tenant packs are visible only to the tenant users."
--
-- Packs had no tenant_id at all before this — the Registry, the Active Packs
-- authoring tab, and every Pack-code dropdown (Dependencies, Template's
-- mandatoryPackCodes, Profile's optionalPackCodes) showed every Pack to
-- every viewer regardless of who authored it. NOT NULL, always a real row in
-- `tenants` — the reserved Platform tenant (11111111-1111-1111-1111-
-- 111111111111) for platform-wide Packs, same convention users.tenant_id
-- already uses (a Platform-type user's tenant_id is the Platform tenant, not
-- NULL — see seedIdentityBaseline.ts).
--
-- Backfill: every existing row becomes Platform-owned. That's the only
-- non-breaking default — nothing anyone could already see becomes newly
-- hidden from them (Platform is visible to everyone); going forward, a
-- Pack's Draft is created under its real author's own tenant (createAuthoringDraft),
-- and reactivating a terminal Pack into a new Version preserves the original
-- row's tenant_id (reactivation is versioning, not a change of ownership).
ALTER TABLE packs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE packs SET tenant_id = '11111111-1111-1111-1111-111111111111' WHERE tenant_id IS NULL;
ALTER TABLE packs ALTER COLUMN tenant_id SET DEFAULT '11111111-1111-1111-1111-111111111111';
ALTER TABLE packs ALTER COLUMN tenant_id SET NOT NULL;
