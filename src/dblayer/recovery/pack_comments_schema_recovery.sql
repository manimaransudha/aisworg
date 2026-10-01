BEGIN;
DROP TABLE IF EXISTS pack_comments CASCADE;
CREATE TABLE pack_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id       UUID NOT NULL REFERENCES packs(id),
  comment_text  TEXT NOT NULL,
  actor_id      UUID REFERENCES participants_master(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pack_comments_pack_id ON pack_comments (pack_id, created_at);
GRANT ALL PRIVILEGES ON TABLE pack_comments TO weirdo;
COMMIT;
