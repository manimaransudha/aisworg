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
ALTER TABLE events ADD COLUMN IF NOT EXISTS actor_id        UUID NOT NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS authority_badge TEXT NOT NULL;
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS seu_id UUID REFERENCES seus(id),
  ADD COLUMN IF NOT EXISTS consumption_state JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_events_seu ON events (seu_id);
CREATE INDEX IF NOT EXISTS idx_events_tenant ON events (tenant_id);
GRANT ALL PRIVILEGES ON TABLE events TO weirdo;
GRANT ALL PRIVILEGES ON SEQUENCE events_sequence_seq TO weirdo;

-- GRANT ALL PRIVILEGES ON SEQUENCE events_sequence_seq TO weirdo;

CREATE INDEX IF NOT EXISTS idx_events_type_created ON events (event_type, occurred_at);
CREATE INDEX IF NOT EXISTS idx_events_correlation ON events (correlation_id);
CREATE INDEX IF NOT EXISTS idx_events_originating ON events (originating_object_type, originating_object_id);
COMMIT;
