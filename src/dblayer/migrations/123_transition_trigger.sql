-- CR-072: what causes a transition to be attempted at all, independent of
-- required_authority_rule_id/required_policy_ids/required_quality_gate_ids
-- (which only govern whether an already-attempted transition succeeds).
--
-- trigger: 'manual' (an actor has to explicitly decide to attempt it) or
-- 'governed' (the event bus drives it automatically once conditions are met
-- — not yet built, deferred until a real case exists; every row defaults to
-- 'manual' since nothing in this codebase auto-fires any transition today).
--
-- submit_verb: nullable — only set once a Submit step has actually been
-- defined for that specific row (badge = entity_type + '_' + submit_verb,
-- same convention transitionEngine already uses for verb itself). A row
-- with submit_verb still null keeps behaving exactly as it does today
-- (a plain badge-gated action button, no queue step) regardless of its own
-- trigger value — this is what keeps every already-built transition (e.g.
-- Objective's own Retire, CR-071) unchanged until its own sub-item defines
-- a real Submit step for it.
ALTER TABLE transition_definitions ADD COLUMN IF NOT EXISTS trigger TEXT NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual', 'governed'));
ALTER TABLE transition_definitions ADD COLUMN IF NOT EXISTS submit_verb TEXT;

-- Sub-item 1 (CR-072): Objective Proposed -> Active is manual, with a real
-- Submit step — badge objective_propose (the same badge that governs
-- proposing/creating an Objective in the first place).
UPDATE transition_definitions SET submit_verb = 'propose'
WHERE entity_type = 'Objective' AND from_state = 'Proposed' AND to_state = 'Active';

-- Owner: "trigger is manual for everything except Active to Achieved."
UPDATE transition_definitions SET trigger = 'governed'
WHERE entity_type = 'Objective' AND from_state = 'Active' AND to_state = 'Achieved';
