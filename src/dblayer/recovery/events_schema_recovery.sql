BEGIN;
DROP TABLE IF EXISTS events CASCADE;
CREATE TABLE events (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type                TEXT NOT NULL,
  originating_object_type   TEXT NOT NULL,
  originating_object_id     UUID NOT NULL,
  correlation_id            UUID NOT NULL,
  causation_id              UUID,
  payload                   JSONB NOT NULL DEFAULT '{}',
  occurred_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sequence                  BIGSERIAL
);
ALTER TABLE events ADD COLUMN IF NOT EXISTS actor_id        TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS authority_badge TEXT;
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS seu_id UUID REFERENCES seus(id),
  ADD COLUMN IF NOT EXISTS consumption_state JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_events_seu ON events (seu_id);
GRANT ALL PRIVILEGES ON TABLE events TO weirdo;
COMMIT;
