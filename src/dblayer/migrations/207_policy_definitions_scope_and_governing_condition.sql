-- CR-104 follow-up (owner: "we have to fix publishPack also. it should not
-- override anything") — the real gap this closes: publishPack's own Policy
-- adoption (contributions.policies) always derived governedTransition from
-- applicability_deliverable_lifecycle (a Deliverable-only field) and always
-- hardcoded condition to {type: "always_true"}, so no Policy Definition
-- could ever be adopted as SEU-scoped/Eligibility-scoped, or as anything a
-- real evaluation could block on. A model has to stay the same whether it
-- comes from a Platform-wide Policy Definition or a tenant's own Pack
-- (owner) — so these three columns mirror the materialised `policies`
-- table's own scope/governed_transition/condition exactly (migration 206),
-- just one layer up, on the Definition a Pack adopts from.
--
-- All three are additive and optional: every one of the 34 real seeded
-- Policy Definitions leaves them unset, so publishPack keeps deriving
-- governedTransition from applicability_deliverable_lifecycle and defaulting
-- condition to always_true for them, exactly as today — no regression.
-- governing_condition is deliberately a NEW column, not a reuse of the
-- existing `conditions` (plural) column: `conditions` is Ch.24 §8's own
-- rich, human-authored, non-evaluatable shape (statement/requiredEvidence/
-- severity/exceptionRules/relatedObligations); governing_condition is the
-- flat, machine-evaluatable shape (`{type, field, values}` /
-- `{type: "always_true"}`) evaluateCondition (policyCondition.ts) actually
-- runs — the same shape the materialised policies.condition column already
-- uses. Conflating the two would make the existing rich `conditions` field
-- lossy for its own documented purpose.
ALTER TABLE policy_definitions
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'Transition'
    CHECK (scope IN ('Transition', 'Eligibility')),
  ADD COLUMN IF NOT EXISTS governed_transition TEXT,
  ADD COLUMN IF NOT EXISTS governing_condition JSONB;

-- Widen schema_definitions to a 2nd version of the Policy authoring form
-- (same additive-version pattern every prior schema change here uses —
-- never mutates version 1 in place). New fields grouped after `conditions`
-- in x-property-order; x-help on each spells out the distinction from the
-- existing `conditions` field and from applicabilityDeliverableLifecycle.
INSERT INTO schema_definitions (entity_kind, version, schema)
SELECT 'Policy', 2, $json$
{
  "type": "object",
  "required": ["code", "name", "category", "constraintType"],
  "x-property-order": ["code", "name", "description", "category", "constraintType", "applicabilityDeliverableNames", "applicabilityEnvironments", "applicabilityDeliverableLifecycle", "conditions", "scope", "governedTransition", "governingCondition"],
  "properties": {
    "code": { "type": "string", "minLength": 1, "x-help": "A short, unique identifier for this canonical Policy (e.g. \"architecture-documentation-required\")." },
    "name": { "type": "string", "minLength": 1, "x-help": "Display name, e.g. \"Architecture Documentation Required\"." },
    "description": { "type": "string", "x-widget": "textarea", "x-help": "What this Policy requires, in plain language." },
    "category": { "type": "string", "x-widget": "referential-select", "x-referential-source": "category:policy", "x-ontology": true, "x-help": "Ch.24 §7's own Policy category — independent of, and never needs to match, any Gate that references this Policy." },
    "constraintType": { "type": "string", "enum": ["Policy", "Standard"], "x-configurable": true, "x-help": "Policy = mandatory, blocks the governed transition on violation. Standard = preferred, traceable but never blocks. Configurable: cascades Pack → Template → Profile." },
    "applicabilityDeliverableNames": { "type": "array", "items": { "type": "string" }, "x-widget": "referential-multi-select", "x-referential-source": "deliverable-name", "x-ontology": true, "x-configurable": true, "x-help": "Which deliverable-names this Policy governs. Empty = matches every deliverable today; narrowable downstream (configurable). Only meaningful when scope is Transition and governedTransition is left blank (Deliverable-lifecycle derived)." },
    "applicabilityEnvironments": { "type": "array", "items": { "type": "string" }, "x-widget": "referential-multi-select", "x-referential-source": "category:environment", "x-ontology": true, "x-configurable": true, "x-help": "Which environments this Policy governs. Empty = matches every environment today; narrowable downstream (configurable)." },
    "applicabilityDeliverableLifecycle": { "type": "string", "x-configurable": true, "x-help": "Comma-separated Deliverable lifecycle states this Policy governs, from: Defined, In Progress, Approved, Baselined (real transition_definitions states for entity_type=Deliverable, not Ontology). Empty = matches every state today; narrowable downstream (configurable). Ignored when governedTransition is set directly, or when scope is Eligibility." },
    "conditions": { "type": "array", "x-widget": "json", "x-help": "The independently-checkable predicates this Policy declares, as a JSON array, for humans and audit (Ch.24 §8) — not evaluated by the engine at runtime. Each condition: statement, requiredEvidence[] (always present, [] if none), severity (x-configurable), exceptionRules[] (always present, [] if none), relatedObligations[] (always present, [] if none)." },
    "scope": { "type": "string", "enum": ["Transition", "Eligibility"], "x-help": "CR-104. Transition (default) governs a real state hop — leave governedTransition blank to derive it from applicabilityDeliverableLifecycle (Deliverable, unchanged default), or set it directly for a non-Deliverable entity (e.g. an SEU's own transition). Eligibility governs Capability Fulfilment participant selection instead — no transition at all; governedTransition is ignored." },
    "governedTransition": { "type": "string", "x-help": "Only for scope=Transition, when this Policy governs something other than a Deliverable's own lifecycle: the exact governed transition, as \"EntityType|FromState|ToState\" (e.g. \"SEU|Activated|Operational\"). Leave blank to keep deriving it from applicabilityDeliverableLifecycle, exactly as before this field existed." },
    "governingCondition": { "type": "object", "x-widget": "json", "x-help": "The real, machine-evaluatable rule the engine checks at runtime — distinct from `conditions` above (documentation only). Shape: {\"type\": \"always_true\"} (always satisfied — the default when left blank, unchanged from before this field existed) or {\"type\": \"field_in\", \"field\": \"<context field>\", \"values\": [...]}." }
  }
}
$json$::jsonb
WHERE NOT EXISTS (SELECT 1 FROM schema_definitions WHERE entity_kind = 'Policy' AND version = 2);
