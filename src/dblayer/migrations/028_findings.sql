-- Review Model — Plan (Phase 14) step 3, Ch.25 §12. A Finding is an observation
-- identified during a Review — an independent, traceable engineering object.
-- Findings may lead to new Obligations / Evidence requests / Decisions /
-- follow-up Reviews; per the confirmed Decision C, a High/Critical Finding
-- auto-surfaces an Attention Item and can be manually converted to an
-- Obligation (obligation_id links the conversion). 'Finding' becomes the 14th
-- TransitionEntityType with the lifecycle Open -> Resolved / Open -> Waived.
CREATE TABLE IF NOT EXISTS findings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id            UUID NOT NULL REFERENCES reviews(id),
  seu_id               UUID NOT NULL REFERENCES seus(id),
  related_object_type  TEXT NOT NULL,                 -- the reviewed object the Finding is about (inherited from the Review)
  related_object_id    UUID NOT NULL,
  severity             TEXT NOT NULL DEFAULT 'Medium', -- Low | Medium | High | Critical
  title                TEXT NOT NULL,
  description          TEXT,
  status               TEXT NOT NULL DEFAULT 'Open',   -- Open -> Resolved / Waived (governed by transition_definitions)
  obligation_id        UUID REFERENCES obligations(id), -- set when a Finding is converted to an Obligation
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_findings_review ON findings (review_id);
CREATE INDEX IF NOT EXISTS idx_findings_related_object ON findings (related_object_type, related_object_id);

-- 'Finding' as the 14th TransitionEntityType.
ALTER TABLE transition_definitions DROP CONSTRAINT IF EXISTS transition_definitions_entity_type_check;
ALTER TABLE transition_definitions ADD CONSTRAINT transition_definitions_entity_type_check
  CHECK (entity_type IN ('SEU', 'Deliverable', 'Objective', 'Obligation', 'Evidence', 'Knowledge', 'Decision', 'KnowledgeScope', 'AttentionItem', 'ExternalInteraction', 'Pack', 'Participant', 'Review', 'Finding'));

ALTER TABLE quality_gates DROP CONSTRAINT IF EXISTS quality_gates_entity_type_check;
ALTER TABLE quality_gates ADD CONSTRAINT quality_gates_entity_type_check
  CHECK (entity_type IN ('SEU', 'Deliverable', 'Objective', 'Obligation', 'Evidence', 'Knowledge', 'Decision', 'KnowledgeScope', 'AttentionItem', 'ExternalInteraction', 'Pack', 'Participant', 'Review', 'Finding'));

INSERT INTO transition_definitions (entity_type, from_state, to_state, required_authority_rule_id, required_policy_ids)
VALUES
  ('Finding', 'Open', 'Resolved', NULL, '{}'),
  ('Finding', 'Open', 'Waived',   NULL, '{}')
ON CONFLICT (entity_type, from_state, to_state) DO NOTHING;
