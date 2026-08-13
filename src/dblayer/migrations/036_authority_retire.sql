-- CR-007 Step 2 — soft-retire for the authority config (never delete/rename).
--
-- Nouns/verbs already carry `is_active` (035). The mapping and the transition
-- definitions did not — add it here so any of the four can be RETIRED: the row
-- stays (existing data keeps working, all FKs intact) but drops out of the
-- "add new" pickers, and a retired transition edge can no longer be traversed.
-- Additive + idempotent; nothing is ever dropped or renamed.

ALTER TABLE authority_noun_verbs   ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE transition_definitions ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Extra column on transition_definitions only: WHEN the edge was retired.
-- Used ONLY by findPossibleNextStates to grandfather an in-progress SEU — an
-- SEU created before an edge was retired may still see/traverse it; an SEU
-- created after cannot. is_active stays as the plain retire flag; retired_at is
-- set alongside it (NULL while active). (owner, 2026-08-13)
ALTER TABLE transition_definitions ADD COLUMN IF NOT EXISTS retired_at TIMESTAMPTZ;

-- CR-006: the noun vocabulary is now data (authority_nouns), so the hardcoded
-- entity_type CHECK that every prior migration hand-widened is retired — a new
-- noun (Document, Certificate…) can now carry transitions without a migration.
-- The app validates entity_type against active authority_nouns instead (core
-- addTransitionDefinition). This runs after 028 (the last migration to (re)add
-- the constraint) and is the final migration, so the constraint stays dropped.
ALTER TABLE transition_definitions DROP CONSTRAINT IF EXISTS transition_definitions_entity_type_check;
