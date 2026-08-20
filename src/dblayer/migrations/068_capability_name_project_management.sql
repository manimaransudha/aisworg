-- Ontology (Ch.18) — `capability-name` was missing a `project-management`
-- concept. Owner, 2026-08-19: "I am viewing the Development (OpenUP
-- Capability Pattern) from the seed data. the Code value is not correct" —
-- investigating found all six openup-*.pack.json seed Packs still carry
-- their pre-CR-020-Part-2 `code` values ("openup-development", etc.), never
-- updated to the real, Ontology-rooted `capability-name` concept CR-020
-- Part 2 made `code` require (Ch.18, x-referential-source: "capability-name").
-- Five of the six have an obvious existing match (development,
-- architecture-solution-design, configuration-management,
-- requirements-analysis, testing-qa) — Project Management does not, so it's
-- added here as a real concept before openup-project-management.pack.json's
-- own code is corrected to use it.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('capability-name', 'project-management', 'Project Management', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;
