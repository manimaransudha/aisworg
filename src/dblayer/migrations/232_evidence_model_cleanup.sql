-- Chapter 17 Evidence Model cleanup, this session's design pass:
--
--   seu_id (scalar column) retired — SEU membership becomes one more
--   evidence_relationships row (related_object_type = 'SEU'), the same
--   generic mechanism Evidence already uses for Deliverable/Decision/etc.
--   No dedicated column needed for it any more than for any other relation.
--
--   originating_deliverable_id/participant_id/capability_id/decision_id/
--   activity all retired. Owner: "Evidence does not need anything. Evidence
--   is required by others." Provenance for Deliverable/Participant/
--   Capability/Decision is expressed the same way as everything else
--   Evidence relates to — evidence_relationships rows — not a bespoke FK
--   column per originating type. This does not abandon Ch.17 §12's
--   provenance requirement; it changes the mechanism, not the guarantee
--   (owner: "it is not reversing anything. The implementation is
--   changing."). originating_activity (free text, not an entity reference)
--   is dropped with no replacement.
--
--   confidence_level becomes Ontology-driven (evidence-confidence-level)
--   AND computed, not author-set free text — the output of evaluating
--   validation_dimensions below, not an input. Nullable now (was NOT NULL
--   DEFAULT 'Medium') — no value exists until a computation has actually
--   run.
--
--   validation_dimensions (new): JSONB array of {dimension, status, notes,
--   assessedAt}, APPEND-ONLY. Owner: "the same row gets updated without a
--   new version, all historical notes have to be saved on the same
--   record" — Validated->Accepted->Referenced->Archived share one row with
--   no new version minted at each hop (unlike Collected->Validated, which
--   does), so every assessment ever made against this Evidence must survive
--   as its own array entry, never overwritten in place.
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('evidence-validation-dimension', 'authenticity', 'Authenticity', '11111111-1111-1111-1111-111111111111'),
  ('evidence-validation-dimension', 'completeness', 'Completeness', '11111111-1111-1111-1111-111111111111'),
  ('evidence-validation-dimension', 'consistency', 'Consistency', '11111111-1111-1111-1111-111111111111'),
  ('evidence-validation-dimension', 'source-credibility', 'Source Credibility', '11111111-1111-1111-1111-111111111111'),
  ('evidence-validation-dimension', 'engineering-relevance', 'Engineering Relevance', '11111111-1111-1111-1111-111111111111'),

  ('evidence-validation-status', 'Not Assessed', 'Not Assessed', '11111111-1111-1111-1111-111111111111'),
  ('evidence-validation-status', 'Pass', 'Pass', '11111111-1111-1111-1111-111111111111'),
  ('evidence-validation-status', 'Partial', 'Partial', '11111111-1111-1111-1111-111111111111'),
  ('evidence-validation-status', 'Fail', 'Fail', '11111111-1111-1111-1111-111111111111'),

  ('evidence-confidence-level', 'Low', 'Low', '11111111-1111-1111-1111-111111111111'),
  ('evidence-confidence-level', 'Medium', 'Medium', '11111111-1111-1111-1111-111111111111'),
  ('evidence-confidence-level', 'High', 'High', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id, version) DO NOTHING;

-- Carry every existing row's seu_id forward into evidence_relationships
-- before the column is dropped.
INSERT INTO evidence_relationships (evidence_id, related_object_type, related_object_id)
SELECT id, 'SEU', seu_id FROM evidence
ON CONFLICT ON CONSTRAINT evidence_relationships_unique DO NOTHING;

ALTER TABLE evidence
  ADD COLUMN IF NOT EXISTS validation_dimensions JSONB NOT NULL DEFAULT '[]';

ALTER TABLE evidence
  ALTER COLUMN confidence_level DROP NOT NULL,
  ALTER COLUMN confidence_level DROP DEFAULT;

ALTER TABLE evidence
  DROP COLUMN IF EXISTS seu_id,
  DROP COLUMN IF EXISTS originating_deliverable_id,
  DROP COLUMN IF EXISTS originating_participant_id,
  DROP COLUMN IF EXISTS originating_capability_id,
  DROP COLUMN IF EXISTS originating_decision_id,
  DROP COLUMN IF EXISTS originating_activity;

-- Version Feature Plan.md — Collected is pure Revision; Collected->Validated
-- mints the one real version (VersionCreated); Validated->Accepted->
-- Referenced->Archived all continue that same version (no version_event);
-- Collected->Rejected/Validated->Rejected are terminal outcomes on the
-- pre-version/same-version row respectively, no version_event. Confirmed
-- with the owner this session. event_type replaces the hardcoded
-- EVENT_BY_TARGET_STATE map in core/evidence.ts.
UPDATE transition_definitions
   SET event_type = 'EvidenceValidated', version_event = 'VersionCreated'
 WHERE entity_type = 'Evidence' AND from_state = 'Collected' AND to_state = 'Validated';

UPDATE transition_definitions
   SET event_type = 'EvidenceAccepted'
 WHERE entity_type = 'Evidence' AND from_state = 'Validated' AND to_state = 'Accepted';

UPDATE transition_definitions
   SET event_type = 'EvidenceReferenced'
 WHERE entity_type = 'Evidence' AND from_state = 'Accepted' AND to_state = 'Referenced';

UPDATE transition_definitions
   SET event_type = 'EvidenceArchived'
 WHERE entity_type = 'Evidence' AND from_state = 'Referenced' AND to_state = 'Archived';

UPDATE transition_definitions
   SET event_type = 'EvidenceRejected'
 WHERE entity_type = 'Evidence' AND from_state = 'Collected' AND to_state = 'Rejected';

UPDATE transition_definitions
   SET event_type = 'EvidenceRejected'
 WHERE entity_type = 'Evidence' AND from_state = 'Validated' AND to_state = 'Rejected';
