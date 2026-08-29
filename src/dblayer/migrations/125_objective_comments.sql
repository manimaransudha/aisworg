-- CR-073: general-purpose, append-only comment thread on an Objective.
-- Never UPDATEd/DELETEd at the application layer — same insert-only
-- discipline as `events` and `schema_definitions`. The Active -> Proposed
-- (Reject) transition requires one of these on every use (its own feedback);
-- any objective_* badge holder may also add one at any other time.
CREATE TABLE IF NOT EXISTS objective_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id  UUID NOT NULL REFERENCES objectives(id),
  comment_text  TEXT NOT NULL,
  actor_id      INTEGER REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_objective_comments_objective_id ON objective_comments (objective_id, created_at);
