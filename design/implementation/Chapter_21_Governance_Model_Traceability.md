# Chapter 21 — Governance Model: Implementation Traceability

**Date of report: 4-10-2026**

<!-- multiline -->
**Legend:** ✅ Fully met  ⚠️ Partially met  ❌ Not met  ❓ Not verifiable

<table style="width:100%; table-layout:fixed;">
  <colgroup>
    <col style="width:4%;">
    <col style="width:32%;">
    <col style="width:27%;">
    <col style="width:37%;">
  </colgroup>
  <thead>
    <tr>
      <th></th>
      <th>Intent</th>
      <th>Code Citation</th>
      <th>Finding</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Governance determines whether engineering work may proceed, under what conditions, with what assurance — it does not perform the work itself<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:60-221</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>transitionEngine.evaluate</code> is a pure decision function: given (entityType, fromState, toState, actorId, context) it returns <code>allowed: true/false</code> + reason. It never performs the transition; the caller applies the resulting state change.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Governance ensures execution stays consistent with the EBM, organisational requirements and regulations<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:126-182 (Policy evaluation)<br>src/routes/seu/core/compliance.ts:1-16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Policy conditions (Pack-contributed, EBM-composed) are checked per transition. Regulatory/compliance rules are checked by a separate, explicitly read-only evaluator (<code>core/compliance.ts</code>) that never blocks a transition — see the Compliance Rules row below for the resulting gap against §7.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Governance is not responsible for performing engineering work<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:211-220</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>evaluate</code> returns an authorisation decision object; it contains no state-mutation call. State changes happen in each entity's own transition route/handler after <code>evaluate</code> returns <code>allowed: true</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Chapter defines governance abstraction, responsibilities, hierarchy, relationships, lifecycle, enforcement; explicitly excludes authority assignments, policy definitions, review procedures, compliance rules (deferred to later chapters)<br> Ref: §2 Scope</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">N/A (scope statement, not an implementation intent)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Scope statement only; evaluated for completeness, no code citation required.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Governance sits between the EBM and Deliverable state changes, with Authority/Obligations/Policies as its three children<br> Ref: §3 Architectural Position</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:13-21 (imports: policiesDB, badgeAuthorityEngine, qualityGateEngine; no obligationsDB)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority (badgeAuthorityEngine) and Policies (policiesDB/governingCondition) are wired as direct inputs to the one evaluation function sitting between EBM-derived definitions and the caller's state transition. Obligations is NOT wired into this function — see §17.5/GM-005 row below. The diagram's three-way "Authority / Obligations / Policies" fan-in under Governance is realised as two-of-three.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Governance is the collection of rules, controls, decision mechanisms regulating engineering execution; determines what may occur, who may authorise, what evidence is required, what obligations must be satisfied, what reviews must occur — but not how work is performed<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:60-221</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">"What may occur" and "who may authorise" are realised (Policy + badge checks). "What evidence is required" and "what reviews must occur" are not resolved by this function at all — Evidence/Review are never read inside <code>evaluate</code>. "What obligations must be satisfied" is resolved only by caller-side code outside this function (see §17.5 row).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">GM-001: Governance is explicit — no significant action depends on implicit organisational knowledge<br> Ref: §5 GM-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/transitionDefinitionsDB.ts (schema: entity_type/from_state/to_state/verb/required_policy_ids/required_quality_gate_ids)<br>src/domain/engine/transitionEngine.ts:86-87</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every governed hop is a resolved <code>transition_definitions</code> row; a missing row returns <code>no_transition_definition</code> rather than falling through to an implicit default. Explicit by construction — no code path infers permission from role/seniority/tenure.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">GM-002: Governance is declarative — rules defined by Packs, interpreted by the Runtime<br> Ref: §5 GM-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts (Pack contributions → composed EBM)<br>src/domain/engine/transitionEngine.ts:126-182</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Policies and Quality Gates are Pack-contributed (composed by <code>compositionEngine</code>) and interpreted generically by <code>transitionEngine.evaluate</code>/<code>qualityGateEngine</code> at evaluation time — no entity-specific governance code per Pack. Authority badges are also data (participants_master.authorised_badges), not Pack-contributed, but still declarative/data-driven, consistent with the principle's intent.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">GM-003: Governance is composable — multiple organisations may contribute governance simultaneously<br> Ref: §5 GM-003</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:436-454, 488-519</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Multiple Packs' <code>authorityRules</code>/Quality Gate contributions are merged at composition time; <code>detectGovernanceConflicts</code> specifically detects cross-Pack (cross-organisation) disagreement on the same governed transition or triple. Composability is real, not merely additive-without-detection.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">GM-004: Governance is traceable — every governance decision shall be explainable<br> Ref: §5 GM-004</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:136-180 (PolicyApplied/PolicyViolated/StandardPolicyDeviation events)<br>§17.14 (narrative)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each Policy check publishes a per-rule event (<code>PolicyApplied</code>/<code>PolicyViolated</code>/<code>StandardPolicyDeviation</code>) carrying <code>originatingObjectId</code>→the Policy, <code>actorId</code>, <code>authorityBadge</code>. A denial (<code>authority_denied</code>/<code>policy_blocked</code>/<code>not_submitted</code>/<code>quality_gate_blocked</code>) returns a reason code, so every decision IS explainable from returned data plus published events. There is no single <code>governance_evaluations</code> record joining Authority+Policy+QualityGate+Obligation for one decision — reconstruction requires joining multiple tables, a partial realisation of "fully traceable" (see FR-21.5 row).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">GM-005: Governance is context-sensitive — depends on EBM, Deliverable state, active Obligations, Engineering Stage, Authority Model<br> Ref: §5 GM-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:61-85 (context, fromState/toState params)<br>grep: no <code>obligationsDB</code> reference in transitionEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>evaluate</code> takes <code>fromState</code>/<code>toState</code>/<code>context</code> (covers Deliverable state and EBM-derived definition) and resolves Authority (badgeAuthorityEngine). It never queries <code>obligationsDB</code> — active Obligations are not read inside this function at all; an open Obligation only blocks a transition because a separate caller (<code>executionEngine.ts</code>) checks <code>obligationsDB.findByRelatedObject</code> before ever invoking <code>evaluate</code> (confirmed: <code>src/domain/engine/executionEngine.ts:111-120, 261</code>). Engineering Stage is not read by <code>evaluate</code> either — it is implicit in which <code>fromState</code> the caller supplies.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">GM-006: Governance shall remain independent of Participant implementations<br> Ref: §5 GM-006</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/badgeAuthorityEngine.ts:44-53, 70-79</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>getHeldBadges</code>/<code>authorise</code> operate purely on <code>participants_master.authorised_badges</code> (badge code + expiry), with no dependency on any specific Participant subtype's implementation (human vs. automated/system actor) — confirmed no Participant-subtype branching in this file.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-21.1: Every SEU shall possess one effective Governance Model derived from its EBM<br> Ref: §6 FR-21.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:1-6, 60-85</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>transitionEngine.evaluate</code> is generic over <code>TransitionEntityType</code> — no SEU/Deliverable-specific import — so there is exactly one evaluation engine, consuming the one composed EBM's <code>transition_definitions</code> rows, for every SEU. Not "one effective Governance Model" in the sense of a single unified evaluation call, however: Quality Gates are a second, parallel evaluation path most entities call directly (§17.4) rather than exclusively through this function — see that row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-21.2: Governance rules shall be contributed through Packs<br> Ref: §6 FR-21.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:436-519</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Policies and Quality Gates are Pack-contributed and composed. Authority (badge grants) is not Pack-contributed — it is a direct <code>participants_master.authorised_badges</code> grant, not routed through Pack composition; this is a real, accepted divergence per CR-006 (badges are a standing grant, not a composed governance rule), not a gap in FR-21.2's own scope (Authority is §7's own component, separately specified), but worth flagging since §7 lists Authority as one of the Governance Components this chapter's FR-21.2 implicitly covers.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-21.3: Governance shall be evaluated before every significant Deliverable state transition<br> Ref: §6 FR-21.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:60-85 (called by state-transition routes, e.g. deliverable transition handlers)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable transitions route through <code>transitionEngine.evaluate</code> before the state change is applied (confirmed via <code>executionEngine.ts</code>'s pre-transition Obligation/Decision checks, which gate calls into the same transition path). Evaluation precedes every governed Deliverable transition that has a <code>transition_definitions</code> row; an entity_type/from/to combination with no such row returns <code>no_transition_definition</code>, which is itself a form of being evaluated (and denied), not skipped.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-21.4: Governance evaluations shall be deterministic<br> Ref: §6 FR-21.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:60-221</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>evaluate</code> is a pure function of the resolved <code>transition_definitions</code> row, the caller-supplied context, and current DB-held badge/policy/gate state — no random input, no wall-clock-dependent branching beyond badge expiry comparison (<code>isExpired</code>, itself a pure function of <code>effective_till</code> vs. <code>now</code>). Deterministic given fixed inputs and DB state.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-21.5: Governance outcomes shall be fully traceable<br> Ref: §6 FR-21.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:136-180</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Per-policy events are published and the returned outcome carries reason codes, but — as in the GM-004 row — there is no single governance-outcome record and no Obligation/Review/Evidence join at decision time. "Fully traceable" as specified (a complete, single-point reconstruction) is not realised; traceability is real but requires joining multiple tables/events.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-21.6: Governance shall support multiple participating organisations<br> Ref: §6 FR-21.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:436-454</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same mechanism as GM-003 — multiple Packs (organisations) contribute composed governance, with conflict detection across them.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-21.7: Governance conflicts shall be detected during composition where possible and at runtime where necessary<br> Ref: §6 FR-21.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:442, 498-519</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition-time detection is real: <code>detectGovernanceConflicts</code> blocks commissioning on cross-Pack authority-role disagreement or duplicate Quality Gate contribution for the same (entityType,fromState,toState). No equivalent runtime conflict detection exists — <code>transitionEngine.evaluate</code> resolves a single already-composed <code>transition_definitions</code> row and has no mechanism to detect a runtime conflict (e.g. two concurrent evaluations racing); the "at runtime where necessary" half of FR-21.7 has no realised equivalent.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Governance Components: Authority, Policies, Obligations, Reviews, Quality Gates, Compliance Rules, Delegation Rules, Escalation Rules, Decision Governance — each specified in a dedicated chapter<br> Ref: §7 Governance Components</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/badgeAuthorityEngine.ts (Authority)<br>src/domain/engine/transitionEngine.ts:126-182 (Policies)<br>src/domain/engine/qualityGateEngine.ts (Quality Gates)<br>src/routes/seu/core/compliance.ts (Compliance Rules)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Of the nine listed components: Authority and Policies are implemented and wired into the one generic evaluation function. Quality Gates are implemented but as a second, largely separate evaluation path (not folded into the generic one for pre-existing rows). Compliance Rules are implemented but explicitly never block a transition (read-only, outside the evaluation path). Obligations and Reviews are real entities elsewhere in the codebase but are not themselves evaluated inside governance's own evaluation function — they only block indirectly via separate caller-side checks (Obligations) or via a Quality Gate criteria type (Reviews). Delegation Rules, Escalation Rules, and Decision Governance have no dedicated implementation at all.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Governance may originate from Platform/Organisation/Domain/Compliance/Technology/Customer Packs; multiple sources may coexist; the Composition Engine produces one effective Governance Model as part of the EBM<br> Ref: §8 Governance Sources</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>compositionEngine</code> composes contributions from an arbitrary set of Packs (no code-level restriction to a fixed Pack-category list — any Pack can contribute <code>authorityRules</code>/Policy/Quality Gate references) into one composed EBM. The six named Pack categories (Platform/Organisation/Domain/Compliance/Technology/Customer) are an Ontology-level classification, not a code-level branch — composition logic is uniform regardless of category, matching the principle that "multiple governance sources may coexist" without needing source-specific code.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Governance is evaluated whenever an engineering action could change SEU state; illustrative triggers: Deliverable approval, Decision approval, Obligation closure, Release authorisation, Engineering stage transition; evaluation determines whether the transition is permitted<br> Ref: §9 Governance Evaluation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:60-221</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>evaluate</code> is the one function called by state-changing routes across entity types to determine permission. Deliverable approval and Engineering stage transition route through it (confirmed generic over <code>TransitionEntityType</code>). "Obligation closure" as a *governance evaluation trigger* is not realised inside <code>evaluate</code> itself — Obligation state is read only by the separate caller-side check before <code>evaluate</code> is invoked (§17.5), not as part of governance's own evaluation of the closure event. Decision approval and Release authorisation, as they are themselves <code>transition_definitions</code>-governed hops (Decision/Release are <code>TransitionEntityType</code> values), are generically covered by the same mechanism.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A governance evaluation may result in Approved / Approved with Conditions / Deferred / Rejected / Escalated / Waived; a transition is Rejected/Deferred only on a "Policy"-type Policy violation, unresolved blocking Obligation, or missing Authority; "Standard"-type Policy deviation never itself produces Rejected/Deferred; every outcome shall include a recorded rationale<br> Ref: §10 Governance Outcomes</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:42-58 (TransitionOutcome type), 96-109 (authority), 159-161 (Policy-type block), 162-180 (Standard-type proceeds + event)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The exact §10 rule for Policy vs. Standard constraint types is realised precisely: <code>constraint_type === "Policy"</code> on an unsatisfied condition returns <code>policy_blocked</code>; <code>constraint_type === "Standard"</code> publishes <code>StandardPolicyDeviation</code> and lets the transition proceed, never blocking by itself. Missing Authority correctly produces <code>authority_denied</code>. However, the realised outcome vocabulary is a binary <code>allowed: true/false</code> with a reason string, not §10's six-way set: Approved and Rejected map directly; Waived exists only inside the separate Quality Gate path, not as a <code>transitionEngine</code> outcome; Approved with Conditions and Deferred have no realised equivalent (a Standard deviation is the closest analogue to "Approved with Conditions" but is not modelled or returned as such — it is a side-published event, not a returned outcome value); Escalated has no realised equivalent anywhere in governance. Every denial does carry a reason (the "recorded rationale" requirement is met for denials); approvals do not carry an explicit rationale field beyond the resolved definition itself.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Governance rules progress through a lifecycle: Defined → Composed → Active → Applied → Superseded → Archived; historical governance rules shall remain reproducible<br> Ref: §11 Governance Lifecycle</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found) grep: no governance-rule-specific state field in transition_definitions/policies schema</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No governance-rule-specific lifecycle state machine exists. Each contributing primitive (Policy, Quality Gate) rides its own *owning* Pack's lifecycle instead (confirmed: no <code>Defined</code>/<code>Composed</code>/<code>Applied</code>/<code>Superseded</code> state column found on <code>policies</code>/<code>transition_definitions</code>/quality-gate tables) — a Policy becomes usable when its Pack reaches Active and is superseded when a new Pack version supersedes it, but there is no governance-rule-specific instance of this six-state lifecycle distinct from Pack's own. Historical reproducibility is inherited from Pack versioning but not verified as a governance-rule-specific guarantee.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every governance outcome shall record: governing rule, originating Pack, applicable Authority, supporting Evidence, related Decision, affected Deliverable, timestamp — enabling complete reconstruction of governance decisions<br> Ref: §12 Governance Traceability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:136-180 (PolicyApplied payload: policyCode, entityType, fromState, toState; originatingObjectId = Policy id)<br>src/domain/engine/transitionEngine.ts:104-109 (authorityBadge)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Governing rule (Policy/Quality Gate id), originating Pack (via Policy's own Pack reference), applicable Authority (authorityBadge, the actual badge used), and timestamp are each individually reconstructable from the published events and the resolved definition row. Supporting Evidence and related Decision are NOT recorded as part of any governance evaluation event — <code>evaluate</code> never references <code>evidenceDB</code> or <code>decisionsDB</code>. Affected Deliverable is implicit only via the caller's own entity-specific event (e.g. a <code>DeliverableTransitioned</code> event carrying the Deliverable id), not part of a governance-level record itself. Reconstruction therefore requires joining multiple independently-emitted events/tables, not reading one governance outcome record — §12's list of seven fields is individually satisfiable but not jointly, in one place.</td>
    </tr>
