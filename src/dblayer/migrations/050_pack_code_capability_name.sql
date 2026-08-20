-- Pack `code` + `category`: owner, 2026-08-19: "Show the code field on the
-- pack page. It should be a dropdown and show the values of the
-- capability-name" / "the category dropdown has to be the values from
-- category:pack" / "do not hard code in the schema. The schema has to pick
-- the values from the ontology."
--
-- Both fields now carry "x-ontology": true, and their "x-referential-source"
-- is the exact Ontology (Ch.18) concept_type to resolve — "capability-name"
-- for code, "category:pack" for category (migration 049) — not an arbitrary
-- registry key translated somewhere in code. The generic resolver
-- (formGenerator.ontologyConceptTypesIn + web/sdkAuthoring.loadOntologyOptions)
-- reads these two markers directly; nothing downstream branches on the field
-- name "code" or "category" to know they're ontology-backed.
--
-- CR-015 had removed `code` from the Pack grammar entirely (system UUID,
-- minted server-side, never shown); this reverses that for Pack, rooting
-- Pack identity in `capability-name` per the owner's earlier framing:
-- "Capability packs are essentially process fragments done by a team...
-- the code that we mapped to UUID should actually be one of the code of
-- concept type capability-name." toPackSeedInput's randomUUID() fallback
-- (core/sdkAuthoring.ts) stays as a defensive default for a JSON import that
-- omits code; the form always submits a real ontology choice.
--
-- `category` previously pointed at "pack-category" (the now-superseded
-- pack_category table, migration 013) — repointed straight at "category:pack".
--
-- Development-time schema correction to the shipped v1 baseline grammar, in
-- place — same convention migrations 038/045 already used.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      schema,
                      '{properties,code}',
                      '{"type":"string","minLength":1,"x-help":"Canonical process-fragment identifier (Ch.18 Ontology, concept type capability-name)","x-widget":"referential-select","x-referential-source":"capability-name","x-ontology":true}'::jsonb,
                      true
                    ),
                    '{properties,category}',
                    '{"type":"string","x-help":"Pack category (Ch.18 Ontology, concept type category:pack)","x-widget":"referential-select","x-referential-source":"category:pack","x-ontology":true}'::jsonb,
                    true
                  ),
                  '{required}',
                  '["code","name","category","packVersion","installationClassification"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = 1;
