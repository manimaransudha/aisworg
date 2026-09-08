-- "At most one SEU per Objective" (Chapter 1 §18.2) is reframed as "at most
-- one ACTIVE SEU per Objective" (design/mvp-build-plan/SEU Composition.md,
-- "Retry after a failed commission" — owner: "so uniqueness has to be on an
-- active seu... not on any other previous state"). The prior, unconditional
-- index (migration 034) permanently blocked re-commissioning an Objective
-- whose SEU either failed early (the new 'Failed' state, migration 177) or
-- fully completed its life (reached 'Archived') — both are now excluded from
-- the uniqueness check, not just the new failure case. Chapter 1 §18.9
-- ("Open: SEU decommissioning semantics") flagged this exact class of
-- question as undecided ("to be detailed separately before it is relied
-- upon"); this is that detailing.
DROP INDEX IF EXISTS idx_seus_objective_id_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_seus_objective_id_active_unique ON seus (objective_id)
  WHERE lifecycle_state IN ('Pending', 'Commissioned', 'Configured', 'Activated', 'Operational', 'Suspended');
