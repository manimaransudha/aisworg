-- CR-079 bug fix follow-up — migration 134 also missed this one: pack-sdk.test.ts's
-- "compositionEngine.compose excludes a Pack code with no Active Version..." test
-- calls freshPackSeed() twice with no override (once for a Pack meant to go
-- Archived/no-Active-Version, once for a Pack meant to stay Active), relying on
-- each call's random UUID suffix to make them two DIFFERENT Pack codes. Now that
-- freshPackSeed()'s default code is a stable, fixed literal ("test-pack"), both
-- calls produce the SAME code, so the Template's mandatory set and the Profile's
-- optional set name the same code — composition then reports "contributed more
-- than once" instead of exercising the intended "no Active Version" path. This
-- test gets its own two dedicated, distinct identities.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('engineering-name', 'test-pack-no-active-version', 'Test: Pack No Active Version', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-pack-still-active', 'Test: Pack Still Active', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;
