-- CR-079 step (c) — a Capability contribution's own `code` becomes a real,
-- Ontology-backed dropdown (capability-name), replacing free text. Strict —
-- no free-text/"type new" affordance here (owner: "contributionCapabilities[].code
-- is a strict dropdown of the capability-name"), unlike Pack's own top-level
-- `code` (Track B, CR-079 point 4/6). Same treatment CR-064 already gave
-- Service's own code (service-name) and CR-065 gave nothing to (Capability's
-- own code was left plain free text at the time) — this closes that gap.
-- Mechanically: buildItemFields (formGenerator.ts) already renders any
-- item field carrying x-referential as a real <select> sourced from
-- locals.referentialOptions[x-referential] — no form-generator or view
-- change needed, only this schema marker plus wiring the capability-name
-- concept list into loadReferentialOptions (web/sdkAuthoring.ts).
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,contributionCapabilities,items,properties,code}',
                  '{"type": "string", "x-help": "Which capability this Pack contributes to (Ch.18 Ontology, concept type capability-name).", "x-referential": "capability-name"}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
