-- Post-MVP Phase 1 — Formalize Objective.
-- objectives.tier/parent_objective_id/status/version already exist from
-- 002_seu_platform.sql; this migration only extends transition_definitions
-- to admit 'Objective' as a governed entity_type, so Objective's lifecycle
-- (Proposed -> Active -> Achieved/Superseded/Retired -> Archived, Ch.1) runs
-- through the same generic transitionEngine as SEU and Deliverable already do
-- — not a bespoke mechanism.

-- Post-MVP Phase 5 fix: this CHECK's value list is kept as the full union of
-- every entity_type this constraint will ever need (matching 006/007), not
-- just what 'Objective' support alone required. DROP+ADD CONSTRAINT is not
-- safe to blindly re-run with a *narrower* list than a later migration
-- already widened it to — run.ts re-applies every migration file in order on
-- every invocation, and by the time this migration is re-run against a
-- database that has since been seeded with real 'Obligation'/'Evidence'/
-- 'Knowledge'/'Decision' rows (added by 006/007), re-narrowing to only
-- ('SEU','Deliverable','Objective') fails outright — existing rows violate
-- it. Keeping every migration that touches this constraint declaring the
-- same final set makes DROP+ADD a true no-op regardless of run order or how
-- much data already exists, restoring the "safe to run repeatedly" contract
-- run.ts's own header comment promises.
ALTER TABLE transition_definitions DROP CONSTRAINT IF EXISTS transition_definitions_entity_type_check;
ALTER TABLE transition_definitions ADD CONSTRAINT transition_definitions_entity_type_check
  CHECK (entity_type IN ('SEU', 'Deliverable', 'Objective', 'Obligation', 'Evidence', 'Knowledge', 'Decision', 'KnowledgeScope', 'AttentionItem', 'ExternalInteraction', 'Pack', 'Participant'));

CREATE INDEX IF NOT EXISTS idx_objectives_parent ON objectives (parent_objective_id);
CREATE INDEX IF NOT EXISTS idx_objectives_status ON objectives (status);
