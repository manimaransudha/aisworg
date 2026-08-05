-- Phase 10 — User Management & Badge Model
-- design/mvp-build-plan/Phase 10 - User Management and Dual Authority Design.md
--
-- An identity holds a *set* of badges (badge_grants), not one flat role.
-- Three layers: Layer 1 Platform (root + whatever narrower badges get
-- created later), Layer 2a Tenant Admin, Layer 2b Engineering (Creator,
-- Reviewer, Approver — entity-type-agnostic, scoped per grant via
-- governed_entity_type/capability_id/scope_id, not one badge per Capability).
--
-- Implementation note not spelled out in the design doc, resolved here: §8.4
-- says a Creator/Reviewer/Approver grant can be scoped to either one SEU
-- instance or a Pack code, but §9's badge_types.scope_kind is described as a
-- single fixed value per badge type. Those two statements only reconcile if
-- Creator/Reviewer/Approver's scope_kind allows both — hence 'SEU_or_Pack'
-- below, a badge_types-level sentinel the badge_grants writer function
-- resolves against either seus or packs. Every other badge type in this
-- catalog has one fixed scope_kind, matching the doc's table as written.

CREATE TABLE IF NOT EXISTS tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'Operational',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO tenants (code, name, status)
VALUES ('default', 'Default Tenant', 'Operational')
ON CONFLICT (code) DO NOTHING;

