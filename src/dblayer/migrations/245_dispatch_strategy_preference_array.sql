-- CR-109 Build Plan §1, revised — dispatchStrategyPreference stops being a
-- single-value Configuration Parameter and becomes an ordered array
-- (core/profiles.ts's own DispatchStrategyPreferenceEntry: {strategy, order}).
-- A Profile can now declare a fallback chain of Dispatch Strategies, tried in
-- ascending order, instead of exactly one. Reuses the existing
-- dispatch-strategy-preference concept type (migration 229's own 7 values)
-- as the strategy picker's value source — no new Ontology concept type.
--
-- The now-orphaned profile-configuration row for it is removed: nothing
-- reads CONFIGURATION_PARAMETER_FIELDS' is_mandatory check for this field
-- any more (core/profiles.ts dropped it from that list), so leaving the row
-- would list a Configuration Parameter that no longer behaves like one.
DELETE FROM ontology_concepts WHERE concept_type = 'profile-configuration' AND code = 'dispatch-strategy-preference';

UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,dispatchStrategyPreference}',
                  '{"type":"array","x-widget":"referential-list","x-help":"Ch.33 §9 Dispatch Strategies, tried in ascending order — the Dispatch Engine falls through to the next entry if a strategy finds no viable Participant.","items":{"type":"object","properties":{"strategy":{"type":"string","x-referential":"dispatch-strategy-preference"},"order":{"type":"number"}}}}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Profile' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Profile');
