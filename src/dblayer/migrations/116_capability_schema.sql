-- CR-065 — contributionCapabilities[] authoring form: category dropped
-- entirely. Owner: "Field category can be dropped. code already carries the
-- required intelligence." Final field set: code, name, description —
-- Capability's own real Structure settles at Identifier/Name/Description
-- only (Ch.10 §8's other 7 named fields all map onto mechanisms that
-- already exist elsewhere in the platform, at a more appropriate grain —
-- see CR-065's own "Design, as settled").
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,contributionCapabilities}',
                  '{
                    "type": "array",
                    "x-help": "§9 Capabilities this Pack contributes — reusable engineering competencies, independent of who or what performs them.",
                    "x-widget": "referential-list",
                    "items": {
                      "type": "object",
                      "required": ["code", "name"],
                      "x-property-order": ["code", "name", "description"],
                      "properties": {
                        "code": {"type": "string", "x-help": "A short, unique identifier for this Capability, scoped to this Pack."},
                        "name": {"type": "string", "x-help": "A short, human-readable name."},
                        "description": {"type": "string", "x-help": "What this Capability is, in plain language."}
                      }
                    }
                  }'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
