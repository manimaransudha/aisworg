-- CR-099 follow-up — migration 196's backfill scan missed 2 real Technology
-- Packs: `technologyc.pack.json` / `technologycpp.pack.json` (codes
-- `technology-c` / `technology-cpp`) don't follow the hyphenated
-- `technology-<name>.pack.json` filename convention every other Technology
-- Pack uses, so a `technology-*.pack.json` glob never found them. Caught by
-- `validatePackSeed`'s own new mandatory-competency check doing exactly its
-- job: "[seed:domain-technology-packs] 2 of 26 Packs failed... a Technology
-- Pack must declare at least one Competency." Both pack.json files now
-- declare their own `contributionCompetencies`; this migration seeds the
-- two missing `technology` concept values those entries reference.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id, text_type, ui_grouping) VALUES
  ('technology', 'c', 'C', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies'),
  ('technology', 'cpp', 'C++', '11111111-1111-1111-1111-111111111111', 'text', 'Competencies')
ON CONFLICT (concept_type, code, tenant_id, version) DO NOTHING;
