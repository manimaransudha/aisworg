BEGIN;
DROP TABLE IF EXISTS objective_comments CASCADE;
CREATE TABLE objective_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id  UUID NOT NULL REFERENCES objectives(id),
  comment_text  TEXT NOT NULL,
  actor_id      UUID REFERENCES participants_master(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_objective_comments_objective_id ON objective_comments (objective_id, created_at);
GRANT ALL PRIVILEGES ON TABLE objective_comments TO weirdo;
COMMIT;
