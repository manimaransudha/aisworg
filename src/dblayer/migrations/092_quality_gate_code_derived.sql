-- CR-058 follow-up — owner: "code in the quality form should not be a text
-- field." A Quality Gate contribution's real identity is (governedTransition,
-- category) — the exact pair the active-slot uniqueness (migration 091)
-- already keys on — so an independently author-typed `code` was a redundant
-- second identity that could disagree with the slot (the exact collision
-- case core/packs.ts guarded against). Same treatment CR-038 gave
-- TemplateDeliverableSeed's own `code` ("dropped outright... nothing
-- functional ever needed a separate identifier once the real identity
-- fields exist"). core/packs.ts's deriveQualityGateCode computes it
-- deterministically from governedTransition + category — deterministic
-- matters specifically because qualityGatesDB.upsert's versioning keys on
-- `code` staying stable across republishes of the same Pack.
UPDATE schema_definitions
   SET schema = schema #- '{properties,contributionQualityGates,items,properties,code}'
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
