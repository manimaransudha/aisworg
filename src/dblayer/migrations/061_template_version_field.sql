-- Template `templateVersion` field. Owner, 2026-08-19 (CR-024): "Let us
-- version the template similar to pack." Same generic `x-widget: "version"`
-- mechanism Pack's own `packVersion` now uses (migration 060) — readonly,
-- semver, advanced only by its own "Next version" button, never hand-typed.
-- A fresh Draft is pre-seeded "1.0.0" the same way Pack's is
-- (web/sdkAuthoring.ts's contentForForm), so `required` here is enforced the
-- same way packVersion's already is — the field is never actually blank on
-- a real submission.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    schema,
                    '{properties,templateVersion}',
                    '{"type":"string","x-help":"semver, e.g. 1.0.0","pattern":"^[0-9]+\\.[0-9]+\\.[0-9]+$","x-widget":"version"}'::jsonb,
                    true
                  ),
                  '{required}',
                  '["code","name","purpose","templateVersion"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Template' AND version = 1;
