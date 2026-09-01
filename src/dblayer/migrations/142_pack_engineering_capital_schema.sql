-- CR-082 — contributionEngineeringCapital[] authoring form. Minimal stub,
-- owner: "We will define that these should be in details later" — just
-- `type` (Ontology-backed, engineering-capital, migration 141) and `url`
-- (plain text). Ch.5 §9 tbi.md classification note: these four kinds are
-- "not classified — inputs and assets, not checks" (unlike Checklists/
-- Quality Gates/Review Gates/Obligations), so no §20 verifiable-item fields
-- apply here.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,contributionEngineeringCapital}',
                  '{
                    "type": "array",
                    "x-help": "§9 Engineering Capital — Engineering Behaviour / Engineering Metrics / Reusable Components / Engineering Templates this Pack contributes. Minimal declaration for now: a type and a URL to the actual resource.",
                    "x-widget": "referential-list",
                    "items": {
                      "type": "object",
                      "required": ["type", "url"],
                      "x-property-order": ["type", "url"],
                      "properties": {
                        "type": {"type": "string", "x-referential": "engineering-capital", "x-ontology": true, "x-help": "What kind of Engineering Capital this is."},
                        "url": {"type": "string", "x-help": "Where this resource actually lives."}
                      }
                    }
                  }'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
