# CR-104 — SEU commissioning to operational

**Raised:** 2026-09-12 · **Origin:** 
How do we model the kickoff of the first deliverbale in the chain? **Status:** 🟢 Built.

## Current behavior

- The platform treats "kickoff" the same as every other governed transition: manual, badge-gated, dependency-checked. If Requirements Analysis Model is the first in the delivery chain, it has no incoming dependency row in dependency_definitions — it's the head of the chain, so dependencyDefinitionEngine.isTargetReady() already passes trivially for it. Its Defined -> In Progress transition is verb create, default_trigger: "manual" in authority_noun_verbs — by design. So no auto fire happens.  The SEU detail page already renders this as a transition button, filtered to possibleNextStates a held badge unlocks (seus.ts:38-45), same hasXBadge pattern as every other noun. So the "first kickoff" isn't a gap to design around — it's: whoever holds deliverable_create for this tenant opens the SEU detail page and clicks Start on Requirements Analysis Model. Everything downstream (Requirements Specification, then the two branches off it, etc.) stays correctly blocked until its own predecessor reaches Approved.

- Currently SEU_operationalise is just a state flip (Active → Operational) with no side effect — nobody's wired a "commence work" consequence to it yet.
"Dispatch engine gets commence-work, kicks off the first deliverable" — the "first deliverable(s)" are structurally identifiable already: whichever Deliverables have no incoming row in dependency_definitions (head-of-chain).
So the missing piece isn't a new entity — it's giving SEU_operationalise's own transition-application code (in core/seus.ts, wherever that transition is applied) the side effect of transitioning every head-of-chain Deliverable Defined -> In Progress in the same call, which cascades naturally through Execution Engine → Work Item Generator → Dispatch Engine exactly as a manual per-Deliverable click would.

- Code the SEU_operationalise to transition itself calls synchronously (same pattern ebmActivatedHandler already uses to run finalizeCommissioning), not a generic event subscriber reacting to SEUOperational. Doing it inside the transition's own governed call keeps "who authorized this" attributable to the one approval act, rather than an implicit background reaction.

- SEU's Activated -> Operational hop already routes through the generic transitionEngine.evaluate (commissioning.ts:461), which checks required_policy_ids and required_quality_gate_ids on that transition_definitions row exactly like every other governed transition (transitionEngine.ts:124-162). So attaching Policy/Quality Gate ids to that one row is a pure Ontology/data change — no code change needed to make this transition gate on them.

- Evidence belongs on a Quality Gate, not a Policy. "Approval to start work with some evidence definition" is the Quality Gate mechanism specifically: criteria_type: "requires_accepted_evidence_or_approved_decision" with a requiredCategory (an Evidence-category Ontology concept), which does its own DB query for Accepted Evidence/Approved Decisions (qualityGateEngine.ts:123-152). Policies are a much thinner mechanism today — evaluateCondition only supports always_true or a field_in check against whatever context object was passed in (policyCondition.ts) — no DB lookups of their own.

- The context passed at that exact call site today is {} (empty). A Policy's field_in check has nothing to look at unless the caller populates context with the relevant precomputed fields first (e.g. { allParticipantsRecruited: true }), which finalizeCommissioning doesn't do yet. So "participant access"/"knowledge repository access" as real state checks would either need (a) commissioning.ts to compute those booleans and pass them in context before calling evaluate, or (b) be modeled as new Quality Gate criteria_types that query participants/knowledge_scopes directly, mirroring how the Evidence check already does its own query rather than trusting a passed-in context.

- Dependency-graph override exists. A Profile can override a Template's dependency edge via exposedParameterOverrides with sourceType: "dependency" — the overridable value is the edge's requiredState (e.g. relax "Approved" to something looser) (templates.ts:225-236). This is the built mechanism behind the "org standard says 100%, project relaxes to 90%" case.

- Quality Gate was deliberately left out of the exposable-parameter mechanism (CR-088)(ExposedParameter.sourceType is only "service" | "policy" | "checklist" | "dependency" — seuTypes.ts:617, no "qualityGate" variant, confirmed current, not stale). So a Profile cannot define/override Quality Gates today, by design, not by gap.

