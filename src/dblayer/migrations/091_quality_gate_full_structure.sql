-- CR-058 — Quality Gate: Category (Ontology-backed), Scope authored against
-- real Transition Definitions, a Required-Policies criteria type, Waiver
-- Rules (badge-gated), and independent Quality-Gate versioning.
--
-- Versioning (owner: "a pack can still be 1.0, but the quality gate
-- associated with it moves to 1.4" — new immutable row per version, same
-- shape as Pack/Template/Profile's own (code, version) identity, not an
-- in-place increment).
ALTER TABLE quality_gates
  ADD COLUMN version TEXT NOT NULL DEFAULT '1.0',
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- code was globally unique; now (code, version) is, so prior versions of the
-- same gate can coexist as history.
ALTER TABLE quality_gates DROP CONSTRAINT quality_gates_code_key;
ALTER TABLE quality_gates ADD CONSTRAINT quality_gates_code_version_key UNIQUE (code, version);

-- (entity_type, from_state, to_state) was globally unique — only one gate
-- could ever exist per transition, the root of "last Pack to publish wins"
-- (Ch.26 §19 audit). Owner: "one gate per category" — widened to include
-- category so different-category gates on the same transition coexist
-- (evaluated as an AND across gates, same semantics
-- transition_definitions.required_quality_gate_ids[] already has). A
-- partial index (WHERE is_active) keeps this a real uniqueness guarantee on
-- the CURRENT gate per (transition, category) while still allowing
-- historical (is_active = false) versions of that same tuple to exist.
ALTER TABLE quality_gates DROP CONSTRAINT quality_gates_entity_type_from_state_to_state_key;
CREATE UNIQUE INDEX quality_gates_active_scope_category_key
  ON quality_gates (entity_type, from_state, to_state, category)
  WHERE is_active;

-- Waiver Rules (§13; Ch.26 §19.10 found zero waiver mechanism for Quality
-- Gate anywhere — only Compliance has one). Modeled on compliance_waivers'
-- shape, but badge-gated (owner: real badge, not Compliance's own ungated
-- grantedBy-only pattern) via the new QualityGate/waive noun-verb pair
-- (authorityVocabulary.json). Scoped to one specific blocked entity instance
-- (quality_gate_id + entity_type/entity_id), not the gate definition
-- globally — the same gate definition can be waived for one Deliverable
-- without waiving it for every other entity it also applies to.
CREATE TABLE quality_gate_waivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quality_gate_id UUID NOT NULL REFERENCES quality_gates(id),
  seu_id UUID NOT NULL REFERENCES seus(id),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  rationale TEXT NOT NULL,
  granted_by INTEGER REFERENCES users(id),
  authority_badge TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_quality_gate_waivers_lookup ON quality_gate_waivers (quality_gate_id, entity_id, status);

-- category:quality-gate Ontology concept type — Ch.26 §7's 5 baseline
-- categories. Pack-contribution of NEW categories stays deferred (CR-056
-- gave Decision categories the same "not now" status).
INSERT INTO ontology_concepts (concept_type, code, default_label, tenant_id) VALUES
  ('category:quality-gate', 'Entry', 'Entry Gate', '11111111-1111-1111-1111-111111111111'),
  ('category:quality-gate', 'Exit', 'Exit Gate', '11111111-1111-1111-1111-111111111111'),
  ('category:quality-gate', 'Release', 'Release Gate', '11111111-1111-1111-1111-111111111111'),
  ('category:quality-gate', 'Compliance', 'Compliance Gate', '11111111-1111-1111-1111-111111111111'),
  ('category:quality-gate', 'Operational', 'Operational Gate', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (concept_type, code, tenant_id) DO NOTHING;

-- Pack authoring schema (schema_definitions, entity_kind='Pack') — the real
-- authoring form for contributionQualityGates[] didn't even expose
-- category/criteria (only the §20 verifiable-item declaration fields). Full
-- replacement of items.properties for this field:
--   - category: referential-select sourced from category:quality-gate
--     (plain x-referential, same mechanism as feature-flag/category:deliverable
--     already use inside a referential-list item — no x-ontology needed here,
--     that marker is only wired for top-level fields today).
--   - governedTransition: replaces the free-typed entityType/fromState/toState
--     triple. Owner: "The pack should not define something beyond what a
--     transition definition already holds" — a referential picker sourced
--     from real transition_definitions rows, submitted as the delimited
--     "EntityType|fromState|toState" value parsed back into the 3 real
--     columns at seedContributions time (core/packs.ts).
--   - criteriaType: the 4 real qualityGateEngine.ts criteria types, no
--     generic AND/OR (owner: settled during design — composite logic
--     resolves once, inside participant execution, never inside the gate).
--   - criteriaCategory: shared param for requires_accepted_review AND
--     requires_accepted_evidence_or_approved_decision (the latter gains this
--     param here — it had none before, confirmed missing in code).
--   - requiredPolicyCode: for the new requires_active_policy type.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,contributionQualityGates}',
                  '{
                    "type": "array",
                    "x-help": "§9 Quality Gates (verifiable — §20)",
                    "x-widget": "referential-list",
                    "items": {
                      "type": "object",
                      "properties": {
                        "code": {"type": "string"},
                        "name": {"type": "string"},
                        "category": {"type": "string", "x-referential": "category:quality-gate"},
                        "governedTransition": {"type": "string", "x-referential": "transition-definition"},
                        "criteriaType": {"type": "string", "enum": ["no_unresolved_obligations", "requires_accepted_evidence_or_approved_decision", "requires_accepted_review", "requires_active_policy"]},
                        "criteriaCategory": {"type": "string"},
                        "requiredPolicyCode": {"type": "string", "x-referential": "policy-code"},
                        "statement": {"type": "string"},
                        "prompt": {"type": "string"},
                        "assurance": {"type": "string"},
                        "participant": {"type": "string", "enum": ["AI", "AI+human", "human"]},
                        "classification": {"type": "string", "enum": ["machine-verifiable", "judgment", "human-attested"]},
                        "outputContract": {"type": "string", "enum": ["passed-failed-notes", "assessment-acceptance"]},
                        "externalEvidence": {"type": "boolean"}
                      }
                    }
                  }'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
