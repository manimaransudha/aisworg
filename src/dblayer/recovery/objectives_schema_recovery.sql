BEGIN;
DROP TABLE IF EXISTS objectives CASCADE;
CREATE TABLE objectives (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement            TEXT NOT NULL,
  tier                 TEXT NOT NULL DEFAULT 'Engineering'
                          CHECK (tier IN ('Strategic', 'Operational', 'Engineering')),
  parent_objective_id  UUID REFERENCES objectives(id),
  status               TEXT NOT NULL DEFAULT 'Active',
  version              INTEGER NOT NULL DEFAULT 1,
  requested_by         UUID REFERENCES participants_master(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE objectives DROP CONSTRAINT IF EXISTS objectives_parent_required_chk;
ALTER TABLE objectives
  ADD CONSTRAINT objectives_parent_required_chk
  CHECK (tier = 'Strategic' OR parent_objective_id IS NOT NULL);
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS next_child_seq INTEGER NOT NULL DEFAULT 1;
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS display_id TEXT;
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS sponsoring_authority JSONB;
ALTER TABLE objectives ALTER COLUMN version TYPE TEXT USING (version::text || '.0.0');
ALTER TABLE objectives ALTER COLUMN version SET DEFAULT '1.0.0';
ALTER TABLE objectives ALTER COLUMN requested_by SET NOT NULL;
ALTER TABLE objectives DROP CONSTRAINT IF EXISTS objectives_status_check;
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS superseding_objective_id UUID REFERENCES objectives(id);
ALTER TABLE objectives ADD CONSTRAINT objectives_status_check
  CHECK (status = ANY (ARRAY['Proposed', 'Active', 'Achieved', 'Superseded', 'Retired', 'Archived', 'Reject']));
GRANT ALL PRIVILEGES ON TABLE objectives TO weirdo;
COMMIT;
