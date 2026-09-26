-- CR-113 — the remaining Ontology-backed fields nested inside array items:
-- Pack.contributionObligationDefinitions[].category (category:obligation),
-- Pack.contributionEngineeringCapital[].type (engineering-capital),
-- Pack.contributionQualityGates[].category (category:evidence),
-- Template.deliverableCatalogue[].code (deliverable-name).
-- No x-widget/attribute rename needed — core/ontology.ts's resolveConceptType
-- already reads legacy `x-referential` same as `x-referential-source`, and
-- the new collectComposableValues walker (replacing formGenerator.ts's
-- single-level ontologyComposableFieldsIn) recurses into array items to
-- arbitrary depth. Schema-only change — no code change needed for this or
-- any future array-nested field marked composable here.
--
-- contributionQualityGates[].category is missing x-ontology:true (unlike the
-- other 3 fields here, which already had it) — the schema-driven write-time
-- checker requires it to recognise the field at all, so it's added here too;
-- this is the one field of the 4 whose Ontology check was, until now, ONLY
-- the hand-coded assertCanonicalCategory in validatePackSeed (packs.ts:407),
-- invisible to the generic write-time validator entirely.
UPDATE schema_definitions
   SET schema = jsonb_set(schema, '{properties,contributionObligationDefinitions,items,properties,category,x-ontology-composable}', 'true'::jsonb, true)
 WHERE entity_kind = 'Pack'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack')
   AND schema->'properties'->'contributionObligationDefinitions'->'items'->'properties' ? 'category';

UPDATE schema_definitions
   SET schema = jsonb_set(schema, '{properties,contributionEngineeringCapital,items,properties,type,x-ontology-composable}', 'true'::jsonb, true)
 WHERE entity_kind = 'Pack'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack')
   AND schema->'properties'->'contributionEngineeringCapital'->'items'->'properties' ? 'type';

UPDATE schema_definitions
   SET schema = jsonb_set(
         jsonb_set(schema, '{properties,contributionQualityGates,items,properties,category,x-ontology-composable}', 'true'::jsonb, true),
         '{properties,contributionQualityGates,items,properties,category,x-ontology}', 'true'::jsonb, true
       )
 WHERE entity_kind = 'Pack'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack')
   AND schema->'properties'->'contributionQualityGates'->'items'->'properties' ? 'category';

UPDATE schema_definitions
   SET schema = jsonb_set(schema, '{properties,deliverableCatalogue,items,properties,code,x-ontology-composable}', 'true'::jsonb, true)
 WHERE entity_kind = 'Template'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Template')
   AND schema->'properties'->'deliverableCatalogue'->'items'->'properties' ? 'code';
