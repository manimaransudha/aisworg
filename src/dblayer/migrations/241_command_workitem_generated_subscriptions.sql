-- Ch.30 event-publishing rule ("no code statements after an event is
-- published") was violated: executionEngine.execute() published
-- CommandGenerated and then kept running (workItemGenerator.generate(),
-- dispatchEngine.dispatch()) in the same call stack, and workItemGenerator.
-- generate() did the same after publishing WorkItemGenerated. Neither event
-- type had ever been registered (event_registry) or subscribed to
-- (event_subscriptions) — they were published, but nothing was ever meant to
-- consume them; the calls that followed ran as plain synchronous code
-- instead. Applied directly (idempotent), not via a full pnpm seed:* reseed.
INSERT INTO event_registry (event_type, description) VALUES
  ('CommandGenerated', 'Ch.31 §10/§15 — executionEngine.execute() persisted a Command. commandGeneratedHandler (async subscriber) runs Work Item generation off it; execute() itself publishes and returns, nothing after.'),
  ('WorkItemGenerated', 'Ch.32 — workItemGenerator.generate() persisted a Work Item. workItemGeneratedHandler (async subscriber) runs dispatchEngine.dispatch() off it; generate() itself publishes and returns, nothing after.')
  ON CONFLICT (event_type) DO NOTHING;

INSERT INTO event_subscriptions (event_type, handler_name) VALUES
  ('CommandGenerated', 'commandGenerated'),
  ('WorkItemGenerated', 'workItemGenerated')
  ON CONFLICT ON CONSTRAINT event_subscriptions_unique DO NOTHING;
