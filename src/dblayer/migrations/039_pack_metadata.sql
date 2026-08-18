-- CR-018 — complete the Pack validator: §8 metadata, §10 dependency types, §13
-- compatibility fields. Declaration only — these fields are authored, validated
-- for shape, and stored; ACTING on them (dependency resolution, compatibility
-- checks, composition strategy) stays the §19.9 engine follow-ups.

-- Recorded-but-unenforced metadata lives in one JSONB column (rather than nine
-- columns nothing yet queries).
ALTER TABLE packs ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

-- Update the Pack grammar (schema_definitions v1, in place — see 038's note):
-- add §8 (description/owner/publisher/compositionStrategy/supportedPlatformVersion)
-- and §13 (min/max supported platform version, incompatible versions, migration
-- guidance); widen dependency.type to the full §10 set.
UPDATE schema_definitions
   SET schema = $json$
{
  "type": "object",
  "required": ["name", "category", "packVersion", "installationClassification", "contributions"],
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
      "type": "array",
      "x-widget": "referential-list",
      "x-referential-source": "pack-code",
      "items": {
        "type": "object",
        "properties": {
          "packCode": { "type": "string", "x-referential": "pack-code" },
          "version": { "type": "string" },
          "type": { "type": "string", "enum": ["required", "optional", "conditional", "incompatible"], "default": "required" }
        },
        "required": ["packCode", "version", "type"]
      }
    },
    "contributions": { "type": "object", "x-widget": "json", "x-help": "capabilities[], services[], authorityRules[], policies[], qualityGates[] — see Ch.5 §9" }
  }
}
$json$::jsonb
 WHERE entity_kind = 'Pack' AND version = 1;
