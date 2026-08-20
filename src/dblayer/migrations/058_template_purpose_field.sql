-- Template `purpose` field. Owner, 2026-08-19 (CR-023): "Add a purpose
-- field... Field goes in the db and also display in the UI/form." Closes
-- part of Chapter 6 §20.7's "Purpose / Objectives — no field" gap (§5, §7).
--
-- x-widget: "textarea" is a new, generic widget kind (formGenerator.ts) —
-- same free-text `string` field as ever, just rendered as a multi-line box
-- instead of a single-line input; not Ontology-backed (this is the author's
-- own words, not a picker) — the per-category "when to use" guidance
-- (migration 057) is surfaced separately, as live UI guidance next to the
-- code dropdown and as the pre-fill core/sdkAuthoring.ts seeds a new Draft
-- with, not as a fixed enum here.
--
-- Development-time schema correction to the shipped v1 baseline grammar, in
-- place — same convention migrations 038/045/050/052/054 already used.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    schema,
                    '{properties,purpose}',
                    '{"type":"string","minLength":1,"x-help":"What this Template is for and when to choose it — pre-filled with guidance for the selected category; edit to describe this specific Template.","x-widget":"textarea"}'::jsonb,
                    true
                  ),
                  '{required}',
                  '["code","name","purpose"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Template' AND version = 1;
