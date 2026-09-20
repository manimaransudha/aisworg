-- Chapter 19 §7 Decision Categories — the live category:decision seed
-- (migration 030) only registers 2 of the chapter's 5 named categories
-- (Engineering Decisions, Design Decisions). Adding the remaining 3 here:
-- Architecture Decisions, Operational Decisions, Governance Decisions.
-- ontology_concepts_type_code_tenant_version_unique (migration 190) is the
-- real constraint — (concept_type, code, tenant_id, version) — ON CONFLICT
-- must name it exactly (migration 199/229's own precedent).
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('category:decision', 'Architecture Decisions', 'Architecture Decisions', '11111111-1111-1111-1111-111111111111'),
  ('category:decision', 'Operational Decisions', 'Operational Decisions', '11111111-1111-1111-1111-111111111111'),
  ('category:decision', 'Governance Decisions', 'Governance Decisions', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id, version) DO NOTHING;
