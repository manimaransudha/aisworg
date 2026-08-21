-- CR-049 Phase 2 — Chapter 15 §12's Derivation/Implementation/Decomposition
-- relationship types, Deliverable-to-Deliverable, Template-owned. Confirmed
-- (owner, 2026-08-21) genuinely gating-shaped, same table, not a parallel
-- structure — just one more dimension on the existing edge.
--
-- Default 'dependency' backfills every existing row (all of CR-039/041/043's
-- own edges, all 11 seeded Templates) with zero behaviour change.
ALTER TABLE dependency_definitions
  ADD COLUMN IF NOT EXISTS relationship_kind TEXT NOT NULL DEFAULT 'dependency';

ALTER TABLE dependency_definitions
  ADD CONSTRAINT dependency_definitions_relationship_kind_check
  CHECK (relationship_kind IN ('dependency', 'derivation', 'implementation', 'decomposition'));

-- relationship_kind joins the natural key — the same (owner, from, to) pair
-- authored under two different kinds must be tracked as two distinct rows,
-- not silently collapsed by the existing ON CONFLICT DO NOTHING (migration
-- 075) onto whichever kind was inserted first.
ALTER TABLE dependency_definitions DROP CONSTRAINT dependency_definitions_natural_key;
ALTER TABLE dependency_definitions ADD CONSTRAINT dependency_definitions_natural_key
  UNIQUE NULLS NOT DISTINCT (owning_entity_type, owning_entity_id, from_entity_type, from_name, from_state, to_entity_type, to_name, to_state, relationship_kind);
