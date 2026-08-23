-- Ch.30 Event Model redesign — Publish/Consume separation, Event Registry,
-- Event Subscriptions. Locked in across an extended design conversation:
-- seu_id closes the real gap in getSeuEvents()'s incomplete N+1
-- reconstruction; consumption_state tracks per-handler dispatch outcome
-- (fire-and-forget, not synchronous); the Registry/Subscriptions tables
-- replace the in-memory subscribers array with a DB-backed, inspectable
-- catalogue, loaded into memory once at boot (never queried on the publish
-- hot path).
-- CR-059 build-time fix — IF NOT EXISTS/IF NOT EXISTS added throughout;
-- none of these were replay-safe.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS seu_id UUID REFERENCES seus(id),
  ADD COLUMN IF NOT EXISTS consumption_state JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_events_seu ON events (seu_id);

-- No historical seu_id backfill: some existing rows genuinely have no SEU
-- (Pack/Template/Profile/DeliverableDefinition are platform catalog events,
-- not SEU-scoped) — going forward is what matters for the reactive design.

CREATE TABLE IF NOT EXISTS event_registry (
  event_type   TEXT PRIMARY KEY,
  description  TEXT
);

CREATE TABLE IF NOT EXISTS event_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    TEXT NOT NULL REFERENCES event_registry(event_type),
  handler_name  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_subscriptions_unique UNIQUE (event_type, handler_name)
);
