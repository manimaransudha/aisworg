-- Engineering Telemetry — Plan (design/mvp-build-plan/Engineering Telemetry
-- — Plan.md), Build order step 1. Ch.35 §8 Metric Registry, scoped down per
-- the plan's own "Scope, resolved 2026-08-06": a metadata catalog, not a
-- computation DSL — same shape as quality_gates.criteria.type: a metadata
-- value (calculation_method) selects hardcoded evaluator code, not a
-- runtime-interpreted formula. A Pack "contributing a custom metric"
-- (FR-35.4) means declaring a metric_definitions row naming an existing
-- calculation_method, same as a Pack declaring a Quality Gate against an
-- existing criteria.type — not supplying new code.
CREATE TABLE IF NOT EXISTS metric_definitions (
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

-- Seed the two already-live metrics against their own already-live
-- calculation methods (metricRegistryEngine.ts) — proves the interpreter
-- against known-good data, per the plan's own build order.
INSERT INTO metric_definitions (identifier, name, description, category, unit_of_measure, aggregation_strategy, calculation_method)
VALUES
  ('deliverable-cycle-time', 'Deliverable Cycle Time', 'Ch.35 §7 Flow Telemetry — time from a Deliverable''s creation to its most recent recorded transition, platform-wide.', 'Flow', 'seconds', 'Average', 'deliverable_cycle_time'),
  ('quality-gate-latency', 'Quality Gate Latency', 'Ch.35 §7 Governance Telemetry — friction per gate: time from first Blocked evaluation to the eventual Pass, platform-wide.', 'Governance', 'seconds', 'Average', 'quality_gate_latency')
ON CONFLICT (identifier) DO NOTHING;
