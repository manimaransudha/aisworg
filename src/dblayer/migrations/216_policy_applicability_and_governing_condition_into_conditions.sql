-- Owner: "I am inclined to move the applicability inside the condition.
-- That is more practical." Then: "Scope can be outside the condition. Move
-- it into the metadata. Move Applicable environments also into the
-- metadata. And remove the applicability tab." And separately: "You are
-- right. Applicability already covers this. So drop governing transition.
-- Governing condition has to be folded into condition. this will be
-- governed. If it is empty, the policy checking will be manual."
--
-- Three moves, all in one pass since they touch the same two fields'
-- worth of schema surface:
--   1. applicabilityDeliverables (name + transitions, migration 214) moves
--      OFF the Policy Definition top level and into each condition
--      (conditions[].applicabilityDeliverables) — a Policy's conditions no
--      longer share one applicability set; each can independently name
--      which deliverable(s)/noun(s) and transition(s) it governs (owner's
--      own example: "2 reviewers required for Code, sign-off required for
--      Deployment Plan" — two different conditions, two different scopes,
--      one Policy). x-referential-source-by-value keeps working unchanged
--      one level deeper — it already resolves off the TOP-LEVEL `scope`
--      field's current value regardless of how deep the driven field itself
--      sits (formGenerator.ts's buildItemFields recurses into nested-list
--      sub-fields the same way at any depth).
--   2. governedTransition is DROPPED entirely, top-level and per-condition
--      both — applicability's own transitions[] already say which
--      transition(s) are governed; a separate override field was always
--      redundant with it once applicability itself could carry real named
--      transitions (migration 211/214).
--   3. governingCondition folds into each condition (conditions[].governingCondition)
--      — the real, machine-evaluated rule now belongs to the SPECIFIC
--      condition it evaluates, not the whole Definition. Left blank, that
--      condition is manual/human-attested (never engine-checked) rather
--      than defaulting to {"type":"always_true"} at the Definition level —
--      the same "machine-verifiable vs judgment vs human-attested" split
--      Obligation Definitions already draw (CR-062's own `classification`).
--
-- scope/applicabilityEnvironments move to the "metadata" tab (owner: "Move
-- it into the metadata... remove the applicability tab") — with
-- applicabilityDeliverables gone (moved into conditions) and governedTransition/
-- governingCondition gone too, nothing is left on the "applicability" tab
-- to justify its own tab any more.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      jsonb_set(
                        (schema #- '{properties,applicabilityDeliverables}') #- '{properties,governedTransition}' #- '{properties,governingCondition}',
                        '{properties,scope,x-group}', '"metadata"'::jsonb, true
                      ),
                      '{properties,applicabilityEnvironments,x-group}', '"metadata"'::jsonb, true
                    ),
                    '{x-groups}',
                    '[{"key": "metadata", "label": "Identity & Metadata"}, {"key": "governance", "label": "Governance"}]'::jsonb,
                    true
                  ),
                  '{properties,conditions}',
                  '{
                    "type": "array",
                    "x-group": "governance",
                    "x-widget": "referential-list",
                    "x-help": "Ch.24 §8 — the independently-checkable predicates this Policy declares. Each condition carries its own applicability, its own severity, and its own governingCondition — a condition left without one is manual/human-attested, never engine-checked.",
                    "items": {
                      "type": "object",
                      "required": ["statement"],
                      "x-property-order": ["statement", "applicabilityDeliverables", "requiredEvidence", "relatedObligations", "exceptionRules", "severity", "governingCondition"],
                      "properties": {
                        "statement": {
                          "type": "string",
                          "x-format": "markdown",
                          "x-help": "What this condition requires, in full — e.g. \"Background verification of all employees joining is mandated. HR performs the check and provides evidence in the form of certificate CF001, signed by HR.\""
                        },
                        "applicabilityDeliverables": {
                          "type": "array",
                          "x-help": "Which deliverable(s)/noun(s) and transition(s) this specific condition governs. If the Policy''s own scope is Transition, name is an Ontology deliverable-name; if Eligibility, name is a real Authority Vocabulary noun (SEU, Ontology, ...) and transitions are that noun''s own real transitions.",
                          "items": {
                            "type": "object",
                            "required": ["name"],
                            "x-property-order": ["name", "transitions"],
                            "properties": {
                              "name": {
                                "type": "string",
                                "x-referential-source-by-value": {
                                  "field": "scope",
                                  "values": {
                                    "Eligibility": {"source": "noun", "ontology": false}
                                  },
                                  "default": {"source": "deliverable-name", "ontology": true}
                                }
                              },
                              "transitions": {"type": "array", "x-referential": "transition-definition", "x-multi": true, "x-help": "This condition''s own real transitions — filtered live to this row''s own name (or to Deliverable, under scope=Transition)."}
                            }
                          }
                        },
                        "requiredEvidence": {
                          "type": "object",
                          "x-help": "The evidence this condition''s satisfaction is proven by.",
                          "properties": {
                            "evidenceType": {"type": "string", "enum": ["document", "email", "governed"]},
                            "evidenceFormat": {"type": "string", "x-help": "The expected shape/format of the evidence, e.g. a named certificate, a template id, a required field set."}
                          }
                        },
                        "relatedObligations": {
                          "type": "array",
                          "x-help": "Obligation Definitions this condition raises on violation (Ch.23''s own Definition-side shape) — declaration only; the real Obligation instance is created at SEU-execution time.",
                          "items": {
                            "type": "object",
                            "required": ["category"],
                            "x-property-order": ["category", "title", "description", "origin", "priority", "severity", "completionCriteria"],
                            "properties": {
                              "category": {"type": "string", "x-referential": "category:obligation", "x-ontology": true, "x-help": "Ch.23 §7."},
                              "title": {"type": "string"},
                              "description": {"type": "string", "x-format": "markdown"},
                              "origin": {"type": "string", "x-referential": "category:obligation-origin", "x-ontology": true, "x-help": "Ch.23 §10."},
                              "priority": {"type": "string", "x-referential": "category:obligation-priority", "x-ontology": true},
                              "severity": {"type": "string", "x-referential": "category:obligation-severity", "x-ontology": true},
                              "completionCriteria": {"type": "string", "x-format": "markdown"}
                            }
                          }
                        },
                        "exceptionRules": {
                          "type": "array",
                          "x-help": "Permitted exceptions to this condition.",
                          "items": {
                            "type": "object",
                            "required": ["exceptionStatement"],
                            "x-property-order": ["identifier", "exceptionStatement", "exceptionApprovers", "exceptionComposition"],
                            "properties": {
                              "identifier": {"type": "string", "x-generated": true, "x-help": "Assigned automatically on save."},
                              "exceptionStatement": {"type": "string", "x-format": "markdown"},
                              "exceptionApprovers": {"type": "array", "x-referential": "authority-badge", "x-multi": true, "x-help": "Who may approve this exception — real Authority Vocabulary badges (noun_verb), the same authority requireBadge checks at execution time."},
                              "exceptionComposition": {"type": "string", "enum": ["all", "any"], "x-help": "Whether every listed approver must approve (all) or any one is sufficient (any)."}
                            }
                          }
                        },
                        "severity": {"type": "string", "x-referential": "category:policy-condition-severity", "x-ontology": true},
                        "governingCondition": {
                          "type": "object",
                          "x-widget": "json",
                          "x-help": "The real, machine-evaluated rule for THIS condition — {\"type\": \"always_true\"} or {\"type\": \"field_in\", \"field\": \"<context field>\", \"values\": [...]}. Left blank, this condition is manual/human-attested — never checked by the engine."
                        }
                      }
                    }
                  }'::jsonb,
                  true
                )
 WHERE entity_kind = 'Policy'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Policy')
   AND schema->'properties' ? 'conditions';

UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{x-property-order}',
                  '["code", "name", "description", "category", "constraintType", "scope", "applicabilityEnvironments", "conditions"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Policy'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Policy');

ALTER TABLE policy_definitions DROP COLUMN IF EXISTS applicability_deliverables;
ALTER TABLE policy_definitions DROP COLUMN IF EXISTS governed_transition;
ALTER TABLE policy_definitions DROP COLUMN IF EXISTS governing_condition;
