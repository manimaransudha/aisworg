-- CR-016 (Ch.5 §20) — replace the opaque `contributions` JSON blob in the Pack
-- grammar with schema-defined, flattened repeatable lists, so the form + validation
-- follow from the validator. Each verifiable list row carries its own §20 fields
-- (classification is PER ITEM — a checklist can hold a machine-verifiable item AND
-- a judgment item). Declaration-only: the reassembled contributions persist in
-- packs.contributions (JSONB); executing them stays the §19.14 B-group follow-up.
--
-- Compliance (frameworks/requirements — deeply nested) stays a raw-JSON field for
-- now. Grammar updated in place at v1 (as 038/039).

UPDATE schema_definitions
   SET schema = $json$
{
  "type": "object",
  "required": ["name", "category", "packVersion", "installationClassification"],
  "properties": {
    "name": { "type": "string", "minLength": 1 },
    "category": { "type": "string", "x-widget": "referential-select", "x-referential-source": "pack-category", "x-help": "select a Pack category (managed in pack_category)" },
    "packVersion": { "type": "string", "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$", "x-help": "semver, e.g. 1.0.0" },
    "installationClassification": { "type": "string", "enum": ["Mandatory", "Recommended", "Optional", "Conditional"] },
    "description": { "type": "string", "x-help": "what this Pack contributes (Ch.5 §8)" },
    "owner": { "type": "string", "x-help": "owning team/organisation (§8)" },
    "publisher": { "type": "string", "x-help": "publisher (§8)" },
    "compositionStrategy": { "type": "string", "x-help": "how contributions compose (§8; recorded, not yet enforced — §19.8)" },
    "supportedPlatformVersion": { "type": "string", "x-help": "target platform version (§8/§13)" },
    "minSupportedPlatformVersion": { "type": "string", "x-help": "minimum supported platform version (§13)" },
    "maxSupportedPlatformVersion": { "type": "string", "x-help": "maximum supported platform version, optional (§13)" },
    "incompatiblePackVersions": { "type": "string", "x-help": "comma-separated incompatible pack codes/versions (§13)" },
    "migrationGuidance": { "type": "string", "x-help": "migration guidance where applicable (§13)" },
    "dependencies": {
      "type": "array", "x-widget": "referential-list", "x-referential-source": "pack-code",
      "items": { "type": "object", "properties": {
        "packCode": { "type": "string", "x-referential": "pack-code" },
        "version": { "type": "string" },
        "type": { "type": "string", "enum": ["required", "optional", "conditional", "incompatible"], "default": "required" }
      } }
    },
    "contributionCapabilities": {
      "type": "array", "x-widget": "referential-list", "x-help": "§9 Capabilities this Pack contributes",
      "items": { "type": "object", "properties": {
        "code": { "type": "string" }, "name": { "type": "string" }, "description": { "type": "string" }, "category": { "type": "string" }
      } }
    },
    "contributionServices": {
      "type": "array", "x-widget": "referential-list", "x-help": "§9 Services",
      "items": { "type": "object", "properties": {
        "code": { "type": "string" }, "capabilityCode": { "type": "string" }, "name": { "type": "string" }, "contractDescription": { "type": "string" }
      } }
    },
    "contributionAuthorityRules": {
      "type": "array", "x-widget": "referential-list", "x-help": "§9 Decision Rules",
      "items": { "type": "object", "properties": {
        "code": { "type": "string" }, "governedTransition": { "type": "string" }, "authorisedRole": { "type": "string" }
      } }
    },
    "contributionPolicies": {
      "type": "array", "x-widget": "referential-list", "x-help": "§9 Policies / Standards",
      "items": { "type": "object", "properties": {
        "code": { "type": "string" }, "name": { "type": "string" },
        "constraintType": { "type": "string", "enum": ["Policy", "Standard"] },
        "governedTransition": { "type": "string" }, "severity": { "type": "string" }
      } }
    },
    "contributionQualityGates": {
      "type": "array", "x-widget": "referential-list", "x-help": "§9 Quality Gates (verifiable — §20)",
      "items": { "type": "object", "properties": {
        "code": { "type": "string" }, "name": { "type": "string" },
        "entityType": { "type": "string" }, "fromState": { "type": "string" }, "toState": { "type": "string" },
        "statement": { "type": "string" },
        "classification": { "type": "string", "enum": ["machine-verifiable", "judgment", "human-attested"] },
        "externalEvidence": { "type": "boolean" },
        "prompt": { "type": "string" },
        "participant": { "type": "string", "enum": ["AI", "AI+human", "human"] },
        "outputContract": { "type": "string", "enum": ["passed-failed-notes", "assessment-acceptance"] },
        "assurance": { "type": "string" }
      } }
    },
    "contributionChecklists": {
      "type": "array", "x-widget": "referential-list", "x-help": "§9 Checklists — one row per item; classification is per item (§20.5)",
      "items": { "type": "object", "properties": {
        "checklist": { "type": "string" }, "statement": { "type": "string" },
        "classification": { "type": "string", "enum": ["machine-verifiable", "judgment", "human-attested"] },
        "externalEvidence": { "type": "boolean" },
        "prompt": { "type": "string" },
        "participant": { "type": "string", "enum": ["AI", "AI+human", "human"] },
        "outputContract": { "type": "string", "enum": ["passed-failed-notes", "assessment-acceptance"] },
        "assurance": { "type": "string" }
      } }
    },
    "contributionReviewGates": {
      "type": "array", "x-widget": "referential-list", "x-help": "§9 Review Gates (judgment by nature — §20.5)",
      "items": { "type": "object", "properties": {
        "code": { "type": "string" }, "statement": { "type": "string" },
        "classification": { "type": "string", "enum": ["machine-verifiable", "judgment", "human-attested"] },
        "externalEvidence": { "type": "boolean" },
        "prompt": { "type": "string" },
        "participant": { "type": "string", "enum": ["AI", "AI+human", "human"] },
        "outputContract": { "type": "string", "enum": ["passed-failed-notes", "assessment-acceptance"] },
        "assurance": { "type": "string" }
      } }
    },
    "contributionObligationDefinitions": {
      "type": "array", "x-widget": "referential-list", "x-help": "§9 Obligation Definitions",
      "items": { "type": "object", "properties": {
        "code": { "type": "string" }, "obligationType": { "type": "string" }, "statement": { "type": "string" },
        "classification": { "type": "string", "enum": ["machine-verifiable", "judgment", "human-attested"] },
        "externalEvidence": { "type": "boolean" },
        "prompt": { "type": "string" },
        "participant": { "type": "string", "enum": ["AI", "AI+human", "human"] },
        "outputContract": { "type": "string", "enum": ["passed-failed-notes", "assessment-acceptance"] },
        "assurance": { "type": "string" }
      } }
    },
    "contributionsCompliance": { "type": "object", "x-widget": "json", "x-help": "Advanced — complianceFrameworks[] / complianceRequirements[] (kept raw JSON; deeply nested)" }
  }
}
$json$::jsonb
 WHERE entity_kind = 'Pack' AND version = 1;
