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
-- it.
--
-- CR-059 build-time fix — this "keep every migration declaring the same
-- final set" discipline was itself superseded by migration 036 (CR-006):
-- the noun vocabulary became data (authority_nouns), so the hardcoded CHECK
-- is retired there permanently ("the constraint stays dropped" — entity_type
-- is validated against active authority_nouns at the app layer instead).
-- Nobody removed this transient DROP+ADD afterward, so replaying from an
-- empty database against real accumulated data (which now legitimately
-- includes 'Template'/'Profile' rows, added long after 036 dropped the
-- constraint) failed here regardless of what 036 does later — this file's
-- own ADD runs first and rejects rows the final, correct state has no
-- opinion on at all. Removed outright rather than widened again, matching
-- 036's own already-settled intent.

CREATE INDEX IF NOT EXISTS idx_objectives_parent ON objectives (parent_objective_id);
CREATE INDEX IF NOT EXISTS idx_objectives_status ON objectives (status);
