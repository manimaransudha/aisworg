BEGIN;
DROP TABLE IF EXISTS metric_definitions CASCADE;
CREATE TABLE metric_definitions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier            TEXT NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  description           TEXT,
  category              TEXT NOT NULL CHECK (category IN ('Flow', 'Governance', 'Runtime', 'Knowledge', 'Quality', 'Collaboration')),
  unit_of_measure       TEXT NOT NULL,
  aggregation_strategy  TEXT NOT NULL CHECK (aggregation_strategy IN ('Average', 'Count', 'Rate', 'Distribution')),
  calculation_method    TEXT NOT NULL,
  version               INTEGER NOT NULL DEFAULT 1,
  originating_pack_id   UUID REFERENCES packs(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE metric_definitions
  ADD COLUMN IF NOT EXISTS author_id UUID NOT NULL REFERENCES participants_master(id),
  ADD COLUMN IF NOT EXISTS author_badge TEXT NOT NULL;
GRANT ALL PRIVILEGES ON TABLE metric_definitions TO weirdo;

INSERT INTO metric_definitions (identifier, name, description, category, unit_of_measure, aggregation_strategy, calculation_method, author_id, author_badge)
VALUES
  ('deliverable-cycle-time', 'Deliverable Cycle Time', 'Ch.35 §7 Flow Telemetry — time from a Deliverable''s creation to its most recent recorded transition, platform-wide.', 'Flow', 'seconds', 'Average', 'deliverable_cycle_time'),
  ('quality-gate-latency', 'Quality Gate Latency', 'Ch.35 §7 Governance Telemetry — friction per gate: time from first Blocked evaluation to the eventual Pass, platform-wide.', 'Governance', 'seconds', 'Average', 'quality_gate_latency')
ON CONFLICT (identifier) DO NOTHING;
INSERT INTO metric_definitions (identifier, name, description, category, unit_of_measure, aggregation_strategy, calculation_method)
VALUES
  ('command-generation-rate', 'Command Generation Volume', 'Ch.35 §7 Runtime Telemetry — total Commands generated, platform-wide. A count today, not yet a real time-bucketed rate (see calculation method''s own comment).', 'Runtime', 'commands', 'Count', 'command_generation_count'),
  ('dispatch-latency', 'Dispatch Latency', 'Ch.35 §7 Runtime Telemetry — time from a Command being generated to its Work Item being dispatched to a Participant.', 'Runtime', 'seconds', 'Average', 'dispatch_latency'),
  ('work-item-duration', 'Work Item Execution Duration', 'Ch.35 §7 Runtime Telemetry — time from a Work Item starting execution to completing. Near-zero today (no autonomous Participant runtime yet, execution is simulated synchronously) — see calculation method''s own comment.', 'Runtime', 'seconds', 'Average', 'work_item_duration')
ON CONFLICT (identifier) DO NOTHING;
INSERT INTO metric_definitions (identifier, name, description, category, unit_of_measure, aggregation_strategy, calculation_method)
VALUES
  ('knowledge-growth', 'Knowledge Growth', 'Ch.35 §7 Knowledge Telemetry — Knowledge Items created, broken down by Acquisition Scope (SEU/Capability/Enterprise/Platform).', 'Knowledge', 'items', 'Distribution', 'knowledge_growth'),
  ('evidence-generation', 'Evidence Generation', 'Ch.35 §7 Knowledge Telemetry — Evidence records created.', 'Knowledge', 'items', 'Count', 'evidence_generation')
ON CONFLICT (identifier) DO NOTHING;
INSERT INTO metric_definitions (identifier, name, description, category, unit_of_measure, aggregation_strategy, calculation_method)
VALUES
  ('rework-rate', 'Rework Rate', 'Ch.35 §7 Quality Telemetry — of entities that eventually passed a Quality Gate, what share needed at least one Blocked attempt first, and how many on average.', 'Quality', 'percent', 'Rate', 'rework_rate'),
  ('deliverable-acceptance-rate', 'Deliverable Acceptance Rate', 'Ch.35 §7 Quality Telemetry — share of Deliverables that have reached Baselined, against the full lifecycle_state distribution.', 'Quality', 'percent', 'Rate', 'deliverable_acceptance_rate')
ON CONFLICT (identifier) DO NOTHING;


COMMIT;
