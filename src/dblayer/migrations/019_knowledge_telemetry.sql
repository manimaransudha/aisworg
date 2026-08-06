-- Engineering Telemetry — Plan, Build order step 4 — Knowledge Telemetry,
-- narrowed to growth and Evidence generation only (Decision reuse and
-- ontology expansion dropped, not deferred — see the plan's own reasoning).
INSERT INTO metric_definitions (identifier, name, description, category, unit_of_measure, aggregation_strategy, calculation_method)
VALUES
  ('knowledge-growth', 'Knowledge Growth', 'Ch.35 §7 Knowledge Telemetry — Knowledge Items created, broken down by Acquisition Scope (SEU/Capability/Enterprise/Platform).', 'Knowledge', 'items', 'Distribution', 'knowledge_growth'),
  ('evidence-generation', 'Evidence Generation', 'Ch.35 §7 Knowledge Telemetry — Evidence records created.', 'Knowledge', 'items', 'Count', 'evidence_generation')
ON CONFLICT (identifier) DO NOTHING;
