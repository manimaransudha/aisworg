-- Owner: "Severity should be after statement. The governing condition
-- should be within applicability deliverables." Two changes:
--   1. Reorder: statement, severity, applicabilityDeliverables,
--      requiredEvidence, relatedObligations, exceptionRules.
--   2. governingCondition moves OFF the condition itself and into each
--      applicabilityDeliverables row (name, transitions, governingCondition)
--      — a condition with several applicability rows (several deliverables/
--      transitions) can now give each one its own real governing rule,
--      rather than one rule shared by every deliverable/transition the
--      condition happens to name. Same 5-field structured shape (migration
--      218) — {type, field, operator, values, value} — just relocated, one
--      level deeper (a nested-object inside a nested-list row, the first of
--      its kind in this codebase — buildItemFields' own recursion already
--      handles this generically; only the EJS edit-mode rendering needed a
--      new branch, _referentialListGroup.ejs's nested-list inner loop).
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    schema #- '{properties,conditions,items,properties,governingCondition}',
                    '{properties,conditions,items,properties,applicabilityDeliverables,items,properties,governingCondition}',
                    '{
                      "type": "object",
                      "x-help": "The real, machine-evaluated rule for THIS deliverable/transition. Left with no Type chosen, it is manual/human-attested — never checked by the engine.",
                      "x-property-order": ["type", "field", "operator", "values", "value"],
                      "properties": {
                        "type": {"type": "string", "enum": ["always_true", "field_in", "comparison", "threshold"]},
                        "field": {"type": "string", "x-help": "The context field this rule checks (dot-path, e.g. testCoveragePercent).", "x-show-when": "type", "x-show-when-values": ["field_in", "comparison", "threshold"]},
                        "operator": {"type": "string", "enum": ["gt", "gte", "lt", "lte", "eq", "neq"], "x-help": "threshold only ever uses gte/gt — a floor, never a ceiling.", "x-show-when": "type", "x-show-when-values": ["comparison", "threshold"]},
                        "values": {"type": "string", "x-help": "Comma-separated list of acceptable values.", "x-show-when": "type", "x-show-when-values": ["field_in"]},
                        "value": {"type": "string", "x-help": "The value to compare the field against.", "x-show-when": "type", "x-show-when-values": ["comparison", "threshold"]}
                      }
                    }'::jsonb,
                    true
                  ),
                  '{properties,conditions,items,x-property-order}',
                  '["statement", "severity", "applicabilityDeliverables", "requiredEvidence", "relatedObligations", "exceptionRules"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Policy'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Policy')
   AND schema->'properties'->'conditions'->'items'->'properties' ? 'applicabilityDeliverables';

UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,conditions,items,properties,applicabilityDeliverables,items,x-property-order}',
                  '["name", "transitions", "governingCondition"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Policy'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Policy')
   AND schema->'properties'->'conditions'->'items'->'properties'->'applicabilityDeliverables' IS NOT NULL;
