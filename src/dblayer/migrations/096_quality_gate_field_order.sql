-- CR-058 form redesign, correction — migration 095's field order was
-- silently discarded: Postgres JSONB does not preserve object key
-- insertion order, it reorders keys by length then lexicographically
-- (confirmed live: writing category/name/governedTransition/... came back
-- as name/prompt/category/assurance/statement/... — exactly sorted by key
-- length). This affects every referential-list field's items.properties in
-- this codebase, not just this one — x-property-order (formGenerator.ts,
-- generateFields) is the fix: an explicit ordered name list itemFields is
-- sorted by after being built from the (JSONB-reordered) properties object.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,contributionQualityGates,items,x-property-order}',
                  '["category", "name", "governedTransition", "criteriaType", "criteriaCategory", "requiredPolicyCode", "participant", "assurance", "classification", "outputContract", "externalEvidence", "statement", "prompt"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
