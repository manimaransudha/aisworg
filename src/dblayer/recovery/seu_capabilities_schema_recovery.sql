BEGIN;
DROP TABLE IF EXISTS seu_capabilities CASCADE;
CREATE TABLE seu_capabilities (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id         UUID NOT NULL REFERENCES seus(id) ON DELETE CASCADE,
  capability_id  UUID NOT NULL REFERENCES capabilities(id),
  status         TEXT NOT NULL DEFAULT 'Unfulfilled'
                    CHECK (status IN ('Unfulfilled', 'Fulfilled')),
  UNIQUE (seu_id, capability_id)
);
ALTER TABLE seu_capabilities
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE seu_capabilities TO weirdo;
COMMIT;
