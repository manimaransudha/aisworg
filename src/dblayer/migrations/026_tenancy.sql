-- Participant Integration & Attestation — Plan step 6 (Resolution 8). The
-- minimal Phase-12 slice: enough tenancy to resolve "which tenant owns this SEU
-- -> which edge configuration its Work Items run against." A tenant's edge
-- choices (VCS provider, orchestrator endpoint/auth, attestation format) are
-- all config; the core is identical across tenants (the step-6 core-invariance
-- check). The remainder of Phase-12 multi-tenancy is unchanged and still sits
-- after this work.
CREATE TABLE IF NOT EXISTS tenants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A single seeded default tenant that every pre-existing SEU belongs to.
INSERT INTO tenants (code, name)
  VALUES ('default', 'Default Tenant')
  ON CONFLICT (code) DO NOTHING;

-- seus.tenant_id — nullable in the schema; commissioning always sets it (to the
-- default tenant unless a tenant is named), and existing rows are backfilled.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'seus' AND column_name = 'tenant_id') THEN
    ALTER TABLE seus ADD COLUMN tenant_id UUID REFERENCES tenants(id);
  END IF;
END $$;
UPDATE seus SET tenant_id = (SELECT id FROM tenants WHERE code = 'default') WHERE tenant_id IS NULL;

-- Per-Capability execution target becomes per-(tenant, Capability): capabilities
-- are pack-global, so the SAME Capability can be reached differently per tenant.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'execution_targets' AND column_name = 'tenant_id') THEN
    ALTER TABLE execution_targets ADD COLUMN tenant_id UUID REFERENCES tenants(id);
  END IF;
END $$;
UPDATE execution_targets SET tenant_id = (SELECT id FROM tenants WHERE code = 'default') WHERE tenant_id IS NULL;
ALTER TABLE execution_targets DROP CONSTRAINT IF EXISTS execution_targets_capability_unique;
ALTER TABLE execution_targets DROP CONSTRAINT IF EXISTS execution_targets_tenant_capability_unique;
ALTER TABLE execution_targets ADD CONSTRAINT execution_targets_tenant_capability_unique UNIQUE (tenant_id, capability_id);

-- The remaining tenant declarations (§2.1): VCS binding (#1), callback auth
-- (#3), attestation config (#4). One row per tenant, each an opaque JSONB the
-- core stores and the edge interprets — the core never parses a provider,
-- credential, or signing format.
CREATE TABLE IF NOT EXISTS tenant_contracts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL UNIQUE REFERENCES tenants(id),
  vcs_binding        JSONB NOT NULL DEFAULT '{}',
  callback_auth      JSONB NOT NULL DEFAULT '{}',
  attestation_config JSONB NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
