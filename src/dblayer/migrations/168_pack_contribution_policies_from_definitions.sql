-- CR-089 follow-on — contributionPolicies[] narrows to referencing the
-- canonical policy_definitions catalog, the same architectural move
-- 158_pack_services_from_service_definitions.sql made for contributionServices[]
-- — but flatter still: a plain list of Policy Definition codes, not an
-- object-array with per-item sub-fields (Service kept target overrides per
-- row; Policy keeps nothing per row at all).
--
-- Full replacement, not additive (mirrors 158's own jsonb_set on the whole
-- key): every prior field (name/category/constraintType/governedTransition/
-- conditionType/conditionField/conditionValues/severity) is dropped from the
-- form. The array itself IS the picker — check/uncheck against every Active
-- policy_definitions row applicable to this Pack's own declared Capabilities
-- (owner: "Similar to services, pick the ones that are applicable to the
-- contributingCapabilities[]... In the form mode, allow the user to
-- check/uncheck to select/deselect a policy").
--
-- `x-widget: "referential-multi-select"`, not "referential-list" — a
-- checkbox grid submits only its CHECKED boxes' values under one repeated
-- "contributionPolicies[]" name, which qs/Express collapse into a clean,
-- gap-free string[] (no sparse-array holes the way an indexed
-- "contributionPolicies[N][code]" object-array would produce for
-- non-consecutive checked indices). generateFields/parseFormBody
-- (formGenerator.ts) already handle this shape as a flat string array with
-- zero extra plumbing (the same path `consumers`/service_definitions
-- multi-select already uses) — only the RENDERING is bespoke
-- (_generatedFieldGroups.ejs's own new "contributionPolicies" special case,
-- a checkbox grid instead of the generic Ontology-sourced <select multiple>,
-- since a canonical Policy isn't an Ontology concept).
--
-- governedTransition — required on the real Pack-composed `policies` table
-- (Quality Gate's requiredPolicyCodes depends on it) but deliberately absent
-- from policy_definitions ("there is no relationship with any other
-- entity") — is DERIVED at publish time (core/packs.ts's seedContributions),
-- not authored here at all. Owner: "is not deliverable_lifecycle equivalent
-- of that?" — yes: every canonical Policy's own applicabilityDeliverableLifecycle
-- names which real Deliverable lifecycle state(s) it governs; the derived
-- governedTransition is the transition_definitions edge LANDING on the
-- most-advanced named state (or landing on Baselined, the final gate, when
-- the list is empty — "matches every state" per CR-089's own convention).
-- Every one of the 34 canonical policies derives to the same edge today
-- (Deliverable|Approved|Baselined), since none currently scope to an
-- earlier-only state — the mechanism still generalises correctly the moment
-- one does.
UPDATE schema_definitions
   SET schema = jsonb_set(
                  schema,
                  '{properties,contributionPolicies}',
                  '{
                    "type": "array",
                    "items": {"type": "string"},
                    "x-help": "§9 Policies / Standards this Pack adopts from the canonical Policy Definitions (Ch.24), scoped to whichever ones govern a deliverable-name produced by this Pack own declared Capabilities.",
                    "x-widget": "referential-multi-select"
                  }'::jsonb,
                  true
                )
 WHERE entity_kind = 'Pack' AND version = (SELECT MAX(version) FROM schema_definitions WHERE entity_kind = 'Pack');
