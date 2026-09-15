-- Owner: "Initialisations look incorrect. Scope has to default to
-- Transition." A brand-new Policy Definition draft rendered `scope`'s
-- <select> on the blank "— select —" option, and since a native <select>
-- always submits whichever option is marked selected (the first, absent any
-- other), an untouched form silently created the Draft with scope="" rather
-- than the intended default. Paired with formGenerator.ts's own fix (its
-- top-level enum/select branch never read a schema-declared `default` at
-- all, unlike the referential-list item default it already honours) — this
-- migration supplies the value that fix now actually uses.
UPDATE schema_definitions
   SET schema = jsonb_set(schema, '{properties,scope,default}', '"Transition"'::jsonb, true)
 WHERE entity_kind = 'Policy'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Policy')
   AND schema->'properties' ? 'scope';
