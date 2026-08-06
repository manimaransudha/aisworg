-- SDK UI Layer Plan, Build order steps 4-5 — Template and Profile's own
-- grammars, mirroring Pack's (014_sdk_authoring.sql). requiredCapabilityCodes
-- and deliverableCatalogue stay x-widget:"json" for this pass, same
-- reasoning as Pack's `contributions` — additive expansion into individual
-- controls is future grammar-version scope, not this pass's.
INSERT INTO schema_definitions (entity_kind, version, schema)
SELECT 'Template', 1, $json$
{
  "type": "object",
  "required": ["code", "name"],
  "properties": {
    "code": { "type": "string", "minLength": 1 },
    "name": { "type": "string", "minLength": 1 },
    "requiredCapabilityCodes": { "type": "array", "x-widget": "json", "x-help": "array of Capability codes, e.g. [\"requirements-analysis\"]" },
    "mandatoryPackCodes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": { "packCode": { "type": "string", "x-referential": "pack-code" } },
        "required": ["packCode"]
      },
      "x-widget": "referential-list"
    },
    "deliverableCatalogue": { "type": "array", "x-widget": "json", "x-help": "array of { code, name, category, producingCapabilityCode?, dependsOnDeliverableCodes?[] } — Ch.6 §10" }
  }
}
$json$::jsonb
WHERE NOT EXISTS (SELECT 1 FROM schema_definitions WHERE entity_kind = 'Template' AND version = 1);

INSERT INTO schema_definitions (entity_kind, version, schema)
SELECT 'Profile', 1, $json$
{
  "type": "object",
  "required": ["code", "name", "baseTemplateCode", "environment"],
  "properties": {
    "code": { "type": "string", "minLength": 1 },
    "name": { "type": "string", "minLength": 1 },
    "baseTemplateCode": { "type": "string", "x-widget": "referential-select", "x-referential-source": "template-code" },
    "environment": { "type": "string", "enum": ["development", "staging", "production"] },
    "configParameters": { "type": "object", "x-widget": "json", "x-help": "meaning owned by the consuming Pack, Ch.7 §10" },
    "optionalPackCodes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": { "packCode": { "type": "string", "x-referential": "pack-code" } },
        "required": ["packCode"]
      },
      "x-widget": "referential-list"
    }
  }
}
$json$::jsonb
WHERE NOT EXISTS (SELECT 1 FROM schema_definitions WHERE entity_kind = 'Profile' AND version = 1);
