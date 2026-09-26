-- Write-time schema validation for Policy Definition (design/design
-- whiteboards.md/schema_implementation.md, "Deepdive on Policy"). No table
-- CHECK to drop — policy_definitions.constraint_type/scope CHECKs mirror the
-- schema's own plain (non-x-ontology) enums for the same fields, fixed
-- structural vocabularies like `status`, not Ontology business vocabulary
-- (same "already correct" finding Template's own step 1 made). category IS
-- Ontology-governed (x-ontology:true, category:policy) and correctly carries
-- no table CHECK. schema_definition_id lets a row's own write-time
-- validation pin to the schema version it was actually authored against,
-- mirroring packs/templates/profiles.schema_definition_id (migrations
-- 266/267/268).
ALTER TABLE policy_definitions ADD COLUMN IF NOT EXISTS schema_definition_id UUID REFERENCES schema_definitions(id);

UPDATE policy_definitions SET schema_definition_id = (SELECT id FROM schema_definitions WHERE entity_kind = 'Policy' ORDER BY version DESC LIMIT 1)
WHERE schema_definition_id IS NULL;
