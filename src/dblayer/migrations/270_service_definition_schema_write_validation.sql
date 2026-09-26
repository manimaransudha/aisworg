-- Write-time schema validation for Service Definition (design/design
-- whiteboards.md/schema_implementation.md, "Deepdive on Service Definition").
-- No table CHECK to drop — only `status` has one, structural, matching the
-- same "already correct" finding every other entity's own pass made.
-- schema_definition_id lets a row's own write-time validation pin to the
-- schema version it was actually authored against, mirroring
-- packs/templates/profiles/policy_definitions.schema_definition_id
-- (migrations 266/267/268/269). Unlike those four, service_definitions never
-- had this column at all until now.
ALTER TABLE service_definitions ADD COLUMN IF NOT EXISTS schema_definition_id UUID REFERENCES schema_definitions(id);

UPDATE service_definitions SET schema_definition_id = (SELECT id FROM schema_definitions WHERE entity_kind = 'Service' ORDER BY version DESC LIMIT 1)
WHERE schema_definition_id IS NULL;
