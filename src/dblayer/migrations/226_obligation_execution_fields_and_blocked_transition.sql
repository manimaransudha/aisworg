-- CR-106 Option C, step 1 — Obligation Model (Ch.23 §8) execution-side gap
-- closure. The Definition-side shape (Policy's conditions[].relatedObligations[],
-- Pack's contributionObligationDefinitions[]) already carries origin/priority/
-- completionCriteria (migration 222/224, seuTypes.ts's ObligationDefinition);
-- the real `obligations` execution row never got the matching columns. Adding
-- them now because Option C's own step 1 ("raise a real Obligation... describing
-- what's needed, drawn from the blocking Policy/Gate itself") needs somewhere
-- real to put that content — Category/Title/Description/Severity/Status
-- already existed; Origin/Priority/Completion Criteria did not.
-- Nullable: every existing Obligation predates this and has none of these —
-- same "grandfathered, not backfilled" treatment the rest of this platform's
-- additive migrations already use.
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS origin TEXT;
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS completion_criteria TEXT;

-- Option C, step 3/4 — which governed transition this Obligation is blocking,
-- so the resolution-triggered retry (the new event subscriber) knows exactly
-- what to re-attempt without re-deriving it from the entity's current state
-- (fragile — many entities have multiple possible next states) or re-running
-- a whole non-idempotent commissioning cascade. NULL for every Obligation not
-- raised from a blocked transition (Telemetry/Knowledge-promotion origins,
-- the pre-existing majority) — this pair only gets set by
-- raiseObligationForBlockedTransition (routes/seu/core/obligations.ts).
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS blocked_from_state TEXT;
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS blocked_to_state TEXT;
