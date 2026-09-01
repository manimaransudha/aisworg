-- Ontology (Ch.18) — CR-079 step (a): six new, category-scoped Pack-identity
-- concept types (sibling to capability-name), one per current category:pack
-- value: domain-name, technology-name, compliance-name, organisation-name,
-- integration-name, engineering-name. Design (CR-079): a Pack's own top-level
-- `code` will be validated against its OWN category's vocabulary (step (b),
-- not built yet — validatePackSeed still checks capability-name
-- unconditionally today), never capability-name — a Pack is never itself a
-- capability, only something that CONTRIBUTES to one (CR-079's own
-- ICD10-vs-Patient-Admission-System example).
--
-- Seeded with every real Pack's own current code, grouped by its actual
-- category, plus each one's test-fixture twin where a real twin Pack row
-- exists — so that once step (b) ships, no real or test Pack's own code
-- breaks re-validating against its new, correctly-scoped vocabulary. Labels
-- reused verbatim from each Pack's own `name`. Excludes 3 confirmed
-- UUID-suffixed test-runtime Pack rows already resident in this dev DB
-- (webflow-phase9-pack-*, conflict-a-*, conflict-b-*) — pre-existing test
-- litter unrelated to this migration, not a real or fixture Pack to seed
-- for. No Integration-category Pack exists yet, so integration-name gets no
-- rows here — the same data-driven convention as every other concept type:
-- it simply doesn't exist until something references it.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('compliance-name', 'security-privacy-compliance', 'Security, Privacy & Compliance (SDLC Phase 4)', '11111111-1111-1111-1111-111111111111'),
  ('compliance-name', 'test-security-privacy-compliance', 'Security, Privacy & Compliance (SDLC Phase 4)', '11111111-1111-1111-1111-111111111111'),
  ('domain-name', 'domain-ebook-library', 'E-Book Library Domain Practices', '11111111-1111-1111-1111-111111111111'),
  ('domain-name', 'test-domain-ebook-library', 'E-Book Library Domain Practices', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'architecture-solution-design', 'Architecture (OpenUP Capability Pattern)', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'configuration-management', 'Configuration & Change Management (OpenUP Capability Pattern)', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'development', 'Development (OpenUP Capability Pattern)', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'experience-design', 'Experience Design (SDLC Phase 2)', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'hypercare-stabilization', 'Hypercare & Stabilization (SDLC Phase 12)', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'implementation-engineering', 'Implementation (SDLC Phase 7)', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'internationalization-localization', 'Internationalization & Localization (SDLC Phase 14)', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'launch-management', 'Launch (SDLC Phase 11)', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'ongoing-operations-governance', 'Ongoing Operations & Governance (SDLC Phase 15)', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'platform-developer-experience', 'Platform & Developer Experience (SDLC Phase 5)', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'project-management', 'Project Management (OpenUP Capability Pattern)', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'quality-engineering-hardening', 'Quality Engineering & Hardening (SDLC Phase 8)', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'requirements-analysis', 'Requirements (OpenUP Capability Pattern)', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'scale-performance-optimization', 'Scale & Performance Optimization (SDLC Phase 9)', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'technical-architecture-discovery', 'Technical Discovery & Architecture (SDLC Phase 3)', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-configuration-management', 'Configuration & Change Management (OpenUP Capability Pattern)', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-experience-design', 'Experience Design (SDLC Phase 2)', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-hypercare-stabilization', 'Hypercare & Stabilization (SDLC Phase 12)', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-implementation-engineering', 'Implementation (SDLC Phase 7)', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-internationalization-localization', 'Internationalization & Localization (SDLC Phase 14)', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-launch-management', 'Launch (SDLC Phase 11)', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-ongoing-operations-governance', 'Ongoing Operations & Governance (SDLC Phase 15)', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-platform-developer-experience', 'Platform & Developer Experience (SDLC Phase 5)', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-project-management', 'Project Management (OpenUP Capability Pattern)', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-quality-engineering-hardening', 'Quality Engineering & Hardening (SDLC Phase 8)', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-scale-performance-optimization', 'Scale & Performance Optimization (SDLC Phase 9)', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-technical-architecture-discovery', 'Technical Discovery & Architecture (SDLC Phase 3)', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'test-testing-qa', 'Test (OpenUP Capability Pattern)', '11111111-1111-1111-1111-111111111111'),
  ('engineering-name', 'testing-qa', 'Test (OpenUP Capability Pattern)', '11111111-1111-1111-1111-111111111111'),
  ('organisation-name', 'backlog-release-planning', 'Backlog & Release Planning (SDLC Phase 6)', '11111111-1111-1111-1111-111111111111'),
  ('organisation-name', 'beta-early-access-management', 'Beta / Early Access (SDLC Phase 10)', '11111111-1111-1111-1111-111111111111'),
  ('organisation-name', 'growth-optimization', 'Growth & Optimization (SDLC Phase 13)', '11111111-1111-1111-1111-111111111111'),
  ('organisation-name', 'product-discovery', 'Product Discovery (SDLC Phase 1)', '11111111-1111-1111-1111-111111111111'),
  ('organisation-name', 'test-backlog-release-planning', 'Backlog & Release Planning (SDLC Phase 6)', '11111111-1111-1111-1111-111111111111'),
  ('organisation-name', 'test-beta-early-access-management', 'Beta / Early Access (SDLC Phase 10)', '11111111-1111-1111-1111-111111111111'),
  ('organisation-name', 'test-growth-optimization', 'Growth & Optimization (SDLC Phase 13)', '11111111-1111-1111-1111-111111111111'),
  ('organisation-name', 'test-product-discovery', 'Product Discovery (SDLC Phase 1)', '11111111-1111-1111-1111-111111111111'),
  ('organisation-name', 'test-vision-opportunity-framing', 'Vision & Opportunity (SDLC Phase 0)', '11111111-1111-1111-1111-111111111111'),
  ('organisation-name', 'vision-opportunity-framing', 'Vision & Opportunity (SDLC Phase 0)', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'technology-c', 'C Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'technology-cpp', 'C++ Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'technology-css', 'Cascading Style Sheets Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'technology-git', 'Git Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'technology-html', 'HTML Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'technology-js', 'JavaScript Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'technology-nodejs', 'Node.js Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'technology-php', 'PHP Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'technology-react', 'React Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'technology-react-native', 'React Native Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'technology-sass', 'SASS Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'technology-rust', 'Rust Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'technology-rails', 'Ruby on Rails Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'technology-oracle', 'Oracle Database Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'technology-db2', 'IBM DB2 Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'technology-cobol', 'COBOL Mainframe Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'technology-python', 'Python Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'technology-java', 'Java Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'technology-go', 'Go Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'technology-csharp', 'C# .NET Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'technology-swift', 'Swift iOS Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'technology-kotlin', 'Kotlin Android Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'technology-docker', 'Docker Containerization Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'technology-kubernetes', 'Kubernetes Cloud-Native Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'technology-sql', 'SQL Database Engineering Practices', '11111111-1111-1111-1111-111111111111'),
  ('technology-name', 'test-technology-nodejs', 'Node.js Engineering Practices', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;

