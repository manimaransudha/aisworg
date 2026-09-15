-- CR-104 — a Quality Gate may target specific Deliverables by name (e.g. a
-- customer signoff gate on only the first Deliverable's kickoff), not every
-- Deliverable sharing the same (entity_type, from_state, to_state). Mirrors
-- policy_definitions.applicability_deliverable_names' own field name/shape —
-- a new property, not a repurposing of the existing `deliverableName` field
-- (that one is unrelated: only used for requires_accepted_review's own
-- Review Gate reference). Empty (default) = every Deliverable on that
-- transition, unchanged from today.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    schema,
                    '{properties,contributionQualityGates,items,properties,applicabilityDeliverableNames}',
                    '{
                      "type": "array",
                      "x-help": "Which Deliverable(s) (by name) this gate applies to. Empty = every Deliverable reaching this transition.",
                      "x-multi": true,
                      "x-referential": "deliverable-name"
                    }'::jsonb,
                    true
                  ),
                  '{properties,contributionQualityGates,items,x-property-order}',
                  (schema #> '{properties,contributionQualityGates,items,x-property-order}') || '["applicabilityDeliverableNames"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
