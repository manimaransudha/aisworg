-- Owner: "complianceCodes - I think this can be removed. We have made
-- compliance a type of pack and this will be added in the templates packs."
-- `contributionComplianceCodes[]` (migration 145) let any Pack reference an
-- existing Compliance Pack's own compliance-name code inline, alongside its
-- own contributions — but Compliance is already a real, first-class Pack
-- category (§6.4; 33 real compliance-*.pack.json Packs), and the real
-- mechanism for "which Compliance Packs apply" is Template's own
-- category-scoped `compliancePackCodes[]` (mandatory) / Profile's own
-- (optional) — picking the WHOLE Pack, not re-declaring a reference to its
-- category tag from inside an unrelated Pack. `contributionComplianceCodes[]`
-- was a second, redundant path to the same relationship, one layer down
-- from where it actually belongs. Zero real pack.json files ever populated
-- it (confirmed directly) — nothing to migrate.
UPDATE schema_definitions
   SET schema = schema #- '{properties,contributionComplianceCodes}'
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
