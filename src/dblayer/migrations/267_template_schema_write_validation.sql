-- Write-time schema validation for Template (design/design whiteboards.md/
-- schema_implementation.md, "Deepdive on templates"). Unlike Pack, Template's
-- Ontology-governed fields (code -> template-categories, migration 054;
-- deliverableCatalogue[].code -> deliverable-name, migration 160) were
-- already marked x-ontology in schema_definitions, and templates carries no
-- table-level CHECK duplicating them — nothing to drop here. schema_definition_id
-- lets a row's own write-time validation pin to the schema version it was
-- actually authored against, rather than always the latest, mirroring
-- packs.schema_definition_id (migration 266).
ALTER TABLE templates ADD COLUMN IF NOT EXISTS schema_definition_id UUID REFERENCES schema_definitions(id);

UPDATE templates SET schema_definition_id = (SELECT id FROM schema_definitions WHERE entity_kind = 'Template' ORDER BY version DESC LIMIT 1)
WHERE schema_definition_id IS NULL;
