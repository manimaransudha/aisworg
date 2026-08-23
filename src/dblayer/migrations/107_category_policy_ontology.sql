-- CR-061 — category:policy concepts. Owner: "category should be ontology
-- driven. The policy categories are in section 7. Seed these categories as
-- category:policy" — Chapter 24 §7's own 7 illustrative categories, a new
-- concept type of its own (not reused from category:evidence or
-- category:pack — confirmed independent, owner: "It does not change the
-- policy category. So I can have a customer sign off policy category
-- across any gate category").
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('category:policy', 'Engineering', 'Engineering', '11111111-1111-1111-1111-111111111111'),
  ('category:policy', 'Security', 'Security', '11111111-1111-1111-1111-111111111111'),
  ('category:policy', 'Quality', 'Quality', '11111111-1111-1111-1111-111111111111'),
  ('category:policy', 'Operational', 'Operational', '11111111-1111-1111-1111-111111111111'),
  ('category:policy', 'Documentation', 'Documentation', '11111111-1111-1111-1111-111111111111'),
  ('category:policy', 'Customer', 'Customer', '11111111-1111-1111-1111-111111111111'),
  ('category:policy', 'Organisation', 'Organisation', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;
