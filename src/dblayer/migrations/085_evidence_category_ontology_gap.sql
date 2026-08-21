-- Chapter 17 §7/§20 bug fix (owner, 2026-08-21, reviewing the chapter's own
-- fresh implementation audit) — the Evidence collection form
-- (views/seu/seus/detail.ejs) offers all 6 of the chapter's own named
-- categories, but 030_ontology.sql only ever seeded 2 of them
-- ("Validation Evidence", "Analytical Evidence") under category:evidence.
-- Selecting any of the other 4 in the real form throws at submission
-- (assertCanonicalCategory rejects anything not seeded as active) — a live
-- bug, not a hypothetical gap. The 4 missing values, matching the form's own
-- literal option text exactly.
--
-- Not part of db:clean-slate's own reseed cycle — ontology_concepts is
-- vocabulary, not usage data, and clean-slate never truncates or reseeds it
-- (confirmed: no mention of it anywhere in cleanSlate.ts). This migration,
-- applied once, is the correct and only mechanism, same as 030_ontology.sql
-- itself and CR-049's own 084_backfill migration.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('category:evidence', 'Operational Evidence', 'Operational Evidence', '11111111-1111-1111-1111-111111111111'),
  ('category:evidence', 'Review Evidence', 'Review Evidence', '11111111-1111-1111-1111-111111111111'),
  ('category:evidence', 'Decision Evidence', 'Decision Evidence', '11111111-1111-1111-1111-111111111111'),
  ('category:evidence', 'External Evidence', 'External Evidence', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;
