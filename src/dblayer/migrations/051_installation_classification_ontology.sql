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
INSERT INTO ontology_concepts (concept_type, code, default_label) VALUES
  ('installation-classification', 'Mandatory', 'Mandatory'),
  ('installation-classification', 'Recommended', 'Recommended'),
  ('installation-classification', 'Optional', 'Optional'),
  ('installation-classification', 'Conditional', 'Conditional')
ON CONFLICT (concept_type, code) DO NOTHING;
