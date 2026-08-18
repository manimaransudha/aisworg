-- Bug fix (corrects CR-014): every governed transition must record WHO did it
-- and under WHAT authority. Events carried from/to but no actor or badge, so
-- "who ran this verb, under which noun_verb authority" was unanswerable —
-- traceability/accountability was lost. These two nullable columns are the
-- accountability record: actor_id is the real acting user (never a silent
-- system substitute), authority_badge is the resolved `noun_verb` badge the
-- transition was authorised under (null when the transition definition has no
-- verb — an ungoverned/system event). Nullable + additive: pre-existing rows
-- and non-transition events (which have no actor) stay valid.
ALTER TABLE events ADD COLUMN IF NOT EXISTS actor_id        TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS authority_badge TEXT;

CREATE INDEX IF NOT EXISTS idx_events_actor_id ON events (actor_id);
