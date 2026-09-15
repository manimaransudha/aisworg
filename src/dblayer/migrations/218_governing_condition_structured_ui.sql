-- Owner: "Now make the GoverningCondition UI user friendly and not a json
-- edit." Was: x-widget:"json", a raw textarea. Now: a real nested-object
-- (buildItemFields' "nested-object" dispatch, same mechanism requiredEvidence
-- already uses) with its own 5 sub-fields, only the relevant ones shown per
-- the chosen `type` (new x-show-when-values marker, formGenerator.ts —
-- x-show-when's existing "named sibling field is truthy" semantics extended
-- with an optional exact-value-membership form; both resolved live,
-- reusing edit.ejs's existing generic [data-show-when] mechanism):
--   type      — always_true | field_in | comparison | threshold (blank = manual).
--   field     — the context field this rule checks. Shown unless type is blank/always_true.
--   operator  — gt/gte/lt/lte/eq/neq. Shown for comparison/threshold only.
--   values    — comma-separated acceptable values. Shown for field_in only.
--   value     — the value to compare against. Shown for comparison/threshold only.
-- toPolicyGoverningCondition (sdkAuthoring.ts) assembles these back into the
-- real {"type":...} shape governingConditionTypes.ts's CONDITION_EVALUATORS
-- expect; validateConditions (policyDefinitions.ts) enforces the fields each
-- type actually needs.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,conditions,items,properties,governingCondition}',
                  '{
                    "type": "object",
                    "x-help": "The real, machine-evaluated rule for THIS condition. Left with no Type chosen, this condition is manual/human-attested — never checked by the engine.",
                    "x-property-order": ["type", "field", "operator", "values", "value"],
                    "properties": {
                      "type": {
                        "type": "string",
                        "enum": ["always_true", "field_in", "comparison", "threshold"]
                      },
                      "field": {
                        "type": "string",
                        "x-help": "The context field this rule checks (dot-path, e.g. testCoveragePercent).",
                        "x-show-when": "type",
                        "x-show-when-values": ["field_in", "comparison", "threshold"]
                      },
                      "operator": {
                        "type": "string",
                        "enum": ["gt", "gte", "lt", "lte", "eq", "neq"],
                        "x-help": "threshold only ever uses gte/gt — a floor, never a ceiling.",
                        "x-show-when": "type",
                        "x-show-when-values": ["comparison", "threshold"]
                      },
                      "values": {
                        "type": "string",
                        "x-help": "Comma-separated list of acceptable values.",
                        "x-show-when": "type",
                        "x-show-when-values": ["field_in"]
                      },
                      "value": {
                        "type": "string",
                        "x-help": "The value to compare the field against.",
                        "x-show-when": "type",
                        "x-show-when-values": ["comparison", "threshold"]
                      }
                    }
                  }'::jsonb,
                  true
                )
 WHERE entity_kind = 'Policy'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Policy')
   AND schema->'properties'->'conditions'->'items'->'properties' ? 'governingCondition';
