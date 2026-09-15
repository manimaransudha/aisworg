-- Owner: "Pack Obligation definition has to be modified to the same shape.
-- ObligationDefinition model has to be created and used in both the places
-- so changes are sustained all the places correctly." — Ch.23 §8's
-- Definition-side shape (Category/Title/Description/Origin/Priority/
-- Severity/Completion Criteria — Status and every Related-*/Traceability
-- field stay execution-only, per CR-106) already exists on Policy's own
-- conditions[].relatedObligations[] (migration 216, seuTypes.ts's
-- ObligationDefinition); this brings Pack's own
-- contributionObligationDefinitions[] (CR-062, migration 111) to the exact
-- same field set:
--   - title, priority, severity, completionCriteria: new.
--   - statement renamed to description (the same concept CR-062 already
--     used this field for — the shared verifiableFieldsBlock view helper
--     is updated alongside, in the same pass, to read the right field name
--     per contribution kind, not a hardcoded "statement").
--   - code, origin, category, classification, prompt, participant,
--     outputContract, assurance, externalEvidence: unchanged — Pack-scoped
--     identifier and the §20 verifiable-item execution-mechanism fields
--     sit outside Ch.23 §8 entirely, layered on top of the shared
--     Definition shape rather than replaced by it.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      (schema #- '{properties,contributionObligationDefinitions,items,properties,statement}'),
                      '{properties,contributionObligationDefinitions,items,properties,title}',
                      '{"type": "string"}'::jsonb,
                      true
                    ),
                    '{properties,contributionObligationDefinitions,items,properties,description}',
                    '{"type": "string", "x-format": "markdown"}'::jsonb,
                    true
                  ),
                  '{properties,contributionObligationDefinitions,items,properties,priority}',
                  '{"type": "string", "x-referential": "category:obligation-priority", "x-ontology": true}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack')
   AND schema->'properties'->'contributionObligationDefinitions' IS NOT NULL;

UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,contributionObligationDefinitions,items,properties,severity}',
                  '{"type": "string", "x-referential": "category:obligation-severity", "x-ontology": true}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack')
   AND schema->'properties'->'contributionObligationDefinitions' IS NOT NULL;

UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    schema,
                    '{properties,contributionObligationDefinitions,items,properties,completionCriteria}',
                    '{"type": "string"}'::jsonb,
                    true
                  ),
                  '{properties,contributionObligationDefinitions,items,x-property-order}',
                  '["code", "category", "title", "description", "origin", "priority", "severity", "completionCriteria", "classification", "prompt", "participant", "outputContract", "assurance", "externalEvidence"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack')
   AND schema->'properties'->'contributionObligationDefinitions' IS NOT NULL;
