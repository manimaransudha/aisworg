-- CR-038 — Template's flat mandatoryPackCodes replaced by six category-
-- scoped fields (mirrors Profile's own technologyPackCodes/domainPackCodes/
-- compliancePackCodes/integrationPackCodes exactly, extended to the full
-- category:pack vocabulary — Compliance/Domain/Engineering/Integration/
-- Organisation/Technology — since a Template's mandatory Packs, unlike
-- Profile's optional supplements, can span any category). requiredCapabilityCodes
-- removed outright — owner: "The Required Capability codes need not be an
-- UI field. It is derived from the selections the user makes" — there is no
-- widget for it at all any more, not even a readonly one.

-- Step 1: drop the two retired fields.
UPDATE schema_definitions
   SET schema = schema #- '{properties,mandatoryPackCodes}' #- '{properties,requiredCapabilityCodes}'
 WHERE entity_kind = 'Template' AND version = 1;

-- Step 2: add the six category-scoped Pack fields, same jsonb_set convention
-- every other Template field migration already uses.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      jsonb_set(
                        jsonb_set(
                          jsonb_set(
                            schema,
                            '{properties,compliancePackCodes}',
                            '{"type":"array","x-widget":"referential-list","x-help":"Packs categorised Compliance","items":{"type":"object","required":["packCode"],"properties":{"packCode":{"type":"string","x-referential":"pack-code:Compliance"}}}}'::jsonb,
                            true
                          ),
                          '{properties,domainPackCodes}',
                          '{"type":"array","x-widget":"referential-list","x-help":"Packs categorised Domain","items":{"type":"object","required":["packCode"],"properties":{"packCode":{"type":"string","x-referential":"pack-code:Domain"}}}}'::jsonb,
                          true
                        ),
                        '{properties,engineeringPackCodes}',
                        '{"type":"array","x-widget":"referential-list","x-help":"Packs categorised Engineering","items":{"type":"object","required":["packCode"],"properties":{"packCode":{"type":"string","x-referential":"pack-code:Engineering"}}}}'::jsonb,
                        true
                      ),
                      '{properties,integrationPackCodes}',
                      '{"type":"array","x-widget":"referential-list","x-help":"Packs categorised Integration","items":{"type":"object","required":["packCode"],"properties":{"packCode":{"type":"string","x-referential":"pack-code:Integration"}}}}'::jsonb,
                      true
                    ),
                    '{properties,organisationPackCodes}',
                    '{"type":"array","x-widget":"referential-list","x-help":"Packs categorised Organisation","items":{"type":"object","required":["packCode"],"properties":{"packCode":{"type":"string","x-referential":"pack-code:Organisation"}}}}'::jsonb,
                    true
                  ),
                  '{properties,technologyPackCodes}',
                  '{"type":"array","x-widget":"referential-list","x-help":"Packs categorised Technology","items":{"type":"object","required":["packCode"],"properties":{"packCode":{"type":"string","x-referential":"pack-code:Technology"}}}}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Template' AND version = 1;
