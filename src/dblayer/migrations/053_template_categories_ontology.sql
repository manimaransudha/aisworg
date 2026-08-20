-- Ontology (Ch.18) — template-categories concepts. Owner, 2026-08-19 (CR-021):
-- "Add a new concept type template-categories. The Values for this is from
-- the examples in Section 8 of chapter 6." Chapter 6 §8 ("Template
-- Categories") lists exactly these 9 examples, verbatim, closing with
-- "Additional categories may be introduced through Packs" — a data-driven
-- vocabulary was always the chapter's own intent, not a hardcoded enum.
--
-- Fresh, zero-consumer concept type (like capability-name/deliverable-name,
-- unlike category:pack/installation-classification) — no live
-- templates.code data uses any of these strings today (existing codes are
-- all UUID-ish test/bootstrap identifiers), so the standard lowercase-
-- hyphenated convention applies with no exception needed.
INSERT INTO ontology_concepts (concept_type, code, default_label) VALUES
  ('template-categories', 'enterprise-web-application', 'Enterprise Web Application'),
  ('template-categories', 'mobile-application', 'Mobile Application'),
  ('template-categories', 'api-platform', 'API Platform'),
  ('template-categories', 'legacy-modernisation', 'Legacy Modernisation'),
  ('template-categories', 'data-platform', 'Data Platform'),
  ('template-categories', 'ai-platform', 'AI Platform'),
  ('template-categories', 'embedded-software', 'Embedded Software'),
  ('template-categories', 'saas-product', 'SaaS Product'),
  ('template-categories', 'package-implementation', 'Package Implementation')
ON CONFLICT (concept_type, code) DO NOTHING;
