-- CR-113 — "Policy categories" from the x-ontology-composable checklist.
-- Marks Policy.category composable, same treatment Pack.category/Template.code
-- got in migration 274. Schema-only change — core/policyDefinitions.ts and
-- sdkAuthoring.ts already read this flag generically
-- (validateComposableFieldsAgainstSchema, ontologyComposableFieldsIn), no
-- code change needed beyond folding `category` into the fields those two
-- already pass through the composable check.
UPDATE schema_definitions
   SET schema = jsonb_set(schema, '{properties,category,x-ontology-composable}', 'true'::jsonb, true)
 WHERE entity_kind = 'Policy'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Policy')
   AND schema->'properties' ? 'category';
