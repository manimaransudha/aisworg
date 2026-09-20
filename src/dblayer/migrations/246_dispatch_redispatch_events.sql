-- Ch.33 §14's remaining 4 events (DispatchRejected, ParticipantUnavailable,
-- RedispatchRequested, RedispatchCompleted) — this session's design pass:
-- empty pool / no Capability declared -> DispatchRejected; pool exists but
-- every candidate filtered out -> ParticipantUnavailable; both raise an
-- Obligation + "Action Required" Attention Item, mark the Command Failed
-- (terminal, not in-flight — commandsDB.findInFlight), and stop. Neither
-- event has its own consumer: retrying is gated on a human resolving the
-- Obligation, which publishes ObligationTransitioned — deliverableKickoff is
-- subscribed to THAT (migration 247), not to these two directly. Subscribing
-- deliverableKickoff to DispatchRejected/ParticipantUnavailable directly (an
-- earlier version of this migration did) creates an immediate infinite retry
-- loop the moment the Command is marked Failed, since Failed is no longer
-- in-flight — caught and corrected before ever being applied.
-- Pool exists, qualified candidates exist, none currently Available ->
-- DispatchDeferred -> a new consumer publishes RedispatchRequested -> a new
-- consumer re-attempts dispatch, tracked by the new work_items.
-- dispatch_attempts counter against the two new Profile Configuration
-- Parameters below (N > M): an "Escalation" Attention Item (informational,
-- no Obligation) at attempt M, and at attempt N, retries stop and it becomes
-- an Obligation + "Action Required" Attention Item, same as cases 1/2.
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS dispatch_attempts INTEGER NOT NULL DEFAULT 0;

INSERT INTO event_registry (event_type, description) VALUES
  ('DispatchDeferred', 'Ch.33 §14 — qualified candidates exist, none currently Available (transient). Published since the original dispatchEngine.ts, pre-dating this session, but never registered until now (same "published but never registered" gap as CommandGenerated/WorkItemGenerated). Consumed by redispatchRequest, which publishes RedispatchRequested.'),
  ('DispatchRejected', 'Ch.33 §14 — no producing Capability declared, or the eligible-Participant pool is empty. An Obligation + Action-Required Attention Item are raised and the Command is marked Failed. No direct consumer — retrying happens only once a human resolves the Obligation, via ObligationTransitioned (migration 247).'),
  ('ParticipantUnavailable', 'Ch.33 §14 — the eligible pool has entries, but Dispatch Strategy filtering eliminates every candidate structurally (not a transient busy state). Same Obligation + Action-Required Attention Item + Command-Failed treatment as DispatchRejected, same no-direct-consumer reasoning.'),
  ('RedispatchRequested', 'Ch.33 §14 — DispatchDeferred''s own consumer requesting a retry: qualified candidates exist but none are currently Available. Consumed by a retry handler that re-runs dispatchEngine.dispatch on the same Work Item.'),
  ('RedispatchCompleted', 'Ch.33 §14 — a RedispatchRequested retry landed on a successful Participant assignment (published alongside ParticipantSelected/WorkItemDispatched, not instead of them).')
ON CONFLICT (event_type) DO NOTHING;

INSERT INTO event_subscriptions (event_type, handler_name) VALUES
  ('DispatchDeferred', 'redispatchRequest'),
  ('RedispatchRequested', 'redispatch')
ON CONFLICT ON CONSTRAINT event_subscriptions_unique DO NOTHING;

-- Two new Profile Configuration Parameters, N (max retry attempts) and M
-- (attempt at which an informational Attention Item is raised, M < N).
-- Plain numbers, not Ontology-backed — same no-concept-type treatment as
-- environmentConfiguration/readme (migration 175/229): a canonical
-- vocabulary makes no sense for a bare integer.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    schema,
                    '{properties,redispatchMaxAttempts}',
                    '{"type":"number","x-help":"Ch.33 §14 Redispatch — N. Maximum automatic retry attempts before Dispatch gives up and raises an Obligation. Must be greater than redispatchAttentionThreshold."}'::jsonb,
                    true
                  ),
                  '{properties,redispatchAttentionThreshold}',
                  '{"type":"number","x-help":"Ch.33 §14 Redispatch — M. Attempt number at which an informational Attention Item is raised (retries continue). Must be less than redispatchMaxAttempts."}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Profile' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Profile');
