-- Version Feature Plan.md — Chapter 24 (Policy Definition) pass, same shape
-- as Pack/Template/Profile/Service/Ontology before it. transition_definitions.
-- event_type/version_event were NULL for every real Policy hop (Ch.24 §13's
-- 6-hop lifecycle, already correct and unchanged) despite policyDefinitions.ts
-- already publishing a per-state event off a hardcoded EVENT_BY_TARGET_STATE
-- map — that map is retired in the same pass, reading gate.eventType instead.
--
-- Deprecated→Retired carries VersionSuperseded, not VersionDeprecated —
-- same judgment call Template's/Profile's own Deprecated→Retired hop
-- already made: Ch.41 §15's generic chain supplies the version-event name
-- by POSITION (Retired is the chain's "Superseded" slot), while the
-- entity's own chapter-defined state name (Retired) wins for the real
-- lifecycle state itself, per this plan's governing rule.
UPDATE transition_definitions
   SET event_type = v.event_type, version_event = v.version_event
  FROM (VALUES
    ('Draft', 'Validated', 'PolicyDefinitionValidated', 'VersionValidated'),
    ('Validated', 'Published', 'PolicyDefinitionPublished', 'VersionPublished'),
    ('Published', 'Active', 'PolicyDefinitionActivated', 'VersionActivated'),
    ('Active', 'Deprecated', 'PolicyDefinitionDeprecated', 'VersionDeprecated'),
    ('Deprecated', 'Retired', 'PolicyDefinitionRetired', 'VersionSuperseded'),
    ('Retired', 'Archived', 'PolicyDefinitionArchived', 'VersionArchived')
  ) AS v(from_state, to_state, event_type, version_event)
 WHERE transition_definitions.entity_type = 'Policy'
   AND transition_definitions.from_state = v.from_state
   AND transition_definitions.to_state = v.to_state;
