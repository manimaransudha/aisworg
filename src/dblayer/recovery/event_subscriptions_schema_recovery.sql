BEGIN;
DROP TABLE IF EXISTS event_subscriptions CASCADE;
CREATE TABLE event_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    TEXT NOT NULL REFERENCES event_registry(event_type),
  handler_name  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_subscriptions_unique UNIQUE (event_type, handler_name)
);
ALTER TABLE event_subscriptions
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE event_subscriptions TO weirdo;
COMMIT;
