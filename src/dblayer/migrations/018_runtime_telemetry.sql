-- Engineering Telemetry — Plan, Build order step 3 — Runtime Telemetry.
-- Command generation rate, dispatch latency, Work Item execution duration —
-- participant utilisation deliberately excluded (held per the plan: 1:1
-- Capability Fulfilment today means nothing comparative to measure).
INSERT INTO metric_definitions (identifier, name, description, category, unit_of_measure, aggregation_strategy, calculation_method)
VALUES
  ('command-generation-rate', 'Command Generation Volume', 'Ch.35 §7 Runtime Telemetry — total Commands generated, platform-wide. A count today, not yet a real time-bucketed rate (see calculation method''s own comment).', 'Runtime', 'commands', 'Count', 'command_generation_count'),
  ('dispatch-latency', 'Dispatch Latency', 'Ch.35 §7 Runtime Telemetry — time from a Command being generated to its Work Item being dispatched to a Participant.', 'Runtime', 'seconds', 'Average', 'dispatch_latency'),
  ('work-item-duration', 'Work Item Execution Duration', 'Ch.35 §7 Runtime Telemetry — time from a Work Item starting execution to completing. Near-zero today (no autonomous Participant runtime yet, execution is simulated synchronously) — see calculation method''s own comment.', 'Runtime', 'seconds', 'Average', 'work_item_duration')
ON CONFLICT (identifier) DO NOTHING;
