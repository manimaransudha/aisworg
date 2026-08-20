-- Pack schema v1, two owner asks (2026-08-19) on the same row:
--
-- 1. "The pack form should not show the owner and publisher fields. The
--    owner is either the platform or the tenant which is established using
--    the user session. The publisher is the user that publishes. So these
--    should not be enterable fields." Both were declaration-only free-text
--    (CR-018, never displayed anywhere — confirmed by grep) and duplicate
--    data the platform already tracks for real: owner is packs.tenant_id
--    (Pack ownership, migration 044, set from the real author's session
--    tenant at creation — not this metadata string); publisher is the real
--    actor + noun_verb badge already captured on the Pack's governed
--    publish-transition event (Part 1's "every transition: real actor +
--    badge"). Dropped from the schema entirely, so they no longer render as
--    form inputs. PackSeedInput.owner/.publisher and packMetadataFromSeed's
--    handling of them (core/packs.ts) are left in place, harmless — a JSON
--    import that still carries them is unaffected; only the interactive form
--    stops asking for them.
--
-- 2. "Create a concept type installation-classification... Schema should
--    have a referential-select to the ontology, no hardcoding." Same
--    treatment as code (capability-name) and category (category:pack,
--    migration 050): a referential-select marked x-ontology:true, pointed at
--    the installation-classification concepts (migration 051), replacing the
--    hardcoded `enum` this field carried since the schema's baseline.
--
-- Development-time schema correction to the shipped v1 baseline grammar, in
-- place — same convention migrations 038/045/050 already used.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  (schema #- '{properties,owner}' #- '{properties,publisher}'),
                  '{properties,installationClassification}',
                  '{"type":"string","x-help":"Pack installation classification (Ch.18 Ontology, concept type installation-classification)","x-widget":"referential-select","x-referential-source":"installation-classification","x-ontology":true}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = 1;
