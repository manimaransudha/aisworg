BEGIN;
DROP TABLE IF EXISTS attestations CASCADE;
CREATE TABLE attestations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id                UUID NOT NULL REFERENCES seus(id),
  deliverable_id        UUID NOT NULL REFERENCES deliverables(id),
  work_item_id          UUID NOT NULL REFERENCES work_items(id),
  participant_id        UUID REFERENCES participants(id),
  from_state            TEXT NOT NULL,
  to_state              TEXT NOT NULL,
  reference             TEXT,
  acting_badge_type     TEXT,
  requested_by          UUID REFERENCES participants_master(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attestations_deliverable ON attestations (deliverable_id);
GRANT ALL PRIVILEGES ON TABLE attestations TO weirdo;
COMMIT;
