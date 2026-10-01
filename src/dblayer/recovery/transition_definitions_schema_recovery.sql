BEGIN;
DROP TABLE IF EXISTS transition_definitions CASCADE;
CREATE TABLE transition_definitions (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type                   TEXT NOT NULL,
  from_state                    TEXT NOT NULL,
  to_state                      TEXT NOT NULL,
  required_authority_rule_id    UUID REFERENCES authority_rules(id),
  required_policy_ids           UUID[] NOT NULL DEFAULT '{}',
  UNIQUE (entity_type, from_state, to_state)
);
ALTER TABLE transition_definitions ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE transition_definitions ADD COLUMN IF NOT EXISTS required_quality_gate_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE transition_definitions ADD COLUMN IF NOT EXISTS creates_obligation TEXT;
ALTER TABLE transition_definitions ADD COLUMN IF NOT EXISTS verb TEXT;
ALTER TABLE transition_definitions ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE transition_definitions ADD COLUMN IF NOT EXISTS retired_at TIMESTAMPTZ;
ALTER TABLE transition_definitions DROP CONSTRAINT IF EXISTS transition_definitions_entity_type_check;
ALTER TABLE transition_definitions ADD COLUMN IF NOT EXISTS trigger TEXT NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual', 'governed'));
ALTER TABLE transition_definitions ADD COLUMN IF NOT EXISTS submit_verb TEXT;
ALTER TABLE transition_definitions ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE transition_definitions ADD COLUMN IF NOT EXISTS version_event TEXT
  CHECK (version_event IS NULL OR version_event IN
    ('VersionCreated', 'VersionValidated', 'VersionPublished', 'VersionActivated', 'VersionDeprecated', 'VersionSuperseded', 'VersionArchived'));
ALTER TABLE transition_definitions ADD COLUMN IF NOT EXISTS submit_version_event TEXT
  CHECK (submit_version_event IS NULL OR submit_version_event IN
    ('VersionCreated', 'VersionValidated', 'VersionPublished', 'VersionActivated', 'VersionDeprecated', 'VersionSuperseded', 'VersionArchived'));
ALTER TABLE transition_definitions
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE transition_definitions TO weirdo;
COMMIT;
