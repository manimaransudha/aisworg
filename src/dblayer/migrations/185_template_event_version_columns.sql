-- Version Feature Plan.md §3, applied to Template (Ch.6) — same mechanism as
-- migration 183 (Objective) and 184 (Pack). event_type replaces the
-- hardcoded EVENT_BY_TARGET_STATE map in core/templates.ts (CR-025);
-- version_event is per Events and Lifecycles.md's new Template table
-- (Ch.6 §15/§20.2/§20.3).
--
-- No Reject/submit step for Template — same as Pack (transition_definitions
-- has no Validated->Draft row, no submit_verb anywhere for this entity).
-- VersionCreated has no separate home here for the same reason it doesn't
-- for Pack: Draft->Validated is both the first governed hop AND the point a
-- Draft stops being freely editable, so VersionValidated alone covers it.
--
-- Template's real 7-state lifecycle (Draft->Validated->Published->Active->
-- Deprecated->Retired->Archived, Ch.6 §15) lines up 1:1 by POSITION with
-- Chapter 41 §15's generic 7-stage chain (...Active->Deprecated->Superseded
-- ->Archived) — the only naming difference is Template's own "Retired"
-- where Ch.41's generic vocabulary says "Superseded". Per the Version
-- Feature Plan's own governing rule, the entity's own state NAME wins
-- (Retired stays Retired, not renamed to Superseded) — but the Version
-- EVENT at that same position is still drawn from Ch.41's fixed seven-name
-- vocabulary, so the Deprecated->Retired hop carries version_event =
-- VersionSuperseded (positional match), not a fabricated eighth name.
-- Active->Deprecated carries VersionDeprecated (both name and position
-- match). Recorded as a judgment call, not a pre-existing precedent — no
-- other entity built so far has both a Deprecated and a Retired state.
UPDATE transition_definitions
   SET event_type = 'TemplateValidated', version_event = 'VersionValidated'
 WHERE entity_type = 'Template' AND from_state = 'Draft' AND to_state = 'Validated';

UPDATE transition_definitions
   SET event_type = 'TemplatePublished', version_event = 'VersionPublished'
 WHERE entity_type = 'Template' AND from_state = 'Validated' AND to_state = 'Published';

UPDATE transition_definitions
   SET event_type = 'TemplateActivated', version_event = 'VersionActivated'
 WHERE entity_type = 'Template' AND from_state = 'Published' AND to_state = 'Active';

UPDATE transition_definitions
   SET event_type = 'TemplateDeprecated', version_event = 'VersionDeprecated'
 WHERE entity_type = 'Template' AND from_state = 'Active' AND to_state = 'Deprecated';

UPDATE transition_definitions
   SET event_type = 'TemplateRetired', version_event = 'VersionSuperseded'
 WHERE entity_type = 'Template' AND from_state = 'Deprecated' AND to_state = 'Retired';

UPDATE transition_definitions
   SET event_type = 'TemplateArchived', version_event = 'VersionArchived'
 WHERE entity_type = 'Template' AND from_state = 'Retired' AND to_state = 'Archived';

-- Reactivation edges (Deprecated/Retired/Archived -> Active, CR-024/026):
-- deliberately left with event_type/version_event both NULL. transitionTemplate
-- never runs updateStatus for these rows — it branches to
-- reactivateAsNewVersion instead, which creates a brand-new Draft and walks
-- it through the three rows above (Validated/Published/Active), each
-- publishing its own real event. These three rows exist only for the
-- authority-badge gate check (`template_activate`), never to publish an
-- event of their own.
