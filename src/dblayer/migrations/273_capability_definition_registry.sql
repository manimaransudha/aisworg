-- CR-111 (Capability Registry) — Capability's "design (firmed)" pass:
-- capability_definitions (migration 265) becomes a full SDK-authored entity,
-- same family as Service Definition (153) and Policy Definition (167).
-- Precedent used is Service Definition specifically — standalone catalog
-- table, no relationship to any other entity structurally (only referenced
-- BY other entities via its own Ontology code, capability-name, migration
-- 046), own governed lifecycle, `draft_content` JSONB, `parent_*_id` for
-- versioning (owner: "versioning is always a new row" — the platform's
-- standing model, not a per-entity choice).
--
-- Lifecycle: Service Definition's lean 6-state, verbatim (owner, deciding
-- among Service's 6-state / Policy's 7-state / no lifecycle at all) —
-- Defined -> Published -> Active -> Deprecated -> Retired -> Archived.
--
-- `roles` (migration 265's own JSONB, [{name, worktypes[]}]) stays a JSONB
-- column — now governed by the schema below instead of being unvalidated:
-- each role's `name` -> role-name (migration 263), each role's `worktypes[]`
-- -> worktype-name (migration 264), both real Ontology concept types added
-- specifically for this.
ALTER TABLE capability_definitions DROP CONSTRAINT IF EXISTS capability_definitions_code_tenant_key;

ALTER TABLE capability_definitions
  ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Defined'
    CHECK (status IN ('Defined', 'Published', 'Active', 'Deprecated', 'Retired', 'Archived')),
  ADD COLUMN IF NOT EXISTS draft_content JSONB,
  ADD COLUMN IF NOT EXISTS authored_by BIGINT,
  ADD COLUMN IF NOT EXISTS parent_capability_definition_id UUID REFERENCES capability_definitions(id),
  ADD COLUMN IF NOT EXISTS schema_definition_id UUID REFERENCES schema_definitions(id);

ALTER TABLE capability_definitions
  ADD CONSTRAINT capability_definitions_code_version_tenant_key UNIQUE (code, version, tenant_id);

-- Widen schema_definitions to the 8th authored kind, same one-line pattern
-- 081/153/167 each used before it.
ALTER TABLE schema_definitions DROP CONSTRAINT IF EXISTS schema_definitions_entity_kind_check;
ALTER TABLE schema_definitions ADD CONSTRAINT schema_definitions_entity_kind_check
  CHECK (entity_kind IN ('Pack', 'Template', 'Profile', 'TransitionDefinition', 'Deliverable', 'Service', 'Policy', 'Capability'));

INSERT INTO schema_definitions (entity_kind, version, schema)
SELECT 'Capability', 1, $json$
{
  "type": "object",
  "required": ["code", "defaultLabel"],
  "properties": {
    "code": { "type": "string", "minLength": 1, "x-ontology": true, "x-referential-source": "capability-name", "x-help": "The Capability's own canonical Ontology identity (capability-name concept type, migration 046), e.g. \"requirements-analysis\"." },
    "defaultLabel": { "type": "string", "minLength": 1, "x-help": "Display label, e.g. \"Analysing engineering requirements\"." },
    "description": { "type": "string", "x-widget": "textarea", "x-help": "What this Capability covers." },
    "roles": {
      "type": "array",
      "x-widget": "referential-list",
      "x-help": "The roles this Capability decomposes into, each with the worktypes it covers — what Capability fulfillment is matched against.",
      "items": {
        "type": "object",
        "required": ["name"],
        "x-property-order": ["name", "worktypes"],
        "properties": {
          "name": { "type": "string", "x-referential": "role-name", "x-ontology": true, "x-help": "role-name concept (migration 263)." },
          "worktypes": { "type": "array", "x-referential": "worktype-name", "x-multi": true, "x-ontology": true, "x-help": "worktype-name concept(s) (migration 264) this role covers." }
        }
      }
    }
  }
}
$json$::jsonb
WHERE NOT EXISTS (SELECT 1 FROM schema_definitions WHERE entity_kind = 'Capability' AND version = 1);

-- Backfill migration 265's own 40 seeded rows: real content already, not a
-- fresh Draft cycle — same immediate-Active backfill treatment migration
-- 266 gave Pack's own pre-existing rows via schema_definition_id, one step
-- further here since a fresh `status` column also needs a value that
-- reflects "this already exists and is the live truth," not "nobody has
-- authored/published this yet."
UPDATE capability_definitions
   SET status = 'Active',
       schema_definition_id = (SELECT id FROM schema_definitions WHERE entity_kind = 'Capability' ORDER BY version DESC LIMIT 1)
 WHERE schema_definition_id IS NULL;

-- CR-110 route_authority — Registry view route, same "GET, roles:
-- ['participant']" treatment every other Definition Registry's own view
-- route already has (Service/Policy, migration 261); Copy mirrors their own
-- POST .../:id/copy row. Capability's own authoring routes
-- (/aisworg/seu/sdk/capability-authoring/*) are covered by route_authority's
-- existing, deliberate exclusion for kind-based dynamic sdkAuthoring.ts
-- routes (migration 261's own header) — no new row needed for those.
INSERT INTO route_authority (method, path, badges, roles, match_mode) VALUES
  ('GET',  '/aisworg/seu/capability-definitions',                     '{}', ARRAY['participant'], 'all'),
  ('POST', '/aisworg/seu/capability-definitions/:id/copy',            '{}', ARRAY['participant'], 'all')
ON CONFLICT (method, path) DO NOTHING;

-- Retire the old thin, read-only capability-name Ontology list page (owner:
-- "retire it") — superseded by the Registry route above, now that
-- capability_definitions is the full governed catalog. web/capabilityRegistry.ts,
-- its view, and its navbar entry are all removed in this same pass.
DELETE FROM route_authority WHERE method = 'GET' AND path = '/aisworg/seu/capabilities';
