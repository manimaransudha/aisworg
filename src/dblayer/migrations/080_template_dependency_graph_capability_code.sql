-- CR-046 follow-up — the dependencyGraph authoring widget's schema (migration
-- 076) never carried a fromCapabilityCode field, only fromName. But
-- materialiseDependencyGraph.ts and validateTemplateSeed both read
-- entry.fromCapabilityCode (not fromName) for fromType === "Capability" rows
-- — the same field the hand-authored seed JSON files have always used
-- (verified: every seeded Template's dependencyGraph Capability-type entries
-- carry fromCapabilityCode, never fromName). Net effect: a Capability-type
-- dependency could never actually be authored through the real web form —
-- the only field the widget offered (fromName) is silently ignored by
-- materialisation for that row shape, so the entry was dropped without error.
--
-- Fix: add fromCapabilityCode to the schema, sourced the same way
-- deliverableCatalogue's own producingCapabilityCode already is —
-- "derived:requiredCapabilityCodes" (CR-038's live, Draft-scoped derivation
-- from whichever Packs are currently selected), not a static registry list.
-- fromName stays as-is for fromType === "Deliverable" rows; the two fields
-- are independent (this codebase's referential-list widgets don't
-- conditionally show/hide a field based on a sibling value), matching the
-- convention deliverableCatalogue's own three independent fields already use.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    schema,
                    '{properties,dependencyGraph,items,properties,fromCapabilityCode}',
                    '{"type": "string", "x-referential": "derived:requiredCapabilityCodes", "x-help": "Only used when From Type is Capability — the Capability that must be fulfilled."}'::jsonb,
                    true
                  ),
                  '{properties,dependencyGraph,items,properties,fromName}',
                  '{"type": "string", "x-referential": "self:deliverableCatalogue", "x-help": "Only used when From Type is Deliverable — the prerequisite Deliverable, picked from the catalogue above."}'::jsonb,
                  true
                )
 WHERE entity_kind = 'Template' AND version = 1;
