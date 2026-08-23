-- CR-059 — Quality Gate's requires_accepted_review criteria: `criteriaCategory`
-- (free text, Review's own unvalidated category vocabulary) is superseded.
-- Owner: "the qualitygate now has to show the reviews in the dropdown to
-- completely define it" — a Quality Gate must not be able to reference a
-- Review Gate that doesn't actually exist, same discipline governedTransition
-- already has against transition_definitions. Settled scope (owner: "if
-- something is global, it has to be a policy" — Review Gates aren't the
-- platform's cross-Pack-sharing mechanism, Policy already is): the dropdown
-- sources the SAME Pack's own declared reviewGates[] only, self-referential
-- (self:reviewGates — same mechanism dependencyGraph.toName already uses
-- against deliverableCatalogue), any transition (not restricted to this
-- Quality Gate's own governedTransition — a later gate legitimately checks a
-- Review that happened at an earlier stage).
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema #- '{properties,contributionQualityGates,items,properties,criteriaCategory}',
                  '{properties,contributionQualityGates,items,properties,deliverableName}',
                  '{"type": "string", "x-referential": "self:contributionReviewGates", "x-help": "Only used when Criteria Type is requires_accepted_review — which of this Pack’s own Review Gates (by deliverable type) must have an Accepted, passing Review."}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');

UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,contributionQualityGates,items,x-property-order}',
                  '["category", "name", "governedTransition", "criteriaType", "deliverableName", "requiredPolicyCode", "participant", "assurance", "classification", "outputContract", "externalEvidence", "statement", "prompt"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
