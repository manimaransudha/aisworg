BEGIN;
DROP TABLE IF EXISTS objective_capabilities CASCADE;
CREATE TABLE objective_capabilities (
  objective_id     UUID NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  capability_code  TEXT NOT NULL,
  PRIMARY KEY (objective_id, capability_code)
);
ALTER TABLE objective_capabilities
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE objective_capabilities TO weirdo;
COMMIT;
