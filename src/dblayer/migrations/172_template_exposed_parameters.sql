-- CR-088 — Template's own "Exposable Parameters" tab. Owner's settled
-- mechanism: "When a template exposes both parameter and value (for
-- service) - 1) value can be changed. 2) add a checkbox to the parameter. if
-- this is checked profile overrides on the value is allowed, other it is not
-- allowed. When a template exposes only parameter, only add a checkbox to
-- the parameter... By default all of the parameters are checked" — plus
-- "create a tab Exposable parameters" (field placement) and "All enums have
-- to be ontology driven" (already true of every candidate this reaches:
-- Service Level metric codes, Policy's constraintType, Checklist's
-- configurableKey — none free text).
--
-- Not a generic referential-list — the row's own OPTIONS (which parameters
-- exist to expose at all, and whether each is value-bearing) are computed
-- server-side per Template from its own currently-selected Packs
-- (deriveExposableParameterCandidates, core/templates.ts), not authored by
-- hand — the same reason contributionPolicies[] (migration 168) is a
-- candidate-driven checkbox grid rather than a free-form list. x-widget:
-- "json" here is the storage shape only (a plain array, parsed/serialised by
-- parseFormBody/generateFields the same way Policy's own `conditions[]`
-- is) — the real authoring surface is a bespoke tab
-- (_generatedFieldGroups.ejs), reading candidates the web route loads
-- alongside it.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,exposedParameters}',
                  '{
                    "type": "array",
                    "x-widget": "json",
                    "x-help": "Which of this Template''s configurable parameters (Service Level targets, Policy constraint types and applicability, Checklist configurable tags) a Profile may override, and Template''s own value for the ones it sets. Authored via the Exposable Parameters tab, not typed here directly.",
                    "items": {
                      "type": "object",
                      "required": ["sourceType", "sourceCode", "parameterName", "overridable"],
                      "properties": {
                        "sourceType": {"type": "string", "enum": ["service", "policy", "checklist"]},
                        "sourceCode": {"type": "string"},
                        "parameterName": {"type": "string"},
                        "value": {"type": "string"},
                        "overridable": {"type": "boolean", "default": true}
                      }
                    }
                  }'::jsonb,
                  true
                )
 WHERE entity_kind = 'Template' AND version = 1;
