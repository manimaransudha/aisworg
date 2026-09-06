-- CR-088 Profile-side completion (owner, 2026-09-05: "the overrides have to
-- be saved in the profile" — CR-088's own Profile-side mechanism was deferred
-- at the time because that pass was Template-focused work; the deferral
-- reason stopped applying once CR-091 opened as the dedicated Profile CR, but
-- was never picked up there — a lapse corrected here).
--
-- Profile's own "Parameter Overrides" tab: for each parameter its base
-- Template's own saved exposedParameters[] flagged overridable (migration
-- 172), the value THIS Profile sets. Deliberately sparse (unlike Template's
-- own non-sparse exposedParameters, which records a row for every candidate
-- regardless of value) — a Profile only needs to store the ones it actually
-- overrides; an omitted candidate falls back to the Template's own value.
-- Scoped to value-bearing candidates only (Service Level metric, Policy
-- constraintType) — the list/filter-shaped ones (Policy applicability
-- dimensions, Checklist configurableKey) have no value for Template itself to
-- set either (deriveExposableParameterCandidates, core/templates.ts); Template
-- flagging one of those overridable only means a Profile MAY filter by it, a
-- separate, still-unbuilt mechanism this does not attempt to add.
--
-- Same x-widget:"json" storage-only treatment as Template's own
-- exposedParameters (migration 172) — the real authoring surface is a bespoke
-- candidate-driven tab (_generatedFieldGroups.ejs), reading candidates the
-- web route derives fresh from the Profile's base Template on every render
-- (deriveOverridableParameterCandidates, core/templates.ts).
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,exposedParameterOverrides}',
                  '{
                    "type": "array",
                    "x-widget": "json",
                    "x-help": "This Profile''s own overriding value for each of its base Template''s configurable parameters the Template flagged as overridable. Authored via the Parameter Overrides tab, not typed here directly. Leaving a candidate out keeps the Template''s own value.",
                    "items": {
                      "type": "object",
                      "required": ["sourceType", "sourceCode", "parameterName", "value"],
                      "properties": {
                        "sourceType": {"type": "string", "enum": ["service", "policy", "checklist"]},
                        "sourceCode": {"type": "string"},
                        "parameterName": {"type": "string"},
                        "value": {"type": "string"}
                      }
                    }
                  }'::jsonb,
                  true
                )
 WHERE entity_kind = 'Profile' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Profile');
