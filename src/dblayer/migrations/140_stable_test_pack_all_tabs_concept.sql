-- CR-081 follow-up — owner: "Create atleast one pack seed json which has all
-- the tabs populated." test-pack-all-tabs.pack.json needs its own dedicated,
-- stable Pack code (same discipline as migrations 134-139: a real, permanent
-- engineering-name concept, not a dynamically-minted one) — this fixture is
-- loaded on every clean-slate run via publishPack/createPackDraft, which
-- (unlike createAuthoringDraft's web-authoring path) requires the code to
-- already be a registered Ontology concept before it can publish.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('engineering-name', 'test-pack-all-tabs', 'Test: All Tabs Populated', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'legacy-knowledge-recovery', 'Knowledge Recovery from Legacy Systems', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'ai-model-engineering', 'AI Model Engineering', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'embedded-firmware-engineering', 'Embedded Firmware Engineering', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'data-pipeline-engineering', 'Data Pipeline Engineering', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;