- Quality Gates aren't even Template-scoped, let alone Profile-scoped. A Pack's contributionQualityGates[] materializes into quality_gates keyed only by (entity_type, from_state, to_state, category) — globally, the moment any Pack anywhere is published with that contribution (packs.ts:926-960). There's no Template/Pack-selection linkage recorded on that row. So today, if Pack X (used by your "client-delivery" Template) contributes a commence-work gate on SEU: Activated -> Operational, it applies to every SEU platform-wide reaching that transition — including ones from a completely different Template/Profile that never selected Pack X. Your "100 CRs against the same Profile" case would actually be fine by accident (they'd all get the same gates), but two different Profiles/Templates can't currently get different gate sets on the same transition — there's no scoping dimension for it to attach to.

- even where a Profile-level override already exists (Policy constraintType, dependency requiredState), it's stored but not consumed — compositionEngine/commissioning.ts never reads exposedParameterOverrides yet. 
 
- a Pack contributing a gate determines what row gets created — it does not determine who the row applies to. Once created, the row is matched by bare (entity_type, from_state, to_state), with no memory of which Pack wrote it or which Template/Profile selected that Pack. That's the actual, current architecture, and it's why your two-Pack plan wouldn't isolate the gates to this one Profile's SEUs even in the one case where it would fire at all.

- A Profile has, per ProfileSeedInput/profiles schema (profiles.ts:75-115):
  - One baseTemplateCode — exactly one base Template (single, not plural).
  - Six Pack-selection fields — optionalPackCodes, technologyPackCodes, domainPackCodes, compliancePackCodes, integrationPackCodes, engineeringPackCodes, organisationPackCodes — Packs it adds on top of the base Template's own mandatory Packs.
  - environment, profileVersion, description, featureFlagCodes, compositionOptions, deploymentTargets, additionalCapabilityCodes.
  - Configuration Parameters (CR-091): developmentMethodology, primaryProgrammingLanguage, sourceControlProvider, targetCloudProvider, deploymentStrategy, aiProviderPreference, defaultRepositoryStructure, documentationLevel, participatingOrganisationCodes.
  - exposedParameterOverrides — its own override values against whatever its base Template flagged overridable (Service Level metric / Policy constraintType / dependency edge requiredState) — the mechanism we just traced as stored-but-not-enforced.
  - parentProfileId — Profile inheritance (Ch.7 §9).

- composed_packs (migration 002) is a real JSONB column storing [{packId, packVersion}] — the actual list of Packs that went into that specific EBM's composition. SEU1's EBM (from Profile 1) will have Pack P's id in its composed_packs; SEU2's EBM (from Profile 2) will not, since Profile 2 never selected Pack P. SEU1's EBM genuinely, correctly "has" Pack P and therefore the 2 Quality Gates P defines, as part of its own composition record. SEU2's EBM genuinely does not. That part of the platform is accurate and Profile-scoped exactly as you'd expect.
 
- the  building block already exists, unexported, in dependencyDefinitionEngine.ts:31-37:


async function resolveOwningScope(seuId: string): Promise<{ templateId, profileId, packIds } | null> {
  const { data: seu } = await seusDB.findById(seuId);
  const { data: ebm } = seu.active_ebm_id ? await ebmsDB.findById(seu.active_ebm_id) : { data: null };
  const packIds = (ebm?.composed_packs ?? []).map((p) => p.packId);
  return { templateId: seu.template_id, profileId: seu.profile_id, packIds };
}
This is precisely "what did this SEU actually compose" — already built, already used by the Dependency Engine to scope dependency checks correctly. qualityGateEngine just never calls it. Three ways to close the gap:

(A) minimal — export this helper, call it inside qualityGateEngine.evaluate()/evaluateGate() when seuId is given, filter the fetched gates to gate.originating_pack_id == null (platform-baseline) || packIds.includes(gate.originating_pack_id). Files: qualityGateEngine.ts, dependencyDefinitionEngine.ts (export). No schema change — originating_pack_id, composed_packs, seuId param all already exist and are already passed in.

