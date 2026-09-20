-- Chapter 19 Decision Model cleanup. Restructures `decisions` per the
-- owner's own design pass (this session):
--
--   originating_type/originating_id — new, singular polymorphic pointer:
--     what gave rise to this Decision (e.g. an AttentionItem), distinct
--     from related_object_type/related_object_ids below.
--
--   related_object_type/related_object_id (scalar) -> related_objects
--     (JSONB array of {related_object_type, related_object_ids[]} groups) —
--     what this Decision applies to; now genuinely multiple, and multiple
--     entity types at once (e.g. several Deliverables AND several other
--     Decisions in the same Decision).
--
--   related_seu (JSONB array of {related_object_type, related_object_ids[]}
--     groups, entity types 'seu'/'packs') — new: propagation beyond the
--     Decision's own originating SEU (Ch.19 §13 Decision Reuse).
--
--   knowledge_id/evidence_id (scalar FKs) -> knowledge_ids/evidence_ids
--     (UUID[]) — Ch.19 §8's "Supporting Knowledge"/"Supporting Evidence"
--     were always plural in the chapter text; the single-FK columns never
--     matched that.
--
--   selected_alternative/rationale (scalars) -> alternatives (JSONB array
--     of {statement, assumptions[], consequences[], status, rationale}) —
--     Ch.19 §8's "Alternatives Considered"/"Selected Alternative" folded
--     into one structure; status is its own new Ontology concept type
--     (decision-alternative-status, seeded below), rationale moves from a
--     single Decision-level field to per-alternative (why THIS alternative
--     was accepted/rejected), so there is no top-level rationale anymore.
--
--   participant_id/authority_badge — who acted, matching events.actor_id/
--     .authority_badge's existing treatment (CR-014). Captured at creation
--     (participant_id only — createDecision is an ungoverned "Identified"
--     row, same as every other entity's own row-1 creation, so there is no
--     badge to record yet) and updated on every governed transition
--     thereafter (both fields, from the resolved TransitionOutcome) — the
--     row always reflects the most recent actor, full history stays in
--     `events`.
--
-- Independent of the Participant means the Participant executing it is
-- replaceable, not that participant attribution is absent (Ch.19 §4/§17
-- correction, this session) — this is why participant_id is captured, not
-- omitted.

-- New Ontology concept type for alternatives[].status (Ch.19 §9 is the
-- Decision's OWN lifecycle — a different, larger state machine; an
-- alternative's own status is a separate, smaller vocabulary).
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('decision-alternative-status', 'Candidate', 'Candidate', '11111111-1111-1111-1111-111111111111'),
  ('decision-alternative-status', 'Evaluating', 'Evaluating', '11111111-1111-1111-1111-111111111111'),
  ('decision-alternative-status', 'Investigating', 'Investigating', '11111111-1111-1111-1111-111111111111'),
  ('decision-alternative-status', 'Deferred', 'Deferred', '11111111-1111-1111-1111-111111111111'),
  ('decision-alternative-status', 'Rejected', 'Rejected', '11111111-1111-1111-1111-111111111111'),
  ('decision-alternative-status', 'Approved', 'Approved', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id, version) DO NOTHING;

ALTER TABLE decisions
  ADD COLUMN IF NOT EXISTS originating_type TEXT,
  ADD COLUMN IF NOT EXISTS originating_id UUID,
  ADD COLUMN IF NOT EXISTS related_objects JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS related_seu JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS knowledge_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS evidence_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS alternatives JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS participant_id UUID REFERENCES participants(id),
  ADD COLUMN IF NOT EXISTS authority_badge TEXT;

-- Carry forward existing scalar data into the new shapes before dropping
-- the old columns, so no live Decision loses its recorded content.
UPDATE decisions
   SET related_objects = jsonb_build_array(jsonb_build_object('related_object_type', related_object_type, 'related_object_ids', jsonb_build_array(related_object_id)))
 WHERE related_object_type IS NOT NULL AND related_object_id IS NOT NULL;

UPDATE decisions SET knowledge_ids = ARRAY[knowledge_id] WHERE knowledge_id IS NOT NULL;
UPDATE decisions SET evidence_ids = ARRAY[evidence_id] WHERE evidence_id IS NOT NULL;

UPDATE decisions
   SET alternatives = jsonb_build_array(
         jsonb_build_object(
           'statement', COALESCE(selected_alternative, ''),
           'assumptions', '[]'::jsonb,
           'consequences', '[]'::jsonb,
           'status', CASE WHEN status IN ('Approved', 'Applied', 'Superseded', 'Archived') THEN 'Approved' ELSE 'Candidate' END,
           'rationale', rationale
         )
       )
 WHERE selected_alternative IS NOT NULL OR rationale IS NOT NULL;

ALTER TABLE decisions
  DROP COLUMN IF EXISTS related_object_type,
  DROP COLUMN IF EXISTS related_object_id,
  DROP COLUMN IF EXISTS knowledge_id,
  DROP COLUMN IF EXISTS evidence_id,
  DROP COLUMN IF EXISTS selected_alternative,
  DROP COLUMN IF EXISTS rationale;

-- Version Feature Plan.md — Identified/Analysed are pure Revision (no
-- version_event); Analysed->Proposed mints VersionCreated; every hop from
-- Proposed onward is versioned, mapped against Ch.41 §15's 7-name
-- vocabulary in the order confirmed with the owner this session.
UPDATE transition_definitions
   SET event_type = 'DecisionAnalysed'
 WHERE entity_type = 'Decision' AND from_state = 'Identified' AND to_state = 'Analysed';

UPDATE transition_definitions
   SET event_type = 'DecisionProposed', version_event = 'VersionCreated'
 WHERE entity_type = 'Decision' AND from_state = 'Analysed' AND to_state = 'Proposed';

UPDATE transition_definitions
   SET event_type = 'DecisionReviewed', version_event = 'VersionValidated'
 WHERE entity_type = 'Decision' AND from_state = 'Proposed' AND to_state = 'Reviewed';

UPDATE transition_definitions
   SET event_type = 'DecisionApproved', version_event = 'VersionPublished'
 WHERE entity_type = 'Decision' AND from_state = 'Reviewed' AND to_state = 'Approved';

UPDATE transition_definitions
   SET event_type = 'DecisionApplied', version_event = 'VersionActivated'
 WHERE entity_type = 'Decision' AND from_state = 'Approved' AND to_state = 'Applied';

UPDATE transition_definitions
   SET event_type = 'DecisionSuperseded', version_event = 'VersionSuperseded'
 WHERE entity_type = 'Decision' AND from_state = 'Applied' AND to_state = 'Superseded';

UPDATE transition_definitions
   SET event_type = 'DecisionArchived', version_event = 'VersionArchived'
 WHERE entity_type = 'Decision' AND from_state = 'Superseded' AND to_state = 'Archived';
