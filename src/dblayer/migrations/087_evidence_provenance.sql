-- CR-051 item 3 (Ch.17 §12/§20.10) — Evidence Provenance. "Every Evidence
-- Item shall preserve: originating SEU; originating Deliverable; originating
-- Participant; originating Capability; originating Decision; originating
-- engineering activity." originating SEU already exists as evidence.seu_id.
-- The remaining five are added here, all nullable — provenance is captured
-- when known at creation time, not required (older flows and External
-- Evidence in particular may not have all of it).
ALTER TABLE evidence
  ADD COLUMN originating_deliverable_id UUID REFERENCES deliverables(id),
  ADD COLUMN originating_participant_id UUID REFERENCES participants(id),
  ADD COLUMN originating_capability_id UUID REFERENCES capabilities(id),
  ADD COLUMN originating_decision_id UUID REFERENCES decisions(id),
  ADD COLUMN originating_activity TEXT;

-- Backfill originating_deliverable_id from each Evidence row's earliest
-- Deliverable-type relationship (086_evidence_relationships.sql), matching
-- the historical single-pointer semantics every pre-existing row was created
-- under.
UPDATE evidence e
SET originating_deliverable_id = r.related_object_id
FROM (
  SELECT DISTINCT ON (evidence_id) evidence_id, related_object_id
  FROM evidence_relationships
  WHERE related_object_type = 'Deliverable'
  ORDER BY evidence_id, created_at
) r
WHERE r.evidence_id = e.id;
