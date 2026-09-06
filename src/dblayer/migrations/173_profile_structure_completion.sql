-- CR-091 — Profile Structure completion (Ch.7 §5/§7), closing the gaps found
-- reviewing Chapter 7 against the current build: two §5 "may define" items
-- had no field at all (Deployment Targets, Optional Capability Enablement),
-- and §7's own four category-scoped Pack fields only covered 4 of Pack's
-- real 6 categories (missing Engineering/Organisation, the two Template
-- already has via PACK_SELECTION_SLOTS, core/templates.ts).
--
-- deploymentTargets — owner: "Deployment target can be something very
-- specific that a CI/CD pipeline should be able to pick. For now, it will be
-- a json so there is flexibility to add what is required." Same
-- declared-not-yet-enforced treatment `compositionOptions` (migration 066)
-- already has — a real, distinct field from `environment` (owner: "Deployment
-- targets is not the same as environment. Environment can be development.
-- Deployment target can be something very specific").
--
-- additionalCapabilityCodes — owner: "this has to be included. This allows
-- addition of capability-name not available in the template. Note we
-- mentioned there should be no excess or no missing in template. If excess
-- is required, it gets added here. just a list of capability-names from
-- ontology not already there coming from the templates." Same referential-
-- list shape as `featureFlagCodes` (migration 066) — Ontology-backed
-- (capability-name, already the shared vocabulary Pack's own
-- contributionCapabilities uses), x-ontology:true (unlike featureFlagCodes,
-- since capability-name concepts carry real labels worth resolving, the same
-- discipline `x-referential`+`x-ontology` item fields elsewhere already
-- follow). The "not already there coming from the templates" narrowing is a
-- candidate-list filter at the authoring route (web/sdkAuthoring.ts), not a
-- schema-level constraint — nothing here stops a resubmission of an already-
-- covered code, the same "declared, softly curated" discipline every other
-- Ontology-backed picker on this page uses.
--
-- engineeringPackCodes / organisationPackCodes — owner: "Selected
-- Technologies/Domains/Compliance/Integration - should cover all pack
-- categories coming from ontology." Mirrors technology/domain/compliance/
-- integrationPackCodes (migration 066) exactly, just the other two of Pack's
-- six real category:pack values — same `x-referential: "pack-code:<Category>"`
-- mechanism, no new widget code.
--
-- Participating organisations (§5) — owner: "I think this should be in
-- capability fulfilment. leave it open for now." — deliberately not
-- addressed here.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      jsonb_set(
                        schema,
                        '{properties,deploymentTargets}',
                        '{"type":"object","x-widget":"json","x-help":"CI/CD-pickable deployment target specifics (Ch.7 §5) — distinct from Environment (development/staging/production): free-form JSON for now, so any pipeline-specific shape can be added without a schema change."}'::jsonb,
                        true
                      ),
                      '{properties,additionalCapabilityCodes}',
                      '{"type":"array","x-help":"Capabilities this Profile enables beyond whatever its base Template already requires (Ch.7 §5 Optional Capability Enablement) — the Profile-level escape hatch for a genuinely per-commissioning excess, so the Template itself never has to over-provision for the general case.","x-widget":"referential-list","items":{"type":"object","required":["capabilityCode"],"properties":{"capabilityCode":{"type":"string","x-referential":"capability-name","x-ontology":true}}}}'::jsonb,
                      true
                    ),
                    '{properties,engineeringPackCodes}',
                    '{"type":"array","x-help":"Packs categorised Engineering","x-widget":"referential-list","items":{"type":"object","required":["packCode"],"properties":{"packCode":{"type":"string","x-referential":"pack-code:Engineering"}}}}'::jsonb,
                    true
                  ),
                  '{properties,organisationPackCodes}',
                  '{"type":"array","x-help":"Packs categorised Organisation","x-widget":"referential-list","items":{"type":"object","required":["packCode"],"properties":{"packCode":{"type":"string","x-referential":"pack-code:Organisation"}}}}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Profile' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Profile');
