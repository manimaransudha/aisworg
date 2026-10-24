# Implementation Traceability: Chapter 24 – Policy Model

**Date of report: 23-10-2026**

Specification: src/docs/SEU Studio Specifications/04_Governance/24_Policy.md

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Policy is a declarative statement of engineering constraints. Its conditions are data, not coded behaviour.<br>Ref: §1, §4, PM-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/policyDefinitions.ts:53-73<br>src/domain/engine/governingCondition.ts:1-9<br>src/dblayer/recovery/policy_definitions_schema_recovery.sql:3-25</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Policy Definition stores its conditions as JSONB. The governing condition types always_true, field_in, comparison and threshold are validated data evaluated by a generic evaluator. Platform lifecycle Policies use the type implemented, decided by functions registered in src/policies/index.ts:17-28. Those functions read state and change nothing.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Policies do not execute work, grant authority, perform reviews or modify engineering state. Evaluation changes no state.<br>Ref: §1, §4, §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:14-91<br>src/domain/engine/transitionEngine.ts:128-175</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Both evaluators read policies and context and publish PolicyApplied, PolicyViolated and StandardPolicyDeviation events. Neither writes entity state. The transition is applied by the caller after the outcome.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Policies sit between the Engineering Behavior Model and governance evaluation, and influence the state transition.<br>Ref: §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:64-88<br>src/domain/engine/policyEngine.ts:26-36<br>src/domain/engine/executionEngine.ts:137-152</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The EBM stores applicable_policy_ids and seu_scoped_policy_ids at composition. policyEngine reads them from the SEU's active EBM and returns Passed or Blocked. executionEngine refuses the Deliverable transition on Blocked.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Policy declares a Constraint Type of Policy or Standard.<br>Ref: §4, §8, FR-24.8, PM-007</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/policies_schema_recovery.sql:9-10<br>src/dblayer/recovery/policy_definitions_schema_recovery.sql:9-10<br>src/dblayer/policyDefinitionsDB.ts:28</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">constraint_type is NOT NULL with CHECK IN ('Policy','Standard') on both policy_definitions and the materialised policies table. createDraft defaults it to Policy.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Constraint Type and Severity are independent fields.<br>Ref: §5 PM-007, §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:271-278<br>src/routes/seu/core/policyDefinitions.ts:75-90<br>src/dblayer/policiesDB.ts:22-28</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Constraint Type is a column on the Definition. Severity is a per-condition field validated against category:policy-condition-severity. The engines branch on constraint_type only and never read severity to decide blocking.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Policies are composable from multiple Packs and organisations.<br>Ref: §5 PM-002, §10, FR-24.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:553-577<br>src/domain/engine/compositionCompleted.ts:64-72<br>src/dblayer/policyDefinitionsDB.ts:201-215</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Pack contributes Policy codes. Install resolves each to an Active Policy Definition visible to the tenant (own or platform) and materialises policies rows owned by that Pack. composition collects the policies of every composed Pack into the EBM.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Policies are independently versioned.<br>Ref: §5 PM-003, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/policy_definitions_schema_recovery.sql:15,23<br>src/dblayer/policyDefinitionsDB.ts:30,154-164<br>src/routes/seu/core/policyDefinitions.ts:231-262</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each Definition has a semver version and UNIQUE (code, version, tenant_id). Copying an Active Definition creates a new Draft at the next free patch version.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Policies are context-sensitive. Conditions are evaluated against the context of the governed action.<br>Ref: §5 PM-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:49<br>src/domain/engine/executionEngine.ts:128-145</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">evaluateCondition receives the context supplied by the caller. For a Deliverable the context holds the Deliverable and the status of its producing Capability.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Policies are independent of Participant implementations.<br>Ref: §5 PM-006</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:14-91<br>src/routes/seu/core/participantEligibility.ts:24-38</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The evaluators take entity type, states and context only. Eligibility-scope Policies read a Participant's declared behaviour context and not any Participant implementation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Policy has a globally unique identifier.<br>Ref: §6, FR-24.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/policy_definitions_schema_recovery.sql:4<br>src/dblayer/recovery/policies_schema_recovery.sql:4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Both tables use a UUID primary key generated with gen_random_uuid().</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Policies are contributed through Packs.<br>Ref: §6, FR-24.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:290-312<br>src/routes/seu/core/packs.ts:553-577<br>src/dblayer/policiesDB.ts:6-50</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">contributions.policies lists Policy codes. Validation requires each to resolve to an Active Policy Definition and to govern a Deliverable the Pack's Capabilities produce. Install writes policies rows with originating_pack_id and upserts on (originating_pack_id, code).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Policies are evaluated during governance evaluation whenever a governed engineering action is requested.<br>Ref: §6 FR-24.4, §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:137-152<br>src/routes/seu/core/commissioning.ts:327-334<br>src/domain/engine/transitionEngine.ts:128-175<br>src/domain/engine/policyEngine.ts:30</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: Pack Policies are evaluated for Deliverable transitions and for SEU commence work. Platform Policies bound through transition_definitions.required_policy_ids are evaluated on every governed hop that reaches transitionEngine.evaluate.<br>Gap: policyEngine.evaluate has only these two callers. A Pack Policy whose governed transition belongs to another entity type is stored in the EBM and never evaluated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A violated Policy condition blocks the governed transition. A violated Standard condition does not block.<br>Ref: §4, §6 FR-24.9, §11, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:65-88<br>src/domain/engine/transitionEngine.ts:151-173<br>src/domain/engine/executionEngine.ts:148-152</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">On an unsatisfied condition PolicyViolated is published. A Policy-type violation returns Blocked and executionEngine returns policy_blocked. A Standard violation adds the id to deviatedPolicyIds, publishes StandardPolicyDeviation and the loop continues. The Deliverable outcome becomes Approved-with-Conditions. tests/sustained-pattern-generalization.test.ts:58 drives three real Standard deviations.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Standard deviation is surfaced through Engineering Telemetry and stays traceable.<br>Ref: §4, §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/eventsDB.ts:216-230<br>src/routes/seu/core/telemetry.ts:202-225<br>src/domain/engine/executionEngine.ts:180-199</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deviations are counted per Policy and SEU from StandardPolicyDeviation events. Three or more raise an Organisational Learning Obligation. The governance outcome row stores deviated_policy_ids.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Policy evaluations remain fully traceable. Each evaluation preserves identifier, originating Pack, EBM version, applicable Deliverables, applicable Decisions, outcome, timestamp and rationale.<br>Ref: §6 FR-24.5, §14, PM-004</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:50-88<br>src/dblayer/governanceEvaluationOutcomesDB.ts:6-41<br>src/dblayer/recovery/governance_evaluation_outcomes_schema_recovery.sql:3-21<br>src/domain/engine/executionEngine.ts:176-206</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: each evaluation publishes an event carrying the Policy id, policyCode, entity type, hop, actor, badge, constraint type and timestamp. An allowed Deliverable transition writes a governance_evaluation_outcomes row with satisfied and deviated Policy ids, outcome, rationale and evaluated_at.<br>Gap: see the next rows for the Pack, EBM version, Deliverable, Decision and rationale fields.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evaluation traceability preserves the originating Pack of the Policy.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/policies_schema_recovery.sql:13<br>src/domain/engine/policyEngine.ts:50<br>src/domain/engine/executionEngine.ts:188-200</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: each materialised policies row stores originating_pack_id.<br>Gap: the event payload omits the Pack. The governance outcome originating_pack_id is set only from a waived Quality Gate and is null otherwise.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evaluation traceability preserves the Engineering Behavior Model version.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:26-31<br>src/dblayer/recovery/governance_evaluation_outcomes_schema_recovery.sql:3-21</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The evaluator reads the active EBM to select Policies and does not record the EBM id or version in any event payload or outcome column.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evaluation traceability preserves the applicable Deliverables.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:50<br>src/domain/engine/executionEngine.ts:188-200</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: an allowed Deliverable transition stores entity_type and entity_id in the outcome row.<br>Gap: policy events carry no entity id and use a fresh correlation id per event. A Blocked evaluation writes no outcome row, so the Deliverable of a blocked evaluation is not recorded with the Policy result.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evaluation traceability preserves the applicable Decisions.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:50-88</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No Decision identifier is read or stored by Policy evaluation. No evaluation record references the Decision model.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evaluation traceability preserves the evaluation outcome, timestamp and rationale.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:53-88<br>src/domain/engine/executionEngine.ts:182-195<br>src/dblayer/eventsDB.ts:216-230</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: PolicyApplied, PolicyViolated and StandardPolicyDeviation events carry outcome and timestamp. The governance outcome rationale lists satisfied and deviated counts.<br>Gap: the rationale is a count summary for the whole hop. No per-Policy rationale is stored, and a Blocked hop has no rationale record.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Policy history is immutable.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/policyDefinitionsDB.ts:116-119,134-142<br>src/dblayer/policiesDB.ts:21-29<br>src/dblayer/eventsDB.ts:52-60</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: Definition content can be updated only while status is Draft. No delete function exists for Definitions or events. Events are insert-only apart from consumption_state.<br>Gap: the materialised policies row is overwritten in place on republish by ON CONFLICT DO UPDATE, so the evaluated condition of an earlier Pack version is lost.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Policies support explicit exception rules. An exception rule specifies justification, approving authority, duration, scope and review requirements.<br>Ref: §6 FR-24.6, §8, §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:255-263<br>src/routes/seu/core/policyDefinitions.ts:157-172<br>src/routes/seu/core/sdkAuthoring.ts:234-248</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A condition carries exceptionRules with identifier, exceptionStatement, duration, exceptionScope, exceptionApprovers, exceptionComposition and reviewRequirements. Validation requires a statement and checks each approver against real noun_verb badges.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Exception rules can be declared only for Constraint Type Policy.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/policyDefinitions.ts:157-159</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">validateConditions rejects exceptionRules on a Standard Definition. A Standard deviation needs no exception.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A blocked transition can proceed under an approved exception within its duration and scope.<br>Ref: §11, §12, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:75-77<br>src/domain/engine/transitionEngine.ts:161</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Both evaluators return Blocked on a Policy violation without consulting exceptionRules. No code reads exceptionRules or exceptionApprovers at evaluation time. A stored exception rule has no runtime effect.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Exceptions are requested, approved by the declared authority and remain traceable. PolicyExceptionRequested and PolicyExceptionApproved are published.<br>Ref: §12, §15, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/authorityVocabulary.json:324-333</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The verbs request_exception and approve_exception exist as vocabulary and are described as not wired to any transition. No exception record, route, service or event publication exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Policy conflicts are detected and resolved according to Governance rules.<br>Ref: §6 FR-24.7, §10, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:253,281-320</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">detectGovernanceConflicts compares authority rules and Quality Gates only. It reads no Policy. Policies from different Packs always co-apply and no Policy conflict is reported or resolved.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Policy categories are Ontology driven and extensible through Packs.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/sdkAuthoring.ts:945<br>src/routes/seu/core/sdkAuthoring.ts:1135<br>src/dblayer/seed/data/ontologyConcepts.json:1893-1954</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">category is validated as a composable field against the category:policy Ontology concepts. New values are proposed to the Ontology when a Definition is authored.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Policy defines Identifier, Name, Description, Category, Constraint Type, Conditions, Severity, Version and Originating Pack.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/policy_definitions_schema_recovery.sql:3-25<br>src/dblayer/seuTypes.ts:271-292<br>src/dblayer/recovery/policies_schema_recovery.sql:3-14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Definition holds code, name, description, category, constraint type, conditions with statement and severity, and version. The materialised policies row holds originating_pack_id. The Definition carries no Pack because it is tenant owned and Packs reference it by code.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Policy defines Required Evidence and the evaluation determines the required evidence.<br>Ref: §8, §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:271-278<br>src/routes/seu/core/policyDefinitions.ts:122</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: each condition stores requiredEvidence and validates its category against category:evidence.<br>Gap: no evaluator, outcome or event reads requiredEvidence. Evaluation neither reports nor checks required evidence.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Policy defines Related Obligations and the evaluation determines the required obligations.<br>Ref: §8, §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/policyDefinitions.ts:124-155<br>src/routes/seu/core/obligations.ts:123-185<br>src/domain/engine/executionEngine.ts:148-151</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: relatedObligations are validated against the obligation Ontology. After a Policy-type block on a Deliverable or SEU commence, an Obligation and an Attention Item are raised for each declared obligation.<br>Gap: obligations are raised only after Blocked and not as an evaluation result. The Obligation does not carry the declared requiredEvidence. Lookup of the Policy uses policiesDB.findByCode, which is not unique per Pack (src/dblayer/policiesDB.ts:52-60).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Applicability is declared by Deliverable and Deliverable lifecycle state, and evaluated dynamically.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyChecks.ts:6-19<br>src/domain/engine/policyEngine.ts:34-44<br>src/routes/seu/core/policyDefinitions.ts:98-120</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A condition lists applicability rows of Deliverable name plus governed transitions (Deliverable|from|to). Install fans each row into a policies row with the transition and names. policyEngine filters by the exact transition and by the Deliverable's name at each request.<br>Note: the candidate set is fixed in the EBM at composition. Matching is per request.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Applicability is declared by Environment.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/policy_definitions_schema_recovery.sql:11<br>src/domain/engine/profileCompositionUnravel.ts:243-258<br>src/routes/seu/core/templates.ts:138-148</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: applicabilityEnvironments is stored on the Definition, validated against category:environment and exposed as a composition parameter and pool entry.<br>Gap: policyEngine and policyChecks never compare it with an environment, so it never excludes a Policy from evaluation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition preserves deterministic behaviour and evaluation is deterministic.<br>Ref: §10, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/policiesDB.ts:62-71,73-82<br>src/domain/engine/policyEngine.ts:46-90<br>src/domain/engine/compositionEngine.ts:240-250</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: composition resolves one Pack per code and the same inputs give the same set. Whether a hop is blocked does not depend on order.<br>Gap: findByIds and findByPackIds have no ORDER BY. The loop returns at the first blocking Policy, so the reported policyCode, the obligations raised and the deviation events recorded depend on row order.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Policy lifecycle is Draft, Validated, Published, Active, Deprecated, Retired, Archived, each hop governed by a verb badge.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1597-1666<br>src/domain/engine/entityAdapters.ts:199-220<br>tests/policy-definition-event-lifecycle-table.test.ts:94-200</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Seven transition_definitions rows exist for entity Policy with verbs define, validate, publish, activate, deprecate, retire, archive. Validate requires policy-validate-schema. Publish also requires policy-ontology-values-present. Each hop carries an event type and version event. Tests drive the hops, the badge refusal and the guards.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Historical Policies remain available for engineering reconstruction.<br>Ref: §13, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/policyDefinitionsDB.ts:154-174,201-215<br>src/dblayer/recovery/policy_definitions_schema_recovery.sql:23</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Definitions are never deleted. Every version stays addressable by code and version. Only Active Definitions are installed into new Packs.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Historical Policy versions remain reproducible for past evaluations.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/policiesDB.ts:21-29<br>src/dblayer/governanceEvaluationOutcomesDB.ts:6-41</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: all Definition versions persist.<br>Gap: evaluations record the materialised policies row id, not the Definition id or version, and that row is overwritten on republish. The version used by a past evaluation cannot be reconstructed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Policy subsystem publishes creation, validation, publication and retirement events.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1597-1666<br>tests/policy-definition-event-lifecycle-table.test.ts:131-160</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Events are published as PolicyDefinitionDefined, PolicyDefinitionValidated, PolicyDefinitionPublished and PolicyDefinitionRetired, plus Activated, Deprecated and Archived. The names differ from the specification and the meanings are equal. Each is published with a real actor and badge through transitionEntity.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Policy subsystem publishes PolicyApplied and PolicyViolated.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:53-74<br>src/domain/engine/transitionEngine.ts:139-160</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PolicyApplied is published for a satisfied condition and PolicyViolated for an unsatisfied one. Both carry the real actorId and the resolved authority badge.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Policy subsystem publishes PolicyExceptionRequested and PolicyExceptionApproved.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/authorityVocabulary.json:324-333</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Neither event type is published anywhere. The vocabulary entries are marked not wired.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Policy composition is supported without technology dependence in the policy language.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/governingConditionTypes.ts<br>src/routes/seu/core/policyDefinitions.ts:53-73</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Conditions are JSON typed data. The language is implementation defined as the specification allows.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Policy domain model and registry.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/policyDefinitionsDB.ts:8-230<br>src/routes/seu/web/policyDefinitionRegistry.ts:20-60<br>src/dblayer/seed/data/routeAuthority.json:1300-1316</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Domain rows and types exist in policyDefinitionsDB and policiesDB. A registry page lists Definitions and copies one into a new Draft. Both routes have route_authority rows. Authoring runs through sdkAuthoring.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Policy evaluation service.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:14-91<br>src/domain/engine/policyChecks.ts:33-55</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">policyEngine evaluates Pack Policies. loadPolicyChecks with transitionEngine evaluates the Policies bound to a hop.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Policy composition service.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:240-280<br>src/domain/engine/compositionCompleted.ts:64-88<br>src/routes/seu/core/packs.ts:553-577</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition collects the Policies of composed Packs into the EBM. Content-level Policy conflict handling is covered in its own row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Exception management service.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/policyDefinitions.ts:157-172</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only authoring validation of exceptionRules exists. No service requests, approves, expires or reviews an exception.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Policy APIs.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/policyDefinitionRegistry.ts:20-60<br>src/routes/seu/web/sdkAuthoring.ts:63,137</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: web routes list, copy, author and transition Policy Definitions with tenant scope checks.<br>Gap: src/routes/seu/api contains no Policy route. No JSON API exposes Policies, evaluations or exceptions.</td>
    </tr>
  </tbody>
