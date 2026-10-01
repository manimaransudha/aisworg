BEGIN;
DROP TABLE IF EXISTS governance_evaluation_outcomes CASCADE;
CREATE TABLE governance_evaluation_outcomes (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seu_id                        UUID NOT NULL REFERENCES seus(id),
  entity_type                   TEXT NOT NULL,
  entity_id                     UUID NOT NULL,
  from_state                    TEXT NOT NULL,
  to_state                      TEXT NOT NULL,
  outcome                       TEXT NOT NULL,
  rationale                     TEXT NOT NULL,
  quality_gate_id               UUID REFERENCES quality_gates(id),
  quality_gate_outcome          TEXT,
  applicable_authority_rule_id  UUID REFERENCES authority_rules(id),
  satisfied_policy_ids          UUID[] NOT NULL DEFAULT '{}',
  deviated_policy_ids           UUID[] NOT NULL DEFAULT '{}',
  consulted_obligation_ids      UUID[] NOT NULL DEFAULT '{}',
  open_attention_item_ids       UUID[] NOT NULL DEFAULT '{}',
  originating_pack_id           UUID REFERENCES packs(id),
  evaluated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE governance_evaluation_outcomes
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE governance_evaluation_outcomes TO weirdo;
COMMIT;
