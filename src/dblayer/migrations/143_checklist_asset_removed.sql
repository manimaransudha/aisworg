-- Owner: "In Checklists, there is a property asset. Remove that in the
-- schema and the seed jsons." Then: "Clean up the column and code also."
-- Fully reverses the `asset` half of migration 120 (Checklist itself:
-- optional `asset` string) — `group` on checklist items is untouched, only
-- Checklist's own top-level `asset` field goes: the schema property, the
-- real `checklists.asset` column, and checklistsDB.ts's own upsert
-- (interface + SQL, core/packs.ts's call site).
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema #- '{properties,contributionChecklists,items,properties,asset}',
                  '{properties,contributionChecklists,items,x-property-order}',
                  '["name", "description", "items"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');

ALTER TABLE checklists DROP COLUMN IF EXISTS asset;
