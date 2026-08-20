-- Ontology (Ch.18) — category:pack concepts. Owner, 2026-08-19: "create a
-- concept type category:pack. Add Compliance, Domain, Engineering,
-- Organisation, Domain, Integration and Technology." ("Domain" was listed
-- twice — deduped to one row.)
--
-- Case exception to the "lowercase, hyphenated" naming discipline used for
-- capability-name/deliverable-name: this concept type REPLACES the already-
-- live `pack_category` table (migration 013), whose codes are exactly this
-- Title-Case wording ("Compliance", "Domain", "Organisation", "Technology",
-- "Integration") and are already stored verbatim on ~370 real packs.category
-- rows AND compared byte-for-byte by the Dependencies picker's client-side
-- category filter (edit.ejs's dep-category-filter, strict !== match). Seeding
-- lowercase codes here would silently break that filter for every existing
-- Active Pack. Keeping the exact historical wording avoids that regression;
-- only "Engineering" is genuinely new (replacing "Platform", which the
-- owner's list drops — existing Platform-categorised packs are unaffected,
-- "Platform" just stops being offered for new Pack authoring, same
-- drops-out-of-new-picks treatment as capability-name's "architecture" fold).
INSERT INTO ontology_concepts (concept_type, code, default_label) VALUES
  ('category:pack', 'Compliance', 'Compliance'),
  ('category:pack', 'Domain', 'Domain'),
  ('category:pack', 'Engineering', 'Engineering'),
  ('category:pack', 'Organisation', 'Organisation'),
  ('category:pack', 'Integration', 'Integration'),
  ('category:pack', 'Technology', 'Technology')
ON CONFLICT (concept_type, code) DO NOTHING;
