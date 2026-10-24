# Implementation Traceability: Chapter 21 – Governance Model

**Date of report: 23-10-2026**

Specification: src/docs/SEU Studio Specifications/04_Governance/21_Governance.md

## Traceability Table

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Governance determines whether engineering work may proceed, under what conditions and with what assurance. It does not perform the work.<br>Ref: §1, §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:52-207<br>src/domain/engine/transitionEngine.ts:115-208</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">evaluateDeliverableTransition and transitionEngine.evaluate only decide permit or refuse. They check dependencies, Obligations, Decisions, authority, Quality Gates, Policies and submission. They change no entity state. The state change is applied afterwards by applyGovernedDeliverableTransition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Governance is a distinct layer between the Engineering Behavior Model and Deliverable state changes, fed by Authority, Obligations and Policies.<br>Ref: §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:52-207<br>src/domain/engine/compositionCompleted.ts:66-89</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The EBM stores applicable_policy_ids, seu_scoped_policy_ids and applicable_quality_gate_ids at composition time. The evaluation reads those sets and also reads Authority (badge resolution) and Obligations before a Deliverable moves.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Governance is explicit. No significant action depends on implicit organisational knowledge.<br>Ref: §5 GM-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:92-99<br>src/domain/engine/executionEngine.ts:98-107</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Permission comes from Transition Definition rows, authority badges, Policy rows and Quality Gate rows. No hard-coded role check decides a transition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Governance is declarative. Rules are defined by Packs and interpreted by the runtime.<br>Ref: §5 GM-002, §6 FR-21.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:540-583<br>src/domain/engine/compositionCompleted.ts:66-89</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack's authorityRules, policies and qualityGates contributions are materialised into authority_rules, policies and quality_gates rows with originating_pack_id. The runtime engines interpret those rows through evaluateCondition and the Quality Gate criteria types.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Governance is composable. Several organisations may contribute governance at the same time.<br>Ref: §5 GM-003, §6 FR-21.6, §8, §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:231-253<br>src/dblayer/recovery/packs_schema_recovery.sql:21-26<br>src/routes/seu/core/governanceModel.ts:33-51</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Packs are tenant scoped and several Packs compose into one EBM. getEffectiveGovernanceModel merges authority rules, policies and gates from all composed Packs.<br>Gap:<br>When two Packs contribute the same authority code or policy code, the first Pack wins and the later one is skipped silently (seenAuth, seenPolicy). Only authority and Quality Gate clashes are reported. The multi-organisation behaviour is not exercised by a test.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Governance is traceable. Every governance decision is explainable.<br>Ref: §5 GM-004, §6 FR-21.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:178-204<br>src/dblayer/recovery/governance_evaluation_outcomes_schema_recovery.sql:3-25</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each Deliverable governance result is persisted with a rationale string, the satisfied and deviated Policy ids, the consulted Obligation ids, open Attention Items, the Quality Gate outcome and the applicable authority rule. The Command links to it through governance_outcome_id.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Governance is context sensitive. It depends on the EBM, Deliverable state, active Obligations, Engineering Stage and Authority.<br>Ref: §5 GM-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:72-90<br>src/domain/engine/executionEngine.ts:105-146<br>src/domain/engine/policyEngine.ts:30-44</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Evaluation uses the SEU's active EBM policy and gate sets, the Deliverable's current state, open Obligations and Decisions, the actor's badge and the Deliverable name (applicability).<br>Gap:<br>Engineering Stage is not an input to any rule. Rules are keyed on entity state transitions only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Governance stays independent of Participant implementations.<br>Ref: §5 GM-006, §14, §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/badgeAuthorityEngine.ts:25-36<br>src/domain/engine/executionEngine.ts:105</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority is resolved from the actor's badges in participants_master. No engine inspects whether the actor is a Human, AI or System Participant implementation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every SEU has one effective Governance Model derived from its EBM.<br>Ref: §6 FR-21.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/governanceModel.ts:17-77<br>src/routes/seu/api/seus.ts:56-65<br>src/dblayer/seed/data/routeAuthority.json:470-476<br>tests/governance-ebm-sharpening.test.ts:52</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>getEffectiveGovernanceModel builds a read model of authority rules, policies, quality gates and composition conflicts from the active EBM. It is exposed at GET /api/seu/seus/:id/governance-model and is tested.<br>Gap:<br>The model is rebuilt from Pack contributions on every call. It is not a stored Governance Model object with its own id and state. Policies are read through policiesDB.findByPackCode, whereas evaluation reads the EBM's applicable_policy_ids, so the two views can differ.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Governance is evaluated before every significant Deliverable state transition.<br>Ref: §6 FR-21.3, §9, §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/deliverables.ts:54-80<br>src/domain/engine/executionEngine.ts:52-207</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Every Deliverable transition goes through evaluateDeliverableTransition and then applyDeliverableTransition. The state is not changed when governance refuses.<br>Gap:<br>The same Governance Outcome evaluation (outcome row, Command link, rationale) exists only for Deliverables. Other entities use transitionEntity, which checks badge, submission, Policies and Quality Gates but writes no governance outcome.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Governance applies to Decision approval, Obligation closure, release authorisation and Engineering Stage transitions.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/entityTransition.ts:24-78<br>src/domain/engine/transitionEngine.ts:64-86<br>src/routes/seu/core/commissioning.ts:326-338<br>src/dblayer/seed/data/transitionDefinitions.json:210-245</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Decision, Obligation and SEU hops pass through transitionEntity and transitionEngine.evaluateGoverned. The SEU Activated to Operational hop also runs policyEngine.evaluate.<br>Gap:<br>No dedicated release authorisation transition or Engineering Stage transition is governed as such. Only the generic hop checks run for non-Deliverable entities, and no governance outcome is recorded for them.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Governance evaluations are deterministic.<br>Ref: §6 FR-21.4, §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/governingCondition.ts<br>src/domain/engine/policyEngine.ts:46-90<br>src/domain/engine/qualityGateEngine.ts:74-78<br>src/dblayer/policiesDB.ts:62-66<br>src/dblayer/qualityGatesDB.ts:118-122</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Conditions are evaluated by evaluateCondition over supplied context. The outcome class (pass or block) depends only on data.<br>Gap:<br>policiesDB.findByIds and qualityGatesDB.findByIds use SELECT without ORDER BY. Policies and gates are evaluated in the order the database returns them, and the first block or waiver wins. Which Policy or gate is named as the blocker may vary when several apply.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Governance conflicts are detected during composition where possible and at runtime where necessary.<br>Ref: §6 FR-21.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:253<br>src/domain/engine/compositionEngine.ts:281-320<br>tests/governance-ebm-sharpening.test.ts:87</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>detectGovernanceConflicts reports authority conflicts (different roles on one transition) and Quality Gate slot clashes between Packs. A conflict blocks commissioning, and a test covers it.<br>Gap:<br>Policy conflicts between Packs are not detected. No runtime conflict detection exists. At runtime the first matching Policy or gate decides.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Governance Model consists of Authority, Policies, Obligations, Reviews, Quality Gates, Compliance Rules, Delegation Rules, Escalation Rules and Decision Governance.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/governanceModel.ts:8-15<br>src/domain/engine/executionEngine.ts:72-90<br>src/domain/engine/qualityGateEngine.ts:126-137</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Authority, Policies, Quality Gates, Obligations, Decisions and Reviews (through the requires_accepted_review gate criterion) take part in evaluation. Compliance has its own model.<br>Gap:<br>The effective Governance Model read model lists only authority rules, policies and gates. Delegation Rules and Escalation Rules have no model, table or evaluation. Each component is specified in its own chapter and is traced there.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Governance may originate from Platform, Organisation, Domain, Compliance, Technology and Customer Packs. Several sources coexist.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/packs_schema_recovery.sql:7-26<br>src/domain/engine/compositionEngine.ts:231-253</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Packs carry a category and a tenant_id. The composition engine resolves every required Pack and their contributions coexist in one EBM. The category vocabulary is data driven.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Composition Engine produces one effective Governance Model as part of the EBM.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:253-258<br>src/domain/engine/compositionCompleted.ts:66-89</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition returns composedPacks and a compositionReport with governance conflicts. composeEbm persists the applicable policy and gate ids and the composition report into the single EBM row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Deliverable transition is approved when Policies, Quality Gates and Authority allow it.<br>Ref: §10 Approved</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:178-206</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">outcome is set to Approved when no Policy deviated and the Quality Gate passed or was not applicable. ok:true is returned with the outcome draft.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Approved with Conditions is an outcome.<br>Ref: §10 Approved with Conditions</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:180-181</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Standard Policy deviation yields Approved-with-Conditions, which is recorded with the deviated Policy ids.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Waived is an outcome.<br>Ref: §10 Waived, §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:178-181<br>src/domain/engine/qualityGateEngine.ts:158-167<br>src/domain/engine/qualityGateEngine.ts:207-225</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An active Quality Gate waiver turns a blocked gate into Waived. The outcome row records Waived with the gate id and originating Pack.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Rejected is an outcome on violation of a mandatory Policy, an unresolved blocking Obligation or missing Authority.<br>Ref: §10 Rejected</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:72-89<br>src/domain/engine/executionEngine.ts:118-153<br>src/domain/engine/policyEngine.ts:75-77<br>src/domain/engine/badgeAuthorityEngine.ts:35</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A Policy-type violation, an open blocking Obligation, an open Decision and a failed Quality Gate all refuse the transition. A missing badge throws.<br>Gap:<br>The refusal is returned as a reason code (policy_blocked, obligation_blocked and so on). No governance outcome row with outcome Rejected is written, and the value Rejected is never produced anywhere. Missing authority throws an Error rather than returning a governed result.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deferred is an outcome, on the same grounds as Rejected.<br>Ref: §10 Deferred</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The type GovernanceOutcome lists Deferred (seuTypes.ts:569), but no code path produces it. A blocked transition is refused, not deferred.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Escalated is an outcome.<br>Ref: §10 Escalated</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The type lists Escalated, but no evaluation produces it. Obligation escalation exists as an Obligation hop and is separate from a governance outcome.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Standard Policy deviation never alone produces Rejected or Deferred. It is recorded and traceable, and governance approves regardless.<br>Ref: §10 Constraint Type rule</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:75-88<br>src/domain/engine/transitionEngine.ts:160-172<br>tests/governance-depth.test.ts:137<br>src/domain/engine/executionEngine.ts:180-181</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only constraint_type Policy returns Blocked. A Standard violation is pushed to deviatedPolicyIds, publishes PolicyViolated and StandardPolicyDeviation, and the outcome is Approved-with-Conditions. A test asserts a Standard deviation allows the transition and a Policy violation blocks it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every outcome includes a recorded rationale.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:182-195<br>src/dblayer/recovery/governance_evaluation_outcomes_schema_recovery.sql:11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>rationale is NOT NULL and is built for every Approved, Approved-with-Conditions and Waived outcome.<br>Gap:<br>Refusals (the Rejected case) have no stored rationale. The detail string is returned to the caller and not persisted.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Governance rules progress through Defined, Composed, Active, Applied, Superseded and Archived. Historical rules remain reproducible.<br>Ref: §11, §14, §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:210-245<br>src/dblayer/seed/data/transitionDefinitions.json:1598-1666<br>src/dblayer/recovery/ebms_schema_recovery.sql:3-13<br>src/dblayer/recovery/governance_evaluation_outcomes_schema_recovery.sql:3-25</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Policy Definitions have a lifecycle (Draft to Archived). The EBM has Composed, Validated, Active and Retired. EBM rows carry a version and composed_packs with Pack versions. Governance outcome rows keep the ids of the rules applied.<br>Gap:<br>Authority rules, Quality Gates and materialised Policies have no lifecycle states. No Applied or Superseded state exists for a governance rule. getEffectiveGovernanceModel reads Packs by id and is not guarded by a historical view, so a past model is only reconstructable from the EBM row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every governance outcome records the governing rule, originating Pack, applicable Authority, supporting Evidence, related Decision, affected Deliverable and timestamp.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/governance_evaluation_outcomes_schema_recovery.sql:3-25<br>src/domain/engine/executionEngine.ts:188-204</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The row records satisfied and deviated Policy ids, originating_pack_id, applicable_authority_rule_id, entity_id of the Deliverable, and evaluated_at.<br>Gap:<br>originating_pack_id is set only for a waived Quality Gate and is null otherwise. No Evidence ids and no Decision ids are stored. The Policy to Pack link must be followed through the Policy rows. Rule identity for Quality Gates is stored only for waivers.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Governance outcomes allow complete reconstruction of governance decisions.<br>Ref: §12, §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/workItemGenerator.ts:109-125<br>src/routes/seu/core/traceability.ts:82-173</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The work item generator reads an outcome by id and resolves its Policies, authority rule, Attention Items and gate.<br>Gap:<br>No API, route or view lists or retrieves governance outcomes for a Deliverable. explainDeliverable does not include them. governanceEvaluationOutcomesDB has only create and findById.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Governance subsystem publishes GovernanceEvaluated, GovernanceApproved, GovernanceRejected, GovernanceEscalated, GovernanceWaived and GovernanceRuleApplied.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/governanceModel.ts:53-63<br>src/domain/engine/policyEngine.ts:53-62<br>src/domain/engine/qualityGateEngine.ts:174-183</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Related events are published: PolicyApplied, PolicyViolated, StandardPolicyDeviation, QualityGatePassed, QualityGateBlocked, QualityGateWaived and GovernanceModelInspected.<br>Gap:<br>None of the six named events is published anywhere. GovernanceRuleApplied has the closest counterpart in PolicyApplied, which covers Policies only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Governance Model supports composition from multiple organisations.<br>Ref: §14, §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:231-253<br>src/dblayer/recovery/packs_schema_recovery.sql:21-26</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Tenant scoped Packs compose into one EBM, and the Mandatory classification pulls platform Packs into every Template. Covered further under the composability row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Governance implementation produces a domain model, evaluation service, registry, APIs, event model and traceability model.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/governance_evaluation_outcomes_schema_recovery.sql:3-25<br>src/domain/engine/executionEngine.ts:52-207<br>src/routes/seu/core/governanceModel.ts:17-77<br>src/routes/seu/api/seus.ts:56-65</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Domain model (outcome table and types), evaluation service (executionEngine and transitionEngine) and one read API exist.<br>Gap:<br>No Governance registry object exists. The API exposes only the effective model. The event model is not implemented as specified. The traceability model covers Deliverable outcomes only and has no retrieval surface.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every significant engineering state transition is governed.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:52-329<br>src/domain/engine/entityTransition.ts:24-78</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Deliverable, Decision, Obligation and SEU hops run governed checks.<br>Gap:<br>Governance Outcome recording and Command linkage apply to Deliverables only. Entities that use transitionEngine.evaluate without a SEU context skip Quality Gate evaluation.</td>
    </tr>
  </tbody>
</table>

## Summary

| Measure | Count |
|---|---|
| Total intents analysed | 31 |
| Fully met | 13 |
| Partially met | 16 |
| Not met | 2 |
| Not verifiable | 0 |

Major implementation gaps:

- Outcomes Deferred, Escalated and Rejected are never produced, and refusals are not persisted.
- Governance outcome rows exist for Deliverable transitions only.
- None of the six Governance events of §13 is published.
- No retrieval surface for governance outcomes. Outcome rows lack Evidence and Decision ids.
- Governance rule lifecycle (§11) exists only for Policy Definitions and the EBM.
- Policy conflicts are not detected, and duplicate codes across Packs are skipped silently.
- Evaluation order of Policies and gates is not deterministic.
- Delegation and Escalation rules have no implementation in this chapter's scope.
