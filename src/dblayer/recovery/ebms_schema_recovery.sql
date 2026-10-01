BEGIN;
DROP TABLE IF EXISTS ebms CASCADE;
CREATE TABLE ebms (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id                UUID NOT NULL,
  template_id           UUID NOT NULL REFERENCES templates(id),
  profile_id            UUID NOT NULL REFERENCES profiles(id),
  composed_packs        JSONB NOT NULL DEFAULT '[]',
  composition_report    JSONB NOT NULL DEFAULT '{}',
  status                TEXT NOT NULL DEFAULT 'Active',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE ebms ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ebms ADD COLUMN IF NOT EXISTS behaviors JSONB;
ALTER TABLE ebms
  ADD COLUMN IF NOT EXISTS applicable_quality_gate_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS applicable_policy_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE ebms
  ADD COLUMN IF NOT EXISTS seu_scoped_policy_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE ebms DROP CONSTRAINT IF EXISTS ebms_status_check;
ALTER TABLE ebms ADD CONSTRAINT ebms_status_check
  CHECK (status IN ('Composed', 'Validated', 'Active', 'Superseded', 'Retired'));
ALTER TABLE ebms
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
ALTER TABLE seus
  ADD CONSTRAINT seus_active_ebm_id_fkey FOREIGN KEY (active_ebm_id) REFERENCES ebms(id);
GRANT ALL PRIVILEGES ON TABLE ebms TO weirdo;
COMMIT;
