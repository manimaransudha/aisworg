-- CR-087 follow-up (owner: "drop category. producing capability code does
-- not require an editable field. That can be automatically generated" /
-- "schema has to reflect the changes") — both properties come off Template's
-- Deliverable Catalogue entirely, not just off its display:
--
-- category: descriptive only (see migration 163's own comment for the full
-- audit — no operational reader anywhere in the app).
--
-- producingCapabilityCode: was the author hand-picking, from this Template's
-- own Pack-derived Capabilities, which one produces a given catalogue entry.
-- That's now derived automatically at commissioning time instead
-- (core/commissioning.ts), off the SEU's required Capabilities' own Active
-- Service Definition outputs (Ch.11's inputs/outputs contract, migration
-- 159) — the same source materialiseDependencyGraph.ts already trusts for
-- Capability-type dependency edges. A catalogue entry whose code isn't
-- declared as an output by any required Capability's Service Definition
-- simply gets no producing Capability, same as an author leaving the old
-- field blank.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema
                    #- '{properties,deliverableCatalogue,items,properties,category}'
                    #- '{properties,deliverableCatalogue,items,properties,producingCapabilityCode}',
                  '{properties,deliverableCatalogue,items,required}',
                  '["code"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Template' AND version = 1;
