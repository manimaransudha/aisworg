BEGIN;
DROP TABLE IF EXISTS policies CASCADE;
CREATE TABLE policies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT NOT NULL,
  name                  TEXT NOT NULL,
  category              TEXT NOT NULL DEFAULT 'Engineering',
  constraint_type       TEXT NOT NULL DEFAULT 'Policy'
                           CHECK (constraint_type IN ('Policy', 'Standard')),
  governed_transition   TEXT,
  condition             JSONB NOT NULL DEFAULT '{"type":"always_true"}',
  severity              TEXT NOT NULL DEFAULT 'Medium',
  originating_pack_id   UUID REFERENCES packs(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE policies DROP CONSTRAINT IF EXISTS policies_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS policies_pack_code_key ON policies (originating_pack_id, code);
ALTER TABLE policies ALTER COLUMN governed_transition DROP NOT NULL;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'Transition'
  CHECK (scope IN ('Transition', 'Eligibility'));
ALTER TABLE policies ADD COLUMN IF NOT EXISTS applicability_deliverable_names TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE policies TO weirdo;
COMMIT;
