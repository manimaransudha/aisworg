-- CR-049 Phase 1 — Deliverable becomes a first-class authored entity, the
-- same shape Pack/Template/Profile already are. Mirrors `templates` (migration
-- 002/059/062) column-for-column, deliberately its own table rather than new
-- columns on the shared `ontology_concepts` (owner: "Is parent_template_id in
-- the ontology table?" — no, it's on `templates`; every authored entity here
-- has its own table, none of them live on a table other unrelated entities
-- share). `ontology_concepts` itself is untouched by this migration.
--
-- The link to Ontology (the `deliverable-name` concept vocabulary CR-038's
-- Template `deliverableCatalogue` picker already reads) is a materialise step
-- in application code (core/deliverableDefinitions.ts), not a schema
-- relationship — the same "publish writes onto the real thing other surfaces
-- read" pattern materialiseTemplateDraft already uses for Pack selections and
-- the dependency graph.
CREATE TABLE IF NOT EXISTS deliverable_definitions (
  id                                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                              TEXT NOT NULL,
  description                       TEXT,
  version                           TEXT NOT NULL DEFAULT '1.0.0',
  status                            TEXT NOT NULL DEFAULT 'Draft'
                                       CHECK (status IN ('Draft', 'Validated', 'Published', 'Active', 'Deprecated', 'Retired', 'Archived')),
  draft_content                     JSONB,
  authored_by                       BIGINT,
  tenant_id                         UUID NOT NULL REFERENCES tenants(id),
  parent_deliverable_definition_id  UUID REFERENCES deliverable_definitions(id),
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT deliverable_definitions_code_version_tenant_key UNIQUE (code, version, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_deliverable_definitions_authored_by ON deliverable_definitions (authored_by);
CREATE INDEX IF NOT EXISTS idx_deliverable_definitions_tenant_id ON deliverable_definitions (tenant_id);

-- schema_definitions (migration 014) gates entity_kind to a fixed CHECK list —
-- widen it for the 4th authored kind. The schema row itself starts complete
-- (unlike Template's own 10+ accumulated incremental field-migrations) since
-- this grammar is small and fixed from day one: code, description,
-- definitionVersion. parentDeliverableDefinitionId is deliberately NOT a
-- schema field — mirrors Template's own parentTemplateId, which is a
-- separate "Inherit" control outside the generic form engine, not a JSON
-- Schema property.
ALTER TABLE schema_definitions DROP CONSTRAINT IF EXISTS schema_definitions_entity_kind_check;
ALTER TABLE schema_definitions ADD CONSTRAINT schema_definitions_entity_kind_check
  CHECK (entity_kind IN ('Pack', 'Template', 'Profile', 'TransitionDefinition', 'Deliverable'));

INSERT INTO schema_definitions (entity_kind, version, schema)
SELECT 'Deliverable', 1, $json$
{
  "type": "object",
  "required": ["code", "definitionVersion"],
  "properties": {
    "code": { "type": "string", "minLength": 1, "x-help": "The deliverable's canonical name, e.g. \"Requirements Specification\" — this is what ends up in a Template's Deliverable Catalogue picker." },
    "description": { "type": "string", "x-widget": "textarea", "x-help": "What this kind of Deliverable is for — authored once on the Definition, not re-typed per SEU instance." },
    "definitionVersion": { "type": "string", "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$", "x-help": "semver, e.g. 1.0.0" }
  }
}
$json$::jsonb
WHERE NOT EXISTS (SELECT 1 FROM schema_definitions WHERE entity_kind = 'Deliverable' AND version = 1);
