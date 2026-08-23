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
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('template-categories', 'enterprise-web-application', 'Enterprise Web Application', '11111111-1111-1111-1111-111111111111'),
  ('template-categories', 'mobile-application', 'Mobile Application', '11111111-1111-1111-1111-111111111111'),
  ('template-categories', 'api-platform', 'API Platform', '11111111-1111-1111-1111-111111111111'),
  ('template-categories', 'legacy-modernisation', 'Legacy Modernisation', '11111111-1111-1111-1111-111111111111'),
  ('template-categories', 'data-platform', 'Data Platform', '11111111-1111-1111-1111-111111111111'),
  ('template-categories', 'ai-platform', 'AI Platform', '11111111-1111-1111-1111-111111111111'),
  ('template-categories', 'embedded-software', 'Embedded Software', '11111111-1111-1111-1111-111111111111'),
  ('template-categories', 'saas-product', 'SaaS Product', '11111111-1111-1111-1111-111111111111'),
  ('template-categories', 'package-implementation', 'Package Implementation', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;

-- CR-059 build-time fix — same class of bug as migrations 030/046:
-- superseded by migration 055's tenant-scoping (ON CONFLICT target
-- widened to (concept_type, code, tenant_id), tenant_id gained NOT NULL
-- with no column default). Explicit Platform tenant_id + the 3-column
-- ON CONFLICT restore both.
