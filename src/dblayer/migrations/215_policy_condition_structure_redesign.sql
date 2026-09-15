-- Owner: Ch.24 §8's Conditions/Required Evidence/Related Obligations/
-- Exception Rules/Severity, full redesign. Was: `conditions` a raw JSON
-- textarea (x-widget:"json"); PolicyCondition (seuTypes.ts) had the right
-- field names but wrong shapes — requiredEvidence an untyped array,
-- severity a hardcoded TS union (not Ontology), exceptionRules/
-- relatedObligations flat string[].
--
-- New shape, one row per condition (x-widget:"referential-list"):
--   statement            — the condition's own text (markdown).
--   requiredEvidence     — a single object, not an array (owner: "Required
--                          evidence will be an object by itself"):
--                          {evidenceType: document|email|governed,
--                           evidenceFormat: text}. evidenceType is a small
--                          closed enum, not Ontology (owner named exactly 3
--                          literal values, no "Ontology driven" said for
--                          this one — same precedent as contributionObligation
--                          Definitions' own classification/participant/
--                          outputContract enums sitting alongside its real
--                          Ontology-backed category/origin).
--   relatedObligations   — array of real Obligation-Definition-shaped
--                          objects (owner: "has to define an array of
--                          Obligation objects... When we get to Obligation
--                          cleanup later in the CR, this will get closed
--                          along with that"). Reuses CR-106's already-agreed
--                          Definition-side field list (CR-106.md line 68):
--                          Category, Title, Description, Origin, Priority,
--                          Severity, Completion Criteria — Category/Origin/
--                          Priority/Severity Ontology-backed. Not yet
--                          mirrored onto Pack's own contributionObligationDefinitions[]
--                          (still missing Priority/Severity/CompletionCriteria
--                          per CR-106's own pending list) — deliberately left
--                          alone here; syncing the two is the deferred
--                          Obligation cleanup pass, not this one.
--   exceptionRules       — array of {identifier (system-generated, never
--                          author-editable — x-generated), exceptionStatement
--                          (markdown), exceptionApprovers (real Authority
--                          Vocabulary badges, x-referential:"authority-badge",
--                          x-multi — owner: "should have list of badges...
--                          Reference authority_noun_verbs" — NOT an Ontology
--                          concept type; badges live in their own real
--                          registry table, ties directly to requireBadge's
--                          own `{noun}_{verb}` code shape), exceptionComposition
--                          (all|any, small closed enum)}.
--   severity              — the condition's own severity, now per-condition
--                          Ontology-backed (owner: "severity: Ontology
--                          driven policy-condition:severity" — named
--                          category:policy-condition-severity here, matching
--                          this platform's uniform "category:X" concept-type
--                          naming convention with zero exceptions today).
--
-- New Ontology concept types this needs, seeded now (data change, not a
-- design invention — CR-106 already settled Priority/Severity as new
-- Obligation concept types; policy-condition severity is this CR's own new
-- one, named on the same convention): category:policy-condition-severity,
-- category:obligation-priority, category:obligation-severity. Values match
-- the platform's existing hardcoded severity union (Critical/High/Medium/Low)
-- and CR-106's own named priority values (Very High/High/Medium/Low) —
-- carried forward as real seeded Ontology data, not re-invented.
--
-- Bug fix (found live, CR-106 Option C testing): all three ON CONFLICT
-- clauses below originally targeted (concept_type, code, tenant_id) — the
-- unique constraint's OLD 3-column shape, dropped by migration 190
-- (ontology_concepts_type_code_tenant_version_unique, 4-column, includes
-- version) which runs before this file. Since 190 already widened it, this
-- INSERT has never matched any live constraint and has always errored
-- ("no unique or exclusion constraint matching the ON CONFLICT
-- specification") on any properly-sequenced run — not just "never applied
-- to this DB," genuinely broken from the day it was written. That also
-- explains why every schema_definitions UPDATE below and in every migration
-- from 216 on (each chained off the previous one's own resulting shape) was
-- silently no-op'd on a DB where this ran as one multi-statement batch: the
-- first failing statement aborted the whole file, which never reached its
-- own trailing UPDATE, so 216's own WHERE condition never matched either.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('category:policy-condition-severity', 'Critical', 'Critical', '11111111-1111-1111-1111-111111111111'),
  ('category:policy-condition-severity', 'High', 'High', '11111111-1111-1111-1111-111111111111'),
  ('category:policy-condition-severity', 'Medium', 'Medium', '11111111-1111-1111-1111-111111111111'),
  ('category:policy-condition-severity', 'Low', 'Low', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id, version) DO NOTHING;

INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('category:obligation-priority', 'Very High', 'Very High', '11111111-1111-1111-1111-111111111111'),
  ('category:obligation-priority', 'High', 'High', '11111111-1111-1111-1111-111111111111'),
  ('category:obligation-priority', 'Medium', 'Medium', '11111111-1111-1111-1111-111111111111'),
  ('category:obligation-priority', 'Low', 'Low', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id, version) DO NOTHING;

INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('category:obligation-severity', 'Critical', 'Critical', '11111111-1111-1111-1111-111111111111'),
  ('category:obligation-severity', 'High', 'High', '11111111-1111-1111-1111-111111111111'),
  ('category:obligation-severity', 'Medium', 'Medium', '11111111-1111-1111-1111-111111111111'),
  ('category:obligation-severity', 'Low', 'Low', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id, version) DO NOTHING;

UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,conditions}',
                  '{
                    "type": "array",
                    "x-group": "governance",
                    "x-widget": "referential-list",
                    "x-help": "Ch.24 §8 — the independently-checkable predicates this Policy declares, for humans and audit. Not evaluated by the engine at runtime (that is governingCondition, above/below) — see this schema''s own governingCondition x-help.",
                    "items": {
                      "type": "object",
                      "required": ["statement"],
                      "x-property-order": ["statement", "requiredEvidence", "relatedObligations", "exceptionRules", "severity"],
                      "properties": {
                        "statement": {
                          "type": "string",
                          "x-format": "markdown",
                          "x-help": "What this condition requires, in full — e.g. \"Background verification of all employees joining is mandated. HR performs the check and provides evidence in the form of certificate CF001, signed by HR.\""
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
                        "severity": {"type": "string", "x-referential": "category:policy-condition-severity", "x-ontology": true}
                      }
                    }
                  }'::jsonb,
                  true
                )
 WHERE entity_kind = 'Policy'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Policy')
   AND schema->'properties' ? 'conditions';
