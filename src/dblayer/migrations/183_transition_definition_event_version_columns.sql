-- Version Feature Plan (design/mvp-build-plan/Version Feature Plan.md) §3 —
-- Chapter 41 Version Management, applied without a new `versions` table or
-- write-time service. Two things a transition needs to declare about itself:
--
-- event_type: the literal domain event name this transition produces (e.g.
-- 'ObjectiveActivated'). Was hardcoded per entity in application code
-- (OBJECTIVE_TRANSITION_EVENT in objectives.ts) because it isn't mechanical
-- from to_state for every transition — Achieved/Retired/Archived are
-- past-tense-verb exceptions. Making it data lets that map go away entirely;
-- callers publish whatever event_type the resolved definition carries.
--
-- version_event: nullable — one of Chapter 41 §15's seven Version event
-- names, or null for a transition that's a pure Revision (no version
-- significance). "Version history" for an entity is then just: filter
-- `events` for that entity down to the event_types whose transition_definitions
-- row carries a non-null version_event, ordered by created_at — a read, not
-- a write path.
--
-- submit_version_event: the same idea for a Submit/queue step (submit_verb).
-- A submit step isn't its own transition_definitions row — it's an attribute
-- of the row it queues into (e.g. Objective's Proposed->Active row carries
-- submit_verb='propose') — so its own version significance needs its own
-- column here rather than overloading version_event, which describes the
-- row's own to_state transition.
ALTER TABLE transition_definitions ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE transition_definitions ADD COLUMN IF NOT EXISTS version_event TEXT
  CHECK (version_event IS NULL OR version_event IN
    ('VersionCreated', 'VersionValidated', 'VersionPublished', 'VersionActivated', 'VersionDeprecated', 'VersionSuperseded', 'VersionArchived'));
ALTER TABLE transition_definitions ADD COLUMN IF NOT EXISTS submit_version_event TEXT
  CHECK (submit_version_event IS NULL OR submit_version_event IN
    ('VersionCreated', 'VersionValidated', 'VersionPublished', 'VersionActivated', 'VersionDeprecated', 'VersionSuperseded', 'VersionArchived'));

-- Objective (Ch.1, Events and Lifecycles.md) — the pilot entity. New/Edit
-- (rows 1-2) are pure Revisions, already correct by having no event_type/
-- version_event set. Row 5 ("Validate") does not apply: Objective's
-- chapter-defined lifecycle has no Validated state (Proposed -> Active
-- directly) — see Version Feature Plan.md §7 Q3.
UPDATE transition_definitions
   SET event_type = 'ObjectiveActivated', version_event = 'VersionActivated', submit_version_event = 'VersionCreated'
 WHERE entity_type = 'Objective' AND from_state = 'Proposed' AND to_state = 'Active';

UPDATE transition_definitions
   SET event_type = 'ObjectiveRejected'
 WHERE entity_type = 'Objective' AND from_state = 'Active' AND to_state = 'Reject';

UPDATE transition_definitions
   SET event_type = 'ObjectiveAchieved', version_event = 'VersionPublished'
 WHERE entity_type = 'Objective' AND from_state = 'Active' AND to_state = 'Achieved';

UPDATE transition_definitions
   SET event_type = 'ObjectiveSuperseded', version_event = 'VersionSuperseded'
 WHERE entity_type = 'Objective' AND from_state = 'Active' AND to_state = 'Superseded';

UPDATE transition_definitions
   SET event_type = 'ObjectiveRetired', version_event = 'VersionDeprecated'
 WHERE entity_type = 'Objective' AND from_state = 'Active' AND to_state = 'Retired';

UPDATE transition_definitions
   SET event_type = 'ObjectiveArchived', version_event = 'VersionArchived'
 WHERE entity_type = 'Objective' AND from_state IN ('Achieved', 'Superseded', 'Retired') AND to_state = 'Archived';
