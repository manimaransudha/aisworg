-- CR-104 — EBM must materialise its own composition, the same discipline
-- composed_packs and behaviors.competencyRequirements already established
-- (compositionCompleted.ts). Quality Gates and Policies were being resolved
-- either by a bare, cross-composition (entity_type, from_state, to_state)
-- match (Quality Gate's real, live findAllActive path — matches every SEU
-- platform-wide regardless of which Packs it actually composed) or not
-- resolved live at all (Policy — no live lookup existed). Both now get a
-- real, inspectable, per-EBM materialised list, computed once at EBM
-- creation (compositionCompleted.ts) from the composed Packs' own
-- originating_pack_id, not re-derived on every transition attempt.
ALTER TABLE ebms
  ADD COLUMN IF NOT EXISTS applicable_quality_gate_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS applicable_policy_ids UUID[] NOT NULL DEFAULT '{}';

-- CR-104 — a Quality Gate may target specific Deliverables by name (e.g. a
-- customer signoff gate on only the first Deliverable's kickoff), not every
-- Deliverable that happens to share the same (entity_type, from_state,
-- to_state). Empty array (default) = applies to every Deliverable on that
-- transition, same as today's behaviour — additive, not a breaking change.
-- Mirrors policy_definitions.applicability_deliverable_names exactly (same
-- shape, same deliverable-name Ontology vocabulary), not a new convention.
ALTER TABLE quality_gates
  ADD COLUMN IF NOT EXISTS applicability_deliverable_names TEXT[] NOT NULL DEFAULT '{}';
