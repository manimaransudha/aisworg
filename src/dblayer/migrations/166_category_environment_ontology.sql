-- CR-089 follow-up — Chapter 24 §9's "Environment" Policy Applicability
-- dimension. Owner: "add environment inside applicability and that is
-- configurable. We have to define an environment ontology and use it."
-- Profile's own `environment` field (schema_definitions, Profile v1) already
-- has a fixed enum (development/staging/production) but is NOT
-- Ontology-backed — plain JSON Schema enum only. This is that same set,
-- promoted to a real Ontology concept type, same discipline category:policy
-- (migration 107) already got for Ch.24 §7.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('category:environment', 'development', 'Development', '11111111-1111-1111-1111-111111111111'),
  ('category:environment', 'staging', 'Staging', '11111111-1111-1111-1111-111111111111'),
  ('category:environment', 'production', 'Production', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;
