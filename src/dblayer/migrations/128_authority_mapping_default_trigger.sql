-- Trigger picked on the Mapping tab's "Allow" form (owner: "add a dropdown to
-- choose trigger and pass it in the allow function") had nowhere to live: the
-- Mapping list's own "Trigger" column is a live read-through off whichever
-- transition_definitions rows already share a (noun, verb) pair
-- (authorityVocabularyDB.listMapping), so applying the Allow form's choice via
-- updateTriggerForVerb would silently overwrite an ALREADY-EXISTING mapping's
-- real, deliberately-set transitions every time "Allow" is resubmitted (the
-- upsert is idempotent — re-adding an existing pair just reactivates it) —
-- and would do nothing at all for a genuinely new pair (no rows yet to
-- update). Neither case is what "pick a trigger when you Allow a verb" means.
--
-- This column is the real fix: it stores the mapping's OWN starting trigger,
-- independent of any transition_definitions row. A new Transition Definition
-- added later under this (noun, verb) starts at this value instead of the
-- column's hardcoded 'manual' default; already-existing transitions are never
-- touched by Allow again.
ALTER TABLE authority_noun_verbs
  ADD COLUMN IF NOT EXISTS default_trigger TEXT NOT NULL DEFAULT 'manual'
  CHECK (default_trigger IN ('manual', 'governed'));
