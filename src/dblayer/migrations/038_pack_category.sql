-- CR-015 — Pack authoring: data-driven categories + UUID codes.
--
-- 1) pack_category becomes DATA (like authority_nouns), so a new category is an
--    INSERT, not a migration — closes Ch.5 §19.6 / §17 ("new categories without
--    kernel change"). The hardcoded packs.category CHECK is dropped; category is
--    validated in code against active pack_category rows (core/packs.ts).
-- 2) The Pack authoring grammar (schema_definitions v1) is updated: `code` is no
--    longer a user field (it is a system UUID assigned at publish), and
--    `category` is a referential-select sourced from pack_category (so a new
--    category flows to the form automatically). Updating the shipped baseline
--    grammar in place (still v1) is a development-time schema correction — the
--    immutability rule (§19.2) governs RUNTIME-authored versions, and keeping it
--    v1 stays consistent with db:clean-slate's "trim schema_definitions to v1".

CREATE TABLE IF NOT EXISTS pack_category (
  code        TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO pack_category (code, label) VALUES
  ('Platform',     'Platform'),
  ('Organisation', 'Organisation'),
  ('Domain',       'Domain'),
  ('Compliance',   'Compliance'),
  ('Technology',   'Technology'),
  ('Integration',  'Integration')
ON CONFLICT (code) DO NOTHING;

-- Category is now validated against pack_category in code, not by a CHECK.
ALTER TABLE packs DROP CONSTRAINT IF EXISTS packs_category_check;

-- Update the Pack authoring grammar: drop `code` from user fields; category is a
-- referential-select sourced from pack_category. Idempotent (an UPDATE).
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
    "dependencies": {
      "type": "array",
      "x-widget": "referential-list",
      "x-referential-source": "pack-code",
      "items": {
        "type": "object",
        "properties": {
          "packCode": { "type": "string", "x-referential": "pack-code" },
          "version": { "type": "string" },
          "type": { "type": "string", "enum": ["required"], "default": "required" }
        },
        "required": ["packCode", "version", "type"]
      }
    },
    "contributions": { "type": "object", "x-widget": "json", "x-help": "capabilities[], services[], authorityRules[], policies[], qualityGates[] — see Ch.5 §9" }
  }
}
$json$::jsonb
 WHERE entity_kind = 'Pack' AND version = 1;
