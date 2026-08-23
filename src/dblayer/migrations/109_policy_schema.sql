-- CR-061 — contributionPolicies[] authoring form redesign. Was: code, name,
-- severity, constraintType, governedTransition only — category and
-- condition were real DB columns never exposed on the form at all. Full
-- replacement, same discipline CR-058/059/060 established: per-field help,
-- required markers, x-property-order set explicitly (Postgres JSONB
-- reorders keys, so this is the only way field order is actually
-- controllable).
--   category: real, Ontology-backed (category:policy, migration 107) —
--     was free text with a silent 'Engineering' default.
--   governedTransition: real, transition-definition-backed (same picker
--     Quality Gate/Review Gate use) — was free text, never validated.
--     Definition-side fix only (owner: "the governed transition should be
--     similar to what is in the quality gate") — NOT wired into the
--     evaluation engine; stays as inert as it is today at runtime
--     (execution, deferred).
--   conditionType/conditionField/conditionValues: condition's own flat,
--     form-facing shape (owner: "we will start with this, but... we will
--     refine this as we go along") — reassembled into condition's real
--     nested JSONB shape at seedContributions time, same pattern
--     criteriaType/deliverableName already use for Quality Gate. Starts
--     with the 2 real, already-evaluated types (always_true/field_in);
--     conditionField/conditionValues only apply to field_in.
--   code stays authored (unlike Quality Gate's own code=category collapse)
--     — Policy's identity is (originating_pack_id, code), a real,
--     author-chosen value, migration 106.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,contributionPolicies}',
                  '{
                    "type": "array",
                    "x-help": "§9 Policies / Standards — a Policy (Constraint Type \"Policy\") blocks its governed transition on violation; a Standard (Constraint Type \"Standard\") never blocks, only records a traceable deviation.",
                    "x-widget": "referential-list",
                    "items": {
                      "type": "object",
                      "required": ["code", "name", "category", "constraintType", "governedTransition"],
                      "x-property-order": ["code", "name", "category", "constraintType", "governedTransition", "conditionType", "conditionField", "conditionValues", "severity"],
                      "properties": {
                        "code": {"type": "string", "x-help": "A short, unique identifier for this Policy, scoped to this Pack."},
                        "name": {"type": "string", "x-help": "A short, human-readable name."},
                        "category": {"type": "string", "x-referential": "category:policy", "x-ontology": true, "x-help": "This Policy''s own category — independent of, and never needs to match, any Gate that references it."},
                        "constraintType": {"type": "string", "enum": ["Policy", "Standard"], "x-help": "Policy = mandatory, blocks the governed transition on violation. Standard = preferred, a violation is recorded and traceable but never blocks."},
                        "governedTransition": {"type": "string", "x-referential": "transition-definition", "x-help": "The transition this Policy is declared against — picked from existing Transition Definitions only. Declaration only for now; not yet consulted by the evaluation engine."},
                        "conditionType": {"type": "string", "enum": ["always_true", "field_in"], "x-help": "always_true = no real condition, always satisfied. field_in = satisfied when a named context field''s value is one of a given set."},
                        "conditionField": {"type": "string", "x-help": "Only used when Condition Type is field_in — the context field to check (e.g. a dotted path)."},
                        "conditionValues": {"type": "string", "x-help": "Only used when Condition Type is field_in — comma-separated list of values that satisfy the condition."},
                        "severity": {"type": "string", "x-help": "How much a violation/deviation matters — independent of Constraint Type, which decides whether it blocks at all."}
                      }
                    }
                  }'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');

-- CR-061 — Quality Gate's requires_active_policy: requiredPolicyCode (a
-- single string) generalizes to requiredPolicyCodes (an array) plus a
-- threshold, same "referential-multi" mechanism checklistIds already uses.
-- Owner: "(1) is right" (confirming the generalization), "we may add more
-- types and each type may lead to some code change to the governance of
-- the gates" — the aggregation/threshold evaluation itself is execution-
-- side, deferred; this migration only changes the declared reference shape.
-- Cross-Pack reach scoped to matching Pack code (owner: "Similar to
-- checklist, if the pack code matches, that policy has to be visible to
-- all other packs") — same reach checklistIds already has.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    schema #- '{properties,contributionQualityGates,items,properties,requiredPolicyCode}',
                    '{properties,contributionQualityGates,items,properties,requiredPolicyCodes}',
                    '{"type": "array", "x-referential": "policy", "x-multi": true, "x-help": "Only used when Criteria Type is requires_active_policy — which of this Pack''s own code''s Policies (any version/tenant sharing this Pack''s code) must be satisfied."}'::jsonb,
                    true
                  ),
                  '{properties,contributionQualityGates,items,x-property-order}',
                  '["category", "name", "governedTransition", "criteriaType", "deliverableName", "requiredPolicyCodes", "checklistIds", "recommendedChecklistIds", "participant", "assurance", "classification", "outputContract", "externalEvidence", "statement", "prompt"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
