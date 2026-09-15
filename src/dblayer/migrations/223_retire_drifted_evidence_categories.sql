-- Owner: "Correct the sql that populates this and remove the quality gate
-- filtering." Migration 030 originally seeded 'Validation'/'Review'/'Test'/
-- 'Technical' under category:evidence — shorthand duplicates of the real
-- category:evidence vocabulary (Ch.17 §7's 6 named categories), never
-- cleaned up. Fixed at the source in migration 030 itself (for a fresh
-- db:clean-slate); this retires the same 4 rows on a database that already
-- ran the old version of 030. Confirmed unused before retiring: `evidence`
-- has zero rows and every real `quality_gates.category` value already uses
-- the canonical name (Analytical Evidence/Review Evidence/Validation
-- Evidence) — nothing references these 4 codes.
UPDATE ontology_concepts
   SET status = 'Retired'
 WHERE concept_type = 'category:evidence'
   AND code IN ('Validation', 'Review', 'Test', 'Technical');
