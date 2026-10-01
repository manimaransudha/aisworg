BEGIN;
DROP TABLE IF EXISTS template_packs CASCADE;
CREATE TABLE template_packs (
  template_id  UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  pack_code    TEXT NOT NULL,
  PRIMARY KEY (template_id, pack_code)
);
ALTER TABLE template_packs ADD COLUMN IF NOT EXISTS list_kind TEXT NOT NULL DEFAULT 'mandatory';
ALTER TABLE template_packs DROP CONSTRAINT IF EXISTS template_packs_pkey;
ALTER TABLE template_packs ADD PRIMARY KEY (template_id, pack_code, list_kind);
ALTER TABLE template_packs
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE template_packs TO weirdo;
COMMIT;