</table>

## Summary

- Total intents analysed: 45
- Fully met: 25
- Partially met: 13
- Not met: 7
- Not verifiable: 0

Major implementation gaps:

- Exceptions: exceptionRules are authored and validated and have no runtime effect. No request, approval, expiry or exception events exist.
- Conflict detection: no Policy conflict is detected or resolved at composition.
- Traceability: evaluation records omit the EBM version, Decisions and the Definition version. Blocked evaluations write no outcome row. Materialised policies rows are overwritten on republish.
- Evaluation reach: Pack Policies are evaluated only for Deliverable transitions and SEU commence work.
- Required Evidence and Environment applicability are stored and never consumed at evaluation.
- Evaluation order is not fixed, so the reported blocking Policy is not deterministic.
- No Policy JSON API exists.

## Coverage Check

| Section | Considered | Rows |
|---|---|---|
| §1 Purpose, §2 Scope, §3 Position | Yes | 1, 2, 3 |
| §4 Definition | Yes | 1, 4, 13, 14 |
| §5 PM-001 to PM-007 | Yes | 1, 5, 6, 7, 8, 9, 15 |
| §6 FR-24.1 to FR-24.9 | Yes | 4, 6, 10, 11, 12, 13, 15, 22, 24, 26 |
| §7 Categories | Yes | 27 |
| §8 Structure | Yes | 5, 28, 29, 30 |
| §9 Applicability | Yes | 31, 32 |
| §10 Composition | Yes | 6, 26, 33 |
| §11 Evaluation | Yes | 2, 12, 13, 14, 24, 29, 30 |
| §12 Exceptions | Yes | 22, 23, 24, 25 |
| §13 Lifecycle | Yes | 34, 35 |
| §14 Traceability | Yes | 15 to 21 |
| §15 Events | Yes | 37, 38, 39 |
| §16 Non-Functional | Yes | 6, 7, 33, 40 |
| §17 Acceptance Criteria | Yes | 13, 15, 24, 26, 36 |
| §18 Deliverables | Yes | 41 to 45 |
