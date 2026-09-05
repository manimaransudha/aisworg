-- CR-089 — Policy Definition (Book 3 Ch.24), the canonical, standalone
-- catalog table — same architectural move CR-086/153 made for Service:
-- `policy_definitions` is authored independently, not owned by any Pack,
-- with NO relationship to any other entity (unlike Service Definition's 1:1
-- tie to Capability) — owner: "there is no relationship with any other
-- entity." The existing, Pack-owned `policies` table (migration 106+) is
-- untouched by this migration; retrofitting it to reference
-- `policy_definitions` is a separate, later step (CR-089's own open
-- question 2/3), not this one.
--
-- Lifecycle: Chapter 24 §13's own 7-state diagram verbatim (Draft ->
-- Validated -> Published -> Active -> Deprecated -> Retired -> Archived) —
-- NOT Service Definition's leaner 6-state one (Defined -> Published -> ...,
-- no Validated step). Owner, resolving that exact discrepancy: "Stick to
-- the policy lifecycle defined in chapter 24 for policy." The `authority_
-- nouns`/`transitions` vocabulary for this same 7-state lifecycle was
-- already added (`Policy` noun, `src/dblayer/seed/data/
-- authorityVocabulary.json`) ahead of this table's own creation.
--
-- Fields mirror `design/fragments/policies.md`'s now-settled structure
-- exactly (identifier/name/description/category/constraintType/
-- applicability/conditions/version — Ch.24 §8's own list, minus
-- Originating Pack, Required Evidence, Related Obligations, and Exception
-- Rules as their own top-level fields, all of which nest inside each
-- condition instead, per that same document's own header).
--
-- `configurable` is a schema-level annotation (`x-configurable: true`), not
-- a nested JSON envelope — `formGenerator.ts`'s own item-field kinds
-- ("string"|"enum"|"boolean"|"referential"|"referential-multi"|
-- "nested-list") have no "object" kind, so a literal nested
-- `configurable: { severity }`-style envelope isn't renderable by the real
-- authoring form without extending the form generator itself. `x-configurable:
-- true` marks the SAME fields (constraintType, the three applicability
-- fields) as tunable, discoverable by inspecting the schema itself — the
-- same "downstream systems know by structure, not by prose" requirement,
-- realised the way this schema mechanism actually supports today. Owner,
-- confirming this trade: "Let us go with flat fields + x-configurable: true."
--
-- applicabilityDeliverableNames/applicabilityEnvironments are real
-- Ontology-backed multi-selects (`x-widget: "referential-multi-select"`,
-- the same top-level mechanism Profile's own multi-value Ontology fields
-- use) — deliverable-name and category:environment (migration 166)
-- respectively. applicabilityDeliverableLifecycle has no Ontology backing
-- (it names real `transition_definitions` states for entity_type=
-- 'Deliverable' — Defined/In Progress/Approved/Baselined — a different
-- canonical source entirely) and no existing "fixed-enum multi-select"
-- widget exists in this schema mechanism, so it's a plain comma-separated
-- string, the same simple convention `conditionValues` already uses on the
-- existing Pack-owned `policies` schema (migration 109).
--
-- `conditions` is `x-widget: "json"` rather than a `referential-list` —
-- each condition nests its own `requiredEvidence`/`exceptionRules`/
-- `relatedObligations` arrays of objects, a third level of nesting
-- `nested-list` (Checklist's own two-level precedent) doesn't reach. Kept
-- as the fragment's own full, rich shape rather than lossily flattened to
-- fit the generic mechanism.
CREATE TABLE IF NOT EXISTS policy_definitions (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                            TEXT NOT NULL,
  name                            TEXT NOT NULL,
  description                     TEXT,
  category                        TEXT NOT NULL DEFAULT 'Engineering',
  constraint_type                 TEXT NOT NULL DEFAULT 'Policy'
                                     CHECK (constraint_type IN ('Policy', 'Standard')),
  applicability_deliverable_names TEXT[] NOT NULL DEFAULT '{}',
  applicability_environments      TEXT[] NOT NULL DEFAULT '{}',
  applicability_deliverable_lifecycle TEXT[] NOT NULL DEFAULT '{}',
  conditions                      JSONB NOT NULL DEFAULT '[]',
  version                         TEXT NOT NULL DEFAULT '1.0.0',
  status                          TEXT NOT NULL DEFAULT 'Draft'
                                     CHECK (status IN ('Draft', 'Validated', 'Published', 'Active', 'Deprecated', 'Retired', 'Archived')),
  draft_content                   JSONB,
  authored_by                     BIGINT,
  tenant_id                       UUID NOT NULL REFERENCES tenants(id),
  parent_policy_definition_id     UUID REFERENCES policy_definitions(id),
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT policy_definitions_code_version_tenant_key UNIQUE (code, version, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_policy_definitions_authored_by ON policy_definitions (authored_by);
CREATE INDEX IF NOT EXISTS idx_policy_definitions_tenant_id ON policy_definitions (tenant_id);

-- Widen schema_definitions to the 7th authored kind, same pattern migration
-- 153 used for the 6th (Service).
ALTER TABLE schema_definitions DROP CONSTRAINT IF EXISTS schema_definitions_entity_kind_check;
ALTER TABLE schema_definitions ADD CONSTRAINT schema_definitions_entity_kind_check
  CHECK (entity_kind IN ('Pack', 'Template', 'Profile', 'TransitionDefinition', 'Deliverable', 'Service', 'Policy'));

INSERT INTO schema_definitions (entity_kind, version, schema)
SELECT 'Policy', 1, $json$
{
  "type": "object",
  "required": ["code", "name", "category", "constraintType"],
  "x-property-order": ["code", "name", "description", "category", "constraintType", "applicabilityDeliverableNames", "applicabilityEnvironments", "applicabilityDeliverableLifecycle", "conditions"],
  "properties": {
    "code": { "type": "string", "minLength": 1, "x-help": "A short, unique identifier for this canonical Policy (e.g. \"architecture-documentation-required\")." },
    "name": { "type": "string", "minLength": 1, "x-help": "Display name, e.g. \"Architecture Documentation Required\"." },
    "description": { "type": "string", "x-widget": "textarea", "x-help": "What this Policy requires, in plain language." },
    "category": { "type": "string", "x-widget": "referential-select", "x-referential-source": "category:policy", "x-ontology": true, "x-help": "Ch.24 §7's own Policy category — independent of, and never needs to match, any Gate that references this Policy." },
    "constraintType": { "type": "string", "enum": ["Policy", "Standard"], "x-configurable": true, "x-help": "Policy = mandatory, blocks the governed transition on violation. Standard = preferred, traceable but never blocks. Configurable: cascades Pack → Template → Profile." },
    "applicabilityDeliverableNames": { "type": "array", "items": { "type": "string" }, "x-widget": "referential-multi-select", "x-referential-source": "deliverable-name", "x-ontology": true, "x-configurable": true, "x-help": "Which deliverable-names this Policy governs. Empty = matches every deliverable today; narrowable downstream (configurable)." },
    "applicabilityEnvironments": { "type": "array", "items": { "type": "string" }, "x-widget": "referential-multi-select", "x-referential-source": "category:environment", "x-ontology": true, "x-configurable": true, "x-help": "Which environments this Policy governs. Empty = matches every environment today; narrowable downstream (configurable)." },
    "applicabilityDeliverableLifecycle": { "type": "string", "x-configurable": true, "x-help": "Comma-separated Deliverable lifecycle states this Policy governs, from: Defined, In Progress, Approved, Baselined (real transition_definitions states for entity_type=Deliverable, not Ontology). Empty = matches every state today; narrowable downstream (configurable)." },
    "conditions": { "type": "array", "x-widget": "json", "x-help": "The independently-checkable predicates this Policy declares, as a JSON array. Each condition: statement, requiredEvidence[] (always present, [] if none), severity (x-configurable), exceptionRules[] (always present, [] if none), relatedObligations[] (always present, [] if none)." }
  }
}
$json$::jsonb
WHERE NOT EXISTS (SELECT 1 FROM schema_definitions WHERE entity_kind = 'Policy' AND version = 1);
