-- Profile identity foundation (owner, 2026-08-19): "19.2 and 19.3 has to be
-- fixed similar to pack and template" — Profile never got ANY of the
-- tenant-ownership/versioning/inheritance work Pack (migration 044, 010,
-- 063) and Template (CR-024, CR-026) each already have. Building all four
-- dimensions in one migration since Profile starts from zero on all of them,
-- unlike Template which built them in separate stages across two CRs.
--
-- tenant_id: mirrors packs.tenant_id / templates.tenant_id exactly —
-- Platform-owned by default, backfilled.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE profiles SET tenant_id = '11111111-1111-1111-1111-111111111111' WHERE tenant_id IS NULL;
ALTER TABLE profiles ALTER COLUMN tenant_id SET DEFAULT '11111111-1111-1111-1111-111111111111';
ALTER TABLE profiles ALTER COLUMN tenant_id SET NOT NULL;

-- profile_version: mirrors templates.template_version (CR-024) — semver TEXT,
-- every existing row backfilled to '1.0.0' (all were code-unique under the
-- old constraint, so this is exact, not a guess).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_version TEXT NOT NULL DEFAULT '1.0.0';

-- parent_profile_id: mirrors templates.parent_template_id (present since
-- migration 002, wired by CR-026) — set once at Draft creation via an
-- "Inherit" control, never revisited by Save.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS parent_profile_id UUID REFERENCES profiles(id);

-- category: net-new for Profile — Ch.7 §8's Profile Categories
-- (Startup/Enterprise/Healthcare/Banking/Prototype/Production), Ontology-
-- rooted (concept type profile-categories, migration 065) the same way
-- Template's category lives in its Ontology-backed `code` (CR-021) — but
-- kept as its OWN field here, not folded into `code` the way Template's
-- was. Template's shortcut (code IS the category) is exactly what made its
-- own inheritance identity awkward (Ch.6 §20.4/§20.14): a Derived Template
-- can't get a category distinct from its parent's without also getting a
-- new identity. Profile's inheritance (this same migration) doesn't have
-- that problem, because category and identity are separate from the start.
-- Nullable for now — every existing row predates this field and has no real
-- category to backfill to; enforced as required at the authoring-grammar
-- level (migration 066) for every NEW Draft going forward, the same way
-- Template's `purpose` (CR-023) was added as schema-required with no DB-level
-- backfill.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS category TEXT;

-- (code, profile_version) alone is no longer the unique identity — Platform's
-- row and a tenant's own row of the same code+version must coexist, and two
-- Versions of the same code must coexist too. Mirrors
-- templates_code_version_tenant_key (migration 062) exactly, one migration
-- instead of two since Profile is starting from a bare UNIQUE(code) with
-- nothing to preserve incrementally.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_code_key;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_code_version_tenant_key;
ALTER TABLE profiles ADD CONSTRAINT profiles_code_version_tenant_key UNIQUE (code, profile_version, tenant_id);
