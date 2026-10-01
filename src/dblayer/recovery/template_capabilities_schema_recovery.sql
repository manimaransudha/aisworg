BEGIN;
DROP TABLE IF EXISTS template_capabilities CASCADE;
CREATE TABLE template_capabilities (
  template_id    UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  capability_id  UUID NOT NULL REFERENCES capabilities(id),
  PRIMARY KEY (template_id, capability_id)
);
ALTER TABLE template_capabilities
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE template_capabilities TO weirdo;
COMMIT;
