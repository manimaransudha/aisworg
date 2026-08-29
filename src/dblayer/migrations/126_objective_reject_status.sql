-- CR-073: Active -> Reject is a real, distinct status (owner: "There is no
-- Active -> Proposed. It is Active to Reject" — not "Rejected", not a reuse
-- of "Proposed"). Only reachable from Active, badge-gated on its own
-- objective_reject badge (owner: "A verb cannot denote two different
-- transitions" — not a reuse of Activate's), event ObjectiveRejected.
ALTER TABLE objectives DROP CONSTRAINT objectives_status_check;
ALTER TABLE objectives ADD CONSTRAINT objectives_status_check
  CHECK (status = ANY (ARRAY['Proposed', 'Active', 'Achieved', 'Superseded', 'Retired', 'Archived', 'Reject']));
