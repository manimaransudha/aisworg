-- Owner: "In Policy, governing condition is defined as a structure. I do
-- not see this in the Pack obligation definition. Did I not say this has to
-- resemble the policy." Migration 249 carried applicabilityDeliverables[]'s
-- `name`/`transitions` onto Pack's own Obligation Definition but dropped the
-- third field Policy's own row has (migration 216/218/219) —
-- `governingCondition`, the real machine-evaluated rule. Same shape,
-- verbatim (type/field/operator/values/value, same enum, same x-show-when
-- wiring) — one source of truth for the structure, per the original
-- instruction this session settled on.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  jsonb_set(
                    schema,
                    '{properties,contributionObligationDefinitions,items,properties,applicabilityDeliverables,items,properties,governingCondition}',
                    '{
                      "type": "object",
                      "x-help": "The real, machine-evaluated rule for whether this row currently triggers the Obligation. Left with no Type chosen, it defaults to always_true — the Obligation is raised whenever this row''s name/transitions match, unconditionally (unchanged from migration 249). A chosen type narrows that: the Obligation is raised only when it evaluates true.",
                      "properties": {
                        "type": {
                          "enum": ["always_true", "field_in", "comparison", "threshold"],
                          "type": "string"
                        },
                        "field": {
                          "type": "string",
                          "x-help": "The context field this rule checks (dot-path, e.g. testCoveragePercent).",
                          "x-show-when": "type",
                          "x-show-when-values": ["field_in", "comparison", "threshold"]
                        },
                        "value": {
                          "type": "string",
                          "x-help": "The value to compare the field against.",
                          "x-show-when": "type",
                          "x-show-when-values": ["comparison", "threshold"]
                        },
                        "values": {
                          "type": "string",
                          "x-help": "Comma-separated list of acceptable values.",
                          "x-show-when": "type",
                          "x-show-when-values": ["field_in"]
                        },
                        "operator": {
                          "enum": ["gt", "gte", "lt", "lte", "eq", "neq"],
                          "type": "string",
                          "x-help": "threshold only ever uses gte/gt — a floor, never a ceiling.",
                          "x-show-when": "type",
                          "x-show-when-values": ["comparison", "threshold"]
                        }
                      },
                      "x-property-order": ["type", "field", "operator", "values", "value"]
                    }'::jsonb,
                    true
                  ),
                  '{properties,contributionObligationDefinitions,items,properties,applicabilityDeliverables,items,x-property-order}',
                  '["name", "transitions", "governingCondition"]'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack')
   AND schema->'properties'->'contributionObligationDefinitions'->'items'->'properties' ? 'applicabilityDeliverables';
