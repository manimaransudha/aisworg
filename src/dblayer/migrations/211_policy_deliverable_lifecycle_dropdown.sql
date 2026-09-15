-- Owner: "Applicability Deliverable Lifecycle - should have the verbs
-- corresponding to Deliverable as a dropdown" -> clarified: the real
-- Deliverable lifecycle STATES, not Authority Vocabulary verbs -> "no.
-- applicabilityDeliverableLifecycle is not OntologyComposable" -> "the
-- dropdown should show the applicable transitions so it's more clear" —
-- because a bare state NAME is ambiguous (e.g. "Active" is both a from_state
-- and a to_state across several real Deliverable hops) and the raw state
-- list conflates Deliverable's two real lifecycles that share
-- entity_type='Deliverable' with nothing to tell them apart: the Deliverable
-- DEFINITION's own authoring lifecycle (Draft..Archived) and an SEU
-- execution instance's own lifecycle (Defined/In Progress/Approved/
-- Baselined). Storing the real EDGE (Deliverable|From|To, same shape
-- governedTransition/"transition-definition" already use) removes the
-- ambiguity — confirmed against Ch.24 §9 directly: the spec only says
-- "Deliverable lifecycle state," no narrower detail, so every real state (11
-- today) is in scope, not a guessed subset.
--
-- Was: {"type":"string","x-configurable":true} — free comma-separated text,
-- validated only after the fact against a hardcoded 4-state Set. Now: a real
-- referential-multi-select sourced from the new "deliverable-transition"
-- registry key (web/sdkAuthoring.ts, core/policyDefinitions.ts's
-- listDeliverableLifecycleTransitions), not Ontology (no x-ontology, no
-- x-ontology-composable — the real state machine, not an extensible
-- vocabulary). `x-configurable` stays — still one of CR-088's three Policy
-- Applicability Exposable-Parameter candidates.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,applicabilityDeliverableLifecycle}',
                  '{
                    "type": "array",
                    "items": { "type": "string" },
                    "x-widget": "referential-multi-select",
                    "x-referential-source": "deliverable-transition",
                    "x-configurable": true,
                    "x-group": "applicability",
                    "x-help": "Which Deliverable transitions this Policy governs — a real dropdown sourced from the live Deliverable transition_definitions edges (Ch.24 §9), not a free-typed list and not Ontology-composable (this is the real state machine, not an extensible vocabulary). Naming more than one transition materializes a separate governed Policy row per transition. Empty = matches every state today; narrowable downstream (configurable). Ignored when governedTransition is set directly, or when scope is Eligibility."
                  }'::jsonb,
                  true
                )
 WHERE entity_kind = 'Policy'
   AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Policy')
   AND schema->'properties' ? 'applicabilityDeliverableLifecycle';

-- Owner: "the policy can be available to any number of deliverables as well.
-- So I can apply 2 reviewers required to code and deployment plan" — real
-- runtime enforcement of Policy's own Applicability Deliverable Names, which
-- until now was declared on the Definition but never even copied onto the
-- materialized `policies` row, and never consulted by policyEngine.ts at
-- all (zero applicability logic existed there). Reuses the EXACT mechanism
-- quality_gates.applicability_deliverable_names already has (migration
-- 204/qualityGateEngine.ts): a real array column, filtered at evaluation
-- time by the actual Deliverable entity's own name — not fanned out into
-- multiple rows (unlike lifecycle transitions, a name is a filter, not a
-- per-row identity), empty = matches every deliverable name.
ALTER TABLE policies ADD COLUMN IF NOT EXISTS applicability_deliverable_names TEXT[] NOT NULL DEFAULT '{}';
