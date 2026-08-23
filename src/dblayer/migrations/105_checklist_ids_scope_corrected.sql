-- CR-060, corrected same day — checklistIds'/recommendedChecklistIds' own
-- help text still described the original, over-broad "any Pack, platform-
-- wide" reach (owner: "any Pack's gate can point at any Pack's checklist -
-- i thought we said this is if the pack codes match. If checklists are
-- global, then we would have created a registry?"). Corrected to describe
-- the real, built scope: Checklists belonging to a Pack sharing this
-- Pack's own code (any version/tenant), not the whole platform.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    schema,
                    '{properties,contributionQualityGates,items,properties,checklistIds,x-help}',
                    '"Which of this Pack''s own Checklists (any version/tenant sharing this Pack''s code) must complete for this gate. All listed Checklists are required (AND); a Checklist shared by more than one gate only runs once."'::jsonb
                  ),
                  '{properties,contributionQualityGates,items,properties,recommendedChecklistIds,x-help}',
                  '"Advisory Checklists (this Pack''s own code only) — completing them does not block this gate, unlike checklistIds."'::jsonb
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');

UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    schema,
                    '{properties,contributionReviewGates,items,properties,checklistIds,x-help}',
                    '"Which of this Pack''s own Checklists (any version/tenant sharing this Pack''s code) must complete for this gate. All listed Checklists are required (AND); a Checklist shared by more than one gate only runs once."'::jsonb
                  ),
                  '{properties,contributionReviewGates,items,properties,recommendedChecklistIds,x-help}',
                  '"Advisory Checklists (this Pack''s own code only) — completing them does not block this gate, unlike checklistIds."'::jsonb
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
