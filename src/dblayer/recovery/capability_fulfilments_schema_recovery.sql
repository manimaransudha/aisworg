BEGIN;
DROP TABLE IF EXISTS capability_fulfilments CASCADE;
CREATE TABLE capability_fulfilments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_capability_id    UUID NOT NULL REFERENCES seu_capabilities(id) ON DELETE CASCADE,
  participant_id       UUID NOT NULL REFERENCES participants(id),
  fulfilment_strategy  TEXT NOT NULL DEFAULT 'AI',
  established_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at           TIMESTAMPTZ
);
ALTER TABLE capability_fulfilments DROP CONSTRAINT IF EXISTS capability_fulfilments_fulfilment_strategy_check;
ALTER TABLE capability_fulfilments
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE capability_fulfilments TO weirdo;
CREATE INDEX IF NOT EXISTS idx_cap_fulfilments_active_cap ON capability_fulfilments (seu_capability_id, established_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cap_fulfilments_active_participant ON capability_fulfilments (participant_id) WHERE revoked_at IS NULL;
COMMIT;
