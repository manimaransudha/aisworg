-- Ch.23 Obligation Model conformance to Version Feature Plan.md, plus two
-- real lifecycle additions the owner asked for in the same pass: a Reopen
-- hop out of Closed, and an Escalate hop reachable from every pre-Closed
-- state (Ch.23 §14, escalation trigger logic itself deferred — this
-- migration only wires the state/event, not what raises it automatically).
--
-- event_type: replaces transitionObligation's previous behaviour of
-- publishing only the generic ObligationTransitioned on every hop. §15's own
-- 8 named events don't map 1:1 onto the 7 real state-machine hops (no
-- "Analysed"/"In Progress"/"Archived" names exist in that list) — owner
-- picked ObligationUpdated for the hop with no dedicated name, plus two new
-- names not in §15 (ObligationProcessing, ObligationArchived) for
-- Assigned->In Progress and Closed->Archived. ObligationTransitioned keeps
-- publishing on every hop in addition to the named event (owner, explicit) —
-- transitionObligation now publishes both, never one instead of the other.
--
-- version_event: owner, explicit — every real transition (including Reopen
-- and Escalate) is VersionCreated; only the plain field-edit/Revision path
-- (no transition_definitions row at all) stays version-insignificant, per
-- this codebase's own Revision-vs-Version convention. "Reopened is
-- equivalent to created" is the owner's own reasoning for why every hop
-- shares the one name, not a position/name match against Ch.41 §15's 7-item
-- vocabulary the way every other chapter's pass used.
UPDATE transition_definitions SET event_type = 'ObligationUpdated', version_event = 'VersionCreated'
 WHERE entity_type = 'Obligation' AND from_state = 'Identified' AND to_state = 'Analysed';
UPDATE transition_definitions SET event_type = 'ObligationAssigned', version_event = 'VersionCreated'
 WHERE entity_type = 'Obligation' AND from_state = 'Analysed' AND to_state = 'Assigned';
UPDATE transition_definitions SET event_type = 'ObligationProcessing', version_event = 'VersionCreated'
 WHERE entity_type = 'Obligation' AND from_state = 'Assigned' AND to_state = 'In Progress';
UPDATE transition_definitions SET event_type = 'ObligationResolved', version_event = 'VersionCreated'
 WHERE entity_type = 'Obligation' AND from_state = 'In Progress' AND to_state = 'Resolved';
UPDATE transition_definitions SET event_type = 'ObligationVerified', version_event = 'VersionCreated'
 WHERE entity_type = 'Obligation' AND from_state = 'Resolved' AND to_state = 'Verified';
UPDATE transition_definitions SET event_type = 'ObligationClosed', version_event = 'VersionCreated'
 WHERE entity_type = 'Obligation' AND from_state = 'Verified' AND to_state = 'Closed';
UPDATE transition_definitions SET event_type = 'ObligationArchived', version_event = 'VersionCreated'
 WHERE entity_type = 'Obligation' AND from_state = 'Closed' AND to_state = 'Archived';

-- New rows: Reopen (Closed -> Reopened) and its own forward re-entry into
-- the normal chain (Reopened -> In Progress, same event_type as the
-- Assigned -> In Progress hop it's the equivalent of); Escalate, reachable
-- from every pre-Closed state (owner: "escalate transition from anywhere",
-- read as "every state still open," not Closed/Archived, which are already
-- fully resolved and outside the escalation reasons Ch.23 §14 names).
-- Same required_authority_rule_id/required_policy_ids as every existing
-- Obligation row -- this entity gates on one flat authority rule, not a
-- per-verb badge, and these new rows follow that same existing convention
-- rather than introducing a second gating mechanism for just themselves.
INSERT INTO transition_definitions (entity_type, from_state, to_state, trigger, event_type, version_event, required_authority_rule_id, required_policy_ids)
SELECT 'Obligation', v.from_state, v.to_state, 'manual', v.event_type, 'VersionCreated',
       (SELECT id FROM authority_rules WHERE code = 'authority-transition-obligation'),
       COALESCE((SELECT array_agg(id) FROM policies WHERE code = 'policy-obligation-transition-baseline'), '{}')
FROM (VALUES
  ('Closed',      'Reopened',    'ObligationReopened'),
  ('Reopened',    'In Progress', 'ObligationProcessing'),
  ('Identified',  'Escalated',   'ObligationEscalated'),
  ('Analysed',    'Escalated',   'ObligationEscalated'),
  ('Assigned',    'Escalated',   'ObligationEscalated'),
  ('In Progress', 'Escalated',   'ObligationEscalated'),
  ('Resolved',    'Escalated',   'ObligationEscalated'),
  ('Verified',    'Escalated',   'ObligationEscalated')
) AS v(from_state, to_state, event_type)
WHERE NOT EXISTS (
  SELECT 1 FROM transition_definitions td WHERE td.entity_type = 'Obligation' AND td.from_state = v.from_state AND td.to_state = v.to_state
);

-- Revision history (owner: "How will I know what the old value was?") —
-- separate mechanism from transition history (which is already real via
-- `events`, per Version Feature Plan.md §4's read-only pattern). A plain
-- field edit (title/description/severity/category/priority/completion
-- criteria/assignment) is a pure Revision — "no event of any kind" by this
-- codebase's own Revision-vs-Version convention — so it leaves nothing in
-- `events` at all. This column is the only record of what a Revision
-- changed; append-only, written to exclusively by the new revise/save path
-- (core/obligations.ts), never by a governed transition.
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS revision_history JSONB NOT NULL DEFAULT '[]';
