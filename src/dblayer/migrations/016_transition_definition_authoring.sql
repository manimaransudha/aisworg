-- SDK UI Layer Plan, Build order step 6 — Transition Definition's own
-- authoring surface. Per the plan's Transition Definition section:
--   - Mechanism: transitionEngine.evaluate itself gains the ability to run a
--     Quality Gate check, for any entityType, reading required_quality_gate_ids
--     explicitly instead of the old coincidental (entityType, from_state,
--     to_state) match against quality_gates. This is additive and opt-in per
--     row (default '{}') — every existing transition_definitions row's
--     behavior is unchanged; Deliverable keeps working exactly as it does
--     today, via its own existing separate qualityGateEngine.evaluate call.
--   - requiredEvidenceCategories[] from the plan's own grammar list was
--     folded into required_quality_gate_ids instead, not added as a second
--     field — Evidence requirements are already fully expressible via a
--     referenced quality_gates row whose criteria is
--     requires_accepted_evidence_or_approved_decision (already generic,
--     Open Design Questions.md #3), so a second field would just duplicate
--     that mechanism. Implementation-level resolution, not verbatim in the
--     plan's own (or similar — exact shape TBD at implementation) grammar
--     line.
--   - creates_obligation is stored (an Obligation category, or NULL — "creates,
--     does not block") but not yet mechanically enforced by any engine code;
--     see the plan's own text for this being logged as a real, separate gap.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transition_definitions' AND column_name = 'required_quality_gate_ids') THEN
    ALTER TABLE transition_definitions ADD COLUMN required_quality_gate_ids UUID[] NOT NULL DEFAULT '{}';
    ALTER TABLE transition_definitions ADD COLUMN creates_obligation TEXT;
  END IF;
END $$;

-- Bootstrap: Transition Definition's own grammar, mirroring Pack/Template/
-- Profile's (014/015_sdk_authoring*.sql). requiredQualityGateCodes/
-- requiredPolicyCodes stay simple JSON-array-of-strings fields for this
-- pass (x-widget: json) rather than a referential-list widget — unlike Pack
-- codes/Template codes, there's no single shared Registry listing endpoint
-- for quality gate/policy codes yet to back a live dropdown; additive to
-- add one later, same reasoning as Pack's own contributions field.
INSERT INTO schema_definitions (entity_kind, version, schema)
SELECT 'TransitionDefinition', 1, $json$
{
  "type": "object",
  "required": ["entityType", "fromState", "toState"],
  "properties": {
    "entityType": { "type": "string", "enum": ["SEU", "Deliverable", "Objective", "Obligation", "Evidence", "Knowledge", "Decision", "KnowledgeScope", "AttentionItem", "ExternalInteraction", "Pack"] },
    "fromState": { "type": "string", "minLength": 1 },
    "toState": { "type": "string", "minLength": 1 },
    "requiredAuthorityRuleCode": { "type": "string", "x-help": "an authority_rules.code, or leave blank for none" },
    "requiredPolicyCodes": { "type": "array", "x-widget": "json", "x-help": "array of policies.code" },
    "requiredQualityGateCodes": { "type": "array", "x-widget": "json", "x-help": "array of quality_gates.code — each gate's own (entityType, fromState, toState) must match this transition's" },
    "createsObligation": { "type": "string", "x-help": "an Obligation category to raise on success, or leave blank for none — stored, not yet enforced by any engine code" }
  }
}
$json$::jsonb
WHERE NOT EXISTS (SELECT 1 FROM schema_definitions WHERE entity_kind = 'TransitionDefinition' AND version = 1);
