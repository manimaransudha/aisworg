-- Template/Profile code: system UUID, not an authored field — owner, 2026-08-18
-- ("Why is code not auto generated? There is a Name field that can be
-- entered by user more descriptively").
--
-- CR-015 (Pack authoring: UUID codes) explicitly deferred this exact
-- question: "Template/Profile codes are out of scope here (decide
-- separately if they should follow the same UUID scheme)" — listed as an
-- open item at the bottom of that CR and never revisited. Deciding it now,
-- the same way: `code` drops out of the user-facing grammar entirely (not
-- just made optional) — the author only ever enters `name`; `code` is
-- minted server-side (toTemplateSeedInput / toProfileSeedInput,
-- core/sdkAuthoring.ts, mirroring toPackSeedInput's randomUUID() fallback).
--
-- Development-time schema correction to the shipped v1 baseline grammar, in
-- place — same convention migration 038 already used for Pack's own v1
-- schema (schema_definitions versions are immutable/additive for
-- RUNTIME-authored versions, Ch.5 §19.2; the baseline seed itself staying v1
-- is a build-time correction, and keeps db:clean-slate's "trim
-- schema_definitions to v1" invariant true).
UPDATE schema_definitions
   SET schema = $json$
{
  "type": "object",
  "required": ["name"],
  "properties": {
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
 WHERE entity_kind = 'Template' AND version = 1;

UPDATE schema_definitions
   SET schema = $json$
{
  "type": "object",
  "required": ["name", "baseTemplateCode", "environment"],
  "properties": {
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
 WHERE entity_kind = 'Profile' AND version = 1;
