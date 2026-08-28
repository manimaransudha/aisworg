-- Ontology (Ch.18) — two real `capability-name` concepts plus 24 test-only
-- twins.
--
-- Real bug fix: domain-ebook-library.pack.json and technology-nodejs.pack.json
-- both incorrectly declared `code: "development"` (evidently copy-pasted from
-- openup-development.pack.json) instead of their own distinct codes — a
-- latent 3-way Pack-code collision in real seed data (masked only because
-- neither file is wired into cleanSlate.ts's active pipeline yet). Their
-- `code` fields are corrected to match their own filenames; those codes need
-- a registered capability-name concept, same requirement every other real
-- Pack's code already has (validatePackSeed's assertCanonicalCategory check,
-- src/routes/seu/core/packs.ts). Same precedent as
-- 071_capability_name_sdlc_phases.sql.
--
-- Test-only twins: every real seed Pack (all 24 src/dblayer/seed/data/
-- *.pack.json files except the confirmed-dead core-engineering.pack.json) is
-- mirrored under src/dblayer/seed/data/test-fixtures/ with its `code`
-- prefixed `test-`, so tests that need "a real, Ontology-valid Pack code" to
-- author throwaway Pack-lifecycle fixtures against (e.g.
-- tests/sdk-authoring.test.ts) never again collide with — and silently
-- deprecate — the real, production-seeded Pack of the same name. Each test-
-- twin code needs its own capability-name concept for the exact same reason
-- as the real ones above.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('capability-name', 'domain-ebook-library', 'E-Book Library Domain Practices', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'technology-nodejs', 'Node.js Engineering Practices', '11111111-1111-1111-1111-111111111111'),

  ('capability-name', 'test-domain-ebook-library', 'Test: E-Book Library Domain Practices', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'test-architecture-solution-design', 'Test: Architecture (OpenUP Capability Pattern)', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'test-configuration-management', 'Test: Configuration & Change Management (OpenUP Capability Pattern)', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'test-development', 'Test: Development (OpenUP Capability Pattern)', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'test-project-management', 'Test: Project Management (OpenUP Capability Pattern)', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'test-requirements-analysis', 'Test: Requirements (OpenUP Capability Pattern)', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'test-testing-qa', 'Test: Test (OpenUP Capability Pattern)', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'test-vision-opportunity-framing', 'Test: Vision & Opportunity (SDLC Phase 0)', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'test-product-discovery', 'Test: Product Discovery (SDLC Phase 1)', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'test-experience-design', 'Test: Experience Design (SDLC Phase 2)', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'test-technical-architecture-discovery', 'Test: Technical Discovery & Architecture (SDLC Phase 3)', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'test-security-privacy-compliance', 'Test: Security, Privacy & Compliance (SDLC Phase 4)', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'test-platform-developer-experience', 'Test: Platform & Developer Experience (SDLC Phase 5)', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'test-backlog-release-planning', 'Test: Backlog & Release Planning (SDLC Phase 6)', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'test-implementation-engineering', 'Test: Implementation (SDLC Phase 7)', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'test-quality-engineering-hardening', 'Test: Quality Engineering & Hardening (SDLC Phase 8)', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'test-scale-performance-optimization', 'Test: Scale & Performance Optimization (SDLC Phase 9)', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'test-beta-early-access-management', 'Test: Beta / Early Access (SDLC Phase 10)', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'test-launch-management', 'Test: Launch (SDLC Phase 11)', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'test-hypercare-stabilization', 'Test: Hypercare & Stabilization (SDLC Phase 12)', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'test-growth-optimization', 'Test: Growth & Optimization (SDLC Phase 13)', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'test-internationalization-localization', 'Test: Internationalization & Localization (SDLC Phase 14)', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'test-ongoing-operations-governance', 'Test: Ongoing Operations & Governance (SDLC Phase 15)', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'test-technology-nodejs', 'Test: Node.js Engineering Practices', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;
