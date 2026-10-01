BEGIN;
DROP TABLE IF EXISTS commands CASCADE;
CREATE TABLE commands (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id         UUID NOT NULL REFERENCES seus(id),
  entity_type    TEXT NOT NULL CHECK (entity_type IN ('SEU', 'Deliverable', 'Objective')),
  entity_id      UUID NOT NULL,
  command_type   TEXT NOT NULL,
  from_state     TEXT NOT NULL,
  to_state       TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'Generated'
                    CHECK (status IN ('Generated', 'Dispatched', 'Completed', 'Deferred', 'Cancelled', 'Failed')),
  requested_by   UUID REFERENCES participants_master(id),
  correlation_id UUID NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE commands ADD COLUMN IF NOT EXISTS acting_badge_type TEXT;
ALTER TABLE commands
  ADD COLUMN IF NOT EXISTS governance_outcome_id UUID REFERENCES governance_evaluation_outcomes(id);
ALTER TABLE commands
  ADD COLUMN IF NOT EXISTS eligible_participant_pool_id UUID REFERENCES capability_fulfilment_pools(id);
GRANT ALL PRIVILEGES ON TABLE commands TO weirdo;
COMMIT;
