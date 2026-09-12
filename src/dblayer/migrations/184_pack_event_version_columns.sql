-- Version Feature Plan.md §3, applied to Pack (Ch.5) — same mechanism as
-- migration 183 did for Objective. event_type replaces the hardcoded
-- EVENT_BY_TARGET_STATE map in packs.ts; version_event is per Events and
-- Lifecycles.md's corrected Pack table (Ch.5 §11/§15).
--
-- No submit/queue step for Pack (owner: "There is no Queue to Validate in
-- pack... the transition buttons are sufficient to pass it further in the
-- lifecycle") — considered and deliberately not built, unlike Objective's
-- Proposed->Active. VersionCreated has no separate home here; Draft->Validated
-- is both the first governed hop AND the point a Draft stops being freely
-- editable (Edit is Draft-only), so VersionValidated alone covers it.
UPDATE transition_definitions
   SET event_type = 'PackValidated', version_event = 'VersionValidated'
 WHERE entity_type = 'Pack' AND from_state = 'Draft' AND to_state = 'Validated';

UPDATE transition_definitions
   SET event_type = 'PackPublished', version_event = 'VersionPublished'
 WHERE entity_type = 'Pack' AND from_state = 'Validated' AND to_state = 'Published';

UPDATE transition_definitions
   SET event_type = 'PackRejected'
 WHERE entity_type = 'Pack' AND from_state = 'Validated' AND to_state = 'Draft';

UPDATE transition_definitions
   SET event_type = 'PackActivated', version_event = 'VersionActivated'
 WHERE entity_type = 'Pack' AND from_state = 'Published' AND to_state = 'Active';

UPDATE transition_definitions
   SET event_type = 'PackRetired', version_event = 'VersionDeprecated'
 WHERE entity_type = 'Pack' AND from_state = 'Active' AND to_state = 'Retired';

UPDATE transition_definitions
   SET event_type = 'PackArchived', version_event = 'VersionArchived'
 WHERE entity_type = 'Pack' AND from_state = 'Retired' AND to_state = 'Archived';
