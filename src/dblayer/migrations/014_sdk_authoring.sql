-- SDK / Authoring UI Layer — design/mvp-build-plan/SDK UI Layer Plan.md.
-- Pack, Template, Profile and Transition Definition are authored as
-- Deliverables via their own bootstrap Template (Core Principle) — this
-- migration adds the supporting schema: where a grammar lives
-- (schema_definitions), where in-progress authored content lives
-- (deliverable_authoring_content), the Quality-Gate-applies-uniformly
-- category column on transition_definitions, and the participants.user_id
-- link the SEU Registry's per-user filtering needs (design doc's "SEU
-- Registry visibility" section).

-- schema_definitions: one row per (entity kind, schema version). The schema
-- and its validator share one version (design doc's versioning section) — no
-- separate validator artifact, the JSON Schema document itself is what both
-- the generic form generator and the generic validator read.
CREATE TABLE IF NOT EXISTS schema_definitions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_kind   TEXT NOT NULL CHECK (entity_kind IN ('Pack', 'Template', 'Profile', 'TransitionDefinition')),
  version       INTEGER NOT NULL,
  schema        JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_kind, version)
);

-- The bootstrap Deliverable itself only carries lifecycle state — this is
-- where the actual in-progress document lives while a Pack/Template/Profile/
-- Transition Definition is being authored. schema_definition_id records
-- which grammar version this content was authored against, permanently
-- (design doc: "an instance declares which one it was authored against, and
-- gets checked against exactly that pair, permanently").
CREATE TABLE IF NOT EXISTS deliverable_authoring_content (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id        UUID NOT NULL UNIQUE REFERENCES deliverables(id),
  schema_definition_id  UUID NOT NULL REFERENCES schema_definitions(id),
  content               JSONB NOT NULL DEFAULT '{}',
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Considered and rejected forking transition_definitions' lookup key by
-- category (design doc's Transition Definition section) — Quality Gates
-- apply uniformly to every Deliverable at a given transition regardless of
-- category, reusing the existing raiseAttentionItem-on-block path rather
-- than a new per-category override mechanism. category is added for
-- reference only, nullable, never read by transitionEngine/qualityGateEngine.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transition_definitions' AND column_name = 'category') THEN
    ALTER TABLE transition_definitions ADD COLUMN category TEXT;
  END IF;
END $$;

-- participants had no link to a real user account at all (display_name was a
-- free-text string). Needed for the SEU Registry's "show SEUs I requested or
-- am a Participant on, not all SEUs" filter (design doc's "SEU Registry
-- visibility" section) — nullable because AI/External participants aren't
-- real accounts. Explicit stopgap ahead of real Participant deployment, per
-- that section.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'participants' AND column_name = 'user_id') THEN
    ALTER TABLE participants ADD COLUMN user_id INTEGER REFERENCES users(id);
  END IF;
END $$;

-- Access control for the four authoring surfaces (design doc's "Access
-- control" section, reconciled with Phase 10's actual mechanics): the
-- Deliverable-transition badge check (transitionEngine + badgeAuthorityEngine)
-- and Work Item dispatch (executionEngine) are both scoped per-SEU, which
-- doesn't fit "grant someone Pack Creator once, they author many Packs over
-- time" — every bootstrap SEU is a different seu_id. Resolution, reusing
-- existing machinery with no engine changes:
--   - Two new flat, Platform-scoped badges gate the four authoring UIs at the
--     route level via the existing requirePlatformBadge, the same way
--     Identity Management is gated by 'root'.
--   - Underneath, each of the four gets its own Capability, and all four
--     share one placeholder Pack row purely to exist as a real `packs.code`
--     for badge_grants' existing SEU_or_Pack scope validation to resolve
--     against — so a single scoped creator/approver grant, auto-provisioned
--     the first time a flat-badge holder acts (src/routes/seu/core/
--     sdkAuthoring.ts), covers every bootstrap SEU they'll ever author, not
--     just one.
INSERT INTO badge_types (tenant_id, code, name, scope_kind, tiered, is_registration_default) VALUES
  (NULL, 'sdk_creator',  'SDK Creator',  'None', FALSE, FALSE),
  (NULL, 'sdk_approver', 'SDK Approver', 'None', FALSE, FALSE)
ON CONFLICT DO NOTHING;

INSERT INTO capabilities (code, name, description, category) VALUES
  ('pack-authoring', 'Pack Authoring', 'Producing capability for the bootstrap Deliverable that authors a Pack definition', 'Platform'),
  ('template-authoring', 'Template Authoring', 'Producing capability for the bootstrap Deliverable that authors a Template definition', 'Platform'),
  ('profile-authoring', 'Profile Authoring', 'Producing capability for the bootstrap Deliverable that authors a Profile definition', 'Platform'),
  ('transition-definition-authoring', 'Transition Definition Authoring', 'Producing capability for the bootstrap Deliverable that authors a Transition Definition', 'Platform')
ON CONFLICT (code) DO NOTHING;

INSERT INTO packs (code, name, category, pack_version, status, installation_classification, contributions, dependencies)
VALUES ('sdk-authoring-scope', 'SDK Authoring Scope (badge-scope anchor, not a real Pack)', 'Platform', '1.0.0', 'Active', 'Optional', '{}', '[]')
ON CONFLICT (code, pack_version) DO NOTHING;

-- Bootstrap: the first schema version for Pack, seeded directly (design
-- doc's "Bootstrap" paragraph — no UI path to create the very first schema
-- from nothing). Mirrors PackSeedInput (src/routes/seu/core/packs.ts) closely
-- enough for the generic form generator/validator to drive Pack authoring;
-- `contributions` is deliberately left as a single JSON document field
-- (x-widget: json) rather than expanded into the full nested grammar for
-- every contribution type — Ch.5/38/39's fuller shape is future grammar
-- versions, additive, per the versioning section.
INSERT INTO schema_definitions (entity_kind, version, schema)
SELECT 'Pack', 1, $json$
{
  "type": "object",
  "required": ["code", "name", "category", "packVersion", "installationClassification", "contributions"],
  "properties": {
    "code": { "type": "string", "minLength": 1 },
    "name": { "type": "string", "minLength": 1 },
    "category": { "type": "string", "enum": ["Platform", "Organisation", "Domain", "Compliance", "Technology", "Integration"] },
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
WHERE NOT EXISTS (SELECT 1 FROM schema_definitions WHERE entity_kind = 'Pack' AND version = 1);
