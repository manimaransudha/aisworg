BEGIN;
DROP TABLE IF EXISTS participants CASCADE;
CREATE TABLE participants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id        UUID NOT NULL REFERENCES seus(id),
  type          TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  state         TEXT NOT NULL DEFAULT 'Available'
                   CHECK (state IN ('Created', 'Available', 'Assigned', 'Executing', 'Idle', 'Released', 'Archived')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE participants ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES participants_master(id);
ALTER TABLE participants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE participants DROP CONSTRAINT IF EXISTS participants_type_check;
ALTER TABLE participants RENAME COLUMN user_id TO participant_id;
ALTER TABLE participants DROP CONSTRAINT IF EXISTS participants_user_id_fkey;
ALTER TABLE participants ALTER COLUMN participant_id TYPE UUID USING NULL;
ALTER TABLE participants DROP CONSTRAINT IF EXISTS participants_participant_id_fkey;
ALTER TABLE participants ADD CONSTRAINT participants_participant_id_fkey
  FOREIGN KEY (participant_id) REFERENCES participants_master(id);
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE participants TO weirdo;
COMMIT;
