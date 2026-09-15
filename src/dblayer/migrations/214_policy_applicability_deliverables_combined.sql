-- Owner: "Scope=Eligibility; Applicable Deliverable Name = SEU. Applicability
-- Deliverable Lifecycle should show the SEU transitions" -> "Is it better to
-- change the layout. Add only deliverable name and allow multiple
-- transitions. And add a +Add another deliverable" -> "seed data work is
-- deferred. but the db changes have to go hand in hand."
--
-- Replaces the old independent applicability_deliverable_names/
-- applicability_deliverable_lifecycle TEXT[] pair with one combined
-- structure: a real relationship couldn't be expressed between the two once
-- scope=Eligibility let a "name" mean a noun (different nouns are different
-- entity types, each with their own real, different transitions) — the old
-- shape had no way to say WHICH transitions belonged to WHICH name. One row
-- per name, its own transitions explicit alongside it, same shape
-- Competency's own {dimension, value} row already uses; a Policy naming
-- more than one (name, transitions) pair repeatable via "+ Add another
-- deliverable."
--
-- Old data intentionally NOT migrated into the new shape — owner: "seed data
-- work is deferred," a later pass. The 34 real seeded Policy Definitions
-- simply start with an empty applicability_deliverables[] until reseeded.
ALTER TABLE policy_definitions ADD COLUMN IF NOT EXISTS applicability_deliverables JSONB NOT NULL DEFAULT '[]';
ALTER TABLE policy_definitions DROP COLUMN IF EXISTS applicability_deliverable_names;
ALTER TABLE policy_definitions DROP COLUMN IF EXISTS applicability_deliverable_lifecycle;

-- Policy authoring form (schema_definitions) — replaces the two top-level
-- fields with one referential-list, `name` driven by `scope` exactly like
-- before (deliverable-name Ontology for Transition, noun list for
-- Eligibility — formGenerator.ts's x-referential-source-by-value, now at
-- the item level too), `transitions` sourced from the existing
-- "transition-definition" registry (already covers every entity type, not
-- just Deliverable).
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema #- '{properties,applicabilityDeliverableNames}' #- '{properties,applicabilityDeliverableLifecycle}',
                  '{properties,applicabilityDeliverables}',
                  '{
                    "type": "array",
                    "x-widget": "referential-list",
                    "x-group": "applicability",
                    "x-configurable": true,
                    "x-help": "Which deliverables (or, when scope is Eligibility, which nouns) this Policy governs, each with its own real transitions. Empty = matches everything today; narrowable downstream (configurable). Ignored when governedTransition is set directly.",
                    "items": {
                      "type": "object",
                      "required": ["name"],
                      "x-property-order": ["name", "transitions"],
                      "properties": {
                        "name": {
                          "type": "string",
                          "x-help": "A real Deliverable name (scope=Transition) or a real Authority Vocabulary noun (scope=Eligibility).",
                          "x-referential-source-by-value": {
                            "field": "scope",
                            "values": { "Eligibility": { "source": "noun", "ontology": false } },
                            "default": { "source": "deliverable-name", "ontology": true }
                          }
                        },
                        "transitions": {
                          "type": "array",
                          "x-referential": "transition-definition",
                          "x-multi": true,
                          "x-help": "The real transitions for this row, picked from every entity own transitions list; choose the ones whose entity type matches this row own name (Deliverable for scope=Transition, the named noun for scope=Eligibility)."
                        }
                      }
                    }
                  }'::jsonb,
                  true
                )
 WHERE entity_kind = 'Policy'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Policy')
   AND schema->'properties' ? 'applicabilityDeliverableNames';

-- Applicability tab order: Environment, Scope, Deliverables (combined), Lifecycle is retired.
UPDATE schema_definitions
   SET schema = jsonb_set(schema, '{x-property-order}', '["code", "name", "description", "category", "constraintType", "applicabilityEnvironments", "scope", "applicabilityDeliverables", "conditions", "governedTransition", "governingCondition"]'::jsonb, true)
 WHERE entity_kind = 'Policy'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Policy');
