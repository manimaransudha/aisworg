-- Review Model — Plan (design/mvp-build-plan/Review Model Plan.md), Phase 14
-- step 1 (Ch.25). A Review is a governed evaluation of an engineering object
-- against declarative criteria; it produces an immutable outcome that
-- Governance consumes when evaluating a state transition (Ch.25 §1/§3/§11). It
-- is one more governed entity — the Evidence/Decision pattern — with a
-- polymorphic reviewed object and the six-state lifecycle Ch.25 §9.
--
-- 'Review' becomes the 13th TransitionEntityType (entity_type CHECK widened on
-- transition_definitions and quality_gates, the same rerun-safety redeclare the
-- previous entity additions each made — run.ts replays every migration file on
-- every boot).
--
-- The Review lifecycle transition_definitions are seeded HERE (not only in
-- transitionDefinitions.json) so the running system has them immediately after
-- migrate, without depending on a separate seed run — the migration replays
-- idempotently and transition_definitions survive clean-slate. The Review
-- lifecycle carries no authority rule for now (required_authority_rule_id NULL,
-- so the authority check is skipped): Ch.25 RM-002 makes a Review independent
-- of who performs it, and Governance consumes the *outcome*, not who walked the
-- lifecycle; Pack-contributed authority on Review is a later refinement.

CREATE TABLE IF NOT EXISTS reviews (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id               UUID NOT NULL REFERENCES seus(id),
  related_object_type  TEXT NOT NULL,                 -- polymorphic reviewed object (Deliverable, ...)
  related_object_id    UUID NOT NULL,
  category             TEXT NOT NULL,                 -- Requirements/Architecture/Design/Code/Security/... (Pack-extensible free text)
  name                 TEXT NOT NULL,
  criteria             JSONB NOT NULL DEFAULT '{}',   -- declarative review criteria (Ch.25 §10)
  outcome              TEXT                           -- set once at Completed; immutable thereafter (FR-25.5)
                         CHECK (outcome IS NULL OR outcome IN ('Passed', 'Passed with Recommendations', 'Rework Required', 'Failed', 'Not Applicable', 'Deferred')),
  status               TEXT NOT NULL DEFAULT 'Planned',   -- lifecycle governed by transition_definitions (Ch.25 §9)
  reviewer             TEXT,                          -- provenance: who performed it (recorded, not dispatched — Decision A)
  version              INTEGER NOT NULL DEFAULT 1,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_related_object ON reviews (related_object_type, related_object_id);
CREATE INDEX IF NOT EXISTS idx_reviews_seu ON reviews (seu_id);

-- Widen the entity_type CHECKs to include 'Review'.
-- CR-059 build-time fix — superseded by migration 036 (CR-006, "the
-- constraint stays dropped"); this transient re-add was breaking replay
-- against real accumulated 'Template'/'Profile' rows. See 003's own note.

ALTER TABLE quality_gates DROP CONSTRAINT IF EXISTS quality_gates_entity_type_check;
ALTER TABLE quality_gates ADD CONSTRAINT quality_gates_entity_type_check
  CHECK (entity_type IN ('SEU', 'Deliverable', 'Objective', 'Obligation', 'Evidence', 'Knowledge', 'Decision', 'KnowledgeScope', 'AttentionItem', 'ExternalInteraction', 'Pack', 'Participant', 'Review', 'Finding'));

-- Seed the Ch.25 §9 lifecycle: Planned -> Prepared -> In Progress -> Completed
-- -> Accepted -> Archived. No authority rule / no policies for now.
INSERT INTO transition_definitions (entity_type, from_state, to_state, required_authority_rule_id, required_policy_ids)
VALUES
  ('Review', 'Planned',     'Prepared',    NULL, '{}'),
  ('Review', 'Prepared',    'In Progress', NULL, '{}'),
  ('Review', 'In Progress', 'Completed',   NULL, '{}'),
  ('Review', 'Completed',   'Accepted',    NULL, '{}'),
  ('Review', 'Accepted',    'Archived',    NULL, '{}')
ON CONFLICT (entity_type, from_state, to_state) DO NOTHING;
