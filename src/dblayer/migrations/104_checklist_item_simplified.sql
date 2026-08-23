-- CR-060, revised same day — Checklist Item drops everything but Statement
-- (owner: "you cannot determine a checklist item to be mandatory. Checklist
-- is generic. Pack has the specifics.") — Mandatory/Recommended, Participant,
-- Output Contract, Assurance, and External Evidence all move to the
-- referencing gate's own checklistIds/recommendedChecklistIds instead
-- (migration 103 added the columns; this migration's own second/third
-- UPDATE add the authored fields).
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,contributionChecklists,items,properties,items,items}',
                  '{
                    "type": "object",
                    "required": ["statement"],
                    "x-property-order": ["statement"],
                    "properties": {
                      "statement": {"type": "string", "x-help": "The claim being verified, in plain language."}
                    }
                  }'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');

-- CR-060, revised same day — recommendedChecklistIds on Quality Gate:
-- advisory Checklists (don't block the gate) alongside checklistIds'
-- required (AND) set.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    schema,
                    '{properties,contributionQualityGates,items,properties,recommendedChecklistIds}',
                    '{"type": "array", "x-referential": "checklist", "x-multi": true, "x-help": "Advisory Checklists — completing them does not block this gate (unlike checklistIds, which is required)."}'::jsonb,
                    true
                  ),
                  '{properties,contributionQualityGates,items,x-property-order}',
                  '["category", "name", "governedTransition", "criteriaType", "deliverableName", "requiredPolicyCode", "checklistIds", "recommendedChecklistIds", "participant", "assurance", "classification", "outputContract", "externalEvidence", "statement", "prompt"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');

-- CR-060, revised same day — recommendedChecklistIds on Review Gate, same shape.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    schema,
                    '{properties,contributionReviewGates,items,properties,recommendedChecklistIds}',
                    '{"type": "array", "x-referential": "checklist", "x-multi": true, "x-help": "Advisory Checklists — completing them does not block this gate (unlike checklistIds, which is required)."}'::jsonb,
                    true
                  ),
                  '{properties,contributionReviewGates,items,x-property-order}',
                  '["code", "name", "governedTransition", "checklistIds", "recommendedChecklistIds", "participant", "assurance", "classification", "outputContract", "externalEvidence", "statement", "prompt"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
