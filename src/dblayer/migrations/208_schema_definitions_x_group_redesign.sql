-- Full redesign (owner: "Policy UI has to be similar to Pack - Metadata tab
-- and other tabs grouped", after: "Full redesign" chosen over a Policy-only
-- patch) — formGenerator.ts's groupFieldsForDisplay() used five hardcoded,
-- name-based Sets (METADATA_FIELD_NAMES/COMPATIBILITY_FIELD_NAMES/
-- PACK_SELECTION_FIELD_NAMES/DELIVERABLES_FIELD_NAMES) plus one shared
-- FIELD_DISPLAY_ORDER array to decide which simple-field-grid tab a field
-- renders under and in what order — one array shared across every kind,
-- including a Pack-only ordering requirement (CR-079: category must lead
-- because Pack's own `code` is Ontology-driven BY category) that silently
-- applied to every other kind too. Policy's own fields were never added to
-- any of these Sets at all, so they fell into an unsorted "other" catch-all
-- rendered AHEAD of Identity & Metadata, not after it.
--
-- This migration makes each kind's own schema the authority instead: a new
-- top-level `x-groups` (which simple tabs this kind has, in order, with a
-- label) and a per-field `x-group` (which tab it belongs to), plus a
-- top-level `x-property-order` (order WITHIN a tab — same reason the
-- existing nested items["x-property-order"] exists: Postgres JSONB doesn't
-- preserve object-key insertion order). The per-field loop below guards
-- existence explicitly (`schema->'properties' ? field_name`) before setting
-- `x-group`, so it's a safe no-op for any (kind, field) pair that doesn't
-- exist on a given schema row — the same row is always targeted via
-- `(SELECT MAX(version) ...)`, so this is robust regardless of which prior
-- migrations have actually been applied to a given database.
--
-- Scope, deliberately bounded: Exposable Parameters (Template's
-- exposedParameters), Parameter Overrides (Profile's
-- exposedParameterOverrides), and Configuration Parameters (Profile's ten
-- Ch.7 §10 fields) stay name-detected singleton groups in formGenerator.ts,
-- unchanged — they're either a bespoke candidate-driven grid (not a plain
-- field grid at all) or carry tenant-overridable required-ness computed at
-- render time (CR-091 Part 2), not a schema-authorable fact. Dependencies
-- (single named field) and Contributions (any `contribution(s)X` field, one
-- tab each) also stay name/pattern-detected — never part of the
-- x-group-ordering problem this closes. TransitionDefinition is skipped: no
-- authoring route renders its schema through generateFields/
-- groupFieldsForDisplay yet (KIND_BY_SLUG, web/sdkAuthoring.ts).
DO $$
DECLARE
  m RECORD;
