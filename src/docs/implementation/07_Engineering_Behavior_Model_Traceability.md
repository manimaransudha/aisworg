# Implementation Traceability: Chapter 7 – Engineering Behavior Model (EBM)

**Date of report: 23-10-2026**

Specification: src/docs/SEU Studio Specifications/01_Engineering Definition/07_Engineering Behavior.md

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every commissioned SEU executes against exactly one EBM that holds its behavioural contract.<br>Ref: §1, §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seusDB.ts:72-82<br>src/domain/engine/compositionCompleted.ts:105<br>src/domain/engine/workItemGenerator.ts:33-38</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the SEU row holds one active_ebm_id and the runtime readers (work items, policies, quality gates, eligibility, dispatch) load the EBM through it.<br>Gap: see FR-7.1 for the single-active guarantee.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The EBM governs engineering behaviour. Competence stays with Participants.<br>Ref: §1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:156-262<br>src/routes/seu/core/participantEligibility.ts:32-45</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the pool holds behaviour (rules, gates, policies, obligations) and competencyRequirements is kept apart for Participant matching.<br>Gap: eligibility re-runs unravelComposition at execution time. It does not read the competency map stored in the EBM.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SEU consumes an EBM but never modifies it directly.<br>Ref: §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:56-64<br>src/domain/engine/entityAdapters.ts:281-302</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the only UPDATE on ebms is updateStatus. The SEU code path writes only seus.active_ebm_id.<br>Gap: none for the SEU. See FR-7.8 for the row itself.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The EBM is authoritative for the SEU lifetime unless superseded by governed recomposition.<br>Ref: §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/objectives.ts:485-544<br>src/routes/seu/web/objectives.ts:594-596</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the EBM is created once and read by the runtime. A second compose creates a new row with version MAX+1.<br>Gap: GET compose-ebm redirects away once active_ebm_id is set, so the UI offers no governed recomposition. The POST has no guard and no supersede step. The old EBM is not retired.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The EBM is produced by composing contributions from one or more Packs.<br>Ref: §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:200-262<br>src/domain/engine/compositionCompleted.ts:59-63</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: Pack capabilities, services, authority rules, quality gates, checklists, review gates, obligations, policies and dependencies are added to the pool, and the pool is stored in ebms.behaviors.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The EBM defines engineering, governance, decision, quality, compliance, collaboration, lifecycle and authority behaviour, terminology and constraints.<br>Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:200-262<br>src/domain/engine/compositionCompleted.ts:66-72</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: authority, quality, review, checklist, policy, obligation, capital and dependency behaviour.<br>Gap: no pool entry exists for terminology, collaboration, engineering-practice or lifecycle rules. Compliance is read from composed Pack ids at run time (compliance.ts:44-49).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The EBM holds no executable work, scheduling, participant management, knowledge or workflow execution.<br>Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/ebms_schema_recovery.sql:3-12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the ebms table holds references, a composed pack list, a report, a behaviour pool and policy and gate id lists. No code path executes from the row itself.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every commissioned SEU references exactly one active EBM.<br>Ref: FR-7.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seusDB.ts:72-82<br>src/domain/engine/compositionCompleted.ts:105<br>src/dblayer/seed/data/transitionDefinitions.json:209-247</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: seus.active_ebm_id is one column, so an SEU has one current reference.<br>Gap: the id is set at creation in state Composed, before Validated and Active. Consumers never check ebm.status. A Composed or Retired EBM governs the SEU as if active.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every EBM has a globally unique identifier.<br>Ref: FR-7.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/ebms_schema_recovery.sql:3-4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: id is a UUID primary key with gen_random_uuid().</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every EBM is versioned.<br>Ref: FR-7.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:23-24<br>src/dblayer/recovery/ebms_schema_recovery.sql:13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: version is computed as MAX(version)+1 per seu_id in the INSERT.<br>Gap: the table has no unique key on (seu_id, version), so concurrent composes can store the same version. The select and insert are not serialised.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every behavioural contribution traces to its originating Pack.<br>Ref: FR-7.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:8-23<br>src/domain/engine/profileCompositionUnravel.ts:200-262</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: each pool entry carries source {kind, id, code, label}. Pack entries name the Pack.<br>Gap: Template and Profile sourced entries name those objects, not a Pack. The Pack version is not on the entry. It is only in composed_packs.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every behavioural rule defines its composition strategy.<br>Ref: FR-7.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:19-23</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: none on the pool entry. PoolEntry has propertyName, value and source only.<br>Gap: no rule or entry records a strategy. Strategies are applied only to conflicts, and the resolved map carries values without the strategy name.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Behavioural conflicts are detected before an SEU is commissioned.<br>Ref: FR-7.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:340-372<br>src/routes/seu/web/objectives.ts:485-544</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: unravelComposition reports property conflicts and the compose route publishes CompositionCompleted only when none remain.<br>Gap: detection compares pooled property values. It does not examine workflow, compliance or technology semantics.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Conflicts needing human judgement block commissioning until resolved.<br>Ref: FR-7.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/objectives.ts:524-526<br>src/routes/seu/core/commissioning.ts:464-507</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: with open conflicts no CompositionCompleted event is published, so no EBM exists and commissioning cannot proceed. A person picks a strategy through applyConflictStrategy.<br>Gap: every conflict is treated as needing a human. There is no deterministic or non-deterministic split.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The EBM is immutable during normal execution.<br>Ref: FR-7.8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:56-64<br>src/dblayer/recovery/ebms_schema_recovery.sql:3-25</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: no code updates behaviors, composed_packs or the report after insert. Only status changes.<br>Gap: the database has no trigger, revoked grant or check. The weirdo role holds ALL on ebms (line 25). Immutability rests on convention.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Modification of an EBM occurs only through recomposition.<br>Ref: FR-7.9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/objectives.ts:485-544<br>src/dblayer/ebmsDB.ts:56-64</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: content changes only through a new row from the compose handler.<br>Gap: the guard is the missing UI link. Any POST to compose-ebm creates a new version with no check of state or authority beyond the route badge. getEffectiveGovernanceModel (governanceModel.ts:20-47) reads live Pack rows, so the answer changes when Packs change.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All recompositions are versioned and fully traceable.<br>Ref: FR-7.10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:23-24<br>src/domain/engine/compositionCompleted.ts:74-89</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: each recompose inserts a new row with a higher version and its own report and pack list.<br>Gap: no parent version, no reason or trigger and no link to the earlier EBM is stored. The old EBM stays in its state.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The EBM may carry behaviour in nine categories (Engineering Practices, Governance, Quality, Compliance, Domain, Technology, Integration, Decision Governance, Obligations).<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:200-262</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: pool entries for governance (authority, policy), quality (gate, checklist, review gate), obligations and capital.<br>Gap: the pool has no category field. The kind is implied by the propertyName prefix. Practices, domain terminology and technology conventions have no pool representation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A behavioural rule has identifier, name, description, category, Pack, version, strategy, applicability conditions, enforcement level and traceability reference.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:19-23<br>src/dblayer/seuTypes.ts:350-362</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a pool entry has propertyName, value and source.<br>Gap: no description, category, Pack version, strategy, enforcement level or traceability reference on the entry. Applicability sits inside some values (policy, obligation) only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Supported strategies are Override, Merge, Supplement, Union, Intersection, Alias and Conflict Detection, with extension by the Extension Framework.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:32-60<br>src/routes/seu/core/commissioning.ts:464-507</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: six strategy names with requirements, and four applied to conflicts.<br>Gap: Alias and Conflict Detection exist only as Ontology concepts. New strategies need a code change (see Chapter 6 report).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The EBM inherits behaviour from Platform, Organisation, Domain, Compliance, Technology and Integration Packs with no assumption on count.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:80-130<br>src/domain/engine/profileCompositionUnravel.ts:200-262</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the walk takes any number of Packs through the Template and Profile.<br>Gap: composition does not use the category ordering shown in the spec. The pool is built per Pack with no precedence between categories. Platform Packs are added only if Mandatory (see Chapter 6 report).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Contributions on the same concern are resolved by declared strategies into one consistent, deterministic EBM.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:340-372<br>src/routes/seu/core/commissioning.ts:464-507<br>src/domain/engine/compositionCompleted.ts:59-63</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: conflicts are detected and a chosen strategy yields a resolved value.<br>Gap: the stored pool still holds every conflicting entry. The resolved map sits beside it and no reader of behaviors.pool consults it. Lookups by Pack have no ORDER BY (policiesDB.ts:76).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Enforcement belongs to runtime services. The EBM performs no execution.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:27-31<br>src/domain/engine/qualityGateEngine.ts:53-58<br>src/domain/engine/dispatchStrategies.ts:27-29</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: policy, quality gate and dispatch engines read the EBM and enforce. The EBM row has no behaviour of its own.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Runtime services: Participants consult the EBM, services enforce, Deliverables and Decisions are validated, Obligations are assessed against it.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/policyEngine.ts:27-31<br>src/domain/engine/qualityGateEngine.ts:53-58<br>src/routes/seu/core/obligations.ts:196-200<br>src/routes/seu/core/participantEligibility.ts:32-45<br>src/routes/seu/core/compliance.ts:44-49</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: Deliverable and transition policies, quality gates, obligations, work items and dispatch read the EBM.<br>Gap: eligibility recomposes live instead of reading the EBM. Compliance and the governance model read live Pack rows from composed ids. decisions.ts does not read the EBM directly.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The EBM remains read-only at run time.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:56-64<br>src/domain/engine/entityAdapters.ts:297-302</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: runtime readers call findById only. The one writer is the status transition adapter.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each EBM keeps a version identifier, parent version, composition history, source Pack versions, change history and approval history.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/ebms_schema_recovery.sql:3-22<br>src/domain/engine/compositionCompleted.ts:74-89</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: version, composed_packs with packVersion, composition_report, author_id and author_badge.<br>Gap: no parent version, composition history, change history or approval history field. Approvals exist only as the generic event and transition log.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Historical versions remain reproducible.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:8-48<br>src/routes/seu/core/governanceModel.ts:20-47</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: old rows keep their stored pool and pack list.<br>Gap: the stored pool refers to Pack ids, but rule content for the governance model is read from live Pack rows. Rebuilding an old EBM from its composed_packs needs Pack versions to be immutable, which is not enforced here.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform publishes EBMCreated, EBMValidated, EBMVersioned, EBMActivated, EBMRetired, BehaviourConflictDetected and BehaviourConflictResolved.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:209-247<br>src/dblayer/seed/data/eventSubscriptions.json:9-14<br>src/domain/engine/compositionCompleted.ts:106-117</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: EBMCreated, EBMValidated, EBMActivated and EBMRetired are published from the transition rows.<br>Gap: EBMVersioned is declared in event_subscriptions but never published. BehaviourConflictDetected and BehaviourConflictResolved are not defined or published.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EBM validation exists as a lifecycle step.<br>Ref: §15, §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:88-103<br>src/routes/seu/core/commissioning.ts:366-381</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: validateEbm checks that the Template, Profile and each composed Pack are still live, else retires the EBM.<br>Gap: no check of behavioural completeness, rule consistency or conflicts.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The EBM activates through governed steps and makes the SEU commissionable.<br>Ref: §5, §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:228-236<br>src/domain/engine/ebmActivated.ts:15-53</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: Validated to Active is a manual row. ebmActivatedHandler runs finalizeCommissioning.<br>Gap: the previous EBM is not retired on activation, so more than one EBM can stay Active per SEU.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The EBM is deterministic from identical inputs.<br>Ref: §11, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:156-262<br>src/domain/engine/compositionCompleted.ts:59-63</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the pool is built in walk order from fixed inputs and stored once.<br>Gap: lookups for policies and quality gates have no ORDER BY, so id lists may differ between runs. Determinism is tested only for compositionEngine.compose.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The EBM supports incremental evolution and concurrent versions.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:23-24<br>src/routes/seu/web/objectives.ts:594-596</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: many rows per seu_id are allowed and each version is stored.<br>Gap: every recompose is a full rebuild. Only one pointer (active_ebm_id) is kept and it is set at creation. No unique version key.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The EBM is independent of implementation technologies.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/ebms_schema_recovery.sql:3-12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the EBM is JSONB data with no technology reference.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Behaviour from multiple Packs is composed.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:200-262<br>src/domain/engine/compositionCompleted.ts:59-65</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: multi-Pack contributions land in one pool and one composed pack list.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Behavioural conflicts are detected.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:340-372</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: property conflicts are detected over the pool.<br>Gap: no BehaviourConflictDetected event and no detection of the semantic examples in Chapter 6 §11.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Conflicts are resolved before commissioning.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/objectives.ts:524-526<br>src/domain/engine/compositionCompleted.ts:59-63</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: no EBM is created while conflicts remain.<br>Gap: after resolution the pool is unchanged (see §11), so the EBM does not reflect the resolution.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The resulting EBM is versioned.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:23-24</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a version number is assigned at insert. See FR-7.3 for the uniqueness gap.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Runtime services correctly consume the EBM.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/workItemGenerator.ts:33-38<br>src/domain/engine/policyEngine.ts:27-31<br>src/domain/engine/redispatch.ts:17-19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: several runtime readers load the EBM through active_ebm_id.<br>Gap: none checks EBM status, and eligibility, compliance and the governance view read live data.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The EBM remains immutable during execution.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:56-64</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: no update path for content. Gap: no database enforcement (see FR-7.8).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: EBM domain object, behaviour catalogue, rule model, versioning model, validation services, query services, composition interfaces and an initial EBM API.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:5-66<br>src/routes/seu/core/seus.ts:489-515<br>src/routes/seu/web/seus.ts:184-198</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: domain row and DB layer, EBM view for the web UI, validation by liveness check, a view page of the pool.<br>Gap: no behaviour catalogue, no rule model, no query service for rules and no EBM API route (src/routes/seu/api has none).</td>
    </tr>
  </tbody>
</table>

## Summary

- Total intents analysed: 40
- Fully met ✅: 12
- Partially met ⚠️: 26
- Not met ❌: 2
- Not verifiable ❓: 0

### Major implementation gaps

- Recomposition is not governed. The UI blocks it once an EBM exists, the POST has no guard and no parent version, trigger or supersede step is recorded.
- active_ebm_id is set at Composed, and no consumer checks EBM status, so an unvalidated or Retired EBM governs the SEU.
- Pool entries carry no composition strategy, category, Pack version or enforcement level, and no behavioural rule model exists.
- Resolved conflicts do not change the stored pool.
- Immutability and version uniqueness are not enforced by the database.
- EBMVersioned, BehaviourConflictDetected and BehaviourConflictResolved are not published.
- Eligibility, compliance and the governance view read live Pack or composition data instead of the EBM.
- Terminology, practice, domain and technology behaviour have no pool representation. There is no EBM API or behaviour query service.
