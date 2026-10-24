# Implementation Traceability: Chapter 22 – Authority Model

**Date of report: 23-10-2026**

Specification: src/docs/SEU Studio Specifications/04_Governance/22_Authority.md

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority determines who may perform a governed engineering action. A governed action needs a badge held by the actor.<br>Ref: §1, §4, AM-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:89-99<br>src/domain/engine/entityTransition.ts:41-53</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">authorise() resolves the Transition Definition verb to the badge entity_verb (for example deliverable_approve) and calls resolveAuthorBadge. The actor must hold that badge or root, otherwise an error is thrown. transitionEntity refuses to proceed when no badge is resolved and applies the state change only after the check.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority is independent of organisational job titles and of the user table role field.<br>Ref: §1, AM-006</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/badgeAuthorityEngine.ts:11-36<br>src/dblayer/participantsMasterDB.ts:13-14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Held badges come only from participants_master.authorised_badges. The user role field and job titles are not read by the badge check.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority is evaluated dynamically using the Engineering Behavior Model, the active Governance Model and applicable Authority Packs.<br>Ref: §1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:115-125<br>src/domain/engine/executionEngine.ts:102-107<br>src/routes/seu/core/governanceModel.ts:26-37</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the required badge is derived at evaluation time from the Transition Definition of the EBM entity, and the decision is made per request.<br>Gap: the Authority rules contributed by Packs are not read when deciding. The decision depends only on the badge held. The rules appear in the Governance Model view and in the outcome row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority sits between the Governance Model and Authority Packs, and Governance Evaluation, which precedes the state transition.<br>Ref: §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:102-207<br>src/domain/engine/transitionEngine.ts:115-208</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: authority is checked first in the evaluation chain, then Quality Gates, Policies and submission, and the state change follows.<br>Gap: Authority Packs do not feed the Authority check. Only the badge vocabulary and Transition Definitions feed it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority is contextual: it depends on EBM, Deliverable state, Governance Model, active Policies, active Obligations and Authority Packs.<br>Ref: §4, AM-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:55-75, 115-125<br>src/domain/engine/badgeAuthorityEngine.ts:11-36</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the required badge depends on the entity type and the from and to state. The actor must also be a Participant of the SEU for governed entities.<br>Gap: the held badge is global. The seu_ids scope stored with each badge is not consulted in badgeAuthorityEngine. Policies and Obligations are evaluated separately and do not change who is authorised.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority is a runtime relationship between an action, a governing context and a Participant, and not a Participant attribute.<br>Ref: §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/participantsMasterDB.ts:144-150<br>src/dblayer/seuTypes.ts:433-434</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the relationship action to badge is runtime resolved.<br>Gap: the grant itself is stored as an attribute list on the participants_master row. No relationship record binds action, context and Participant.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority is composable from several Packs.<br>Ref: AM-003, §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/profileCompositionUnravel.ts:215-223<br>src/domain/engine/compositionEngine.ts:281-302<br>src/routes/seu/core/governanceModel.ts:26-37</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: Pack authorityRules are pooled per governed transition and listed in one Governance Model, de-duplicated by rule code.<br>Gap: composition produces a list and conflict messages. It does not produce an effective Authority Model that the evaluator consults.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority stays independently traceable.<br>Ref: AM-004, FR-22.4, §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/governanceEvaluationOutcomesDB.ts:9-34<br>src/domain/engine/executionEngine.ts:180-206</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: Deliverable transitions write a governance outcome row with applicable_authority_rule_id, author, badge and rationale.<br>Gap: other entities write no such row. See §14 rows.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority may be delegated.<br>Ref: AM-005, FR-22.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No delegation table, service, route or evaluation step exists. A search for delegat across src found no authority code.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every governed engineering action requires explicit authority.<br>Ref: FR-22.1, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/routeAuthorityGate.ts:29-88<br>src/domain/engine/entityTransition.ts:41-53<br>src/domain/engine/executionEngine.ts:102-107</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Routes are denied by default unless a route_authority row exists. Entity transitions throw when the Transition Definition declares no verb. Deliverable hops resolve deliverable_ verbs.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority is evaluated before execution.<br>Ref: FR-22.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/entityTransition.ts:41-61<br>src/domain/engine/executionEngine.ts:102-107</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evaluation runs before the transaction that changes state. A failed badge check throws before any write.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority rules are contributed through Packs.<br>Ref: FR-22.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/packs.ts:209, 540-549<br>src/dblayer/authorityRulesDB.ts:6-37<br>src/dblayer/seuTypes.ts:87</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: Packs declare authorityRules {code, governedTransition, authorisedRole}. Publish validates duplicates and upserts them with originating_pack_id.<br>Gap: the required badge comes from transition_definitions.verb. The rule contributes no enforcement and authorisedRole is not compared with any role.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority assignments remain fully traceable.<br>Ref: FR-22.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/identity.ts:165-188<br>src/dblayer/participantsMasterDB.ts:144-150</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: assignments carry effective_till and seu_ids.<br>Gap: setAuthorisedBadges overwrites the JSON list. It records no grantor, no grant timestamp, no history and publishes no event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority supports multiple participating organisations.<br>Ref: FR-22.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/badgeTypesDB.ts:7-30<br>src/routes/seu/core/governanceModel.ts:26-37</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: tenants add badge types derived from Platform badges. Packs from several organisations contribute rules.<br>Gap: authority evaluation has no organisation dimension. Rules from different organisations are not evaluated per organisation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority conflicts are detected.<br>Ref: FR-22.7, §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:253, 281-302<br>tests/governance-ebm-sharpening.test.ts:87-100</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Packs that assign different authorised roles to the same governed transition create a conflict. Conflicts block commissioning, and a test covers it.<br>Note: only role disagreement on one transition is detected.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Authority Model has Authority Rules.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/authorityRulesDB.ts:6-37<br>src/domain/engine/executionEngine.ts:106-107</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Rules exist as {code, governedTransition, authorisedRole}. The engine looks a rule up by badge code and records its id on the outcome row. The rule is not applied.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Authority Model has Delegation Rules.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No delegation rule construct exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Authority Model has Escalation Rules.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No escalation rule construct exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Authority Model has Approval Rules.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No approval rule construct exists. Approval is a badge-gated transition only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Authority Model has Exception Rules.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/qualityGateWaiversDB.ts:16-26</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only Quality Gate waivers exist. They are not Authority exception rules.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Authority Model has Separation of Duties Rules.<br>Ref: §7, §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No separation of duties rule construct exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority originates from Platform, Organisation, Domain, Compliance and Customer Packs, and the Composition Engine composes one effective Model.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:281-302<br>src/domain/engine/profileCompositionUnravel.ts:215-223</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: any Pack category can contribute authorityRules and the Composition Engine pools them.<br>Gap: no single effective Authority Model is produced. Pack category does not influence authority.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority is evaluated whenever a governed action is requested.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/entityTransition.ts:41-53<br>src/domain/engine/executionEngine.ts:102-107<br>src/middleware/routeAuthorityGate.ts:29-88</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each governed transition and each route request runs the check.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evaluation considers the requested action, current Deliverable state and Participant identity.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:89-99<br>src/domain/engine/transitionEngine.ts:55-62</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evaluation takes entity type, from state, to state and actorId, and resolves the SEU Participant.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evaluation considers the fulfilled Capabilities of the Participant.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The badge check does not read Capability fulfilments.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evaluation considers the Governance Model, Policies, Obligations and engineering stage.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:137-186</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: Policies and Quality Gates are evaluated in the same chain. Open Obligations are listed on the outcome row.<br>Gap: they are not inputs to the authority decision. Open Obligations do not change who is authorised.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evaluation produces one deterministic outcome.<br>Ref: §9, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/badgeAuthorityEngine.ts:11-36</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The decision is set membership of the held badge, so identical inputs give the same result.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Outcomes: Authorised with Conditions, Not Authorised, Escalation Required, Delegation Required, Waiver Required.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The check returns a badge or throws. authorise() throws when the actor lacks the badge, so Not Authorised is an exception. The other outcomes do not exist.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each outcome includes supporting rationale.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:180-206</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable outcome rows carry rationale text including Authority check passed. Refusals carry no rationale record.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Delegation is defined by explicit delegation rules with delegating authority, receiving authority, scope, duration and conditions.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No delegation structure exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Delegation never occurs implicitly and is traceable.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No delegation exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Assignments can be time bound, which supports duration.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/badgeAuthorityEngine.ts:11-36</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">effective_till expires a held badge in getHeldBadges. This is an assignment expiry and not delegation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Multiple organisations contribute authority rules that form one effective Model.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:281-302</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pack rules from several organisations are pooled. See the §8 row for the missing effective Model.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Conflicts resolve deterministically by composition rules defined by the Governance Model.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:253-259</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Conflicts block commissioning. The resolutions list is always empty and there is no resolution rule.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Separation of duties: the implementer of a Deliverable cannot approve it.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No check compares the implementing and approving Participant.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Separation of duties: security waivers need independent approval.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/qualityGateWaiversDB.ts:16-26</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The waiver stores granted_by and authority_badge. No independence check exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Separation of duties: production and development approvals need different authorities.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No such constraint exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Separation of duties constraints are declarative and contributed through Packs.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:87</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Pack contribution schema has authorityRules only. It has no SoD constraint kind.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An authority decision preserves the governing rule and originating Pack.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/governanceEvaluationOutcomesDB.ts:9-34<br>src/domain/engine/executionEngine.ts:188-199</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">applicable_authority_rule_id is stored. originating_pack_id is taken from a waived Quality Gate, so it is null otherwise. The Pack of the authority rule is not stored on the outcome.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An authority decision preserves the requesting and authorised Participant.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/governanceEvaluationOutcomesDB.ts:9-34</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">One author_id and author_badge are stored. The requester and the authorised Participant are not stored as separate fields.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An authority decision preserves the affected Deliverable and Governance Model.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/governanceEvaluationOutcomesDB.ts:9-34</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable id, SEU id and states are stored. The EBM version or Governance Model is not stored. Only Deliverable transitions write an outcome row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An authority decision preserves a timestamp and rationale.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/governance_evaluation_outcomes_schema_recovery.sql:20-21<br>src/domain/engine/executionEngine.ts:180-186</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">created_at defaults to NOW and rationale is written for Deliverable outcomes.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority traceability is immutable.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/governanceEvaluationOutcomesDB.ts:5-51</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The DB layer exposes create and findById only. No database trigger or constraint prevents updates.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Authority subsystem publishes AuthorityRequested.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No event of this name is published.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Authority subsystem publishes AuthorityGranted.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No event of this name is published. Badge grants publish nothing.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Authority subsystem publishes AuthorityDenied.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No event of this name is published. A denial throws or redirects.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Authority subsystem publishes AuthorityDelegated.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No event of this name is published.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Authority subsystem publishes AuthorityEscalated.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No event of this name is published.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Authority subsystem publishes AuthorityExpired.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/badgeAuthorityEngine.ts:11-36</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Expiry is filtered at read time. No event is published.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Authority subsystem publishes AuthorityRevoked.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/identity.ts:178-186</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Removing a badge edits the list. No event is published.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Non-functional: composition from multiple organisations and dynamic delegation.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionEngine.ts:281-302</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composition is partly met, see §12. Dynamic delegation does not exist.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Non-functional: authority is independent of Participant implementations.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/badgeAuthorityEngine.ts:11-36</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The check uses the actor id and the participants_master badge list for any Participant type.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Non-functional: complete traceability.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/governanceEvaluationOutcomesDB.ts:9-34</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See the §14 rows.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: every governed action requires explicit authority.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See FR-22.1 row</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as FR-22.1.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: authority is evaluated contextually.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See §4 row</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Context is limited to transition and SEU Participant. seu_ids is not applied.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: authority rules from multiple organisations are composed.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See §8 row</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Pooled and checked for conflict, not composed into an enforced Model.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: delegation is explicit and traceable.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No delegation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: separation of duties constraints are enforced.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No enforcement.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: authority decisions are explainable and reproducible.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:180-206</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Reproducible by set membership. Explanation exists for Deliverable approvals only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Authority domain model.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/authority_rules_schema_recovery.sql:2-14<br>src/dblayer/authorityVocabularyDB.ts:40-59</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Tables exist for rules, nouns, verbs and noun-verb pairs, and badge types. No delegation or SoD entities exist.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Authority evaluation service.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/badgeAuthorityEngine.ts:11-36<br>src/domain/engine/transitionEngine.ts:89-99</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A badge check service exists. It lacks outcomes, rule evaluation and context.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Delegation service.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No delegation service exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Authority registry.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/authorityVocabularyDB.ts:217-236<br>src/routes/seu/core/authorityVocabulary.ts:74-140</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A registry of nouns, verbs and pairs with trigger settings exists, plus the route_authority table. Authority rules have no registry view.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Authority APIs.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/identity.ts:165-188</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Web routes manage vocabulary and badge grants. There is no API for evaluating, delegating or querying authority decisions.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Authority events.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None found</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See the §15 rows.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Authority traceability service.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/governanceEvaluationOutcomesDB.ts:43-51</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only findById on outcome rows exists. There is no retrieval or query service.</td>
    </tr>
  </tbody>
</table>

## Summary

| Measure | Count |
|---|---|
| Intents analysed | 66 |
| Fully met | 11 |
| Partially met | 28 |
| Not met | 27 |
| Not verifiable | 0 |

Major implementation gaps:

- Authority is a badge membership test. Pack-contributed Authority Rules are recorded but not enforced, and authorised_role is never compared with a role.
- Delegation has no implementation (rules, service, traceability, events).
- Separation of Duties, Escalation, Approval and Exception rules have no implementation.
- The six non-binary Authority outcomes do not exist. A missing badge throws.
- None of the seven Authority events of §15 is published.
- Badge scope seu_ids is stored but not applied, so authority is global per badge.
- Authority decisions are traced only for Deliverable transitions, without separate requester, authorised Participant, rule Pack or Governance Model.
- Badge grants have no history, grantor or event.
