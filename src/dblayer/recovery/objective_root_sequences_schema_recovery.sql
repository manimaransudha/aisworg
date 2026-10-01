BEGIN;
DROP TABLE IF EXISTS objective_root_sequences CASCADE;
CREATE TABLE objective_root_sequences (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id),
  next_seq  INTEGER NOT NULL DEFAULT 1
);
ALTER TABLE objective_root_sequences
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE objective_root_sequences TO weirdo;
COMMIT;
