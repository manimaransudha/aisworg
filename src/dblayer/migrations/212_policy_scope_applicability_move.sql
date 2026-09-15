-- Owner: "The scope field which is in governance tab has to be moved to the
-- Applicability tab. If the scope is Transition, the applicable deliverable
-- names will be ontology driven deliverable names. If the scope is
-- eligibility, the nouns (SEU, Ontology etc.) should be in the dropdown.
-- Applicable environment, Scope, Deliverables, Lifecycle is the order of the
-- fields." CR-104's own `scope` field is an implementation detail, not
-- named in Ch.24 explicitly (owner) — no spec text to anchor the new noun
-- vocabulary's name to; repurposing applicabilityDeliverableNames itself
-- (owner: "reused... rather than inventing a second field") rather than a
-- new column.
--
-- x-referential-source-by-value (formGenerator.ts, new marker) resolves
-- applicabilityDeliverableNames' own source per the CURRENT `scope` value:
-- Transition (the field's own already-existing static declaration, kept as
-- `default`) stays real Ontology deliverable-name, composable; Eligibility
-- switches to the real, active Authority Vocabulary noun list ("noun",
-- web/sdkAuthoring.ts's loadReferentialOptions) — not Ontology, not
-- composable (a closed, real vocabulary; proposing a new "noun" isn't a
-- Policy-authoring action).
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    jsonb_set(schema, '{properties,scope,x-group}', '"applicability"'::jsonb, true),
                    '{properties,applicabilityDeliverableNames,x-referential-source-by-value}',
                    '{
                      "field": "scope",
                      "values": {
                        "Eligibility": { "source": "noun", "ontology": false }
                      },
                      "default": { "source": "deliverable-name", "ontology": true, "composable": true }
                    }'::jsonb,
                    true
                  ),
                  '{x-property-order}',
                  '["code", "name", "description", "category", "constraintType", "applicabilityEnvironments", "scope", "applicabilityDeliverableNames", "applicabilityDeliverableLifecycle", "conditions", "governedTransition", "governingCondition"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Policy'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Policy')
   AND schema->'properties' ? 'scope'
   AND schema->'properties' ? 'applicabilityDeliverableNames';
