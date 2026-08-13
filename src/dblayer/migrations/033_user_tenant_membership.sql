-- CR-004 — Every user belongs to a Platform or a Tenant.
-- design/Change Requests.md CR-004. Establishes user↔home membership uniformly
-- (no nullable/sentinel special-case): users.type ('Platform'|'Tenant') + a
-- NOT NULL users.tenant_id. Platform users live in the reserved 'platform'
-- system tenant; Google-OAuth self-signups land in the operational 'demo'
-- sandbox tenant. This migration only establishes + populates membership — no
-- data isolation or access enforcement (those are separate, later CRs).
--
-- Idempotent (replayed every boot): IF NOT EXISTS on columns, ON CONFLICT on
-- seeds, DROP+ADD on the CHECK, and backfills guarded by IS NULL.

-- 1. Tenants gain an is_system flag (marks reserved, non-engineering tenants).
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Reserved tenants, with fixed ids so seeds/backfills can reference them
--    deterministically. 'platform' is the home for Platform users (is_system,
--    never hosts engineering); 'demo' is the operational OAuth sandbox.
INSERT INTO tenants (id, code, name, status, is_system)
  VALUES ('11111111-1111-1111-1111-111111111111', 'platform', 'Platform', 'Operational', TRUE)
  ON CONFLICT (code) DO UPDATE SET is_system = TRUE;
INSERT INTO tenants (id, code, name, status, is_system)
  VALUES ('22222222-2222-2222-2222-222222222222', 'demo', 'Demo', 'Operational', FALSE)
  ON CONFLICT (code) DO NOTHING;

-- 3. users.type + users.tenant_id — add nullable, backfill, then enforce.
ALTER TABLE users ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Backfill (only rows not yet populated): default everyone to the operational
-- 'default' tenant as a safe baseline, then promote holders of an Active root
-- badge to Platform / 'platform'. (SUPERUSER_EMAIL holds a root grant, so this
-- identifies the platform identity without needing the env value in SQL. On a
-- clean-slate DB, seedIdentityBaseline then sets the authoritative per-user
-- values.)
UPDATE users
   SET type = 'Tenant',
       tenant_id = (SELECT id FROM tenants WHERE code = 'default')
 WHERE type IS NULL;

UPDATE users
   SET type = 'Platform',
       tenant_id = (SELECT id FROM tenants WHERE code = 'platform')
 WHERE id::text IN (SELECT holder_id FROM badge_grants WHERE badge_type = 'root' AND status = 'Active');

-- Enforce: both columns NOT NULL + type domain.
ALTER TABLE users ALTER COLUMN type SET NOT NULL;
ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_type_check;
ALTER TABLE users ADD CONSTRAINT users_type_check CHECK (type IN ('Platform', 'Tenant'));

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users (tenant_id);
