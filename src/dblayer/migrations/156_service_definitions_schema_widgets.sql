-- CR-086/Ch.11 follow-on. Two problems in the Service schema (entity_kind
-- 'Service') that 153/155 left behind:
--
-- 1. serviceLevel (155) got its {code,label,target_level,target,units} item
--    shape but never the "x-widget":"referential-list" marker on the FIELD
--    itself — without it, generateFields() (domain/sdk/formGenerator.ts)
--    doesn't recognise this as a repeatable-row field at all and falls
--    through to its generic scalar branch, which does `String(rawValue)` on
--    the raw array -> Array.prototype.toString()'s default join(',') calls
--    .toString() on each element -> literally "[object Object],[object
--    Object]" wherever this field is displayed. This is the exact bug
--    reported live. items.x-property-order was already correct (155); only
--    the missing top-level x-widget needed adding.
-- 2. capabilityCode/consumers were both plain free-text-shaped fields even
--    though both are already validated server-side as capability-name
--    Ontology codes (core/serviceDefinitions.ts's
--    assertCanonicalCategory("capability-name", ...)) — the form just never
--    exposed that as a dropdown. Fixed the same way every other Ontology-
--    backed field on Pack/Template/Profile already is: x-ontology:true +
--    x-referential-source. capabilityCode picks exactly one (referential-
--    select, existing mechanism); consumers picks zero or more (referential-
--    multi-select — a new, small top-level widget, this migration's reason
--    for needing a formGenerator.ts change alongside the schema data change).
-- Field DISPLAY order (Code, Name, Purpose, Capability-code, Service Level,
-- Governance, Consumers, Success, Inputs, Outputs) is controlled in code
-- (formGenerator.ts's FIELD_DISPLAY_ORDER/METADATA_FIELD_NAMES), not schema —
-- no migration needed for that part.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      jsonb_set(
                        schema,
                        '{properties,serviceLevel,x-widget}',
                        '"referential-list"'::jsonb
                      ),
                      '{properties,capabilityCode,x-widget}',
                      '"referential-select"'::jsonb
                    ),
                    '{properties,capabilityCode,x-ontology}',
                    'true'::jsonb
                  ),
                  '{properties,capabilityCode,x-referential-source}',
                  '"capability-name"'::jsonb
                )
 WHERE entity_kind = 'Service' AND version = 1;

UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      schema,
                      '{properties,consumers,x-widget}',
                      '"referential-multi-select"'::jsonb
                    ),
                    '{properties,consumers,x-ontology}',
                    'true'::jsonb
                  ),
                  '{properties,consumers,x-referential-source}',
                  '"capability-name"'::jsonb
                )
 WHERE entity_kind = 'Service' AND version = 1;
