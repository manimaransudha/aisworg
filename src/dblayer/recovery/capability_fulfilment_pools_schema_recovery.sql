BEGIN;
DROP TABLE IF EXISTS capability_fulfilment_pools CASCADE;
CREATE TABLE capability_fulfilment_pools (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id             UUID NOT NULL REFERENCES seus(id),
  seu_capability_id  UUID REFERENCES seu_capabilities(id),
  capability_id      UUID REFERENCES capabilities(id),
  participant_ids    UUID[] NOT NULL DEFAULT '{}',
  resolved_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_capability_fulfilment_pools_seu ON capability_fulfilment_pools (seu_id);
CREATE INDEX IF NOT EXISTS idx_capability_fulfilment_pools_seu_capability ON capability_fulfilment_pools (seu_capability_id);
ALTER TABLE capability_fulfilment_pools
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE capability_fulfilment_pools TO weirdo;
COMMIT;
