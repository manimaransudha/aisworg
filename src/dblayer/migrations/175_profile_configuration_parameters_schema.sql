-- CR-091 Part 2/Part 3 — Profile schema changes.
--
-- Part 2: configParameters (free-form, inert JSON, Ch.7 §19.5) retired
-- outright, replaced by ten explicit named fields — not a generic
-- {parameterCode, value} list (owner, correcting that first design: "why
-- will this happen? If both AWS and Azure are required, each will be a
-- separate profile, isn't it?... why are we moving away from a schema
-- definition for profile?"). Each single-value parameter is
-- x-referential + x-ontology (CR-060's nested-item-field convention would
-- apply if these were nested; these are top-level, so x-widget:
-- "referential-select" + x-referential-source, same as every other
-- top-level Ontology-backed field) sourced from its own concept type
-- (migration 174), named identically to its own profile-configuration code.
-- None of the ten appear in `required` — mandatory-or-not is Ontology-driven
-- per parameter, tenant-overridable (validateProfileSeed's own
-- CONFIGURATION_PARAMETER_FIELDS loop, core/profiles.ts — not a
-- schema-level constraint).
--
-- Part 3: category (migration 065/066) removed from use per owner: "Profile
-- is not supposed to be restrictive" — the profiles.category DATABASE
-- COLUMN and the profile-categories Ontology concepts are deliberately left
-- alone ("do not delete. But do not use them"); only the SCHEMA field (what
-- the authoring form shows/requires) is removed here.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      jsonb_set(
                        jsonb_set(
                          jsonb_set(
                            jsonb_set(
                              jsonb_set(
                                (schema #- '{properties,configParameters}') #- '{properties,category}',
                                '{properties,targetCloudProvider}',
                                '{"type":"string","x-widget":"referential-select","x-referential-source":"target-cloud-provider","x-ontology":true,"x-help":"Ch.7 §10 Configuration Parameters."}'::jsonb,
                                true
                              ),
                              '{properties,primaryProgrammingLanguage}',
                              '{"type":"string","x-widget":"referential-select","x-referential-source":"primary-programming-language","x-ontology":true,"x-help":"Ch.7 §10 Configuration Parameters."}'::jsonb,
                              true
                            ),
                            '{properties,sourceControlProvider}',
                            '{"type":"string","x-widget":"referential-select","x-referential-source":"source-control-provider","x-ontology":true,"x-help":"Ch.7 §10 Configuration Parameters."}'::jsonb,
                            true
                          ),
                          '{properties,deploymentStrategy}',
                          '{"type":"string","x-widget":"referential-select","x-referential-source":"deployment-strategy","x-ontology":true,"x-help":"Ch.7 §10 Configuration Parameters."}'::jsonb,
                          true
                        ),
                        '{properties,aiProviderPreference}',
                        '{"type":"string","x-widget":"referential-select","x-referential-source":"ai-provider-preference","x-ontology":true,"x-help":"Ch.7 §10 Configuration Parameters."}'::jsonb,
                        true
                      ),
                      '{properties,defaultRepositoryStructure}',
                      '{"type":"string","x-widget":"referential-select","x-referential-source":"default-repository-structure","x-ontology":true,"x-help":"Ch.7 §10 Configuration Parameters."}'::jsonb,
                      true
                    ),
                    '{properties,documentationLevel}',
                    '{"type":"string","x-widget":"referential-select","x-referential-source":"documentation-level","x-ontology":true,"x-help":"Ch.7 §10 Configuration Parameters."}'::jsonb,
                    true
                  ),
                  '{properties,developmentMethodology}',
                  '{"type":"string","x-widget":"referential-select","x-referential-source":"development-methodology","x-ontology":true,"x-help":"Ch.7 §10 Configuration Parameters. Ch.6 §13''s own Development Methodology example (CR-088)."}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Profile' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Profile');

UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    schema,
                    '{properties,participatingOrganisationCodes}',
                    '{"type":"array","x-help":"Ch.7 §5/§12 Participating Organisations. No values exist yet — populated when multi-tenancy is implemented.","x-widget":"referential-list","items":{"type":"object","required":["organisationCode"],"properties":{"organisationCode":{"type":"string","x-referential":"participating-organisations","x-ontology":true}}}}'::jsonb,
                    true
                  ),
                  '{properties,environmentConfiguration}',
                  '{"type":"object","x-widget":"json","x-help":"Ch.7 §5/§10 Environment Configuration — free-form key/value pairs a CI/CD pipeline reads (e.g. SUPABASE_URL), never a closed vocabulary. Distinct from Environment (development/staging/production)."}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Profile' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Profile');

UPDATE schema_definitions
   SET schema = jsonb_set(schema, '{required}', '["name","baseTemplateCode","environment","profileVersion"]'::jsonb, true)
 WHERE entity_kind = 'Profile' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Profile');
