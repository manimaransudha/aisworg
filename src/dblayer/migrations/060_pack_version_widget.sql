-- Pack's `packVersion` field gains the explicit `x-widget: "version"` marker
-- (CR-024) — the readonly-plus-"Next version"-button rendering used to be
-- triggered by a hardcoded `f.name === 'packVersion'` check in
-- _generatedFieldGroups.ejs; generalised to a real schema-driven widget kind
-- (`kind === "version"`, formGenerator.ts) so Template's own `templateVersion`
-- (migration 061) can use the exact same mechanism instead of a second,
-- parallel hardcoded special case. Without this, Pack's own packVersion field
-- would silently fall through to a plain single-line text input the moment
-- the view stopped checking the field name.
UPDATE schema_definitions
   SET schema = jsonb_set(schema, '{properties,packVersion,x-widget}', '"version"'::jsonb, true)
 WHERE entity_kind = 'Pack' AND version = 1;
