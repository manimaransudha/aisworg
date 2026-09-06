-- Follow-up to 169 — 145_pack_compliance_codes_picker.sql's own jsonb_set was
-- supposed to remove `contributionsCompliance` (the original raw-JSON
-- Compliance Frameworks/Requirements field) in the SAME statement that added
-- `contributionComplianceCodes` in its place, but 145 was never actually
-- applied against this database: confirmed live — `contributionsCompliance`
-- was still present with its original x-widget:"json" shape, while
-- `contributionComplianceCodes` (145's own replacement, which 169 then
-- correctly but silently no-op'd against) had never existed at all. This is
-- what was still rendering a bare "Compliance" vertical tab after 169 ran —
-- `labelizeContribution` strips the "contributions" (plural) prefix,
-- leaving just "Compliance" for this one field, unlike every other
-- contribution field's singular "contribution" prefix.
--
-- Removes it outright rather than replaying 145's own jsonb_set, since 169
-- already established the destination (`contributionComplianceCodes`)
-- shouldn't exist either — Compliance is a Pack category (§6.4) and Template
-- already has `compliancePackCodes[]`; no Pack-level Compliance contribution
-- field belongs here at all.
UPDATE schema_definitions
   SET schema = schema #- '{properties,contributionsCompliance}'
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
