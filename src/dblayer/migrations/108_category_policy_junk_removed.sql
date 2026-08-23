-- CR-061 build-time fix — migration 030's original ontology_concepts seed
-- (long before Policy had any real design) already populated `category:policy`
-- with 10 stray values that don't belong to any real vocabulary: "Coding
-- Standard"/"Domain Standard"/"Domain"/"Exit"/"Implementation"/"Platform"/
-- "Technology" match nothing in Chapter 24 §7 (some read like leftover
-- Quality-Gate-category experimentation, e.g. "Exit"/"Platform", the same
-- wrong vocabulary CR-058 itself had to correct for category:quality-gate).
-- Migration 107's real 7-value seed (Engineering/Security/Quality/
-- Operational/Documentation/Customer/Organisation) coincidentally shares 3
-- codes with the old junk (Engineering/Quality/Documentation) — those stay,
-- unaffected. The remaining 7 stray codes are removed outright.
DELETE FROM ontology_concepts
 WHERE concept_type = 'category:policy'
   AND code IN ('Coding Standard', 'Domain Standard', 'Domain', 'Exit', 'Implementation', 'Platform', 'Technology');
