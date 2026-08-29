-- CR-068 deferred this deliberately ("the schema does not need the
-- constraint — it has to be imposed by the app"), enforced only in
-- createObjective. Owner (2026-08-28, after CR-073's transition work):
-- promote it to a real DB constraint now — every real caller already
-- guarantees a non-null requestedBy, and no existing row violates it.
ALTER TABLE objectives ALTER COLUMN requested_by SET NOT NULL;
