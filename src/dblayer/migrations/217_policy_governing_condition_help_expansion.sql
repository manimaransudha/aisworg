-- Owner: "it has new condition types and comparison operators. They should
-- be in a separate module so we can expand or add later" — domain/engine/
-- governingConditionTypes.ts's new CONDITION_EVALUATORS registry adds
-- `comparison` ({"type":"comparison","field":..,"operator":"gt"|"gte"|"lt"|
-- "lte"|"eq"|"neq","value":..}) and `threshold` ({"type":"threshold",
-- "field":..,"operator":"gte"|"gt","value":..}) alongside the existing
-- always_true/field_in. Data-only change (x-help text), no schema shape
-- change — governingCondition was already a free-form x-widget:"json" field
-- accepting any {"type": ...} object.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,conditions,items,properties,governingCondition,x-help}',
                  '"The real, machine-evaluated rule for THIS condition. Types: {\"type\": \"always_true\"}; {\"type\": \"field_in\", \"field\": \"<context field>\", \"values\": [...]}; {\"type\": \"comparison\", \"field\": \"<context field>\", \"operator\": \"gt\"|\"gte\"|\"lt\"|\"lte\"|\"eq\"|\"neq\", \"value\": ...}; {\"type\": \"threshold\", \"field\": \"<context field>\", \"operator\": \"gte\"|\"gt\", \"value\": ...}. Left blank, this condition is manual/human-attested — never checked by the engine."'::jsonb,
                  false
                )
 WHERE entity_kind = 'Policy'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Policy')
   AND schema->'properties'->'conditions'->'items'->'properties' ? 'governingCondition';
