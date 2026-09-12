-- Version Feature Plan.md §3, applied to Profile (Ch.7) — same mechanism as
-- migration 183 (Objective), 184 (Pack), 185 (Template). event_type replaces
-- the hardcoded EVENT_BY_TARGET_STATE map in core/profiles.ts (Ch.7 §19.9);
-- version_event is per Events and Lifecycles.md's new Profile table (Ch.7
-- §14/§19.1/§19.2), an exact structural mirror of Template's own migration
-- 185 — Profile shares the identical seven-state lifecycle (Draft->Validated
-- ->Published->Active->Deprecated->Retired->Archived), the identical
-- no-Reject/no-submit shape, and the identical Deprecated+Retired-as-two-
-- distinct-hops divergence from Chapter 41 §15's generic vocabulary. See
-- migration 185's own header for the full reasoning on the
-- Deprecated->Retired = VersionSuperseded judgment call — it applies here
-- unchanged, not re-derived.
UPDATE transition_definitions
   SET event_type = 'ProfileValidated', version_event = 'VersionValidated'
 WHERE entity_type = 'Profile' AND from_state = 'Draft' AND to_state = 'Validated';

UPDATE transition_definitions
   SET event_type = 'ProfilePublished', version_event = 'VersionPublished'
 WHERE entity_type = 'Profile' AND from_state = 'Validated' AND to_state = 'Published';

UPDATE transition_definitions
   SET event_type = 'ProfileActivated', version_event = 'VersionActivated'
 WHERE entity_type = 'Profile' AND from_state = 'Published' AND to_state = 'Active';

UPDATE transition_definitions
   SET event_type = 'ProfileDeprecated', version_event = 'VersionDeprecated'
 WHERE entity_type = 'Profile' AND from_state = 'Active' AND to_state = 'Deprecated';

UPDATE transition_definitions
   SET event_type = 'ProfileRetired', version_event = 'VersionSuperseded'
 WHERE entity_type = 'Profile' AND from_state = 'Deprecated' AND to_state = 'Retired';

UPDATE transition_definitions
   SET event_type = 'ProfileArchived', version_event = 'VersionArchived'
 WHERE entity_type = 'Profile' AND from_state = 'Retired' AND to_state = 'Archived';

-- Reactivation edges (Deprecated/Retired/Archived -> Active, §19.1/§19.2):
-- deliberately left with event_type/version_event both NULL, same reasoning
-- as Template's identical rows (migration 185) — transitionProfile branches
-- to reactivateAsNewVersion for these, which walks a brand-new Draft through
-- the three rows above instead of ever calling updateStatus on them.
