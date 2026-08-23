-- CR-062 — Obligation Category/Origin ontology. category:obligation already
-- existed (5 values); Ch.23 §7 names 4 more not yet seeded. Origin (FR-23.5,
-- "shall remain permanently recorded") never had any mechanism at all — a
-- new concept type category:obligation-origin, seeded with Ch.23 §10's own
-- 11 named Obligation Sources. Both stay categorical vocabularies (no
-- cross-Pack reference — see CR-062's own "no real Definition table" design
-- decision), same treatment category:policy (CR-061, migration 107) got.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('category:obligation', 'Risk', 'Risk', '11111111-1111-1111-1111-111111111111'),
  ('category:obligation', 'Audit', 'Audit', '11111111-1111-1111-1111-111111111111'),
  ('category:obligation', 'Operational', 'Operational', '11111111-1111-1111-1111-111111111111'),
  ('category:obligation', 'Customer', 'Customer', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;

INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('category:obligation-origin', 'EBM', 'EBM', '11111111-1111-1111-1111-111111111111'),
  ('category:obligation-origin', 'Policies', 'Policies', '11111111-1111-1111-1111-111111111111'),
  ('category:obligation-origin', 'Authority evaluations', 'Authority evaluations', '11111111-1111-1111-1111-111111111111'),
  ('category:obligation-origin', 'Reviews', 'Reviews', '11111111-1111-1111-1111-111111111111'),
  ('category:obligation-origin', 'Quality Gates', 'Quality Gates', '11111111-1111-1111-1111-111111111111'),
  ('category:obligation-origin', 'Compliance Packs', 'Compliance Packs', '11111111-1111-1111-1111-111111111111'),
  ('category:obligation-origin', 'Organisation Packs', 'Organisation Packs', '11111111-1111-1111-1111-111111111111'),
  ('category:obligation-origin', 'Customer requests', 'Customer requests', '11111111-1111-1111-1111-111111111111'),
  ('category:obligation-origin', 'Participants', 'Participants', '11111111-1111-1111-1111-111111111111'),
  ('category:obligation-origin', 'External systems', 'External systems', '11111111-1111-1111-1111-111111111111'),
  ('category:obligation-origin', 'Telemetry and Knowledge Model', 'Telemetry and Knowledge Model', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;
