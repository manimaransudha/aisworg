-- CR-079 step (d) — Pack's own top-level `code` no longer sources its
-- dropdown from the fixed capability-name concept type (already wrong since
-- step (b) shipped — the schema and the server-side check had drifted out of
-- sync). Replaced with the new x-referential-source-by/x-referential-source-suffix
-- pair (formGenerator.ts) — the dropdown is now driven by whatever `category`
-- is currently selected: "Technology" -> technology-name, "Domain" ->
-- domain-name, etc. Same naming convention validatePackSeed itself now uses
-- (step (b), core/packs.ts).
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,code}',
                  '{
                    "type": "string",
                    "x-help": "Identity code for this Pack, sourced from the Ontology vocabulary of its own category (Ch.18). Not a capability; see Capability Contributions for what this Pack contributes to.",
                    "x-widget": "referential-select",
                    "minLength": 1,
                    "x-ontology": true,
                    "x-referential-source-by": "category",
                    "x-referential-source-suffix": "-name"
                  }'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
