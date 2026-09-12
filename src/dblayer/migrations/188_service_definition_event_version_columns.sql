-- Version Feature Plan.md §3, applied to Service Definition (Ch.11) — same
-- mechanism as migrations 183/184/185/187 (Objective/Pack/Template/Profile).
--
-- Scope note, definition vs execution (Ch.11 §18.9, CR-064's own split,
-- mirroring CR-063's identical split for Obligation): Book 3 Ch.11 names two
-- genuinely different things under "Service":
--   1. Service Definition (this migration's subject) — the canonical,
--      tenant-scoped, versioned CATALOG entry a Capability Pack's own
--      contributionServices[] picks by code (CR-086). This is the real
--      embodiment of Ch.11 §13's governed lifecycle in the current build —
--      core/serviceDefinitions.ts's own header says so directly ("Ch.11
--      §13's own lifecycle is used verbatim"). `entity_type = 'Service'` in
--      transition_definitions is THIS entity, despite the shorter name.
--   2. The `services` table — a Pack-materialized, per-Capability EXECUTION
--      row (content-diff versioned, CR-064; no governed lifecycle, no
--      transition_definitions rows, none planned by this migration either).
-- event_type replaces core/serviceDefinitions.ts's hardcoded
-- EVENT_BY_TARGET_STATE map; version_event is per Events and Lifecycles.md's
-- new Service Definition table (Ch.11 §13).
--
-- No Reject/submit step (no transition_definitions row anywhere declares
-- submit_verb for this entity, same shape as Pack/Template/Profile).
-- VersionValidated never applies here — Service Definition's own governed
-- lifecycle (Defined -> Published -> Active -> Deprecated -> Retired ->
-- Archived) has no Validated state at all, one shorter than Pack/Template/
-- Profile's seven; per this plan's own governing rule, a Chapter 41 generic
-- stage with no corresponding real state on this entity does not apply —
-- the same reasoning Objective's own missing Validated state already
-- established, not a new judgment call. VersionCreated has no separate row
-- for the identical reason Pack's Draft->Validated already established:
-- Defined -> Published is both the first governed hop AND the point a
-- Defined stops being freely editable (updateDraftContent's own `WHERE
-- status = 'Defined'` guard), so VersionPublished alone covers it.
UPDATE transition_definitions
   SET event_type = 'ServiceDefinitionPublished', version_event = 'VersionPublished'
 WHERE entity_type = 'Service' AND from_state = 'Defined' AND to_state = 'Published';

UPDATE transition_definitions
   SET event_type = 'ServiceDefinitionActivated', version_event = 'VersionActivated'
 WHERE entity_type = 'Service' AND from_state = 'Published' AND to_state = 'Active';

UPDATE transition_definitions
   SET event_type = 'ServiceDefinitionDeprecated', version_event = 'VersionDeprecated'
 WHERE entity_type = 'Service' AND from_state = 'Active' AND to_state = 'Deprecated';

UPDATE transition_definitions
   SET event_type = 'ServiceDefinitionRetired', version_event = 'VersionSuperseded'
 WHERE entity_type = 'Service' AND from_state = 'Deprecated' AND to_state = 'Retired';

UPDATE transition_definitions
   SET event_type = 'ServiceDefinitionArchived', version_event = 'VersionArchived'
 WHERE entity_type = 'Service' AND from_state = 'Retired' AND to_state = 'Archived';
