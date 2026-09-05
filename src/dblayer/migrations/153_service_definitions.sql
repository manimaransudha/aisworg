-- CR-086 follow-on — Service Definition (Book 3 Ch.11). Two genuinely
-- different structures, per the owner: `service_definitions` is the
-- canonical, versioned CONTRACT DEFINITION — one per capability-name code,
-- aligned 1:1 (design/fragments/services.csv) — while the existing
-- `services` table stays exactly as it is: the Pack-level COMPOSED data,
-- many rows per capability across different Packs (Ch.11 §12 Composition).
-- This migration only adds the first; `services` is untouched.
--
-- Same authored-entity shape as `deliverable_definitions` (migration 081) —
-- draft_content JSONB, tenant-scoped, parent-linked for inheritance — but
-- the owner asked for a REAL governed lifecycle here (unlike
-- deliverable_definitions' plain Draft-default), so `status` takes Ch.11
-- §13's own 6-state lifecycle verbatim: Defined -> Published -> Active ->
-- Deprecated -> Retired -> Archived. "Defined" plays Draft's usual role —
-- the noun_verb vocabulary's existing `define` verb ("birth of the entity
-- into its initial state (create-as-transition; not yet wired)") was
-- exactly built for this and had no real consumer until now.
--
-- `code` is validated against the NEW `service-name` concept-type rows
-- migration 152 just added — not `capability-name` (owner: "I do not want
-- to reuse the capability-name... [gives] future mutations easy"). The 1:1
-- alignment to Capability is its own separate `capability_code` column,
-- validated against `capability-name` instead — two independent Ontology
-- references, matching the two independent things they name.
--
-- Every CSV column is kept (owner: "keep all of the columns in csv").
-- inputs/outputs/service_level/governance/purpose/success stay plain TEXT —
-- verbatim prose from the CSV, not split into arrays (several cells are
-- continuous sentences containing incidental commas, not itemised lists;
-- splitting on comma there would corrupt content, e.g. "a structured,
-- decomposed, categorised requirement set..." is one phrase, not three).
-- `consumers` is the one column that IS a real array: it was hand-resolved
-- from the CSV's free-text Consumers column down to actual capability-name
-- codes (owner: "map to the corresponding capability-name(s) correctly").
--
-- `services.service_definition_id` (linking a Pack-composed Service back to
-- its canonical Definition) is explicitly NOT part of this migration —
-- owner: "yes, but that is for the next step, not this one."
CREATE TABLE IF NOT EXISTS service_definitions (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                          TEXT NOT NULL,
  name                          TEXT NOT NULL,
  capability_code               TEXT NOT NULL,
  purpose                       TEXT,
  inputs                        TEXT,
  outputs                       TEXT,
  service_level                 TEXT,
  governance                    TEXT,
  success                       TEXT,
  consumers                     TEXT[] NOT NULL DEFAULT '{}',
  version                       TEXT NOT NULL DEFAULT '1.0.0',
  status                        TEXT NOT NULL DEFAULT 'Defined'
                                   CHECK (status IN ('Defined', 'Published', 'Active', 'Deprecated', 'Retired', 'Archived')),
  draft_content                 JSONB,
  authored_by                   BIGINT,
  tenant_id                     UUID NOT NULL REFERENCES tenants(id),
  parent_service_definition_id  UUID REFERENCES service_definitions(id),
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_definitions_code_version_tenant_key UNIQUE (code, version, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_service_definitions_authored_by ON service_definitions (authored_by);
CREATE INDEX IF NOT EXISTS idx_service_definitions_tenant_id ON service_definitions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_definitions_capability_code ON service_definitions (capability_code);

-- Widen schema_definitions to the 6th authored kind, same pattern migration
-- 081 used for the 4th (Deliverable).
ALTER TABLE schema_definitions DROP CONSTRAINT IF EXISTS schema_definitions_entity_kind_check;
ALTER TABLE schema_definitions ADD CONSTRAINT schema_definitions_entity_kind_check
  CHECK (entity_kind IN ('Pack', 'Template', 'Profile', 'TransitionDefinition', 'Deliverable', 'Service'));

INSERT INTO schema_definitions (entity_kind, version, schema)
SELECT 'Service', 1, $json$
{
  "type": "object",
  "required": ["code", "name", "capabilityCode"],
  "properties": {
    "code": { "type": "string", "minLength": 1, "x-help": "The Service's own canonical, Ontology-governed identity (service-name concept type) — independent of the Capability it aligns to, e.g. \"requirements-discovery-service\"." },
    "name": { "type": "string", "minLength": 1, "x-help": "Display name, e.g. \"Requirements Discovery Service\"." },
    "capabilityCode": { "type": "string", "minLength": 1, "x-help": "The single capability-name code this Service Definition is aligned 1:1 to." },
    "purpose": { "type": "string", "x-widget": "textarea", "x-help": "What this Service is for." },
    "inputs": { "type": "string", "x-widget": "textarea", "x-help": "What this Service consumes to do its work." },
    "outputs": { "type": "string", "x-widget": "textarea", "x-help": "What this Service produces." },
    "serviceLevel": { "type": "string", "x-widget": "textarea", "x-help": "The measurable expectation this Service declares for its own delivery (Ch.11 §8)." },
    "governance": { "type": "string", "x-widget": "textarea", "x-help": "The policy/standard this Service's delivery is governed by." },
    "success": { "type": "string", "x-widget": "textarea", "x-help": "What confirms this Service met its purpose." },
    "consumers": { "type": "array", "items": { "type": "string" }, "x-help": "capability-name code(s) that consume this Service. Leave empty if consumed universally or by non-capability actors." }
  }
}
$json$::jsonb
WHERE NOT EXISTS (SELECT 1 FROM schema_definitions WHERE entity_kind = 'Service' AND version = 1);