-- badge_types: the recommended badge catalog, tenant-overridable. `code` is
-- deliberately NOT globally unique — a Tenant's renamed/derived badge shares
-- the same `code` as the Platform-recommended row it overrides, resolved via
-- tenant-override-then-platform-default lookup (design doc §9), not a
-- literal single-row reference. `derived_from` is TEXT, not a real FK: it
-- can't be, since `code` isn't globally unique and Postgres foreign keys
-- can't target a partial unique index — validated by the single writer
-- function in badgeTypesDB.ts instead (§9's Enforcement point).
CREATE TABLE IF NOT EXISTS badge_types (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID REFERENCES tenants(id),
  code                      TEXT NOT NULL,
  name                      TEXT NOT NULL,
  scope_kind                TEXT NOT NULL CHECK (scope_kind IN ('None', 'Tenant', 'SEU', 'Pack', 'SEU_or_Pack')),
  derived_from              TEXT,
  tiered                    BOOLEAN NOT NULL DEFAULT FALSE,
  is_registration_default   BOOLEAN NOT NULL DEFAULT FALSE,  -- exactly one row should be TRUE (Viewer) — the badge every registration gets, §8.2/§9
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT badge_types_derived_from_requires_tenant CHECK (tenant_id IS NOT NULL OR derived_from IS NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_badge_types_platform_code ON badge_types (code) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_badge_types_tenant_code ON badge_types (tenant_id, code) WHERE tenant_id IS NOT NULL;

-- canonical_ranks / badge_tiers: reserved extensibility mechanism (§9), not
-- seeded, not wired into any check for this pass. Badges are flat by default
-- (§3/§6 goal 8) — kept only so a badge that later genuinely needs graded
-- internal authority doesn't require a schema redesign.
CREATE TABLE IF NOT EXISTS canonical_ranks (
  rank  INTEGER PRIMARY KEY,
  name  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS badge_tiers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id),
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  rank        INTEGER NOT NULL REFERENCES canonical_ranks(rank),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_badge_tiers_platform_code ON badge_tiers (code) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_badge_tiers_tenant_code ON badge_tiers (tenant_id, code) WHERE tenant_id IS NOT NULL;

-- badge_grants: the actual assignments — where identity meets authority. One
-- row per grant; an identity accumulates as many rows as it holds badges.
-- `badge_type` is a code, not a literal FK, for the same reason
-- `badge_types.derived_from` isn't (badge_types.code isn't globally unique).
CREATE TABLE IF NOT EXISTS badge_grants (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holder_type           TEXT NOT NULL DEFAULT 'User',
  holder_id             TEXT NOT NULL,
  badge_type            TEXT NOT NULL,
  governed_entity_type  TEXT,                          -- TransitionEntityType — only meaningful for Creator/Reviewer/Approver grants
  capability_id         UUID REFERENCES capabilities(id),
  tier                  TEXT,                           -- reserved, unused for now (badge_tiers.code)
  scope_id              TEXT,                           -- a tenant_id / seu_id / Pack code, per the resolved badge_types.scope_kind
  status                TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended', 'Revoked')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Mandatory Capability-narrowing (§8.0): capability_id is same-row-checkable,
  -- unlike scope_id/scope_kind or derived_from, which need a cross-table
  -- lookup the badgeGrantsDB writer function performs instead.
  CONSTRAINT badge_grants_capability_narrowing CHECK (governed_entity_type IS DISTINCT FROM 'Deliverable' OR capability_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_badge_grants_holder ON badge_grants (holder_type, holder_id);
CREATE INDEX IF NOT EXISTS idx_badge_grants_holder_badge ON badge_grants (holder_id, badge_type);

-- authority_rules.authorised_role is replaced by required_badge_type +
-- required_rank (§9) — added additively. This pass migrates Deliverable
-- transitions to the badge model; every other entity type stays on
-- authorised_role until its own migration, so the old column is kept, not
-- dropped.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'authority_rules' AND column_name = 'required_badge_type') THEN
    ALTER TABLE authority_rules ADD COLUMN required_badge_type TEXT;
    ALTER TABLE authority_rules ADD COLUMN required_rank INTEGER REFERENCES canonical_ranks(rank);
  END IF;
END $$;

-- Seed the recommended badge catalog (§9's six named rows): Viewer (universal
-- registration default), root (the one seed Layer 1/Platform badge), Tenant
-- Admin (Layer 2a), Creator/Reviewer/Approver (Layer 2b).
INSERT INTO badge_types (tenant_id, code, name, scope_kind, tiered, is_registration_default) VALUES
  (NULL, 'viewer',        'Viewer',       'None',        FALSE, TRUE),
  (NULL, 'root',          'Root',         'None',        FALSE, FALSE),
  (NULL, 'tenant_admin',  'Tenant Admin', 'Tenant',      FALSE, FALSE),
  (NULL, 'creator',       'Creator',      'SEU_or_Pack', FALSE, FALSE),
  (NULL, 'reviewer',      'Reviewer',     'SEU_or_Pack', FALSE, FALSE),
  (NULL, 'approver',      'Approver',     'SEU_or_Pack', FALSE, FALSE)
ON CONFLICT DO NOTHING;

-- Migrate Deliverable transitions to the badge model (§8.0): Creator performs
-- Defined -> In Progress; Approver performs In Progress -> Approved and
-- Approved -> Baselined — genuinely separate authority. The single shared
-- 'authority-transition-deliverable' rule (one role for all three
-- transitions) can't express that split, so two new rules replace it for
-- Deliverable specifically. `authorised_role` is set to 'general' on both as
-- a placeholder to satisfy the NOT NULL column — ignored once
-- required_badge_type is set (transitionEngine.ts's badge-model branch).
-- Every other entity type is untouched, still on its own shared role-based
-- rule.
INSERT INTO authority_rules (code, governed_transition, authorised_role, required_badge_type)
VALUES
  ('authority-deliverable-creator', 'deliverable.transition', 'general', 'creator'),
  ('authority-deliverable-approver', 'deliverable.transition', 'general', 'approver')
ON CONFLICT (code) DO NOTHING;

UPDATE transition_definitions
SET required_authority_rule_id = (SELECT id FROM authority_rules WHERE code = 'authority-deliverable-creator')
WHERE entity_type = 'Deliverable' AND from_state = 'Defined' AND to_state = 'In Progress';

UPDATE transition_definitions
SET required_authority_rule_id = (SELECT id FROM authority_rules WHERE code = 'authority-deliverable-approver')
WHERE entity_type = 'Deliverable' AND from_state IN ('In Progress', 'Approved');

-- Dev/test convenience, not part of this design: app.js's own pre-existing
-- non-production auto-login shim fabricates req.session.user = { id: 1,
-- role: 'super', ... } for any unauthenticated request when
-- NODE_ENV !== 'production'. That identity never goes through a real login
-- (buildSessionUser/ensureBadgeBootstrap never run for it), so it never
-- acquires badges the normal way. Granted root directly here so every
-- existing dev/test flow that relied on the old role='super' check keeps
-- working under the badge model too. This is not the SUPERUSER_EMAIL
-- bootstrap (§9's real provisioning mechanism) — it's this one hardcoded
-- shim's own bookkeeping.
INSERT INTO badge_grants (holder_type, holder_id, badge_type)
SELECT 'User', '1', 'root'
WHERE NOT EXISTS (SELECT 1 FROM badge_grants WHERE holder_id = '1' AND badge_type = 'root');
