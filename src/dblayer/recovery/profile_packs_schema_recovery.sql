BEGIN;
DROP TABLE IF EXISTS profile_packs CASCADE;
CREATE TABLE profile_packs (
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pack_code   TEXT NOT NULL,
  PRIMARY KEY (profile_id, pack_code)
);
ALTER TABLE profile_packs ADD COLUMN IF NOT EXISTS list_kind TEXT NOT NULL DEFAULT 'optional';
ALTER TABLE profile_packs DROP CONSTRAINT IF EXISTS profile_packs_pkey;
ALTER TABLE profile_packs ADD PRIMARY KEY (profile_id, pack_code, list_kind);
ALTER TABLE profile_packs
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE profile_packs TO weirdo;
COMMIT;
