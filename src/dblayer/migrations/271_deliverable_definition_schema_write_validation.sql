-- Write-time schema validation for Deliverable Definition (design/design
-- whiteboards.md/schema_implementation.md, "Deepdive + Build on Deliverable
-- Definition"). No table CHECK to drop — only `status` has one, structural.
-- schema_definition_id lets a row's own write-time validation pin to the
-- schema version it was actually authored against, mirroring
-- packs/templates/profiles/policy_definitions/service_definitions.schema_definition_id
-- (migrations 266/267/268/269/270).
ALTER TABLE deliverable_definitions ADD COLUMN IF NOT EXISTS schema_definition_id UUID REFERENCES schema_definitions(id);

UPDATE deliverable_definitions SET schema_definition_id = (SELECT id FROM schema_definitions WHERE entity_kind = 'Deliverable' ORDER BY version DESC LIMIT 1)
WHERE schema_definition_id IS NULL;
