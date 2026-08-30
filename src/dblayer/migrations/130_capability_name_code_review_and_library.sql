-- Ontology (Ch.18) — 3 new `capability-name` concepts, needed by CR-079 step
-- (c): contributionCapabilities[].code becomes a real, enforced Ontology
-- dropdown (see migration 131), so every real seed Pack's own declared
-- capability codes must already resolve. Auditing all 27 real seed files +
-- their test-fixture twins against the existing vocabulary found 3 gaps:
--
-- - `code-review` — technology-nodejs/technologyc/technologycpp each
--   declared a per-language variant (nodejs-code-review, c-code-review,
--   cpp-code-review) instead of a shared term; corrected in the same pass
--   this migration lands with (seed files conform to the Ontology, not the
--   reverse). Also anticipated directly by the owner's own CR-079 example:
--   "web-standards pack will be a technology pack contributing to
--   development and code-review capabilities."
-- - `catalog-management`, `circulation-management` — domain-ebook-library's
--   own two capabilities; real, distinct competencies with no existing
--   broader term to collapse into (unlike the per-language *-development
--   variants above, which do collapse into the existing `development`).
--
-- (The three *-development variants collapse into the already-real
-- `development` concept — no new concept needed for those.)
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('capability-name', 'code-review', 'Code Review', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'catalog-management', 'Catalog Management', '11111111-1111-1111-1111-111111111111'),
  ('capability-name', 'circulation-management', 'Circulation Management', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;
