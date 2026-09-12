-- CR-100 — owner: "In Pack authoring, dimension dropdown is correct. Value
-- has to be a dropdown from Competency Value Ontology but allow a new text.
-- If a new text is written, it has to emit a OntologyComposed event."
-- `dimension` (category:pack, static) already renders correctly as a plain
-- Ontology dropdown — untouched. `value` becomes a real item-level dynamic
-- dropdown (x-referential-source-by/-suffix, new formGenerator.ts support),
-- driven by this same row's own `dimension` — the free-text-capable
-- .ontology-combo widget Pack's own `code` field already uses, reused here
-- for the first time inside a repeatable row. Publishing an unregistered
-- value is still blocked by validatePackSeed (unchanged) — writing one is
-- what proposes it (core/sdkAuthoring.ts's emitOntologyComposedForCompetencies,
-- draft create/save), same as an unregistered Pack code already works.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,contributionCompetencies,items,properties,value}',
                  '{
                    "type": "string",
                    "x-ontology": true,
                    "x-referential-source-by": "dimension",
                    "x-referential-source-suffix": "",
                    "x-help": "Click or start typing to browse existing values for the chosen dimension, or type a new one — publishing is blocked until it becomes a real, registered Ontology concept."
                  }'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
