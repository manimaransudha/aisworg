-- CR-110 — Route Authority: which badge(s)/role(s) a route requires, as data
-- instead of a literal baked into each route file. See
-- design/change-requests/CR-110-route-authority-table.md and
-- design/route-authority-decisions.md for the full design trace.
--
-- badges/roles are both arrays (AND semantics by default; match_mode='any'
-- for the handful of routes that accept alternates, e.g. Pack's
-- transition/validate). A route with no badge/role requirement at all still
-- gets a row with an empty array — requireBadge(['None'])/requireRole
-- (['None']) are honest, explicit declarations in code today (see
-- middleware/requireBadge.ts's own header comment), and that stays true as
-- data: "checked, and nothing is required" is different from "never
-- checked, no row at all."
--
-- Backfilled from the live, running app's own mounted route tree (Express 5
-- app.router.stack, walked via a one-off instrumented dump — not by hand
-- transcribing route files), so this reflects exactly what's mounted today,
-- not what a grep happened to find.
--
-- Deliberately excluded from this backfill (see CR-110 for why each one
-- doesn't fit a static (method, path) -> badges/roles row):
--   - Routes whose badge is resolved per-request from a URL param, e.g.
--     sdkAuthoring.ts's kind-based defines (/sdk/:slug/new,
--     /sdk/:slug/:draftId/*) and requireRowActionBadge-gated publish/
--     transition routes — one route pattern, many possible badges depending
--     on runtime data. Stays on its existing dynamic-resolution mechanism.
--   - Hand-rolled inline gates that never call requireBadge/requireRole at
--     all: requireAuthorityAdmin (/sdk/authority/*), requireOntologyAdmin
--     (/sdk/ontology/*).
--   - /aisworg/demo, gated at the router-mount level
--     (app.use("/aisworg/demo", requireRole(...), demoRouter)), not
--     per-route — req.route isn't set yet at that point, so it doesn't fit
--     the same per-route lookup key.
--   - The legacy string-argument requireRole (middleware/auth.js:
--     requireRole('general'|'super')), used by routes/web/public.js and
--     routes/web/auth.js — a different, older mechanism, explicitly kept
--     untouched per its own header comment, not part of this effort.
--   - Every route with no requireBadge/requireRole call at all today (most
--     of the SEU API layer: evidence, decisions, knowledge, reviews,
--     compliance, obligations, tenants, execution-targets, attention-items,
--     external-interactions, findings, work-items, etc.) — nothing to
--     record; adding a row for these would assert a gate that doesn't
--     exist.
--   - CRUD routes for this table itself (don't exist yet — built separately,
--     gated by ROUTE_AUTHORITY_ADMIN_BADGE env var, not by this table).

CREATE TABLE IF NOT EXISTS route_authority (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method      TEXT NOT NULL,
  path        TEXT NOT NULL,
  badges      TEXT[] NOT NULL DEFAULT '{}',
  roles       TEXT[] NOT NULL DEFAULT '{}',
  match_mode  TEXT NOT NULL DEFAULT 'all' CHECK (match_mode IN ('all', 'any')),
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT route_authority_method_path_unique UNIQUE (method, path)
);

INSERT INTO route_authority (method, path, badges, roles, match_mode) VALUES
  -- /aisworg/api/seu/*
  ('POST', '/aisworg/api/seu/objectives/:id/transition/achieve',   ARRAY['objective_achieve'],   '{}', 'all'),
  ('POST', '/aisworg/api/seu/objectives/:id/transition/activate',  ARRAY['objective_activate'],  '{}', 'all'),
  ('POST', '/aisworg/api/seu/objectives/:id/transition/archive',   ARRAY['objective_archive'],   '{}', 'all'),
  ('POST', '/aisworg/api/seu/objectives/:id/transition/reject',    ARRAY['objective_reject'],    '{}', 'all'),
  ('POST', '/aisworg/api/seu/objectives/:id/transition/retire',    ARRAY['objective_retire'],    '{}', 'all'),
  ('POST', '/aisworg/api/seu/objectives/:id/transition/supersede', ARRAY['objective_supersede'], '{}', 'all'),
  ('POST', '/aisworg/api/seu/objectives/:id/update',               ARRAY['objective_propose'],   '{}', 'all'),
  ('GET',  '/aisworg/api/seu/objectives/:id',                      '{}', '{}', 'all'),
  ('GET',  '/aisworg/api/seu/objectives/suggest-capabilities',     '{}', '{}', 'all'),
  ('GET',  '/aisworg/api/seu/objectives',                          '{}', '{}', 'all'),
  ('POST', '/aisworg/api/seu/objectives',                          ARRAY['objective_propose'],   '{}', 'all'),
  ('POST', '/aisworg/api/seu/packs/:id/transition/activate',       ARRAY['pack_activate'],       '{}', 'all'),
  ('POST', '/aisworg/api/seu/packs/:id/transition/archive',        ARRAY['pack_archive'],        '{}', 'all'),
  ('POST', '/aisworg/api/seu/packs/:id/transition/publish',        ARRAY['pack_publish'],        '{}', 'all'),
  ('POST', '/aisworg/api/seu/packs/:id/transition/reject',         ARRAY['pack_reject', 'pack_validate'], '{}', 'any'),
  ('POST', '/aisworg/api/seu/packs/:id/transition/retire',         ARRAY['pack_retire'],         '{}', 'all'),
  ('POST', '/aisworg/api/seu/packs/:id/transition/validate',       ARRAY['pack_validate', 'pack_define', 'pack_reject'], '{}', 'any'),
  ('GET',  '/aisworg/api/seu/packs',                                '{}', '{}', 'all'),

  -- /aisworg/seu/* (web)
  ('GET',  '/aisworg/seu/capabilities',                            '{}', ARRAY['participant'], 'all'),
  ('POST', '/aisworg/seu/deliverable-definitions/:id/copy',        '{}', ARRAY['participant'], 'all'),
  ('GET',  '/aisworg/seu/deliverable-definitions',                 '{}', ARRAY['participant'], 'all'),
  ('POST', '/aisworg/seu/identity/badges/:id/update',              ARRAY['identity_manage'], '{}', 'all'),
  ('GET',  '/aisworg/seu/identity/badges',                         ARRAY['identity_manage'], '{}', 'all'),
  ('GET',  '/aisworg/seu/identity/tenants',                        ARRAY['root'], '{}', 'all'),
  ('POST', '/aisworg/seu/identity/tenants',                        ARRAY['root'], '{}', 'all'),
  ('POST', '/aisworg/seu/identity/users/:id/update',               ARRAY['identity_manage'], '{}', 'all'),
  ('GET',  '/aisworg/seu/identity/users',                          ARRAY['identity_manage'], '{}', 'all'),
  ('POST', '/aisworg/seu/identity/users',                          ARRAY['identity_manage'], '{}', 'all'),
  ('GET',  '/aisworg/seu/identity',                                ARRAY['root'], '{}', 'all'),
  ('GET',  '/aisworg/seu/objectives/:id/children',                 '{}', '{}', 'all'),
  ('POST', '/aisworg/seu/objectives/:id/comments',                 '{}', '{}', 'all'),
  ('POST', '/aisworg/seu/objectives/:id/commission',               ARRAY['seu_commission'], '{}', 'all'),
  ('GET',  '/aisworg/seu/objectives/:id/compose-ebm',              ARRAY['seu_commission'], '{}', 'all'),
  ('POST', '/aisworg/seu/objectives/:id/compose-ebm',              ARRAY['seu_commission'], '{}', 'all'),
  ('POST', '/aisworg/seu/objectives/:id/delete',                   ARRAY['objective_propose'], '{}', 'all'),
  ('GET',  '/aisworg/seu/objectives/:id/edit',                     ARRAY['objective_propose'], '{}', 'all'),
  ('POST', '/aisworg/seu/objectives/:id/move',                     ARRAY['objective_propose'], '{}', 'all'),
  ('POST', '/aisworg/seu/objectives/:id/retire',                   ARRAY['objective_retire'], '{}', 'all'),
  ('POST', '/aisworg/seu/objectives/:id/submit',                   ARRAY['objective_propose'], '{}', 'all'),
  ('POST', '/aisworg/seu/objectives/:id/transition/activate',      ARRAY['objective_activate'], '{}', 'all'),
  ('POST', '/aisworg/seu/objectives/:id/transition/archive',       ARRAY['objective_archive'], '{}', 'all'),
  ('POST', '/aisworg/seu/objectives/:id/transition/reject',        ARRAY['objective_reject'], '{}', 'all'),
  ('POST', '/aisworg/seu/objectives/:id/transition/retire',        ARRAY['objective_retire'], '{}', 'all'),
  ('POST', '/aisworg/seu/objectives/:id/transition/supersede',     ARRAY['objective_supersede'], '{}', 'all'),
  ('POST', '/aisworg/seu/objectives/:id/update',                   ARRAY['objective_propose'], '{}', 'all'),
  ('GET',  '/aisworg/seu/objectives/:id/validate-commission',      ARRAY['seu_commission'], '{}', 'all'),
  ('POST', '/aisworg/seu/objectives/:id/validate-commission',      ARRAY['seu_commission'], '{}', 'all'),
  ('GET',  '/aisworg/seu/objectives/:id',                          '{}', '{}', 'all'),
  ('GET',  '/aisworg/seu/objectives/new',                          ARRAY['objective_propose'], '{}', 'all'),
  ('GET',  '/aisworg/seu/objectives',                              '{}', '{}', 'all'),
  ('POST', '/aisworg/seu/objectives',                              ARRAY['objective_propose'], '{}', 'all'),
  ('GET',  '/aisworg/seu/packs',                                   '{}', ARRAY['participant'], 'all'),
  ('GET',  '/aisworg/seu/participants',                            '{}', ARRAY['participant'], 'all'),
  ('POST', '/aisworg/seu/policy-definitions/:id/copy',             '{}', ARRAY['participant'], 'all'),
  ('GET',  '/aisworg/seu/policy-definitions',                      '{}', ARRAY['participant'], 'all'),
  ('POST', '/aisworg/seu/profiles/:id/copy',                       '{}', ARRAY['participant'], 'all'),
  ('GET',  '/aisworg/seu/profiles',                                '{}', ARRAY['participant'], 'all'),
  ('GET',  '/aisworg/seu/sdk/schema-registry/:id',                 ARRAY['root'], '{}', 'all'),
  ('GET',  '/aisworg/seu/sdk/schema-registry/new',                 ARRAY['root'], '{}', 'all'),
  ('GET',  '/aisworg/seu/sdk/schema-registry',                     ARRAY['root'], '{}', 'all'),
  ('POST', '/aisworg/seu/sdk/schema-registry',                     ARRAY['root'], '{}', 'all'),
  ('POST', '/aisworg/seu/service-definitions/:id/copy',            '{}', ARRAY['participant'], 'all'),
  ('GET',  '/aisworg/seu/service-definitions',                     '{}', ARRAY['participant'], 'all'),
  ('POST', '/aisworg/seu/templates/:id/copy',                      '{}', ARRAY['participant'], 'all'),
  ('GET',  '/aisworg/seu/templates',                                '{}', ARRAY['participant'], 'all')
ON CONFLICT (method, path) DO NOTHING;
