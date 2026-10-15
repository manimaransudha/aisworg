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

-- INSERT INTO route_authority (method, path, badges, roles, match_mode, author_id, author_badge)
-- SELECT v.method, v.path, v.badges, v.roles, 'all', pm.id, 'root'
--   FROM (VALUES
--     ('GET',  '/aisworg/seu/demo',                                  ARRAY[]::text[],       ARRAY['participant']::text[]),
--     ('POST', '/aisworg/seu/demo/reset',                            ARRAY[]::text[],       ARRAY['participant']::text[]),
--     ('POST', '/aisworg/seu/demo/scenarios/:code/run',              ARRAY[]::text[],       ARRAY['participant']::text[]),
--     ('POST', '/aisworg/seu/demo/playbooks/:code/step',             ARRAY[]::text[],       ARRAY['participant']::text[]),
--     ('GET',  '/aisworg/seu/demo/root',                             ARRAY['root']::text[], ARRAY[]::text[]),
--     ('POST', '/aisworg/seu/demo/root/scenarios/:code/enabled',     ARRAY['root']::text[], ARRAY[]::text[])
--   ) AS v(method, path, badges, roles)
--   JOIN users u ON lower(u.email) = lower('manimaransudha@gmail.com')
--   JOIN participants_master pm ON pm.user_id = u.id
-- ON CONFLICT (method, path) DO NOTHING;

