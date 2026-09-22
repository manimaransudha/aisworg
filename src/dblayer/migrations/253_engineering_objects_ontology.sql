-- Ontology data seed (owner request, 2026-09-22): a new concept_type
-- "engineering-objects" naming the platform's engineering object codes.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('engineering-objects', 'deliverable', 'Deliverable', '11111111-1111-1111-1111-111111111111'),
  ('engineering-objects', 'decision', 'Decision', '11111111-1111-1111-1111-111111111111'),
  ('engineering-objects', 'evidence', 'Evidence', '11111111-1111-1111-1111-111111111111'),
  ('engineering-objects', 'finding', 'Finding', '11111111-1111-1111-1111-111111111111'),
  ('engineering-objects', 'risk', 'Risk', '11111111-1111-1111-1111-111111111111'),
  ('engineering-objects', 'knowledge', 'Knowledge', '11111111-1111-1111-1111-111111111111'),
  ('engineering-objects', 'obligation', 'Obligation', '11111111-1111-1111-1111-111111111111'),
  ('engineering-objects', 'waiver', 'Waiver', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id, version) DO NOTHING;
