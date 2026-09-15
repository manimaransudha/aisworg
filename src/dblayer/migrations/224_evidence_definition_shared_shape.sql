-- Owner: "Evidence definition has to be a common model and used in Policy
-- [and] Obligations." Ch.17 §8's Definition-side shape — Title/Category/
-- Description/Collection Method (Source and every other §8 field are
-- execution-only — owner: "Source is execution side... Evidence is related
-- to an engineering artefact," Ch.17 §10). Category is Ontology-backed
-- (category:evidence, Ch.17 §7's own 6 real categories, just cleaned up of
-- drift in migration 223). Not a Pack contribution kind of its own (owner:
-- "Pack does not have a contributingEvidence") — reaches Pack via
-- ObligationDefinition's own requiredEvidence instead (seuTypes.ts).
--
-- Two call sites:
--   1. Policy's own conditions[].requiredEvidence — REPLACES its old narrow
--      {evidenceType: document|email|governed, evidenceFormat} shape
--      entirely with this real, Ontology-backed one.
--   2. ObligationDefinition's own new requiredEvidence field, on BOTH of
--      its real call sites: Policy's conditions[].relatedObligations[] and
--      Pack's contributionObligationDefinitions[] — one schema fragment,
--      declared identically in both places (there is no shared schema
--      fragment mechanism; the two UPDATEs below keep them in lockstep by
--      hand, same discipline the rest of this shared-model pass already
--      established in seuTypes.ts/sdkAuthoring.ts).
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,conditions,items,properties,requiredEvidence}',
                  '{
                    "type": "object",
                    "x-help": "Ch.17 §8 — the type of evidence needed to satisfy this condition.",
                    "x-property-order": ["title", "category", "description", "collectionMethod"],
                    "properties": {
                      "title": {"type": "string"},
                      "category": {"type": "string", "x-referential": "category:evidence", "x-ontology": true, "x-help": "Ch.17 §7."},
                      "description": {"type": "string", "x-format": "markdown"},
                      "collectionMethod": {"type": "string", "x-help": "How this evidence is meant to be gathered."}
                    }
                  }'::jsonb,
                  true
                )
 WHERE entity_kind = 'Policy'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Policy')
   AND schema->'properties'->'conditions'->'items'->'properties' ? 'requiredEvidence';

UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    schema,
                    '{properties,conditions,items,properties,relatedObligations,items,properties,requiredEvidence}',
                    '{
                      "type": "object",
                      "x-help": "Ch.17 §8 — the type of evidence needed to satisfy/close this Obligation.",
                      "x-property-order": ["title", "category", "description", "collectionMethod"],
                      "properties": {
                        "title": {"type": "string"},
                        "category": {"type": "string", "x-referential": "category:evidence", "x-ontology": true, "x-help": "Ch.17 §7."},
                        "description": {"type": "string", "x-format": "markdown"},
                        "collectionMethod": {"type": "string", "x-help": "How this evidence is meant to be gathered."}
                      }
                    }'::jsonb,
                    true
                  ),
                  '{properties,conditions,items,properties,relatedObligations,items,x-property-order}',
                  '["category", "title", "description", "origin", "priority", "severity", "completionCriteria", "requiredEvidence"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Policy'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Policy')
   AND schema->'properties'->'conditions'->'items'->'properties'->'relatedObligations' IS NOT NULL;

UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    schema,
                    '{properties,contributionObligationDefinitions,items,properties,requiredEvidence}',
                    '{
                      "type": "object",
                      "x-help": "Ch.17 §8 — the type of evidence needed to satisfy/close this Obligation.",
                      "x-property-order": ["title", "category", "description", "collectionMethod"],
                      "properties": {
                        "title": {"type": "string"},
                        "category": {"type": "string", "x-referential": "category:evidence", "x-ontology": true, "x-help": "Ch.17 §7."},
                        "description": {"type": "string", "x-format": "markdown"},
                        "collectionMethod": {"type": "string", "x-help": "How this evidence is meant to be gathered."}
                      }
                    }'::jsonb,
                    true
                  ),
                  '{properties,contributionObligationDefinitions,items,x-property-order}',
                  '["code", "category", "title", "description", "origin", "priority", "severity", "completionCriteria", "requiredEvidence", "classification", "prompt", "participant", "outputContract", "assurance", "externalEvidence"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack')
   AND schema->'properties'->'contributionObligationDefinitions' IS NOT NULL;