(B) moderate — same fix, but first extract resolveOwningScope into its own shared module (e.g. domain/engine/seuCompositionScope.ts) since two engines now depend on it, and apply the identical scoping to the required_policy_ids/required_quality_gate_ids explicit-reference path in transitionEngine.ts too, so every entity type (not just Deliverable's redundant direct call) gets consistent Pack-composition scoping.

(C) full — materialize the applicable gate ids onto the EBM itself at commissioning time (a new ebms.applicable_quality_gate_ids column, frozen like composed_packs is), so scoping is computed once at commission time rather than re-resolved on every transition attempt, and stays stable even if Pack P is later republished with different gates. *[Remarks: if EBM changes, we use te supersede mechanism and do not retrofit; so not correct]*
 

  
*(Remarks: I am inclined towards (B) . The scope resolver should take/key by ebmId and the SEU-facing callers should resolve their active_ebm_id first, not the other way round. Worth fixing as part of (B), not just relocating the function.]*

 
- Ch.26 defines a Quality Gate as "a declarative engineering contract that must evaluate to true before a governed state transition may occur" — its criteria types (requires_accepted_evidence_or_approved_decision, requires_accepted_review, no_unresolved_obligations) are all artifact-existence checks at one specific transition moment: did a review happen, was evidence accepted, for this entity, right now, before this hop. "2 approvals required" fits that exactly — it's checking that 2 approval artifacts exist before the Deliverable moves Defined → In Progress.

- "Participant background check" isn't an artifact produced for this transition — it's a standing eligibility property of the Participant as a resource, true or false independent of which Deliverable is being kicked off. Ch.24 frames Policy as exactly this: "what constraints must be respected" — a standing rule, not a per-transition artifact. And Ch.33 sharpens where it should actually be checked: "Capability Fulfilment answers: which Participants are eligible to provide this Capability at all? ... a comparatively slow-moving, structural concern." A background check is precisely that — it should gate whether a Participant is even eligible to be the Capability Fulfilment/Dispatch candidate in the first place, not block the Deliverable's kickoff after the fact. If you gate it on the Deliverable transition instead, you get the wrong failure mode: the Deliverable stalls for everyone, when the real fix is "pick a different, cleared Participant" — which is Capability Fulfilment's job, not the Deliverable's.
  
- ebms.composed_packs stores only [{packId, packVersion}] — nothing about Policies. 

- Policy's own resolution mechanism is even thinner than Quality Gate's: policiesDB has no findAllActive/coincidental-match-by-transition method at all  Policy is only ever reached two ways: (a) explicit criteria.policyIds baked into a Quality Gate's requires_active_policy criteria at Pack-publish time, or (b) transition_definitions.required_policy_ids, which nothing populates for real Deliverable/SEU rows. So Policies aren't composed onto the EBM, and there's no live "which Policies apply to this SEU" query anywhere today — a smaller version of the same gap, not yet even at the "wrong scope" stage Quality Gate is at.

- Policy's own identity is already (originating_pack_id, code) — Pack-scoped by design (migration 106, CR-061: "it is not global so no versioning required") — unlike Quality Gate's (entity_type, from_state, to_state, category), which is global. So Policy was actually built with the right identity shape; it just has no evaluation path that uses it yet.

- profileCompositionUnravel.ts:367-384 does unravel Policies during composition: this unraveling only feeds pool, which becomes the EbmCompositionReport — the pre-commissioning validation/conflict display (compose.ejs, "Queue to validate"). It's discovery and reporting, not enforcement. Nothing writes these discovered Policy ids into anything transitionEngine.evaluate() or qualityGateEngine later reads — required_policy_ids still stays empty, and a Quality Gate's requires_active_policy criteria still only sees whatever policyIds were hardcoded at Pack-authoring time, not what this specific EBM actually composed.

- quality_gates currently has no way to say "only Deliverable X" — matching is purely (entity_type, from_state, to_state, category), so every Deliverable hitting Defined -> In Progress is indistinguishable to the query. But the platform already has the right addressing scheme for this elsewhere: dependency_definitions and a Template's own deliverableCatalogue/dependency graph address Deliverables by name (an Ontology-backed deliverable-name concept, e.g. "Requirements Analysis Model"), not by instance id — because these are authored before any SEU/Deliverable instance exists, same situation a Pack's Quality Gate authoring is in.

So the concrete fix: 

## Summary of gaps: 

- Quality Gate has a live lookup function today — qualityGatesDB.findAllActive(entityType, fromState, toState) — it's just not scoped by that transitive join yet. That's exactly what fix (B) adds: teach that lookup to also filter by packIds from the EBM.
- Policy has no equivalent live lookup at all. policiesDB has findByCode, findByIds, findByPackCode, findAll — nothing shaped like "find all active Policies for this governed transition." Its only two consumers are explicit-id references (required_policy_ids, criteria.policyIds) that nothing populates for real transitions. So Policy isn't missing a scoping fix on an existing mechanism — it's missing the mechanism itself.
- exposedParameterOverrides remains the concrete instance.
Explicitly declaration-only by design — not a hidden bug ; defered to CR-105.

## Summary of fixes:
 
1. extract resolveOwningScope into its own shared module (e.g. domain/engine/seuCompositionScope.ts) since two engines now depend on it, and apply the identical scoping to the required_policy_ids/required_quality_gate_ids. resolveOwningScope(seuId: string) will change to resolveOwningScope(ebmId: string)
2.  Quality gat should have applicability_deliverable_names. This along with the scoping should get us to target quality gates for specific deliverables. 
3. Writing the policy or quality gates itself is using the platform to create the appropriate packs.
4. Materialize at commissioning: At the same point composed_packs gets written (EBM creation, commissioning), also run resolveOwningScope(ebmId) → get packIds → quality_gates WHERE originating_pack_id = ANY(packIds) AND is_active and the equivalent new policies query → write both id arrays onto the ebms row.
5. Redefine "mandatory" as a real composition rule. Composition itself always folds in every Pack marked Mandatory — tenant-scoped ones for Templates in that same tenant, Platform-scoped ones for every Template everywhere — not just what a Template's own mandatoryPackCodes happens to list. Closes the "pack-across-all-seus" gap without any new authoring mechanism.
6. SEU-scoped policy delivery. At EBM composition time, filter the composed Packs' own contributed Policies down to entity_type === 'SEU', and deliver that filtered set two ways: on the CompositionCompleted/EBMCreated event payload (for commissioning.ts to consume directly as part of its own transitionEngine.evaluate() context) and persisted as its own field on the EBM row (for traceability — someone inspecting the EBM later can see the SEU-level enforcement was really part of it). This one legitimately belongs on the EBM, since it's gating the SEU's own engineering-lifecycle transitions.
7. Expand EligibilityCriteria with a required-policies property, scope "Eligibility", governed_transition: null — checked against a candidate Participant's own behaviour_context, not any transition's context object. Resolved live, at the moment findEligibleParticipants runs, directly from the SEU's own Template/Profile Pack selection — never through the EBM, since this is onboarding/eligibility, not engineering behavior.
 
--------------
## Changes implemented
 
- src/dblayer/migrations/203_ebm_materialised_governance.sql — new: ebms.applicable_quality_gate_ids/applicable_policy_ids (UUID[]), quality_gates.applicability_deliverable_names (TEXT[]).
- src/dblayer/migrations/204_quality_gate_applicability_deliverable_names.sql — new: adds applicabilityDeliverableNames to the Pack SDK authoring schema's contributionQualityGates[] (picks up automatically in the existing schema-driven authoring UI — no separate UI to build, per point 6).
- src/domain/engine/seuCompositionScope.ts — new shared module: resolveOwningScope(ebmId), reading template_id/profile_id/composed_packs straight off the ebms row.
- src/domain/engine/dependencyDefinitionEngine.ts — its own resolveOwningScope(seuId) now resolves seu.active_ebm_id then delegates to the shared, EBM-keyed function (unused ebmsDB import dropped).
- src/domain/engine/compositionCompleted.ts — the sole ebmsDB.create call site: now also queries qualityGatesDB.findByPackIds/policiesDB.findByPackIds against the composed Pack ids and writes both id arrays onto the new EBM row.
- src/domain/engine/qualityGateEngine.ts — evaluate() rewritten: reads the SEU's active EBM's applicable_quality_gate_ids (via findByIds), filters to the exact transition shape, then to applicability_deliverable_names (resolving the Deliverable's own name when set) — replaces the old bare-state findAllActive match entirely.
- src/domain/engine/policyEngine.ts — new: Policy's first live evaluation path, same shape as Quality Gate — reads applicable_policy_ids, filters by governed_transition, evaluates each condition, blocks on unsatisfied constraint_type: "Policy", logs StandardPolicyDeviation for "Standard".
- src/routes/seu/core/deliverables.ts — transitionDeliverable now calls policyEngine.evaluate alongside the existing qualityGateEngine.evaluate, same position (after dependency readiness, before Authority).
- src/dblayer/qualityGatesDB.ts / policiesDB.ts — new findByPackIds; qualityGatesDB.upsert now accepts/persists applicabilityDeliverableNames.
- src/dblayer/ebmsDB.ts, seuTypes.ts — EbmRow/QualityGateRow/PackContributions.qualityGates types extended; packs.ts materialization + validatePackSeed (mirrors the existing Policy applicability_deliverable_names intersection check) wired through.
- "Mandatory" as a real composition rule
packsDB.findActiveMandatoryVisibleTo(tenantId) — new method, mirrors findActiveVisibleTo exactly: Active Packs with installation_classification = 'Mandatory' at Platform tenant OR the given tenant.
unravelComposition (the real, live composition path) now folds this set in per-Template, alongside whatever that Template's own mandatoryPackCodes explicitly lists — additive, not a replacement.

-  SEU-scoped Policy delivery:
Migration 206: ebms.seu_scoped_policy_ids, and policies.scope/nullable governed_transition.
compositionCompletedHandler now splits composed Packs' own scope: "Transition" Policies into SEU-scoped (governed_transition starting "SEU|") vs entity-scoped, writing the former to the new EBM field and carrying it on the EBMCreated event payload too.
policyEngine.evaluate() reads seu_scoped_policy_ids when entityType === "SEU", applicable_policy_ids otherwise — one function, no duplicated logic.
commissioning.ts's Activated -> Operational hop now calls policyEngine.evaluate({entityType: "SEU", ...}) right after its existing transitionEngine.evaluate check.

- Eligibility-scoped Policy: PolicyRow.scope: "Transition" | "Eligibility"; governed_transition nullable for the latter.
EligibilityCriteria.requiredPolicyIds, checked via a new matchesRequiredPolicies against each candidate's own behaviour_context (matched by Policy code, fails closed with no matching entry).
resolveEligibilityPolicies(seu) — resolves live via unravelComposition({templateIds:[seu.template_id], profileIds:[seu.profile_id]}), never touching the EBM. Wired into both real callers (capabilities.ts's resolveMasterParticipant, seus.ts's Fulfil dropdown) so they can't drift apart, same discipline competency already has.
Fixed a type ripple in governanceModel.ts (policies[].governedTransition now string | null).

-------------------

## Usecases to test:
1. Participants should have cleared a background verification. 
2. Active client contract should be in place. 
3. Client sign-off and manager approval are required to start work. 
4. Waiver mechanism

- Create an engineering pack with no contributing capabilities or service, but define quality gates corresponding to approvals
- Create another engineering pack with no contributing capabilities or service, but define quality gates corresponding to participant background checks. 
- Include these packs at the profile so the composition picks all of it.

required_policy_ids/required_quality_gate_ids are arrays, so attach two Quality Gates, each requiring a different Evidence category (manager-approval, director-approval). Pure data change, zero schema/code change.

transition_definitions: { entity_type: 'SEU', from_state: 'Activated', to_state: 'Operational', verb: 'operationalise' }
required_quality_gate_ids: [qg_delivery_manager_signoff, qg_account_head_signoff]
Two Quality Gates, both AND'd (evaluateByIds blocks on the first that fails):


qg_delivery_manager_signoff: { entity_type: 'SEU', criteria: { type: 'requires_accepted_evidence_or_approved_decision' }, category: 'commencement-approval-dm' }
qg_account_head_signoff:     { entity_type: 'SEU', criteria: { type: 'requires_accepted_evidence_or_approved_decision' }, category: 'commencement-approval-ah' }


 