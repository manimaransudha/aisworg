-- Ontology (Ch.18) — 16 new `capability-name` concepts, one per SDLC phase
-- (owner, 2026-08-19: "design/fragments/sdlc-templates-main has the current
-- software engineering methodology. Map this into pack..."). Each of the 16
-- new sdlc-phase-NN-*.pack.json Packs declares its own top-level `code` from
-- this list (CR-020 Part 2, x-referential-source: "capability-name"), same
-- mechanism the 6 openup-*.pack.json Packs already use. Deliberately distinct
-- codes from the OpenUP/EPF set (architecture-solution-design, development,
-- etc.) even where a phase's theme overlaps an OpenUP discipline (e.g. Phase 3
-- vs the OpenUP Architecture pattern) — these are two independently-owned
-- Pack families, not meant to collide or merge identities.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('capability-name', 'vision-opportunity-framing', 'Vision & Opportunity Framing', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'product-discovery', 'Product Discovery', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'experience-design', 'Experience Design', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'technical-architecture-discovery', 'Technical Architecture & Discovery', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'security-privacy-compliance', 'Security, Privacy & Compliance', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'platform-developer-experience', 'Platform & Developer Experience', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'backlog-release-planning', 'Backlog & Release Planning', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'implementation-engineering', 'Implementation Engineering', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'quality-engineering-hardening', 'Quality Engineering & Hardening', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'scale-performance-optimization', 'Scale & Performance Optimization', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'beta-early-access-management', 'Beta / Early Access Management', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'launch-management', 'Launch Management', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'hypercare-stabilization', 'Hypercare & Stabilization', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'growth-optimization', 'Growth & Optimization', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'internationalization-localization', 'Internationalization & Localization', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'ongoing-operations-governance', 'Ongoing Operations & Governance', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;
