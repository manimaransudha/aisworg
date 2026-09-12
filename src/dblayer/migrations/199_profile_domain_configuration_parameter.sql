-- Owner: "I want domain as an additional profile-configuration parameter.
-- ui_grouping is Profiles, text_type is text." A ninth Configuration
-- Parameter (Ch.7 §10, migrations 174/175), same single-value
-- referential-select shape as the existing eight — but its own
-- profile-configuration catalogue row carries ui_grouping='Profiles', not
-- 'SEU Configurations' (owner explicit, distinguishing it from the other
-- eight). Its VALUES reuse the `domain` concept type CR-099 already seeded
-- (25 real values, migration 196) rather than seeding a new set — same
-- "parameterCode is both its own profile-configuration code and its own
-- value concept type name" convention (core/profiles.ts CONFIGURATION_PARAMETER_FIELDS),
-- and the same concept type Pack's own Domain competency values already use.
-- Leaving `domain`'s own 25 child rows' ui_grouping at 'Competencies'
-- (migration 196) untouched — that groups the CHILD concept type's rows for
-- the Ontology admin tab; only the PARENT profile-configuration catalogue
-- row (this insert) needs the new 'Profiles' grouping, exactly as migration
-- 191 set it directly on each of the other eight.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id, text_type, ui_grouping, is_mandatory) VALUES
  ('profile-configuration', 'domain', 'Domain', '11111111-1111-1111-1111-111111111111', 'text', 'Profiles', FALSE)
ON CONFLICT (concept_type, code, tenant_id, version) DO NOTHING;

UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,domain}',
                  '{"type":"string","x-widget":"referential-select","x-referential-source":"domain","x-ontology":true,"x-help":"Ch.7 §10 Configuration Parameters. Unioned with composed Packs'' own Domain competency values at EBM composition (CR-101)."}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Profile' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Profile');
