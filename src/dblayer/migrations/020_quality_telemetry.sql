-- Engineering Telemetry — Plan, Build order step 6 — Quality Telemetry,
-- narrowed to rework rate and Deliverable acceptance rate only (review
-- effectiveness and defect escape rate held — no Review entity, no governed
-- backward Deliverable transition). Collaboration Telemetry stays held.
INSERT INTO metric_definitions (identifier, name, description, category, unit_of_measure, aggregation_strategy, calculation_method)
VALUES
  ('rework-rate', 'Rework Rate', 'Ch.35 §7 Quality Telemetry — of entities that eventually passed a Quality Gate, what share needed at least one Blocked attempt first, and how many on average.', 'Quality', 'percent', 'Rate', 'rework_rate'),
  ('deliverable-acceptance-rate', 'Deliverable Acceptance Rate', 'Ch.35 §7 Quality Telemetry — share of Deliverables that have reached Baselined, against the full lifecycle_state distribution.', 'Quality', 'percent', 'Rate', 'deliverable_acceptance_rate')
ON CONFLICT (identifier) DO NOTHING;
