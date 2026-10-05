BEGIN;
DROP TABLE IF EXISTS version_events CASCADE;
CREATE TABLE version_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL REFERENCES events(id),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  entity_type      TEXT NOT NULL,
  entity_id        UUID NOT NULL,
  from_state       TEXT,
  to_state          TEXT,
  version_event    TEXT NOT NULL,
  occurred_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id         UUID NOT NULL  REFERENCES participants_master(id),
  authority_badge  TEXT
);
CREATE INDEX IF NOT EXISTS idx_version_events_entity ON version_events (entity_type, entity_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_version_events_tenant ON version_events (tenant_id);
GRANT ALL PRIVILEGES ON TABLE version_events TO weirdo;
COMMIT;
