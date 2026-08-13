-- CR-009 — a parent is mandatory for Operational and Engineering Objectives;
-- only Strategic may be a root (parentless). Backend createObjective enforces
-- this with a friendly error; this is the race-free DB backstop.

-- Guard pre-CR-009 dev data: any orphan Operational/Engineering row would make
-- the CHECK fail to add. Promote such orphans to Strategic roots (data-preserving,
-- reversible by re-parenting), so the constraint can be applied. In practice
-- db:clean_slate wipes and reseeds objectives, so this rarely bites — it exists
-- only so an existing dev DB can migrate forward without manual surgery.
UPDATE objectives
   SET tier = 'Strategic', updated_at = NOW()
 WHERE parent_objective_id IS NULL
   AND tier IN ('Operational', 'Engineering');

-- Idempotent: drop-then-add so re-running the runner is safe.
ALTER TABLE objectives DROP CONSTRAINT IF EXISTS objectives_parent_required_chk;
ALTER TABLE objectives
  ADD CONSTRAINT objectives_parent_required_chk
  CHECK (tier = 'Strategic' OR parent_objective_id IS NOT NULL);
