BEGIN;
DROP TABLE IF EXISTS users CASCADE;
CREATE TABLE users (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                TEXT NOT NULL UNIQUE,
  name                 TEXT,
  avatar_url           TEXT,
  --role                 TEXT NOT NULL DEFAULT 'general',
  auth_provider        TEXT NOT NULL DEFAULT 'local'
                         CHECK (auth_provider IN ('google', 'facebook', 'local')),
  provider_id          TEXT,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  is_protected         BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash        TEXT,
  verification_token   TEXT,
  verification_expires TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login           TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_users_email        ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_verify_token ON users (verification_token) WHERE verification_token IS NOT NULL;


ALTER TABLE users ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE users ALTER COLUMN type SET NOT NULL;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_type_check;
ALTER TABLE users ADD CONSTRAINT users_type_check CHECK (type IN ('Platform', 'Tenant'));

ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL;

--ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
--ALTER TABLE users ADD CONSTRAINT users_role_check
--  CHECK (role IN ('general', 'power', 'super', 'tenant_super'));

GRANT ALL PRIVILEGES ON TABLE users TO weirdo;
COMMIT;
