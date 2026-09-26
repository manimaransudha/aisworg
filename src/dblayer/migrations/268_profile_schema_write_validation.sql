-- Write-time schema validation for Profile (design/design whiteboards.md/
-- schema_implementation.md, "Deepdive on profiles").
--
-- environment (owner: "Profile environment has to be changed to be Ontology
-- driven and it also has to be ontology composable") — was a hardcoded
-- `enum` (migration 015) never converted even after migration 166 created
-- the `category:environment` Ontology concept type for this exact field.
-- x-ontology-composable:true mirrors Pack's own `code` (CR-079/CR-100):
-- write-time validation never rejects an unregistered value here (Ontology
-- write-time enforcement skips composable fields by design, core/ontology.ts
-- validateOntologyFieldsAgainstSchema), an authored value that isn't yet a
-- real concept gets PROPOSED instead (proposeComposableOntologyValues, wired
-- into sdkAuthoring.ts's Profile authoring paths in this same pass).
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,environment}',
                  '{"type":"string","x-widget":"referential-select","x-referential-source":"category:environment","x-ontology":true,"x-ontology-composable":true,"x-help":"Ch.7 §7 Environment."}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Profile' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Profile');

-- featureFlagCodes[].featureCode (owner: "featureFlagCodes[].featureCode has
-- to be x-ontology: true") — was x-referential:"feature-flag" only (migration
-- 066), a deliberate choice at the time (migration 173's own comment: "unlike
-- featureFlagCodes, since capability-name concepts carry real labels worth
-- resolving") that predates x-ontology's role as the write-time enforcement
-- marker. Not composable — same hard reject-on-unregistered treatment
-- additionalCapabilityCodes/participatingOrganisationCodes already have.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,featureFlagCodes,items,properties,featureCode}',
                  '{"type":"string","x-referential":"feature-flag","x-ontology":true}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Profile' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Profile');

-- schema_definition_id — pins write-time validation to the schema version a
-- row was actually authored against, mirroring packs/templates.schema_definition_id
-- (migrations 266/267).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS schema_definition_id UUID REFERENCES schema_definitions(id);

UPDATE profiles SET schema_definition_id = (SELECT id FROM schema_definitions WHERE entity_kind = 'Profile' ORDER BY version DESC LIMIT 1)
WHERE schema_definition_id IS NULL;
