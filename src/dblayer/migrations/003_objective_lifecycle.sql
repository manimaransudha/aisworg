-- Post-MVP Phase 1 — Formalize Objective.
-- objectives.tier/parent_objective_id/status/version already exist from
-- 002_seu_platform.sql; this migration only extends transition_definitions
-- to admit 'Objective' as a governed entity_type, so Objective's lifecycle
-- (Proposed -> Active -> Achieved/Superseded/Retired -> Archived, Ch.1) runs
-- through the same generic transitionEngine as SEU and Deliverable already do
-- — not a bespoke mechanism.

ALTER TABLE transition_definitions DROP CONSTRAINT IF EXISTS transition_definitions_entity_type_check;
ALTER TABLE transition_definitions ADD CONSTRAINT transition_definitions_entity_type_check
  CHECK (entity_type IN ('SEU', 'Deliverable', 'Objective'));

CREATE INDEX IF NOT EXISTS idx_objectives_parent ON objectives (parent_objective_id);
CREATE INDEX IF NOT EXISTS idx_objectives_status ON objectives (status);
