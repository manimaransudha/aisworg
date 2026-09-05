-- Owner (2026-09-01): "Extend the canonical taxonomy — add
-- Compliance/Privacy/Ethics as new, permanent category:policy values."
-- Ch.24 §7's own canonical Policy Category set (CR-061, migration 107:
-- Engineering, Security, Quality, Operational, Documentation, Customer,
-- Organisation — 7) grows to 10. Found while wiring the 33 real Compliance
-- Packs: 31 of their policies used one of these three (Compliance ×26,
-- Privacy ×4, Ethics ×1), none canonical — recategorizing onto the existing
-- 7 was the other option considered; owner chose extending the taxonomy
-- instead. See Ch.24 §19's own build note for the record.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('category:policy', 'Compliance', 'Compliance', '11111111-1111-1111-1111-111111111111'),
  ('category:policy', 'Privacy', 'Privacy', '11111111-1111-1111-1111-111111111111'),
  ('category:policy', 'Ethics', 'Ethics', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;
