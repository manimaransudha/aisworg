-- CR-114 Compatibility feature (design/change-requests/CR-114-schema-
-- metadata.md). Records, at publish time, which existing versions of the
-- same entity_kind the new version is compatible/incompatible with (see
-- that file's "Compatibility semantics" section for what compatible means).
-- Empty for a kind's first version — nothing to compare against.
ALTER TABLE schema_definitions
  ADD COLUMN IF NOT EXISTS compatible_versions INTEGER[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS incompatible_versions INTEGER[] NOT NULL DEFAULT '{}';

-- route_authority (CR-110) — the new Publish step's own route. Same root-only
-- gate as the existing POST /aisworg/seu/sdk/schema-registry (migration 261);
-- POST /aisworg/seu/sdk/schema-registry itself no longer writes (it's now the
-- review step) but keeps its existing row/gate unchanged.
INSERT INTO route_authority (method, path, badges, roles, match_mode) VALUES
  ('POST', '/aisworg/seu/sdk/schema-registry/publish', '{}', ARRAY['root'], 'all');
