-- CR-109 Build Plan §1 — three more Profile-level Configuration Parameters
-- (Ch.6 §13 / Ch.7 §10), settled in the CR-109 design note:
--
--   dispatchStrategyPreference — a tenth single-value Configuration
--     Parameter, same shape as the existing nine (migrations 174/175/199).
--     Its value vocabulary is Ch.33 §9's own "Illustrative strategies"
--     list ("Strategies are contributed through Packs" per the spec — same
--     Ontology-seeded-today, Pack-authorable-later treatment every other
--     Configuration Parameter already gets, not a real deviation).
--
--   knowledgeLocations — settled as "just Input Location + Output Location,
--     generic — one {deliverableCode or capabilityCode, inputLocation,
--     outputLocation} entry per Deliverable/Capability that needs one,
--     Ontology-backed on the code, not a fixed named-field list per
--     Deliverable." Two independent nested x-referential fields (mirrors
--     migration 040's own packCode-per-item convention) rather than one
--     field of ambiguous kind — exactly one of deliverableCode/
--     capabilityCode is expected per entry, checked in validateProfileSeed
--     (core/profiles.ts), not at the schema level. No new concept type
--     needed — reuses the existing deliverable-name/capability-name
--     catalogues.
--
--   readme — the per-SEU README.md-style free-form field. No Ontology
--     concept type at all, same treatment as environmentConfiguration
--     (migration 175) — free text the author writes, not a closed
--     vocabulary.
-- ontology_concepts_type_code_tenant_version_unique (migration 190) is the
-- real constraint — (concept_type, code, tenant_id, version), not the
-- 3-column one migration 174 predates that widening; ON CONFLICT must name
-- it exactly (migration 199's own precedent), otherwise Postgres has no
-- matching unique/exclusion constraint to arbitrate the conflict on.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id, is_mandatory, ui_grouping) VALUES
  ('profile-configuration', 'dispatch-strategy-preference', 'Dispatch Strategy Preference', '11111111-1111-1111-1111-111111111111', FALSE, 'SEU Configurations')
ON CONFLICT (concept_type, code, tenant_id, version) DO NOTHING;

INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('dispatch-strategy-preference', 'capability-match', 'Capability Match', '11111111-1111-1111-1111-111111111111'),
  ('dispatch-strategy-preference', 'specialist-preference', 'Specialist Preference', '11111111-1111-1111-1111-111111111111'),
  ('dispatch-strategy-preference', 'cost-optimisation', 'Cost Optimisation', '11111111-1111-1111-1111-111111111111'),
  ('dispatch-strategy-preference', 'confidence-optimisation', 'Confidence Optimisation', '11111111-1111-1111-1111-111111111111'),
  ('dispatch-strategy-preference', 'load-balancing', 'Load Balancing', '11111111-1111-1111-1111-111111111111'),
  ('dispatch-strategy-preference', 'locality-preference', 'Locality Preference', '11111111-1111-1111-1111-111111111111'),
  ('dispatch-strategy-preference', 'organisation-preference', 'Organisation Preference', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id, version) DO NOTHING;

UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      schema,
                      '{properties,dispatchStrategyPreference}',
                      '{"type":"string","x-widget":"referential-select","x-referential-source":"dispatch-strategy-preference","x-ontology":true,"x-help":"Ch.33 §9 Dispatch Strategies. Which Pack-contributed strategy the Dispatch Engine uses for this SEU (CR-109)."}'::jsonb,
                      true
                    ),
                    '{properties,knowledgeLocations}',
                    '{"type":"array","x-widget":"referential-list","x-help":"Ch.6 §13 / Ch.32 §7 Input/Output Knowledge Location, one entry per Deliverable or Capability that needs one (CR-109). Exactly one of deliverableCode/capabilityCode per entry.","items":{"type":"object","properties":{"deliverableCode":{"type":"string","x-referential":"deliverable-name"},"capabilityCode":{"type":"string","x-referential":"capability-name"},"inputLocation":{"type":"string"},"outputLocation":{"type":"string"}}}}'::jsonb,
                    true
                  ),
                  '{properties,readme}',
                  '{"type":"string","x-widget":"textarea","x-help":"Per-SEU README.md-style free-form field (CR-109) — anything not covered by a structured Configuration Parameter."}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Profile' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Profile');
