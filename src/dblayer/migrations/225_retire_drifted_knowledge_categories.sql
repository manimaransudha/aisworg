-- Owner: "Correct the sql loading the category:knowledge ontology." Migration
-- 030 originally seeded 'Domain Knowledge'/'Technical Knowledge'/'Technical'/
-- 'Test' under category:knowledge — a de-facto vocabulary never matching
-- Ch.16 §7's 6 named categories (Architectural/Domain/Technical/Operational/
-- Governance/Process Knowledge). Fixed at the source in migration 030 itself
-- (for a fresh db:clean-slate); this retires the 2 drifted rows on a database
-- that already ran the old version of 030. 'Domain Knowledge' and 'Technical
-- Knowledge' are kept — they already match the chapter's real vocabulary.
UPDATE ontology_concepts
   SET status = 'Retired'
 WHERE concept_type = 'category:knowledge'
   AND code IN ('Technical', 'Test');
