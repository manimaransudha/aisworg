-- CR-082 — Engineering Capital contribution kind. Ch.5 §9 names four
-- contribution kinds never Pack-contributable at all (§19.4): Engineering
-- Behaviour, Engineering Metrics, Reusable Components, Engineering
-- Templates (unrelated to the platform's own Template entity — owner:
-- "Template Entity this app defines is not the same as Engineering
-- Templates. Completely unrelated."). Owner: unify all four under one
-- contribution kind, EngineeringCapital, classified by a new, freely-
-- extensible concept type (same treatment service-name/capability-name
-- already get) rather than four separate schema fields.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('engineering-capital', 'Engineering Behaviour', 'Engineering Behaviour', '11111111-1111-1111-1111-111111111111'),
  ('engineering-capital', 'Engineering Metrics', 'Engineering Metrics', '11111111-1111-1111-1111-111111111111'),
  ('engineering-capital', 'Reusable Components', 'Reusable Components', '11111111-1111-1111-1111-111111111111'),
  ('engineering-capital', 'Engineering Templates', 'Engineering Templates', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;
