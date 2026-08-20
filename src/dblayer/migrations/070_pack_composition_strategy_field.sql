-- Pack `compositionStrategy` — Ontology-backed dropdown (owner, 2026-08-19,
-- CR-030): was a bare {"type":"string"} free-text field; now the same
-- referential-select + x-ontology mechanism category/installationClassification
-- already use (CR-020 Part 2) — zero new widget code, the generic
-- form-generator/Ontology-picker/live-guidance machinery picks it up as-is.
-- Not added to `required` — compositionStrategy stays optional, same as it
-- always was (Ch.5 §8/§13, CR-018).
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,compositionStrategy}',
                  '{"type":"string","x-help":"how contributions compose (§8; recorded, not yet enforced — §19.8)","x-widget":"referential-select","x-ontology":true,"x-referential-source":"composition-strategy"}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
