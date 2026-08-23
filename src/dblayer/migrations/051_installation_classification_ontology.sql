-- Ontology (Ch.18) — installation-classification concepts. Owner, 2026-08-19:
-- "Create a concept type installation-classification. This should have
-- values: Mandatory, Recommended, Optional, Conditional. The installation
-- classification dropdown on the form should come from this values. Schema
-- should have a referential-select to the ontology, no hardcoding."
--
-- Same Title-Case exception as category:pack (migration 049): these 4 codes
-- already live on ~440 real packs.installation_classification rows verbatim
-- ('Mandatory': 42, 'Optional': 396, 'Recommended': 6) and are checked by a
-- hardcoded PACK_CLASSIFICATIONS array (core/packs.ts) being retired in
-- favour of Ontology validation in this same change — keeping the exact
-- wording means every existing Pack's classification stays valid with zero
-- migration of Pack rows themselves.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('installation-classification', 'Mandatory', 'Mandatory', '11111111-1111-1111-1111-111111111111'),
  ('installation-classification', 'Recommended', 'Recommended', '11111111-1111-1111-1111-111111111111'),
  ('installation-classification', 'Optional', 'Optional', '11111111-1111-1111-1111-111111111111'),
  ('installation-classification', 'Conditional', 'Conditional', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;

-- CR-059 build-time fix — same class of bug as migrations 030/046:
-- superseded by migration 055's tenant-scoping (ON CONFLICT target
-- widened to (concept_type, code, tenant_id), tenant_id gained NOT NULL
-- with no column default). Explicit Platform tenant_id + the 3-column
-- ON CONFLICT restore both.
