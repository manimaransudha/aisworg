-- CR-110 follow-up — the two remaining nav-gated routes that still used the
-- LEGACY requireRole('super'|'tenant_super') (middleware/auth.js, the
-- singular users.role rank check) are moved onto the modern, Ontology-backed
-- requireRole (middleware/requireRole.ts, participants_master.authorised_role)
-- so navbar.ejs's link visibility and the route's own enforcement read from
-- the same source: route_authority.
--
-- 'superuser' and 'tenant_admin' are pre-existing authorised-role Ontology
-- codes (migration 254) — no new Ontology data introduced. Existing seeded
-- Tenant Admin fixture users are granted the 'tenant_admin' authorised_role
-- in the same pass (src/dblayer/seed/seedIdentityBaseline.ts), mirroring how
-- root/user 1 already holds 'superuser'.

INSERT INTO route_authority (method, path, badges, roles, match_mode) VALUES
  ('GET',  '/aisworg/seu/events',                          '{}', ARRAY['superuser'], 'all'),
  ('GET',  '/aisworg/seu/tenant-admin/users',               '{}', ARRAY['tenant_admin'], 'all'),
  ('POST', '/aisworg/seu/tenant-admin/users/:id/badges',    '{}', ARRAY['tenant_admin'], 'all')
ON CONFLICT (method, path) DO NOTHING;
