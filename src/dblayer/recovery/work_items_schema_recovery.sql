BEGIN;
DROP TABLE IF EXISTS work_items CASCADE;
CREATE TABLE work_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id       UUID NOT NULL REFERENCES commands(id),
  participant_id   UUID REFERENCES participants(id),
  status           TEXT NOT NULL DEFAULT 'Generated',
  dispatch_strategy TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_work_items_command  ON work_items (command_id);
CREATE INDEX IF NOT EXISTS idx_work_items_participant ON work_items (participant_id);
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS output_reference TEXT;
ALTER TABLE work_items DROP CONSTRAINT IF EXISTS work_items_status_check;
ALTER TABLE work_items ADD CONSTRAINT work_items_status_check
  CHECK (status IN ('Generated', 'Assigned', 'Dispatched', 'Executing', 'Completed', 'Failed', 'Cancelled', 'Disposed'));
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS target_completion_at TIMESTAMPTZ;
ALTER TABLE work_items
  ADD COLUMN IF NOT EXISTS execution_context JSONB;
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS dispatch_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE work_items
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE work_items TO weirdo;
COMMIT;
