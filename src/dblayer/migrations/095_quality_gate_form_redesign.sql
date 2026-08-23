-- CR-058 form redesign — owner: "the form is very very poorly designed."
-- The field order/required/labels had accumulated incidentally across 4
-- prior migrations' worth of jsonb_set/path-delete patches (091/092/093/
-- 094), never designed as a whole. Full, deliberate replacement:
--
--   1. category (required, first) — Ontology-backed (category:evidence),
--      doubles as the gate's own identity/code.
--   2. name (required)
--   3. governedTransition (required) — real Transition Definitions only
--   4. criteriaType (required) — what the gate actually checks
--   5. criteriaCategory — Review-only narrowing (requires_accepted_review),
--      a deliberately separate vocabulary from `category` above
--   6. requiredPolicyCode — Policy-only (requires_active_policy)
--   7-11. participant, assurance (moved next to participant, was 4
--      positions away), classification, outputContract, externalEvidence
--      — the §20 execution-declaration fields
--   12-13. statement (relabeled "Description" — x-label), prompt — long
--      free-text fields kept together at the end, not scattered mid-form
--
-- Every field now carries its own x-help (rendered inline by
-- _referentialListGroup.ejs — CR-058 formGenerator.ts/view changes), so
-- the once-per-section write-up above the widget is suppressed for this
-- section specifically (_generatedFieldGroups.ejs).
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,contributionQualityGates}',
                  '{
                    "type": "array",
                    "x-help": "§9 Quality Gates (verifiable — §20)",
                    "x-widget": "referential-list",
                    "items": {
                      "type": "object",
                      "required": ["category", "name", "governedTransition", "criteriaType"],
                      "properties": {
                        "category": {"type": "string", "x-referential": "category:evidence", "x-help": "The Evidence category this gate checks for — also becomes the gate’s own identifier (one gate per category, per transition)."},
                        "name": {"type": "string", "x-help": "A short, human-readable name for this gate."},
                        "governedTransition": {"type": "string", "x-referential": "transition-definition", "x-help": "The exact transition this gate applies to — picked from existing Transition Definitions only."},
                        "criteriaType": {"type": "string", "enum": ["no_unresolved_obligations", "requires_accepted_evidence_or_approved_decision", "requires_accepted_review", "requires_active_policy"], "x-help": "What this gate checks: no unresolved Obligations · Accepted Evidence of this gate’s Category (or an Approved Decision, any category) · an Accepted, passing Review · a satisfied Policy."},
                        "criteriaCategory": {"type": "string", "x-help": "Only used when Criteria Type is requires_accepted_review — narrows to a specific Review category (e.g. Architecture). A different vocabulary from this gate’s own Category above, not interchangeable with it."},
                        "requiredPolicyCode": {"type": "string", "x-referential": "policy-code", "x-help": "Only used when Criteria Type is requires_active_policy — the Policy that must be satisfied."},
                        "participant": {"type": "string", "enum": ["AI", "AI+human", "human"], "x-help": "Who executes this check: an AI participant, an AI participant paired with a human, or a human authority."},
                        "assurance": {"type": "string", "x-help": "Optional confidence/severity threshold at which an AI result escalates to a human (declared only — not yet enforced)."},
                        "classification": {"type": "string", "enum": ["machine-verifiable", "judgment", "human-attested"], "x-help": "machine-verifiable = an AI/tool determines the result directly · judgment = an AI assessment a human must accept · human-attested = an authoritative human act an AI can’t perform."},
                        "outputContract": {"type": "string", "enum": ["passed-failed-notes", "assessment-acceptance"], "x-help": "The shape of the result: a plain Passed/Failed plus notes, or an assessment a human must separately accept."},
                        "externalEvidence": {"type": "boolean", "x-help": "Check this if a machine-verifiable item is verified by an external Integration connector (e.g. a CI result) rather than direct artifact analysis."},
                        "statement": {"type": "string", "x-label": "Description", "x-help": "The human-readable standard this gate enforces, in plain language (e.g. “No hardcoded passwords”)."},
                        "prompt": {"type": "string", "x-help": "The instruction given to the AI participant executing this check (machine-verifiable or judgment classifications)."}
                      }
                    }
                  }'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
