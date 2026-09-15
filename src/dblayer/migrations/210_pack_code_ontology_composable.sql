-- Owner: "Pack's code also has to be marked x-ontology-composable and reuse
-- what is built" — Pack's own `code` (migration 133, x-widget:
-- "referential-select", x-referential-source-by: "category") already
-- behaved as Ontology-composable in practice (CR-079 step (d)/CR-100's own
-- proposal mechanism), just via a hand-wired call in
-- core/sdkAuthoring.ts's createAuthoringDraft/saveAuthoringDraft rather than
-- the schema-driven `x-ontology-composable` flag Policy's own Applicability
-- fields now use (migration 209). formGenerator.ts's
-- ontologyComposableFieldsIn was generalised the same session to resolve a
-- DRIVEN concept type (x-referential-source-by), not just a fixed
-- x-referential-source, specifically so this single-value field could carry
-- the same flag as Policy's multi-select ones. Setting it here lets
-- core/sdkAuthoring.ts's Pack branches call the same generic
-- proposeComposableOntologyValues() Policy already does, retiring the
-- hand-wired call.
UPDATE schema_definitions
   SET schema = jsonb_set(schema, '{properties,code,x-ontology-composable}', 'true'::jsonb, true)
 WHERE entity_kind = 'Pack'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack')
   AND schema->'properties' ? 'code';
