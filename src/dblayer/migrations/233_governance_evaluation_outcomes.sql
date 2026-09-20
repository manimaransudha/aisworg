-- CR-109 Build Plan §6 (Work Item Generator design) — step 1 of the build:
-- the Governance Evaluation Outcome record (CR-109 §6.1), owned by the
-- Execution Engine. `executionEngine.evaluateDeliverableTransition` already
-- computes quality gate / policy / obligation / authority results on every
-- passing evaluation; today it discards all of it and returns only
-- `{ok:true, fromState}`. This table is where that gets captured instead of
-- thrown away, so Command generation (6.2) and, downstream, the Work Item
-- Generator's Execution Context (6.3) can read it rather than re-derive it.
--
-- Settled in this design pass (do not relitigate without the owner):
--   - One row per PASSING evaluation only. A blocked attempt is not
--     recorded here — that history already exists as Obligations/
--     AttentionItems attached directly to the Deliverable/SEU. This table
--     exists only for the evaluation that is about to become a Command.
--   - entity_type/outcome/quality_gate_outcome are Ontology-backed, not
--     CHECK-constrained TEXT (unlike transition_definitions.entity_type,
--     which is a known, uncorrected gap — not the pattern to copy).
--   - consulted_obligation_ids / open_attention_item_ids capture what's
--     still open and relevant right now, even though none of it blocked
--     this transition — not a log of what happened during this run. This
--     is what lets Work Item Execution Context tell the Participant
--     "these are still live," per Ch.32 §11's activeObligations.
--   - applicable_authority_rule_id / quality_gate_id reference the real
--     rows (authority_rules/quality_gates) rather than flattening them to
--     text, same as transition_definitions.required_authority_rule_id
--     already does.

INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('governed-entity-type', 'SEU', 'SEU', '11111111-1111-1111-1111-111111111111'),
  ('governed-entity-type', 'Deliverable', 'Deliverable', '11111111-1111-1111-1111-111111111111'),
  ('governed-entity-type', 'Objective', 'Objective', '11111111-1111-1111-1111-111111111111'),
  ('governed-entity-type', 'Obligation', 'Obligation', '11111111-1111-1111-1111-111111111111'),
  ('governed-entity-type', 'Evidence', 'Evidence', '11111111-1111-1111-1111-111111111111'),
  ('governed-entity-type', 'Knowledge', 'Knowledge', '11111111-1111-1111-1111-111111111111'),
  ('governed-entity-type', 'Decision', 'Decision', '11111111-1111-1111-1111-111111111111'),
  ('governed-entity-type', 'KnowledgeScope', 'Knowledge Scope', '11111111-1111-1111-1111-111111111111'),
  ('governed-entity-type', 'AttentionItem', 'Attention Item', '11111111-1111-1111-1111-111111111111'),
  ('governed-entity-type', 'ExternalInteraction', 'External Interaction', '11111111-1111-1111-1111-111111111111'),
  ('governed-entity-type', 'Pack', 'Pack', '11111111-1111-1111-1111-111111111111'),
  ('governed-entity-type', 'Participant', 'Participant', '11111111-1111-1111-1111-111111111111'),
  ('governed-entity-type', 'Review', 'Review', '11111111-1111-1111-1111-111111111111'),
  ('governed-entity-type', 'Finding', 'Finding', '11111111-1111-1111-1111-111111111111'),
  ('governed-entity-type', 'Template', 'Template', '11111111-1111-1111-1111-111111111111'),
  ('governed-entity-type', 'Profile', 'Profile', '11111111-1111-1111-1111-111111111111'),
  ('governed-entity-type', 'Service', 'Service', '11111111-1111-1111-1111-111111111111'),
  ('governed-entity-type', 'Policy', 'Policy', '11111111-1111-1111-1111-111111111111'),
  ('governed-entity-type', 'EBM', 'EBM', '11111111-1111-1111-1111-111111111111'),
  ('governed-entity-type', 'Ontology', 'Ontology', '11111111-1111-1111-1111-111111111111'),
  ('governance-outcome', 'Approved', 'Approved', '11111111-1111-1111-1111-111111111111'),
  ('governance-outcome', 'Approved-with-Conditions', 'Approved with Conditions', '11111111-1111-1111-1111-111111111111'),
  ('governance-outcome', 'Deferred', 'Deferred', '11111111-1111-1111-1111-111111111111'),
  ('governance-outcome', 'Rejected', 'Rejected', '11111111-1111-1111-1111-111111111111'),
  ('governance-outcome', 'Escalated', 'Escalated', '11111111-1111-1111-1111-111111111111'),
  ('governance-outcome', 'Waived', 'Waived', '11111111-1111-1111-1111-111111111111'),
  ('quality-gate-outcome', 'Passed', 'Passed', '11111111-1111-1111-1111-111111111111'),
  ('quality-gate-outcome', 'NotApplicable', 'Not Applicable', '11111111-1111-1111-1111-111111111111'),
  ('quality-gate-outcome', 'Waived', 'Waived', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id, version) DO NOTHING;

CREATE TABLE IF NOT EXISTS governance_evaluation_outcomes (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id                        UUID NOT NULL REFERENCES seus(id),
  entity_type                   TEXT NOT NULL,   -- Ontology: governed-entity-type
  entity_id                     UUID NOT NULL,
  from_state                    TEXT NOT NULL,
  to_state                      TEXT NOT NULL,
  outcome                       TEXT NOT NULL,   -- Ontology: governance-outcome
  rationale                     TEXT NOT NULL,
  quality_gate_id               UUID REFERENCES quality_gates(id),
  quality_gate_outcome          TEXT,            -- Ontology: quality-gate-outcome
  applicable_authority_rule_id  UUID REFERENCES authority_rules(id),
  satisfied_policy_ids          UUID[] NOT NULL DEFAULT '{}',
  deviated_policy_ids           UUID[] NOT NULL DEFAULT '{}',
  consulted_obligation_ids      UUID[] NOT NULL DEFAULT '{}',
  open_attention_item_ids       UUID[] NOT NULL DEFAULT '{}',
  originating_pack_id           UUID REFERENCES packs(id),
  evaluated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_evaluation_outcomes_seu ON governance_evaluation_outcomes (seu_id);
CREATE INDEX IF NOT EXISTS idx_governance_evaluation_outcomes_entity ON governance_evaluation_outcomes (entity_type, entity_id);
