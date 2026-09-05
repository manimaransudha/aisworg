-- CR-087 follow-up — migration 160 renamed deliverableCatalogue.items.
-- properties.name to .code, but left items.required as ["name", "category"]
-- untouched: the property it names no longer exists, and the property that
-- actually needs marking required (code) wasn't in the list. Cosmetic in
-- validateTemplateSeed (core/templates.ts already enforces both server-side
-- regardless of this schema-level marker) but real in the authoring form:
-- _referentialListGroup.ejs's isRequiredField (itemField.required, sourced
-- straight off this array) decided the Code field's `*` and `required`
-- attribute, and silently never showed either.
UPDATE schema_definitions
   SET schema = jsonb_set(schema, '{properties,deliverableCatalogue,items,required}', '["code", "category"]'::jsonb, true)
 WHERE entity_kind = 'Template' AND version = 1;
