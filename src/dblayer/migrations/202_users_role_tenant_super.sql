-- Owner: add 'tenant_super' as a real users.role value, alongside the
-- tenant_admin badge grants (migration 201-adjacent seed change). Value only
-- for now — not yet wired into ROLE_LEVEL/requireRole (middleware/auth.js);
-- owner will specify what it should unlock in a follow-up pass.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('general', 'power', 'super', 'tenant_super'));
