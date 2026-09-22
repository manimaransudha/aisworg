-- Ontology data seed (owner request, 2026-09-22): two new concept_types for
-- the admin-surface badges superseding the removed Authoring (noun x verb)
-- catalog section — "This is now handled differently."
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('badges:platform', 'identity_manage', 'Identity Manage', '11111111-1111-1111-1111-111111111111'),
  ('badges:platform', 'tenant_manage', 'Tenant Manage', '11111111-1111-1111-1111-111111111111'),
  ('badges:platform', 'ontology_manage', 'Ontology Manage', '11111111-1111-1111-1111-111111111111'),
  ('badges:platform', 'platform_manage', 'Platform Manage', '11111111-1111-1111-1111-111111111111'),
  ('badges:tenant', 'identity_manage', 'Identity Manage', '11111111-1111-1111-1111-111111111111'),
  ('badges:tenant', 'platform_manage', 'Platform Manage', '11111111-1111-1111-1111-111111111111'),
  ('badges:tenant', 'ontology_manage', 'Ontology Manage', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id, version) DO NOTHING;
