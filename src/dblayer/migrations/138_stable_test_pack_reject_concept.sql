-- CR-080 — pack-sdk.test.ts's new "Pack reject (Validated -> Draft) requires
-- a genuinely new comment every time" test needs its own dedicated, stable
-- Pack code (same discipline as migrations 134/135/136: a real, permanent
-- engineering-name concept, not a dynamically-minted one — CR-079's own
-- "the source of truth is what we fed through the migration files").
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('engineering-name', 'test-pack-reject', 'Test: Pack Reject', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;