| The Governance subsystem shall publish: GovernanceEvaluated, GovernanceApproved, GovernanceRejected, GovernanceEscalated, GovernanceWaived, GovernanceRuleApplied | §13 Events | grep -rn "GovernanceEvaluated\|GovernanceApproved\|GovernanceRejected\|GovernanceEscalated\|GovernanceWaived\|GovernanceRuleApplied" (no matches in src/) | None of the six named Governance events are published anywhere in the codebase. What is published instead is each sub-mechanism's own lower-level vocabulary: `PolicyApplied`/`PolicyViolated`/`StandardPolicyDeviation` (transitionEngine.ts:137-179), `QualityGatePassed`/`QualityGateBlocked`/`QualityGateWaived` (qualityGateEngine.ts), plus each entity's own domain-specific `*Transitioned` event once applied. There is no single governance-level event emitted per evaluation call under any of the six specified names. | Not met |
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: Governance shall remain deterministic, support multi-organisation composition, preserve complete traceability, support historical reconstruction, remain independent of runtime implementations<br> Ref: §14 Non-Functional Requirements</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:60-221<br>src/domain/engine/compositionEngine.ts:436-519</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Determinism and multi-organisation composition are realised (see GM-003/FR-21.4 rows). Complete traceability and historical reconstruction are only partially realised (see GM-004/FR-21.5/§12 rows: traceability is real but distributed, no governance-rule lifecycle for historical reconstruction per §11). "Remain independent of runtime implementations" is satisfied in the sense that <code>evaluate</code> depends only on DB-stored data (definitions, policies, badges), not on any specific runtime/host implementation detail.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: every significant transition governed; rules composable; decisions traceable; multi-org supported; history reconstructable; independent of Participant implementations<br> Ref: §15 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(aggregate of rows above)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">"Every significant engineering state transition is governed" holds for every entity_type/from/to with a <code>transition_definitions</code> row (anything without one is denied, not silently allowed — a safe failure mode, but not evidence every *intended* significant transition actually has a row provisioned; that is a data/seed completeness question outside this function's own correctness). "Rules composable" — met (compositionEngine). "Decisions traceable" — partially met (distributed, not reconstructable from one record). "Multi-organisation" — met. "Historical reconstruction" — not met as a governance-rule-specific guarantee (§11). "Independent of Participant implementations" — met (badgeAuthorityEngine).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Governance domain model, Governance evaluation service, Governance registry, Governance APIs, Governance event model, Governance traceability model<br> Ref: §16 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/transitionDefinitionsDB.ts (domain model/registry)<br>src/domain/engine/transitionEngine.ts (evaluation service)<br>src/routes/seu/api/*.ts (APIs, per-entity, not governance-specific)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A domain model (<code>transition_definitions</code> + <code>policies</code> tables) and an evaluation service (<code>transitionEngine.evaluate</code>) exist and function as the registry and evaluation service respectively. There is no governance-specific API surface distinct from each entity's own transition API (no single <code>/governance/evaluate</code> or similar endpoint — each entity's route calls the shared engine internally). There is no governance event model (per §13 finding) and no single governance traceability model (per §12 finding) as dedicated deliverables; both exist only as emergent properties of other subsystems' own events/tables.</td>
    </tr>
  </tbody>
