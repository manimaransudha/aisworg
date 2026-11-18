# Implementation Traceability: Chapter 26 – Quality Gate Model

**Date of report: 18-11-2026**

Specification: src/docs/SEU Studio Specifications/04_Governance/26_Quality Gate.md

Basis: CR-145 (design/change-requests/CR-145-quality-gate-alignment.md), built and checked with `tsc` only. The tests and `db:clean-slate` were not run for this report.

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:116-185<br>src/domain/engine/executionEngine.ts:203-236</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">evaluate reads the gates the SEU's EBM settled for the hop and runs each criterion. The only writes are evaluation rows, the stored decision and events. The Execution Engine receives the decision and decides whether the hop proceeds.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Quality Gate evaluation does not modify engineering state.<br>Ref: §4, §10, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/qualitygates/index.ts:19-23<br>src/domain/engine/qualityGateEngine.ts:61-71, 274-290</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A criterion returns satisfied or not and changes nothing. recordAndPass and recordAndBlock store the evaluation row only. The caller updates the entity after the decision. tests/quality-gate-generalization.test.ts asserts a blocked hop leaves the entity unchanged.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The position in the architecture is Policies, Reviews, Evidence, Knowledge, Decisions and Obligations feeding a Quality Gate, then Governance evaluation, then the state transition.<br>Ref: §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/qualitygates/index.ts:27-32<br>src/domain/engine/executionEngine.ts:70-236</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: criteria read Obligations, Evidence, Decisions, Reviews and Policies. The gate decision is made inside governed evaluation before the state change.<br>Gap: no criterion reads Knowledge. Searched: src/qualitygates (four criterion files, one registry map).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Quality Gates are declarative contracts.<br>Ref: §4, QG-001, §9, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/quality_gate_definitions_schema_recovery.sql:1-20<br>src/qualitygates/index.ts:27-36<br>src/dblayer/seed/data/ontologyConcepts.json:5619-5640</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A gate is a Quality Gate Definition row with a code, name, category and a criteriaType. The criteria types are Ontology concepts (quality-gate-criteria-type). The engine resolves each type to its implementation through findQualityGateCriterion and blocks an unknown type. A Pack lists a gate by Definition code with the transition, the Deliverable, the Checklists and the required Policy codes. A new criterion type is a new implementation file by design (CR-145 A1).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Criteria are interpreted by the Governance Model.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:61-71<br>src/qualitygates/requiresActivePolicy.ts:10-38<br>src/domain/engine/executionEngine.ts:203-236</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the engine interprets each criterion through the registry. The Execution Engine acts on the composed decision.<br>Gap: the Policy criterion evaluates each Policy condition with evaluateCondition and does not route an implemented condition to the Policy evaluation that the transition engine uses (transitionEngine.ts:151). Whether the criterion is to call the Policy evaluation is not decided (CR-145 A3).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Criteria may reference Deliverable state, review outcomes, accepted Evidence, approved Decisions, active Policies, unresolved Obligations, compliance requirements and engineering metrics.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/qualitygates/noUnresolvedObligations.ts:6-17<br>src/qualitygates/requiresAcceptedEvidenceOrApprovedDecision.ts:10-26<br>src/qualitygates/requiresAcceptedReview.ts:8-20<br>src/qualitygates/requiresActivePolicy.ts:10-38</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: unresolved Obligations, accepted Evidence or approved Decisions, accepted Reviews and active Policies.<br>Gap: no criterion reads Deliverable state, compliance requirements or engineering metrics. The compliance evaluation in src/routes/seu/core/compliance.ts is not a gate criterion. Searched: src/qualitygates and the registry map.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Standard-type Policy referenced by a gate is non-blocking unless the gate explicitly treats adherence as blocking.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/qualitygates/requiresActivePolicy.ts:10-38<br>src/domain/engine/policyEngine.ts:57-107</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: requires_active_policy no longer decides the Standard rule. It passes the Policy checks to policyEngine.evaluateChecks (requiresActivePolicy.ts:31) and reports the result. The engine blocks a failed Policy and does not block a failed Standard: it stores the evaluation as Deviated, publishes PolicyViolated and StandardPolicyDeviation, and returns the deviated ids, which the criterion keeps in the evaluation detail (policyEngine.ts:83-99). The rule belongs to Policy evaluation, as the owner decided (CR-145 A3).<br>Gap: a gate has no setting that makes a Standard blocking for that gate, so the exception in §9 ("unless the gate explicitly treats adherence as blocking") cannot be expressed. The engine needs an SEU, so the criterion blocks an entity outside an SEU. The tests were not run.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Quality Gate has a globally unique identifier.<br>Ref: §6 FR-26.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/quality_gate_definitions_schema_recovery.sql:1-20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">quality_gate_definitions.id is a UUID primary key. Evaluations, waivers, the EBM and Transition Definitions refer to a gate by this id. The code and version are unique per tenant (quality_gate_definitions_code_version_tenant_key).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Quality Gates are contributed through Packs.<br>Ref: §6 FR-26.2, §8 Originating Pack</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/quality-gate-no-unresolved-obligations.json<br>src/actions/materialisePack.ts:9-16<br>src/dblayer/recovery/quality_gates_schema_recovery.sql:12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack lists Quality Gate Definition codes in contributionQualityGates. The Pack Published to Active hop runs the materialise-pack action, which writes the gate rows with originating_pack_id NOT NULL. The EBM takes the gates of the composed Packs. The seed lists eight gate entries in four Packs.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Quality Gates support composition from multiple organisations. Composition is deterministic. Conflicts are resolved through Governance composition rules.<br>Ref: §6 FR-26.3, §12, QG-003, §16, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/conflicts/unravelQualityGates.ts:39-82<br>src/domain/engine/conflicts/qualityGates.ts:11-30<br>src/domain/engine/conflicts/settleQualityGates.ts:29-56<br>src/domain/engine/compositionCompleted.ts:62-68</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The gates of every composed Pack are collected per Deliverable and step. A conflict (quality-gate-different) is detected and settled by the user's pick (CR-139). The EBM stores the settled result once, and the SEU evaluates exactly that result, so the effective gates are fixed at composition. §12 names Platform, Organisation, Customer and Compliance Packs as examples. No layer field or precedence exists, and every effective gate of a hop is evaluated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Quality Gate evaluates one or more engineering objects.<br>Ref: §6 FR-26.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:116-162<br>src/domain/engine/entityTransition.ts:58-65</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each gate line item is its own evaluation of one object. The engine evaluates Deliverables, AttentionItems, Obligations and the other SEU-scoped entity types that pass through transitionEntity. A call that takes several objects at once is expanded when a need arises (owner, CR-145 A7).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Quality Gate outcomes are immutable.<br>Ref: §6 FR-26.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/qualityGateEvaluationsDB.ts<br>src/dblayer/qualityGateOutcomesDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">qualityGateEvaluationsDB and qualityGateOutcomesDB hold create and read functions only. No UPDATE or DELETE of either table exists in src (the only DELETE is a test cleanup). No database trigger enforces it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every evaluation preserves the evaluated object, applicable Engineering Behavior Model, governing Policies, supporting Reviews, Evidence, Decisions, active Obligations, outcome and timestamp. Historical evaluations are reproducible.<br>Ref: §6 FR-26.6, §14, QG-005, §16, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:61-71, 274-290<br>src/qualitygates/noUnresolvedObligations.ts:6-17<br>src/qualitygates/requiresAcceptedEvidenceOrApprovedDecision.ts:10-26<br>src/qualitygates/requiresAcceptedReview.ts:8-20<br>src/qualitygates/requiresActivePolicy.ts:10-38</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An evaluation row stores the gate (an exact version), the SEU, the entity, the outcome, the author, the badge and the timestamp. Its detail stores the EBM id and version and the objects the criterion relied on: Obligation ids, Evidence and Decision ids, Review ids or Policy ids. A Blocked row also stores the reason data. The decision stores the conditions and the evaluation ids. The reason text of a Blocked gate is returned to the caller and is not stored.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Quality Gate evaluations are deterministic. Identical engineering state gives the same outcome.<br>Ref: §5 QG-006, §16, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateOutcomeComposition.ts:42-48, 72-86</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The outcome is a fixed function of the conditions and of the Active waivers. Due waivers are expired before every lookup, so the time of the decision is an input, and the stored decision records the waiver id of each covered condition. A past decision is reproducible from its record.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Quality Gates remain independent of Participants.<br>Ref: §5 QG-004, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/qualitygates/index.ts:11-17<br>src/domain/engine/executionEngine.ts:203-212</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A criterion receives the gate, the entity type, the entity id and the SEU id. The author and badge of every evaluation are the SEU's system actor, not a user.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Quality Gate evaluation records are kept and historical evaluations remain available.<br>Ref: §16, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/qualityGateEvaluationsDB.ts:30-42<br>src/dblayer/qualityGateOutcomesDB.ts<br>src/routes/seu/core/seus.ts:486, 596-618</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every evaluation and every decision is stored and never deleted. The Quality Gates tab of the SEU page shows the latest outcome of each gate, the gates that block now, and the latest decision of each Deliverable. The full history is in the tables.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Quality Gates support explicit waivers with a justification, approving authority, scope, duration, risks and compensating controls. Waivers are explicit, governed and traceable.<br>Ref: §6 FR-26.7, §13, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/qualityGateWaivers.ts:45-190<br>src/routes/seu/web/seus.ts:447-487<br>src/domain/engine/qualityGateWaiverExpiry.ts:8-35<br>src/dblayer/recovery/quality_gate_waiver_risks_schema_recovery.sql</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a waiver has a rationale, the granting participant and the badge qualitygate_waive resolved through the badge authority engine, a scope (Gate, Policy, Policy Obligation or Obligation) with its target, the entity and Deliverable codes, an optional Profile share, an expiry time, risks and the controls that offset each risk (Expiry, Obligation, Accept risk). The grant refuses a past expiry time and a duplicate Active waiver. A Waiver Active to Expired hop runs through transition_definitions, and QualityGateWaiverCreated and QualityGateWaiverExpired are published with the tenant.<br>Gap: no function or route performs Active to Revoked. The lifecycle-table test and the Version Feature Plan entry for Waiver are not written. The waiver API routes are not implemented, by the owner's decision.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A waiver does not remove the Quality Gate. It modifies evaluation for a defined context.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateOutcomeComposition.ts:51-86<br>src/domain/engine/qualityGateEngine.ts:187-207</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The evaluation row stays Blocked. A waiver is applied in the decision: composeQualityGateOutcome marks a Blocked condition Waived only when an Active waiver names it for the entity or the Deliverable code, and the decision becomes Waived when no uncovered block remains.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Quality Gates are evaluated whenever a governed lifecycle transition is requested.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:203-236<br>src/domain/engine/entityTransition.ts:58-65<br>src/domain/engine/transitionEngine.ts:99-110<br>src/domain/engine/deliverableKickoff.ts:26, 98</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a Deliverable hop decides every condition and stores the decision. transitionEntity evaluates the EBM gates for entities in an SEU, and evaluateGoverned evaluates the gates a Transition Definition pins. A granted waiver triggers a new attempt of the covered Deliverable hops.<br>Gap: entity types outside an SEU (Objective, EBM, SEU, SchemaDefinition, Ontology) are not evaluated, and only a Deliverable hop stores a decision (the owner confirmed the second as expected). No authoring path writes the pinned gate ids (CR-145 G11).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evaluation determines satisfied criteria, unsatisfied criteria, applicable waivers, blocking conditions and supporting rationale.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:187-207<br>src/domain/engine/qualityGateOutcomeComposition.ts:93-103<br>src/dblayer/recovery/quality_gate_outcomes_schema_recovery.sql:1-23</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The decision lists every condition with its outcome, Passed or Blocked or Waived with the waiver id. It carries the composed outcome, the confidence level, the rationale and the evaluation ids, and it is stored in quality_gate_outcomes. Conditions come from the gate line items and from the other checks of the hop: dependencies, SEU Obligations, Obligations, Decisions, Command in flight, Policies, Submission and Reference.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evaluation produces one of six outcomes: Passed, Passed with Conditions, Blocked, Waived, Deferred, Not Applicable.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/ontologyConcepts.json:5682-5730<br>src/domain/engine/qualityGateOutcomeComposition.ts:72-86</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the Ontology concepts quality-gate-outcome and quality-gate-decision-outcome and the types hold the values. A gate evaluation is Passed or Blocked. The decision is Approved, Blocked, Waived or NotApplicable.<br>Gap: nothing produces Passed with Conditions or Deferred, and the composition has no rule for them. The chapter does not say when a gate produces either (CR-145 B1, item 21).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The outcome becomes an input to Governance, which decides whether the transition proceeds.<br>Ref: §3, §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:203-236<br>src/domain/engine/entityTransition.ts:58-70</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The decision is composed from the line items and acted on by the Execution Engine and by transitionEntity. A Blocked decision refuses the hop and raises an Attention Item. An Approved or Waived decision lets it go on, and the governance outcome of the hop carries the id of the stored decision (quality_gate_outcome_id).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Quality Gate defines Identifier, Name, Category, Scope, Applicable Lifecycle Transition, Evaluation Criteria, Required Reviews, Evidence, Decisions, Obligations, Policies, Waiver Rules, Version and Originating Pack.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/quality_gate_definitions_schema_recovery.sql:1-20<br>src/dblayer/recovery/quality_gates_schema_recovery.sql<br>src/dblayer/seuTypes.ts:84-99</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the Definition holds the identifier (code and id), name, category, criteria and version. The Pack entry holds the transition, the Deliverable, the Checklists and the required Policy codes. The originating Pack is the Pack that lists the gate. Reviews, Evidence, Decisions, Obligations and Policies are expressed through the criterion type and its parameters (reviewGateId, evidenceCategory, the listed Policies).<br>Gap: Waiver Rules. A gate holds no waiver rule, a waiver carries its own scope, entity, duration and risks, and nothing lets a gate refuse to be waived.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Quality Gates carry a version, and a change gives a new version that the evaluation names.<br>Ref: §8 Version</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/quality_gate_definitions_schema_recovery.sql:11, 20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Definition is unique on (code, version, tenant), and a new version is a new row. An evaluation row stores the id of the Definition, so it names the exact version.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Categories include Entry, Exit, Release, Compliance and Operational, and additional categories may be introduced through Packs.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/ontologyConcepts.json:1848-1884<br>src/dblayer/seed/data/schemaDefinitions.json (contributionQualityGates.category)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the five categories are Ontology concepts of type category:quality-gate, the category field of a gate is Ontology-driven, and a Pack author can propose another concept.<br>Gap: the category has no behaviour of its own. It groups gates and separates gates on one transition (CR-145 G4).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The subsystem publishes QualityGateEvaluated, QualityGatePassed, QualityGateBlocked, QualityGateWaived, QualityGateDeferred and QualityGateConfigurationChanged.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:209-272<br>src/routes/seu/core/qualityGateWaivers.ts:179-190<br>src/domain/engine/qualityGateWaiverExpiry.ts:22-32</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: recordDecision publishes QualityGatePassed for each gate that passed, QualityGateBlocked for each gate the decision leaves Blocked and QualityGateWaived for each condition a waiver covers, after the decision is stored and with the real actor, badge and tenant. This holds for Deliverable hops, which are the hops that store a decision. QualityGateWaiverCreated and QualityGateWaiverExpired are also published.<br>Gap: QualityGateEvaluated, QualityGateDeferred and QualityGateConfigurationChanged are never published, and a changed gate version raises no event. Searched: eventType literals across src.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The implementation delivers a domain model, a registry, an evaluation service, a waiver service, a composition service, APIs and events.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:84-101, 993-1007<br>src/routes/seu/web/qualityGateDefinitionRegistry.ts<br>src/domain/engine/qualityGateEngine.ts:116-272<br>src/routes/seu/core/qualityGateWaivers.ts:45-190<br>src/routes/seu/api/qualityGateWaivers.ts:9-10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the domain model (Definition, evaluation, decision and waiver tables and types), the Definition registry page with list controls, the evaluation and decision service, the grant and expire parts of the waiver service, a composition sequence (unravel, detect, settle, store in the EBM, evaluate, compose the outcome) and the events of §15 in part.<br>Gap: no revoke in the waiver service. The Quality Gate API routes are registered as notImplemented and have no route_authority row. The owner decided that no API is needed.</td>
    </tr>
  </tbody>
</table>

## Summary

- Total intents analysed: 27
- Fully met: 16
- Partially met: 11
- Not met: 0
- Not verifiable: 0
- Major implementation gaps: no criterion reads Knowledge, Deliverable state, compliance requirements or engineering metrics; a gate cannot treat a Standard as blocking (the Standard rule itself is Policy evaluation's, which the policy criterion calls); Passed with Conditions and Deferred are never produced; QualityGateEvaluated, QualityGateDeferred and QualityGateConfigurationChanged are never published; waivers have no revoke; a gate holds no waiver rule; pinned gate ids have no authoring path and entity types outside an SEU are not evaluated; the gate category has no behaviour of its own.
