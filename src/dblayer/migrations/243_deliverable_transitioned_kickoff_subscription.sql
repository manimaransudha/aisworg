-- deliverableKickoffHandler's succession half: SEUOperational alone only
-- covers the first kickoff. DeliverableTransitioned already exists and is
-- already published (completeWorkItem, workItems.ts) but had never been
-- registered (event_registry) or subscribed to. Applied directly
-- (idempotent), not via a full pnpm seed:* reseed.
INSERT INTO event_registry (event_type, description) VALUES
  ('DeliverableTransitioned', 'Chapter 9 — a Deliverable''s governed transition completed (payload: fromState/toState). Published by completeWorkItem when a Participant reports done. deliverableKickoffHandler subscribes to this too (same handler as SEUOperational) so each completed hop re-scans the SEU''s Deliverables and attempts whichever one this just unblocked.')
  ON CONFLICT (event_type) DO NOTHING;

INSERT INTO event_subscriptions (event_type, handler_name) VALUES
  ('DeliverableTransitioned', 'deliverableKickoff')
  ON CONFLICT ON CONSTRAINT event_subscriptions_unique DO NOTHING;
