-- Owner: "In new pack, capabilities tab, capability code is from a dropdown
-- of capability-name. Name and description should not be editable" then,
-- once through that: "what is stored in contributionCapabilities[]? Just
-- store only the code." name/description are 100% derivable from the
-- capability-name Ontology concept `code` already resolves to (and already
-- validates against — core/packs.ts's assertCanonicalCategory), so storing
-- them redundantly per-Pack was pure duplication, not just a non-editable
-- UI nicety. seedContributions (core/packs.ts) now looks them up from the
-- Ontology at publish time instead of trusting the seed's own row.
--
-- x-ontology:true on `code` is what lets its own dropdown resolve a real
-- label (not the bare code) — the same marker every top-level Ontology-
-- backed field already carries, now also read at the item level
-- (ontologyConceptTypesIn/buildItemFields, domain/sdk/formGenerator.ts).
-- Replaces the whole field (not a sub-path jsonb_set), same as migration 116
-- originally did — required/x-property-order/properties all narrow to
-- `code` alone; migration 131's own x-help on `code` carries over verbatim.
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
                      "required": ["code"],
                      "x-property-order": ["code"],
                      "properties": {
                        "code": {"type": "string", "x-help": "Which capability this Pack contributes to (Ch.18 Ontology, concept type capability-name).", "x-referential": "capability-name", "x-ontology": true}
                      }
                    }
                  }'::jsonb
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
