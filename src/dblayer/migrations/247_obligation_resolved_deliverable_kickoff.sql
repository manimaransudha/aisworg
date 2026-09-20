-- Closes the second half of the dispatch give-up gap: a Command that gave up
-- (Failed, migration 246's Obligation + Attention Item) had no path back —
-- resolving that Obligation did nothing, since deliverableKickoffHandler was
-- never subscribed to ObligationTransitioned (only executionEngineKickoff
-- was, and only for the SEU commence-work case). Same event, second handler
-- — deliverableKickoffHandler filters to a resolved status itself (see its
-- own code), so this fires a rescan only once the Obligation is actually
-- resolved, not on every intermediate hop.
INSERT INTO event_subscriptions (event_type, handler_name) VALUES
  ('ObligationTransitioned', 'deliverableKickoff')
  ON CONFLICT ON CONSTRAINT event_subscriptions_unique DO NOTHING;
