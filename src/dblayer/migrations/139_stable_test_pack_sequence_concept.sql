-- CR-081 — pack-sdk.test.ts's new "packCodeVersionSummaries: version is a
-- sequence per code" test needs its own dedicated, stable Pack code (same
-- discipline as migrations 134-138: a real, permanent engineering-name
-- concept, not a dynamically-minted one).
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('engineering-name', 'test-pack-sequence', 'Test: Pack Version Sequence', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;
