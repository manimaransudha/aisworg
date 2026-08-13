-- CR-002 — enforce "at most one SEU per Objective" (Chapter 1 §18.2).
-- The 1:1 SEU↔Objective model already has seus.objective_id NOT NULL (one
-- Objective per SEU). This adds the other direction: a unique index so an
-- Objective cannot be commissioned twice, enforced by the database rather than
-- an application check (which would race). Idempotent via IF NOT EXISTS.
--
-- The Engineering-tier invariant (§18.2) is enforced at commissioning in
-- core/commissioning.ts (a clear rejection), not in the schema, for a friendly
-- error path — see CR-002.
CREATE UNIQUE INDEX IF NOT EXISTS idx_seus_objective_id_unique ON seus (objective_id);
