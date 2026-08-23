-- CR-059 — contributionReviewGates[] authoring form. Was: code + the shared
-- §20 verifiable-item fields only, no way to say which deliverable a Review
-- Gate is for. Full replacement, field order deliberate from the start (see
-- CR-058's own form-redesign lesson — x-property-order set directly here,
-- not discovered after the fact):
--   1. code (required, first) — the deliverable type this reviews, picked
--      from the same "deliverable-name" referential source Template's own
--      Deliverable Catalogue already uses. Stays VISIBLE, unlike Quality
--      Gate's own code=category collapse (owner: "it should show up on the
--      form... a pack can hold multiple checklists for different
--      deliverable-type-code").
--   2. name (required)
--   3. governedTransition (required) — real Transition Definitions only,
--      same referential mechanism Quality Gate already has.
--   4-9. participant, assurance, classification, outputContract,
--      externalEvidence, statement (relabeled "Description"), prompt — the
--      §20 execution-declaration fields, same order CR-058 settled on.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,contributionReviewGates}',
                  '{
                    "type": "array",
                    "x-help": "§9 Review Gates (judgment by nature — §20.5)",
                    "x-widget": "referential-list",
                    "items": {
                      "type": "object",
                      "required": ["code", "name", "governedTransition"],
                      "x-property-order": ["code", "name", "governedTransition", "participant", "assurance", "classification", "outputContract", "externalEvidence", "statement", "prompt"],
                      "properties": {
                        "code": {"type": "string", "x-referential": "deliverable-name", "x-help": "Which deliverable type this Review Gate is for — a Pack can declare several, one per deliverable type."},
                        "name": {"type": "string", "x-help": "A short, human-readable name for this Review Gate."},
                        "governedTransition": {"type": "string", "x-referential": "transition-definition", "x-help": "The exact transition this Review Gate applies to — picked from existing Transition Definitions only."},
                        "participant": {"type": "string", "enum": ["AI", "AI+human", "human"], "x-help": "Who executes this review: an AI participant, an AI participant paired with a human, or a human authority."},
                        "assurance": {"type": "string", "x-help": "Optional confidence/severity threshold at which an AI result escalates to a human (declared only — not yet enforced)."},
                        "classification": {"type": "string", "enum": ["machine-verifiable", "judgment", "human-attested"], "x-help": "Reviews are judgment by nature (§20.5) — almost always judgment or human-attested."},
                        "outputContract": {"type": "string", "enum": ["passed-failed-notes", "assessment-acceptance"], "x-help": "The shape of the result: a plain Passed/Failed plus notes, or an assessment a human must separately accept."},
                        "externalEvidence": {"type": "boolean", "x-help": "Check this if verified by an external Integration connector rather than direct review."},
                        "statement": {"type": "string", "x-label": "Description", "x-help": "The human-readable standard this review confirms, in plain language."},
                        "prompt": {"type": "string", "x-help": "The instruction given to the AI/human participant performing this review."}
                      }
                    }
                  }'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