BEGIN
  FOR m IN SELECT * FROM (VALUES
    -- Pack
    ('Pack', 'category', 'metadata'), ('Pack', 'code', 'metadata'), ('Pack', 'packVersion', 'metadata'),
    ('Pack', 'name', 'metadata'), ('Pack', 'description', 'metadata'),
    ('Pack', 'installationClassification', 'metadata'), ('Pack', 'compositionStrategy', 'metadata'), ('Pack', 'compositionSources', 'metadata'),
    ('Pack', 'supportedPlatformVersion', 'compatibility'), ('Pack', 'minSupportedPlatformVersion', 'compatibility'),
    ('Pack', 'maxSupportedPlatformVersion', 'compatibility'), ('Pack', 'incompatiblePackVersions', 'compatibility'), ('Pack', 'migrationGuidance', 'compatibility'),
    -- Template
    ('Template', 'code', 'metadata'), ('Template', 'name', 'metadata'), ('Template', 'purpose', 'metadata'), ('Template', 'templateVersion', 'metadata'),
    ('Template', 'compliancePackCodes', 'packSelection'), ('Template', 'domainPackCodes', 'packSelection'), ('Template', 'engineeringPackCodes', 'packSelection'),
    ('Template', 'integrationPackCodes', 'packSelection'), ('Template', 'organisationPackCodes', 'packSelection'), ('Template', 'technologyPackCodes', 'packSelection'),
    ('Template', 'deliverableCatalogue', 'deliverables'), ('Template', 'dependencyGraph', 'deliverables'),
    -- Profile
    ('Profile', 'name', 'metadata'), ('Profile', 'description', 'metadata'), ('Profile', 'environment', 'metadata'), ('Profile', 'profileVersion', 'metadata'),
    ('Profile', 'baseTemplateCode', 'metadata'), ('Profile', 'featureFlagCodes', 'metadata'), ('Profile', 'deploymentTargets', 'metadata'),
    ('Profile', 'additionalCapabilityCodes', 'metadata'), ('Profile', 'compositionOptions', 'metadata'),
    ('Profile', 'compliancePackCodes', 'packSelection'), ('Profile', 'domainPackCodes', 'packSelection'), ('Profile', 'engineeringPackCodes', 'packSelection'),
    ('Profile', 'integrationPackCodes', 'packSelection'), ('Profile', 'organisationPackCodes', 'packSelection'), ('Profile', 'technologyPackCodes', 'packSelection'),
    -- Service
    ('Service', 'code', 'metadata'), ('Service', 'name', 'metadata'), ('Service', 'purpose', 'metadata'), ('Service', 'capabilityCode', 'metadata'),
    ('Service', 'serviceLevel', 'metadata'), ('Service', 'governance', 'metadata'), ('Service', 'consumers', 'metadata'),
    ('Service', 'success', 'metadata'), ('Service', 'inputs', 'metadata'), ('Service', 'outputs', 'metadata'),
    -- Deliverable
    ('Deliverable', 'code', 'metadata'), ('Deliverable', 'description', 'metadata'), ('Deliverable', 'definitionVersion', 'metadata'),
    -- Policy (owner: "code, Name, description should all come to the top";
    -- Applicability/Governance are the two new tabs agreed for CR-106's
    -- Obligation-model follow-on Policy authoring UI pass)
    ('Policy', 'code', 'metadata'), ('Policy', 'name', 'metadata'), ('Policy', 'description', 'metadata'),
    ('Policy', 'category', 'metadata'), ('Policy', 'constraintType', 'metadata'),
    ('Policy', 'applicabilityDeliverableNames', 'applicability'), ('Policy', 'applicabilityEnvironments', 'applicability'),
    ('Policy', 'applicabilityDeliverableLifecycle', 'applicability'),
    ('Policy', 'conditions', 'governance'), ('Policy', 'scope', 'governance'),
    ('Policy', 'governedTransition', 'governance'), ('Policy', 'governingCondition', 'governance')
  ) AS t(entity_kind, field_name, group_key)
  LOOP
    -- Bug fix in passing: create_missing=false disables creating the FINAL
    -- path segment too, not just intermediate ones — since `x-group` never
    -- existed on any property before this migration, that made every one of
    -- these updates a silent no-op (confirmed live: x-groups landed, but no
    -- property ever got its own x-group). Existence is guarded explicitly
    -- via `?` on `properties` instead, so create_missing=true here is safe —
    -- `properties.<field>` is confirmed present; only `x-group` under it is
    -- genuinely new.
    UPDATE schema_definitions
       SET schema = jsonb_set(schema, ARRAY['properties', m.field_name, 'x-group'], to_jsonb(m.group_key), true)
     WHERE entity_kind = m.entity_kind
       AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = m.entity_kind)
       AND schema->'properties' ? m.field_name;
  END LOOP;
END $$;

UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(schema, '{x-groups}', '[{"key": "metadata", "label": "Identity & Metadata"}, {"key": "compatibility", "label": "Compatibility"}]'::jsonb, true),
                  '{x-property-order}',
                  '["category", "code", "packVersion", "name", "description", "installationClassification", "compositionStrategy", "compositionSources", "supportedPlatformVersion", "minSupportedPlatformVersion", "maxSupportedPlatformVersion", "incompatiblePackVersions", "migrationGuidance"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');

UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(schema, '{x-groups}', '[{"key": "metadata", "label": "Identity & Metadata"}, {"key": "packSelection", "label": "Pack Codes"}, {"key": "deliverables", "label": "Deliverable Catalogue"}]'::jsonb, true),
                  '{x-property-order}',
                  '["code", "name", "purpose", "templateVersion", "compliancePackCodes", "domainPackCodes", "engineeringPackCodes", "integrationPackCodes", "organisationPackCodes", "technologyPackCodes", "deliverableCatalogue", "dependencyGraph"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Template' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Template');

UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(schema, '{x-groups}', '[{"key": "metadata", "label": "Identity & Metadata"}, {"key": "packSelection", "label": "Pack Codes"}]'::jsonb, true),
                  '{x-property-order}',
                  '["name", "profileVersion", "description", "environment", "baseTemplateCode", "featureFlagCodes", "deploymentTargets", "additionalCapabilityCodes", "compositionOptions", "compliancePackCodes", "domainPackCodes", "engineeringPackCodes", "integrationPackCodes", "organisationPackCodes", "technologyPackCodes"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Profile' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Profile');

UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(schema, '{x-groups}', '[{"key": "metadata", "label": "Identity & Metadata"}]'::jsonb, true),
                  '{x-property-order}',
                  '["code", "name", "purpose", "capabilityCode", "serviceLevel", "governance", "consumers", "success", "inputs", "outputs"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Service' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Service');

UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(schema, '{x-groups}', '[{"key": "metadata", "label": "Identity & Metadata"}]'::jsonb, true),
                  '{x-property-order}',
                  '["code", "description", "definitionVersion"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Deliverable' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Deliverable');

UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(schema, '{x-groups}', '[{"key": "metadata", "label": "Identity & Metadata"}, {"key": "applicability", "label": "Applicability"}, {"key": "governance", "label": "Governance"}]'::jsonb, true),
                  '{x-property-order}',
                  '["code", "name", "description", "category", "constraintType", "applicabilityDeliverableNames", "applicabilityEnvironments", "applicabilityDeliverableLifecycle", "conditions", "scope", "governedTransition", "governingCondition"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Policy' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Policy');
