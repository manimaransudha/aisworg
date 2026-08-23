-- CR-060 — contributionChecklists[] authoring form. Was: a flat array of
-- bare §20 fields (checklist/statement/classification/...), never actually
-- populated by any real Pack (every real seed file used an undeclared
-- `code` field instead) and never materialized anywhere. Full replacement:
-- a Checklist is now Name/Description + its own nested `items` sub-list
-- (Ch.47 §8/§9, as the owner edited it) — no Category/Capability/
-- Applicable-Deliverable-Type/Applicable-Transition (that scope is fully
-- carried by whichever Review/Quality Gate references this Checklist via
-- checklistIds instead — owner: "Checklist is just the mechanism for
-- review and quality gate"). First nested (two-level) referential-list in
-- this codebase (formGenerator.ts's own new "nested-list" item kind).
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,contributionChecklists}',
                  '{
                    "type": "array",
                    "x-help": "Ch.47 Checklists — reusable, cross-Pack-referenceable lists of verification Items. A Checklist carries no scope of its own; Review Gates and Quality Gates reference it by id via checklistIds.",
                    "x-widget": "referential-list",
                    "items": {
                      "type": "object",
                      "required": ["name", "items"],
                      "x-property-order": ["name", "description", "items"],
                      "properties": {
                        "name": {"type": "string", "x-help": "A short, human-readable name for this Checklist, unique within this Pack."},
                        "description": {"type": "string", "x-help": "Optional: what this Checklist verifies, in plain language."},
                        "items": {
                          "type": "array",
                          "x-help": "The ordered verification items a Participant works through.",
                          "items": {
                            "type": "object",
                            "required": ["statement", "mandatory"],
                            "x-property-order": ["statement", "mandatory", "participant", "outputContract", "assurance", "externalEvidence", "prompt"],
                            "properties": {
                              "statement": {"type": "string", "x-help": "The claim being verified, in plain language."},
                              "mandatory": {"type": "string", "enum": ["Mandatory", "Recommended"], "x-help": "Mandatory items must all pass for this Checklist to report Passed; Recommended items do not by themselves determine that outcome."},
                              "participant": {"type": "string", "enum": ["AI", "AI+human", "human"], "x-help": "Who executes this item: an AI participant, an AI participant paired with a human, or a human authority."},
                              "outputContract": {"type": "string", "enum": ["passed-failed-notes", "assessment-acceptance"], "x-help": "The shape of the result: a plain Passed/Failed plus notes, or an assessment a human must separately accept."},
                              "assurance": {"type": "string", "x-help": "Optional confidence threshold at which an AI result escalates to a human (declared only — not yet enforced)."},
                              "externalEvidence": {"type": "boolean", "x-help": "Check this if verified by an external Integration connector rather than direct analysis."},
                              "prompt": {"type": "string", "x-help": "The instruction given to the AI participant executing this item."}
                            }
                          }
                        }
                      }
                    }
                  }'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');

-- CR-060 — checklistIds on Quality Gate: which of the platform's Checklists
-- (any Pack's) must complete for this gate. Multi-select, sourced from
-- every real, persisted checklists row (x-multi, resolved specially —
-- unlike every prior x-referential source, this one is cross-Pack and
-- keyed by real id, not a Pack-scoped name/code).
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    schema,
                    '{properties,contributionQualityGates,items,properties,checklistIds}',
                    '{"type": "array", "x-referential": "checklist", "x-multi": true, "x-help": "Which of the platform''s Checklists must complete for this gate — any Pack''s Checklist may be picked, not just this Pack''s own. All listed Checklists are required (AND); a Checklist shared by more than one gate only runs once."}'::jsonb,
                    true
                  ),
                  '{properties,contributionQualityGates,items,x-property-order}',
                  '["category", "name", "governedTransition", "criteriaType", "deliverableName", "requiredPolicyCode", "checklistIds", "participant", "assurance", "classification", "outputContract", "externalEvidence", "statement", "prompt"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');

-- CR-060 — checklistIds on Review Gate, identical shape/semantics.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    schema,
                    '{properties,contributionReviewGates,items,properties,checklistIds}',
                    '{"type": "array", "x-referential": "checklist", "x-multi": true, "x-help": "Which of the platform''s Checklists must complete for this gate — any Pack''s Checklist may be picked, not just this Pack''s own. All listed Checklists are required (AND); a Checklist shared by more than one gate only runs once."}'::jsonb,
                    true
                  ),
                  '{properties,contributionReviewGates,items,x-property-order}',
                  '["code", "name", "governedTransition", "checklistIds", "participant", "assurance", "classification", "outputContract", "externalEvidence", "statement", "prompt"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
