-- CR-079 bug fix — registerTestOntologyCode (tests/testFixtures.ts) used to
-- mint a fresh, random-UUID-suffixed capability-name concept per test run
-- for a Pack's own top-level `code` — exactly the "test litter" pollution
-- CR-079 fixed capability-name of in the first place (44 of 85 live rows
-- were runtime-minted junk of this same shape). Owner: "the ontology was
-- updated with what test fixture needs. This should be removed. The source
-- of truth is what we fed through the migration files." Every one of these
-- tests already had a stable, descriptive prefix (only the random suffix was
-- ever the problem) — seeded here as real, permanent concepts under the
-- correct category-scoped vocabulary (never capability-name — none of these
-- are Capability contributions, they're every one of these tests' own Pack
-- identity). Per-run uniqueness moves to packVersion instead (Pack identity
-- is (code, packVersion, tenant_id), not code alone) — see
-- testFixtures.ts's new uniqueTestPackVersion().
--
-- engineering-name (every source test uses category: "Engineering").
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('engineering-name', 'test-comp-arity', 'Test: Composition Arity', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-comp-samecode', 'Test: Composition Same Code', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-comp-cd', 'Test: Composition Conflict Detection', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-compose-specialize-parent', 'Test: Compose Specialize Parent', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-compose-specialize-child', 'Test: Compose Specialize Child', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-compose-union-a', 'Test: Compose Union A', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-compose-union-b', 'Test: Compose Union B', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-compose-union-child', 'Test: Compose Union Child', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-compose-merge-shared', 'Test: Compose Merge Shared', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-compose-merge-child', 'Test: Compose Merge Child', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-compose-intersect-a', 'Test: Compose Intersect A', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-compose-intersect-b', 'Test: Compose Intersect B', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-compose-intersect-child', 'Test: Compose Intersect Child', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-compose-supplement-base', 'Test: Compose Supplement Base', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-compose-supplement-extra', 'Test: Compose Supplement Extra', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-compose-supplement-child', 'Test: Compose Supplement Child', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-compose-override', 'Test: Compose Override', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-compose-override-draft', 'Test: Compose Override Draft', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-compose-notdraft-parent', 'Test: Compose Not-Draft Parent', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-compose-mandatory', 'Test: Compose Mandatory', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-compose-optional', 'Test: Compose Optional', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-pack', 'Test: Pack', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-conflict', 'Test: Conflict', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-live-code', 'Test: Live Code', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-reactivate-supersede', 'Test: Reactivate Supersede', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-tenant-scoped', 'Test: Tenant Scoped', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-tenant-reactivate', 'Test: Tenant Reactivate', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'webflow-phase9-pack', 'Test: WebFlow Phase 9 Pack', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-sdk-pack', 'Test: SDK Pack', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;

-- organisation-name (governance-ebm-sharpening.test.ts's own two Packs use
-- category: "Organisation").
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('organisation-name', 'conflict-a', 'Test: Conflict A', '11111111-1111-1111-1111-111111111111'),
  ('organisation-name', 'conflict-b', 'Test: Conflict B', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;
