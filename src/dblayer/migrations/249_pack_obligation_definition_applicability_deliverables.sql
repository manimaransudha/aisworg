-- Owner: "Pack has to define the Obligation definition similar to what the
-- Policy Eligibility definition looks." A standalone Pack-declared Obligation
-- Definition (contributionObligationDefinitions[]) had no attached trigger at
-- all (CR-108 line 35) — composed into the EBM, never read by anything at
-- runtime. Policy's own scope=Eligibility condition already solves the exact
-- same "Pack has no Deliverable-type context" problem (a Pack author cannot
-- fill in a Deliverable name — only a Template/Profile knows Deliverable
-- identity) via applicabilityDeliverables[{name, transitions}], where name is
-- a real Authority Vocabulary noun (SEU, Ontology, Participant, ...), not a
-- Deliverable name, and transitions are that noun's own real transitions
-- (migration 214). Pack's Obligation Definition reuses that exact shape,
-- fixed to the noun source always (no Transition/Eligibility scope toggle —
-- a standalone Pack Obligation Definition is never Deliverable-targeted, so
-- there is no "default" branch to switch away from).
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    schema,
                    '{properties,contributionObligationDefinitions,items,properties,applicabilityDeliverables}',
                    '{
                      "type": "array",
                      "x-widget": "referential-list",
                      "x-help": "Which noun(s) (SEU, Ontology, Participant, ...) and real transition(s) raise this Obligation. Same mechanism as Policy''s own scope=Eligibility applicabilityDeliverables — a Pack never knows Deliverable identity, so name is always a real Authority Vocabulary noun, never a Deliverable name.",
                      "items": {
                        "type": "object",
                        "required": ["name"],
                        "x-property-order": ["name", "transitions"],
                        "properties": {
                          "name": {"type": "string", "x-referential": "noun", "x-help": "A real Authority Vocabulary noun (SEU, Ontology, Participant, ...)."},
                          "transitions": {"type": "array", "x-referential": "transition-definition", "x-multi": true, "x-help": "This noun''s own real transitions; choose the ones whose entity type matches this row''s own name."}
                        }
                      }
                    }'::jsonb,
                    true
                  ),
                  '{properties,contributionObligationDefinitions,items,x-property-order}',
                  '["code", "category", "title", "description", "origin", "applicabilityDeliverables", "priority", "severity", "completionCriteria", "requiredEvidence", "classification", "prompt", "participant", "outputContract", "assurance", "externalEvidence"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack')
   AND schema->'properties'->'contributionObligationDefinitions' IS NOT NULL;
