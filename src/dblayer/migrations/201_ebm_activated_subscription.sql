-- CR-102 — EBMActivated gets a real subscriber (ebmActivatedHandler), moving
-- finalizeCommissioning off transitionEbm's synchronous call path. Applied
-- directly (not via a full pnpm seed:* reseed) — narrow, idempotent.
UPDATE event_registry
  SET description = 'Chapter 3 §15 — a human manually confirmed the Validated EBM should take effect (transitionEbm, targetState Active). CR-102: transitionEbm itself only updates status and publishes this event; ebmActivatedHandler (async subscriber) runs finalizeCommissioning off it — failure is signaled via seus.lifecycle_state = Failed + CommissionFailed, not a caller return.'
  WHERE event_type = 'EBMActivated';

INSERT INTO event_subscriptions (event_type, handler_name)
  VALUES ('EBMActivated', 'ebmActivated')
  ON CONFLICT ON CONSTRAINT event_subscriptions_unique DO NOTHING;

UPDATE event_registry
  SET description = 'Chapter 2/8 — seus.lifecycle_state set to Configured. Published by finalizeCommissioning (CR-102: called from ebmActivatedHandler, off EBMActivated), deliberately ahead of SEUCommissioned (owner: "let us stick to the order I gave").'
  WHERE event_type = 'SEUConfigured';
