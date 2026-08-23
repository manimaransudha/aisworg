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
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('category:pack', 'Compliance', 'Compliance', '11111111-1111-1111-1111-111111111111'),
  ('category:pack', 'Domain', 'Domain', '11111111-1111-1111-1111-111111111111'),
  ('category:pack', 'Engineering', 'Engineering', '11111111-1111-1111-1111-111111111111'),
  ('category:pack', 'Organisation', 'Organisation', '11111111-1111-1111-1111-111111111111'),
  ('category:pack', 'Integration', 'Integration', '11111111-1111-1111-1111-111111111111'),
  ('category:pack', 'Technology', 'Technology', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;

-- CR-059 build-time fix — same class of bug as migrations 030/046:
-- superseded by migration 055's tenant-scoping (ON CONFLICT target
-- widened to (concept_type, code, tenant_id), tenant_id gained NOT NULL
-- with no column default). Explicit Platform tenant_id + the 3-column
-- ON CONFLICT restore both.
