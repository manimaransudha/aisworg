-- Schema/table sync + write-time schema validation for Pack (design/design
-- whiteboards.md/schema_implementation.md). installation_classification is
-- Ontology-governed (validated against the installation-classification
-- concept type in code) but still carried a hardcoded CHECK duplicating an
-- older, now-stale list — same treatment migration 038 already gave
-- packs.category. schema_definition_id lets a row's own write-time
-- validation pin to the schema version it was actually authored against,
-- rather than always the latest.
ALTER TABLE packs DROP CONSTRAINT IF EXISTS packs_installation_classification_check;

ALTER TABLE packs ADD COLUMN IF NOT EXISTS schema_definition_id UUID REFERENCES schema_definitions(id);

UPDATE packs SET schema_definition_id = (SELECT id FROM schema_definitions WHERE entity_kind = 'Pack' ORDER BY version DESC LIMIT 1)
WHERE schema_definition_id IS NULL;
