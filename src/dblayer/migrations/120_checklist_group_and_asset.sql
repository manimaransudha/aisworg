-- Checklist schema extension — 2 real seed files (technologyc.pack.json,
-- technologycpp.pack.json) plus a concurrently-edited technology-nodejs.pack.json
-- authored checklists.items as nested groups ({groupname, items: [{statement}]})
-- and a top-level `asset` reference (e.g. "link to the organisation asset
-- .editorconfig") — neither has a home in the schema migration 104 (CR-060,
-- "revised same day") simplified checklist Items down to. That simplification
-- deliberately dropped Mandatory/Participant/OutputContract/Assurance/
-- ExternalEvidence (owner: "you cannot determine a checklist item to be
-- mandatory. Checklist is generic. Pack has the specifics." — those are
-- GATE-specific concerns, correctly moved to the referencing gate's own
-- checklistIds). `group` and `asset` are not gate-specific in that same way
-- — group is a pure organisational label on the Checklist's own items, and
-- asset is a reference relevant to the Checklist as a whole — so they're
-- added back, narrowly, rather than reverting the simplification.
--
-- items[].group: optional string, alongside the sole required `statement`.
-- Checklist itself: optional `asset` string, alongside name/description.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    schema,
                    '{properties,contributionChecklists,items,properties,items,items}',
                    '{
                      "type": "object",
                      "required": ["statement"],
                      "x-property-order": ["statement", "group"],
                      "properties": {
                        "statement": {"type": "string", "x-help": "The claim being verified, in plain language."},
                        "group": {"type": "string", "x-help": "Optional: a short category label grouping related items within this Checklist (e.g. \"Formatting\", \"Naming conventions\") — purely organisational, not a scoping mechanism."}
                      }
                    }'::jsonb,
                    true
                  ),
                  '{properties,contributionChecklists,items,properties,asset}',
                  '{"type": "string", "x-help": "Optional: a reference to a related organisational asset this Checklist enforces (e.g. a shared .editorconfig, style guide, or lint config)."}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');

UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,contributionChecklists,items,x-property-order}',
                  '["name", "description", "asset", "items"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');

ALTER TABLE checklists ADD COLUMN IF NOT EXISTS asset TEXT;
