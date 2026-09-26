-- CR-113 — "whatever is x-ontology-composable will be gated at publish
-- time... it has to be applied wherever a field is x-ontology-composable."
-- Marks Pack.category and Template.code (Template's own category-equivalent
-- field, x-help: "Template category", migration 054) composable, same
-- treatment Pack.code/Profile.environment/Policy.applicabilityEnvironments
-- already have (migrations 210/268/209). Schema-only change — core/packs.ts,
-- core/templates.ts, core/ontology.ts, and sdkAuthoring.ts already read this
-- flag generically (validateOntologyFieldsAgainstSchema/
-- validateComposableFieldsAgainstSchema, ontologyComposableFieldsIn), no
-- code change needed for this or any future field marked composable here.
UPDATE schema_definitions
   SET schema = jsonb_set(schema, '{properties,category,x-ontology-composable}', 'true'::jsonb, true)
 WHERE entity_kind = 'Pack'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack')
   AND schema->'properties' ? 'category';

UPDATE schema_definitions
   SET schema = jsonb_set(schema, '{properties,code,x-ontology-composable}', 'true'::jsonb, true)
 WHERE entity_kind = 'Template'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Template')
   AND schema->'properties' ? 'code';
