# Implementation Traceability: Chapter 26 – Quality Gate Model

**Date of report: 23-10-2026**

Specification: src/docs/SEU Studio Specifications/04_Governance/26_Quality Gate.md

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Quality Gate evaluates engineering readiness before a governed transition. It performs no engineering work and grants no authority.<br>Ref: §1, §4, QG-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:37-79<br>src/domain/engine/transitionEngine.ts:73-84</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">evaluate loads the gates for the entity type and transition and checks obligations, evidence, decisions, reviews or policies. The only writes are evaluation rows and events. The result is returned to the transition engine, which decides whether the hop proceeds.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Quality Gate evaluation does not modify engineering state.<br>Ref: §4, §10, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:94-156<br>src/domain/engine/transitionEngine.ts:64-86</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">evaluateGate only reads Obligations, Evidence, Decisions, Reviews and Policies. The caller updates the entity after the outcome. tests/quality-gate-generalization.test.ts:201-240 asserts a blocked hop writes and publishes nothing on the entity.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The position in the architecture is Policies, Reviews, Evidence, Knowledge, Decisions and Obligations feeding a Quality Gate, then Governance evaluation, then the state transition.<br>Ref: §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:100-153<br>src/domain/engine/transitionEngine.ts:64-86</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: gate criteria read Obligations, Evidence, Decisions, Reviews and Policies. The gate runs inside governed evaluation before the transition.<br>Gap: no criteria type reads Knowledge. The four criteria types cover Obligations, Evidence or Decisions, Reviews and Policies only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Quality Gates are declarative contracts.<br>Ref: §4, QG-001, §9, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/quality_gates_schema_recovery.sql:3-14<br>src/dblayer/seuTypes.ts:89-101<br>src/domain/engine/qualityGateEngine.ts:98-155</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a gate is a data row with entity type, from state, to state and a JSONB criteria document. A Pack contributes it as data with a criteriaType.<br>Gap: criteria are a closed set of four types hard-coded in an if chain in evaluateGate. Conditions are not an interpreted expression. An unknown type blocks. New criteria need a code change. Only requires_active_policy evaluates a declarative condition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Criteria are interpreted by the Governance Model.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:139-153<br>src/domain/engine/governingCondition.ts<br>src/domain/engine/transitionEngine.ts:64-86</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the Policy criterion uses the shared evaluateCondition from the governing condition module.<br>Gap: the other three criteria types are interpreted inside the Quality Gate engine, not by a Governance evaluator. evaluateGate is called with no context from the governed path, so Policy conditions see an empty context.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Criteria may reference Deliverable state, review outcomes, accepted Evidence, approved Decisions, active Policies, unresolved Obligations, compliance requirements and engineering metrics.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:100-153</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: unresolved Obligations (100-109), accepted Evidence or approved Decisions (111-124), review outcomes (126-137), Policies (139-153).<br>Gap: no criterion reads Deliverable state, compliance requirements or engineering metrics.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Standard-type Policy referenced by a gate is non-blocking unless the gate explicitly treats adherence as blocking.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:139-153</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: requires_active_policy does not look at the Policy Constraint Type. Every referenced Policy that is not satisfied blocks. There is no gate option to make a Standard blocking or non-blocking.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Quality Gate has a globally unique identifier.<br>Ref: §6 FR-26.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/quality_gates_schema_recovery.sql:4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">id is a UUID primary key generated by gen_random_uuid.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Quality Gates are contributed through Packs.<br>Ref: §6 FR-26.2, §8 Originating Pack</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:89-101<br>src/routes/seu/core/packs.ts:621-646<br>src/dblayer/qualityGatesDB.ts:11-69<br>src/domain/engine/compositionEngine.ts:306-317</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a Pack contributes qualityGates. Publishing the Pack upserts each into quality_gates with originating_pack_id, author and badge.<br>Gap: the schema leaves originating_pack_id nullable, so a gate without a Pack is possible at the database.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Quality Gates support composition from multiple organisations. Composition is deterministic. Conflicts are resolved through Governance composition rules.<br>Ref: §6 FR-26.3, §12, QG-003, §16, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:304-317<br>src/domain/engine/compositionCompleted.ts:65-86<br>src/dblayer/qualityGatesDB.ts:84-96<br>src/domain/engine/qualityGateEngine.ts:47-63</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the Pack gates of a composition are collected into the EBM applicable_quality_gate_ids. Evaluation selects the gates of the active EBM for the transition. Two Packs gating the same transition and category are reported as a conflict to resolve before commissioning.<br>Gap: there is no composition service that merges gates. A conflict is reported and not resolved by a rule. Two gates of different categories on one transition are all evaluated, with no precedence rule. Nothing models Platform, Organisation, Customer or Compliance gate layers.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Quality Gate evaluates one or more engineering objects.<br>Ref: §6 FR-26.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/quality_gates_schema_recovery.sql:15-17<br>src/domain/engine/qualityGateEngine.ts:37-92</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a gate applies to one entity type per transition across fourteen entity types, and each evaluation is for one entity id.<br>Gap: a gate cannot evaluate several objects together. Each evaluation takes one entityId.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Quality Gate outcomes are immutable.<br>Ref: §6 FR-26.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/qualityGateEvaluationsDB.ts:5-104<br>src/dblayer/recovery/quality_gate_evaluations_schema_recovery.sql:3-13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateEvaluationsDB exposes create and read queries only. No update or delete exists on evaluation rows.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every evaluation preserves the evaluated object, applicable Engineering Behavior Model, governing Policies, supporting Reviews, Evidence, Decisions, active Obligations, outcome and timestamp. Historical evaluations are reproducible and available.<br>Ref: §6 FR-26.6, §14, §16, §17, QG-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/quality_gate_evaluations_schema_recovery.sql:3-25<br>src/domain/engine/qualityGateEngine.ts:100-225<br>src/dblayer/qualityGateEvaluationsDB.ts:30-41</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: each row stores the gate, SEU, entity type and id, outcome, a detail document, evaluated_at, author and badge. Blocked rows carry the unresolved Obligation ids, the required category, the review gate id or the Policy id. The rows are queryable per SEU.<br>Gap: Passed rows store no detail. The rows do not record the EBM version, the Policies, Reviews, Evidence or Decisions that supported the pass, or the gate version. The gate version is held on the gate row. A past evaluation cannot be reproduced from the stored record.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Quality Gate evaluations are deterministic. Identical engineering state gives the same outcome.<br>Ref: §5 QG-006, §16, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:47-79<br>src/domain/engine/qualityGateEngine.ts:94-156</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evaluation is a pure function of the stored rows. Gates are iterated in query order and the first Blocked or Waived result is returned. No randomness or clock enters the criteria, except waiver expiry (see §13).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Quality Gates remain independent of Participants.<br>Ref: §5 QG-004, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:94-156</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No criterion reads Participant data. The author id and badge are used only to record the evaluation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Quality Gates support explicit waivers, with a justification, approving authority, scope, duration, risks and compensating controls. Waivers are explicit, governed and traceable.<br>Ref: §6 FR-26.7, §13, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/qualityGateWaiversDB.ts:5-28<br>src/routes/seu/core/qualityGateWaivers.ts:12-55<br>src/routes/seu/api/qualityGateWaivers.ts:11-36<br>src/dblayer/recovery/quality_gate_waivers_schema_recovery.sql:3-15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a waiver stores the gate, SEU, entity, rationale (required), granting participant, authority badge and expiry. Granting resolves the qualitygate_waive badge for the actor and publishes QualityGateWaiverGranted. Listing by SEU exists.<br>Gap: there are no fields for associated risks or compensating controls. Scope is one entity id only. There is no revoke or expire transition, so the Revoked and Expired statuses are never set. The POST route_authority row has empty badges (src/dblayer/seed/data/routeAuthority.json:484-490). The badge is checked inside the core function. No UI page grants a waiver. The waiver badge name is a literal in the core file (qualityGateWaivers.ts:8).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A waiver does not remove the Quality Gate. It modifies evaluation for a defined context.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:158-167,207-225<br>src/dblayer/qualityGateWaiversDB.ts:30-44</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the gate is still evaluated. Only when the criteria fail and an active unexpired waiver exists for that gate and entity does the outcome become Waived, which the transition engine lets through. The Waived result is recorded and QualityGateWaived is published.<br>Gap: the waiver is looked up only after a failure and never lowers the criteria. Waiver expiry is read against NOW(), so the same state can evaluate differently over time.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Quality Gates are evaluated whenever a governed lifecycle transition is requested, and the evaluation determines satisfied criteria, unsatisfied criteria, applicable waivers, blocking conditions and rationale.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:64-86,183-194<br>src/domain/engine/entityTransition.ts<br>src/domain/engine/qualityGateEngine.ts:37-92</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: governed transitions call evaluate (category-matched gates for the transition) or evaluateByIds (gates pinned on the Transition Definition). The first Blocked or Waived result stops the loop and carries a reason.<br>Gap: the loop stops at the first failing gate, so later gates are not evaluated and the unsatisfied criteria are not listed together. Satisfied criteria are not reported in the result. A transition with no seuId and no governed path skips the pinned gates (transitionEngine.ts:183).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evaluation produces one of six outcomes: Passed, Passed with Conditions, Blocked, Waived, Deferred, Not Applicable.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/quality_gate_evaluations_schema_recovery.sql:9-10<br>src/dblayer/seuTypes.ts:929<br>src/domain/engine/qualityGateEngine.ts:25-34</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: Passed, Blocked, Waived and Not Applicable are produced. Not Applicable is returned, not stored.<br>Gap: Passed with Conditions and Deferred are accepted by the database check and the type but no code produces them. The stored value for Not Applicable is never written.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The outcome becomes an input to Governance, which decides whether the transition proceeds.<br>Ref: §3, §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:83-85,190-194<br>src/dblayer/governanceEvaluationOutcomesDB.ts:11-25<br>src/dblayer/seuTypes.ts:570</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the transition engine treats Blocked as a refusal and everything else as allowed. The governance evaluation outcome table has quality_gate_id and quality_gate_outcome columns.<br>Gap: the outcome type there allows only Passed, NotApplicable and Waived, so Blocked, Conditions and Deferred cannot be recorded in the governance outcome.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Quality Gate defines Identifier, Name, Category, Scope, Applicable Lifecycle Transition, Evaluation Criteria, Required Reviews, Evidence, Decisions, Obligations, Policies, Waiver Rules, Version and Originating Pack.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/quality_gates_schema_recovery.sql:3-39<br>src/dblayer/seuTypes.ts:931-946</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: id, code, name, category, entity type (scope), from and to state (transition), criteria, version, originating Pack, checklists and deliverable names.<br>Gap: Required Reviews, Evidence, Decisions, Obligations and Policies are not separate fields. They are expressed through the single criteria type. Waiver Rules are not a field of the gate. code is the category, not a unique identifier of the gate.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Quality Gates carry a version and a change replaces the active row.<br>Ref: §8 Version</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/qualityGatesDB.ts:5-8,34-59<br>src/dblayer/recovery/quality_gates_schema_recovery.sql:19-36</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">upsert compares the contribution with the active row. If it differs, the old row is set inactive and a new row with the next minor version is inserted, in one transaction. The unique index allows one active row per transition, category and Pack.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Categories include Entry, Exit, Release, Compliance and Operational, and additional categories may be introduced through Packs.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/qualityGatesDB.ts:28<br>src/dblayer/recovery/quality_gates_schema_recovery.sql:7<br>src/dblayer/seed/data/authorityVocabulary.json:85</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: category is free text supplied by the Pack, defaulting to Exit, so Packs can introduce any category.<br>Gap: category is not validated against an Ontology list of gate categories and has no behaviour. It only separates gates on the same transition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The subsystem publishes QualityGateEvaluated, QualityGatePassed, QualityGateBlocked, QualityGateWaived, QualityGateDeferred and QualityGateConfigurationChanged.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:169-225<br>src/routes/seu/core/qualityGateWaivers.ts:43-52<br>src/routes/seu/core/packs.ts:621-646</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: QualityGatePassed, QualityGateBlocked and QualityGateWaived are published with a real actor and badge after the evaluation row is written. QualityGateWaiverGranted is published as an extra event.<br>Gap: QualityGateEvaluated, QualityGateDeferred and QualityGateConfigurationChanged are never published. Publishing a changed gate version raises no event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The implementation delivers a domain model, a registry, an evaluation service, a waiver service, a composition service, APIs and events.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/qualityGatesDB.ts<br>src/dblayer/qualityGateEvaluationsDB.ts<br>src/dblayer/qualityGateWaiversDB.ts<br>src/domain/engine/qualityGateEngine.ts<br>src/routes/seu/core/qualityGateWaivers.ts<br>src/routes/seu/api/qualityGateWaivers.ts:11-45<br>src/domain/engine/compositionEngine.ts:304-317</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: tables and row types (model), qualityGatesDB (registry), qualityGateEngine (evaluation), the waiver core and API (waiver service), conflict detection (composition).<br>Gap: there is no gate registry API or page to list gates or evaluations. No composition service exists. The API covers waivers only. The telemetry module reads latency and rework from the evaluations (src/domain/engine/metricRegistryEngine.ts:39-57).</td>
    </tr>
  </tbody>
</table>

## Summary

- Total intents analysed: 25
- Fully met: 7
- Partially met: 17
- Not met: 1
- Not verifiable: 0
- Major implementation gaps: criteria are a closed set of four coded types; Standard Policy handling absent; Passed with Conditions and Deferred never produced; QualityGateEvaluated, QualityGateDeferred and QualityGateConfigurationChanged never published; evaluation records lack the EBM, Policy, Review, Evidence and Decision lineage needed for reproduction; waivers lack risks, compensating controls, revocation and a UI; no composition service; no gate registry API.
