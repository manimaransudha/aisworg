-- CR-079 bug fix follow-up — migration 134 missed one: pack-sdk.test.ts's
-- own "publishing a new version of an existing Pack code..." test used the
-- SAME dynamic prefix ("test-pack") as freshPackSeed's own default, relying
-- on each call's random UUID suffix to keep them from colliding. Now that
-- both are stable, fixed codes (per migration 134's own reasoning), they
-- need to be two DIFFERENT names, not one shared one — this test gets its
-- own.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('engineering-name', 'test-pack-versioning', 'Test: Pack Versioning', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;
