-- Profile authoring grammar — the missing Ch.7 §7 fields, added at the
-- schema level so the generic form generator picks them up automatically,
-- same mechanism Pack/Template use (owner, 2026-08-19: "all missing fields
-- have to be fixed at schema level and the form generator has to use it").
--
-- category: Ontology-backed (profile-categories, migration 065), same
-- referential-select + x-ontology mechanism Template's `code` uses.
-- profileVersion: same generic x-widget:"version" mechanism as
-- packVersion/templateVersion (CR-024).
-- description: same x-widget:"textarea" mechanism as Template's `purpose`
-- (CR-023) — free text, not required (nothing else on Profile is redundant
-- with it the way Template's purpose made its own `description` redundant).
-- featureFlagCodes: a referential-list whose item field is Ontology-backed
-- (feature-flag, migration 065) rather than Pack-registry-backed — the
-- generic `x-referential` item-field resolver already treats this as "any
-- string list keyed by referentialSource"; feature-flag values are wired
-- into the picker at web/sdkAuthoring.ts's loadReferentialOptions.
-- compositionOptions: §7's remaining structural field — declared, not yet
-- enforced by anything (same "declared for documentation today" treatment
-- Pack's own §8/§13 compatibility metadata already has, Ch.5 §19.9).
-- technology/domain/compliance/integrationPackCodes: §7's four named
-- Pack-selection categories, each a referential-list scoped to ONE Pack
-- category via the existing category:pack Ontology vocabulary (Technology/
-- Domain/Compliance/Integration, already seeded) — `x-referential`
-- "pack-code:<Category>" is parsed by _referentialListGroup.ejs to filter
-- the same packDependencyOptions list every other Pack-code picker already
-- uses, not a new Pack list. The pre-existing `optionalPackCodes` is left
-- exactly as-is — the general/uncategorised selection, unaffected.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      jsonb_set(
                        jsonb_set(
                          jsonb_set(
                            jsonb_set(
                              jsonb_set(
                                jsonb_set(
                                  schema,
                                  '{properties,category}',
                                  '{"type":"string","minLength":1,"x-help":"Ch.7 §8 Profile Categories","x-widget":"referential-select","x-ontology":true,"x-referential-source":"profile-categories"}'::jsonb,
                                  true
                                ),
                                '{properties,profileVersion}',
                                '{"type":"string","x-help":"semver, e.g. 1.0.0","pattern":"^[0-9]+\\.[0-9]+\\.[0-9]+$","x-widget":"version"}'::jsonb,
                                true
                              ),
                              '{properties,description}',
                              '{"type":"string","x-widget":"textarea","x-help":"What this Profile is for and when to choose it."}'::jsonb,
                              true
                            ),
                            '{properties,featureFlagCodes}',
                            '{"type":"array","x-widget":"referential-list","items":{"type":"object","required":["featureCode"],"properties":{"featureCode":{"type":"string","x-referential":"feature-flag"}}}}'::jsonb,
                            true
                          ),
                          '{properties,compositionOptions}',
                          '{"type":"object","x-widget":"json","x-help":"Declared for documentation today; not yet enforced by the Composition Engine (Ch.5 §19.9 treatment)."}'::jsonb,
                          true
                        ),
                        '{properties,technologyPackCodes}',
                        '{"type":"array","x-help":"Packs categorised Technology","x-widget":"referential-list","items":{"type":"object","required":["packCode"],"properties":{"packCode":{"type":"string","x-referential":"pack-code:Technology"}}}}'::jsonb,
                        true
                      ),
                      '{properties,domainPackCodes}',
                      '{"type":"array","x-help":"Packs categorised Domain","x-widget":"referential-list","items":{"type":"object","required":["packCode"],"properties":{"packCode":{"type":"string","x-referential":"pack-code:Domain"}}}}'::jsonb,
                      true
                    ),
                    '{properties,compliancePackCodes}',
                    '{"type":"array","x-help":"Packs categorised Compliance","x-widget":"referential-list","items":{"type":"object","required":["packCode"],"properties":{"packCode":{"type":"string","x-referential":"pack-code:Compliance"}}}}'::jsonb,
                    true
                  ),
                  '{properties,integrationPackCodes}',
                  '{"type":"array","x-help":"Packs categorised Integration","x-widget":"referential-list","items":{"type":"object","required":["packCode"],"properties":{"packCode":{"type":"string","x-referential":"pack-code:Integration"}}}}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Profile' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Profile');

UPDATE schema_definitions
   SET schema = jsonb_set(schema, '{required}', '["name","baseTemplateCode","environment","category","profileVersion"]'::jsonb, true)
 WHERE entity_kind = 'Profile' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Profile');