</table>
---

## Summary

- Total intents analysed: 28
- Fully met: 9
- Partially met: 17
- Not met: 2
- Not Verifiable: 1 (pure scope statement, §2)

### Major implementation gaps

- No single generic Governance evaluation covers Obligations or Reviews: both block transitions only via separate caller-side code outside `transitionEngine.evaluate` (GM-005, §9, §17.5, §17.6).
- Quality Gates are a second, parallel evaluation path for most entities, not folded into the one generic evaluation function for any pre-existing `transition_definitions` row (FR-21.1, §7, §17.4).
- The six named Governance events (`GovernanceEvaluated` etc., §13) are never published anywhere; only lower-level sub-mechanism events exist.
- The realised outcome vocabulary is binary (allowed/denied + reason), not §10's six-way Approved/Approved-with-Conditions/Deferred/Rejected/Escalated/Waived set — Approved with Conditions, Deferred, and Escalated have no realised equivalent at the governance layer.
- No governance-rule-specific lifecycle (§11) exists; lifecycle state is inherited entirely from each contributing Pack.
- Delegation Rules, Escalation Rules, and Decision Governance (§7) have no implementation at all.
- Traceability (GM-004, FR-21.5, §12) is real but distributed across multiple tables/events; no single governance-outcome record joins Authority + Policy + Quality Gate + Obligation + Evidence + Decision for one decision.
