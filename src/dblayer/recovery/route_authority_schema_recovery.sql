BEGIN;
DROP TABLE IF EXISTS route_authority CASCADE;
CREATE TABLE route_authority (
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
ALTER TABLE route_authority
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE route_authority TO weirdo;
COMMIT;
