BEGIN;
DROP TABLE IF EXISTS tenants CASCADE;
CREATE TABLE tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'Operational',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL,
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE tenants TO weirdo;

-- The Platform tenant authors itself (no participant exists yet), as seedBaselineTenants.ts does. db:clean-slate keeps the reserved tenants.
INSERT INTO tenants (id, code, name, status, is_system, author_id, author_badge)
SELECT p.id, 'platform', 'Platform', 'Operational', TRUE, p.id, 'bootstrap'
FROM (SELECT gen_random_uuid() AS id) p;

COMMIT;
