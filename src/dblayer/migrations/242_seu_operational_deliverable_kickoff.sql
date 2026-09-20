-- CR-104's own "kickoff of the first Deliverable" question, closed as a real
-- event subscriber (deliverableKickoffHandler) on SEUOperational — an event
-- type already registered (migration 189), never previously subscribed to.
-- Applied directly (idempotent), not via a full pnpm seed:* reseed.
INSERT INTO event_subscriptions (event_type, handler_name) VALUES
  ('SEUOperational', 'deliverableKickoff')
  ON CONFLICT ON CONSTRAINT event_subscriptions_unique DO NOTHING;
