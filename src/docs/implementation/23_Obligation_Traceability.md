# Implementation Traceability: Chapter 23 – Obligation Model

**Date of report: 15-11-2026**

Specification: src/docs/SEU Studio Specifications/04_Governance/23_Obligation.md

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">An Obligation is a persistent, first-class engineering object with its own stored record.<br>Ref: §1, §4, OM-006</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/obligations_schema_recovery.sql:3-29<br>src/dblayer/obligationsDB.ts:6-44</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The obligations table stores each Obligation with category, title, description, severity, status, origin, priority, completion criteria, assignee, author, badge and timestamps. obligationsDB provides create, read and update functions.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Obligation has a globally unique identifier.<br>Ref: FR-23.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/obligations_schema_recovery.sql:4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The id column is a UUID primary key generated with gen_random_uuid().</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligations arise from governance, compliance, engineering practice, customer requirements, risk, operational experience and engineering decisions. Every significant commitment is represented as an Obligation.<br>Ref: §4, OM-001, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/obligations.ts:41-117<br>src/routes/seu/core/obligations.ts:125-194<br>src/routes/seu/core/obligations.ts:196-267<br>src/domain/engine/dispatchEngine.ts:29<br>src/domain/engine/redispatch.ts:59<br>src/domain/engine/deliverableKickoff.ts:276<br>src/routes/seu/core/participantHome.ts:129<br>src/routes/web/public.ts:101-125</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: Obligations are raised from blocking Policies, Pack obligation definitions, dispatch failures, the redispatch limit, an unavailable Capability, Participant requests (the Quickview and demo forms), Finding conversion, telemetry patterns, Knowledge promotion and the demo simulator.<br>Gap: no rule makes every significant commitment an Obligation. Each source is a separate coded path. An actor without a required badge makes resolveAuthorBadge throw (src/domain/engine/badgeAuthorityEngine.ts:30-36), and no Obligation is raised. A Quality Gate block raises an Attention Item (src/domain/engine/executionEngine.ts:124-136); an Obligation follows only through the sustained-pattern detector after the gate has blocked 3 times.<br>Searched: createObligation, raiseObligationForBlockedTransition and raiseObligationsForPackDefinitions (every caller in src/); raiseAttentionItem( (13 files); authority_denied and "does not hold" (src/).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform raises an Organisational Learning Obligation when Engineering Telemetry detects a sustained pattern that a Capability, Service or Policy should be improved.<br>Ref: §4, FR-23.8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/telemetry.ts:117-176<br>src/routes/seu/core/telemetry.ts:178-202<br>src/routes/seu/core/telemetry.ts:204-227<br>src/routes/seu/core/telemetry.ts:229-254</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: three detectors raise an Organisational Learning Obligation, for a repeatedly blocking Quality Gate, a repeatedly waived Standard Policy and a Capability unfulfilled across at least 3 SEUs. The raise is de-duplicated by a marker in the description, publishes SustainedPatternDetected and raises an Escalation Attention Item on the Obligation.<br>The Quality Gate detector runs inside a blocked Deliverable transition (src/domain/engine/executionEngine.ts:125). The Policy waiver and Capability shortage detectors run when the Engineering Telemetry page loads (src/routes/seu/web/telemetry.ts:58). No other code calls them.<br>Gap: no detector exists for a Service missing its declared Service Level or for a rework pattern that points at a Capability Pack. Service levels are read only to set a turnaround target (src/domain/engine/dispatchEngine.ts:13-21). Rework appears as a metric (src/domain/engine/metricRegistryEngine.ts, src/routes/seu/core/telemetry.ts:96-111) and as the Review outcome text "Rework Required" (src/routes/seu/core/reviews.ts:104). The Quality Gate detector targets a Quality Gate, which is not one of Capability, Service or Policy. The threshold 3 and the category text are literals in telemetry.ts (lines 113 and 141).<br>Searched: serviceLevel, service_level, Service Level, rework and checkSustained (src/**/*.ts).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Knowledge promoted to Capability, Enterprise or Platform Acquisition Scope raises an Organisational Learning Obligation to codify it.<br>Ref: §4, §7 Organisational Learning</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/knowledge.ts:128<br>src/routes/seu/core/knowledge.ts:180-194</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">After a successful scope promotion, createObligation is called with category Organisational Learning, origin Telemetry and Knowledge Model, the Knowledge Item as originating entity and a severity chosen by scope. The test tests/engineering-capital.test.ts:56 asserts the Obligation is visible.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligations are independent of Participants. Participants are assigned responsibility but do not own the Obligation, and reassignment does not change its identity or lifecycle.<br>Ref: OM-002, FR-23.7, §13, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/obligations_schema_recovery.sql:5-29<br>src/routes/seu/core/obligations.ts:281-320<br>src/dblayer/obligationsDB.ts:102-115</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Obligation row is keyed to seu_id. The assignee is held in separate assigned_entity_type and assigned_entity_id columns. reviseObligation changes the assignee without touching id, status or version, and records the change in revision_history. author_id and author_badge record the creator only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligations participate in dependency evaluation and are described in the Dependency Graph.<br>Ref: OM-003, §11, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:55-61<br>src/domain/engine/executionEngine.ts:57-73</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a Dependency Definition row whose from-entity is Obligation is satisfied only when every Obligation on the gated Deliverable has reached the named state. Deliverable readiness calls this check.<br>A gated entity with no Obligation counts as satisfied.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligations support dependencies upon Deliverables, Decisions, Evidence and other Obligations.<br>Ref: FR-23.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/obligations_schema_recovery.sql:6-7<br>src/routes/seu/core/obligations.ts:21-39</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: an Obligation links to one related object of type SEU, Deliverable, Obligation or Attention Item.<br>Gap: no link from an Obligation to a Decision or Evidence exists. Only one related object is allowed. Other types are refused with an error. A dependency row names only Deliverable and Capability nodes (src/domain/engine/dependencyDefinitionEngine.ts:36-52). Readiness is evaluated only for Deliverable targets (executionEngine.ts:57, capabilityOnReady.ts:27, deliverableKickoff.ts:130 and 165), so no Obligation is gated by a dependency on another object.<br>Searched: obligation in src/dblayer/*.ts (only constants, governanceEvaluationOutcomesDB, findingsDB, obligationsDB, qualityGatesDB, transitionDefinitionsDB and seuTypes name it; decisionsDB and evidenceDB do not); isTargetReady and isStartNode callers; obligation_id and obligationId in src/dblayer/recovery.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligations may block Deliverable state transitions, and unresolved Obligations block transitions.<br>Ref: FR-23.3, §3, §11, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:16<br>src/domain/engine/qualityGateEngine.ts:101-110<br>src/domain/engine/executionEngine.ts:75-85<br>src/domain/engine/executionEngine.ts:166-173</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The no_unresolved_obligations Quality Gate criterion blocks a transition while any Obligation on the entity is not Verified, Closed or Archived. The Execution Engine also refuses to start a Deliverable while the SEU or the Deliverable has an open blocking Obligation. A Policy block raises the blocking Obligation with the blocked from and to states.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A deployment Deliverable becomes ready automatically once its blocking Obligations are resolved. The Dependency Engine evaluates continuously.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/eventSubscriptions.json:27<br>src/dblayer/seed/data/eventSubscriptions.json:53<br>src/dblayer/seed/data/eventSubscriptions.json:64<br>src/domain/engine/deliverableKickoff.ts:21-50<br>src/domain/engine/deliverableKickoff.ts:91-101<br>src/domain/engine/executionEngineKickoff.ts:18-37</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">transitionObligation publishes ObligationTransitioned after every hop. Two registered handlers re-attempt the blocked work when the new state is Verified, Closed or Archived. executionEngineKickoff re-attempts SEU commence-work for a blocking SEU Obligation. deliverableKickoff re-attempts the governed transitions of the one Deliverable the Obligation is raised against and re-issues its producing Command. The test tests/cr108-obligation-model-seu-execution.test.ts:142 asserts unblocking.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Obligation has measurable completion criteria.<br>Ref: FR-23.4, §8, §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/obligations_schema_recovery.sql:18<br>src/routes/seu/core/obligations.ts:41-59<br>src/routes/seu/core/obligations.ts:82-103</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a completion_criteria text column exists and is set from Pack and Policy definitions.<br>Gap: the column is nullable text and createObligation does not require it. Only the Obligation modal, the Quickview form and the Pack and Policy authoring forms read or write completion criteria. No engine, Quality Gate, Policy or transition action reads it, so no check makes it measurable and no step tests it before Resolved. Pack definitions also carry classification, outputContract, assurance and externalEvidence (src/dblayer/seuTypes.ts:66-74 and 102). Only the authoring form reads them, and the Obligation row has no column for them.<br>Searched: completionCriteria and completion_criteria (src/**/*.ts and src/**/*.ejs); outputContract, machine-verifiable and externalEvidence (src/**/*.ts).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Obligation shall define Identifier, Title, Category, Description, Origin, Priority, Severity, Completion Criteria and Status.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/obligations_schema_recovery.sql:3-29<br>src/routes/seu/core/obligations.ts:60-62</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: all nine fields exist. Category, origin and priority are checked against Ontology categories.<br>Gap: of the nine fields only category, title, severity and status are NOT NULL. Origin, priority, description and completion criteria may be empty. createObligation and reviseObligation do not check severity against the category:obligation-severity Ontology set (src/routes/seu/core/obligations.ts:60-62, 296-297). Policy Definition authoring checks category, origin, priority and severity (src/routes/seu/core/policyDefinitions.ts:125-150). Pack authoring checks only origin (src/routes/seu/core/packs.ts:335-341), so a Pack definition's severity is never checked. The Quickview and demo raise forms pass no origin or priority (src/routes/seu/core/participantHome.ts:129-141), and the Quickview form offers severity from the Ontology (src/routes/web/public.ts:51).<br>Searched: obligation-severity (src/**/*.ts and *.ejs); assertCanonicalCategory in obligations.ts, packs.ts and policyDefinitions.ts.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Obligation shall define Related Risks, Related Policies and Related Authority Rules.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/obligations_schema_recovery.sql:3-29</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: the table has no column or link table for related Risks, Policies or Authority Rules. The only link to a Policy is the single originating_entity reference set when a Policy block raises the Obligation. Related Authority Rules are not stored.<br>Searched: relatedRisk, related_risk, relatedPolic, related_polic, relatedAuthorit and related_authorit (src/**/*.ts and src/**/*.sql): no hit. The originating entity is a Policy (obligations.ts:173-174) or a Pack (obligations.ts:247-248).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Obligation shall define Related Deliverables, Related Decisions, Related Evidence and Traceability References.<br>Ref: §8, OM-004</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:85-100<br>src/routes/seu/core/traceability.ts:165</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the Deliverable traceability view lists the Obligations related to a Deliverable.<br>Findings link to an Obligation through findings.obligation_id (src/dblayer/recovery/findings_schema_recovery.sql:13), and a governance evaluation outcome records the Obligations it consulted (src/dblayer/recovery/governance_evaluation_outcomes_schema_recovery.sql:17).<br>Gap: an Obligation carries one related object. It has no lists of related Deliverables, Decisions or Evidence, and no traceability reference field of its own.<br>Searched: obligation in src/dblayer/*.ts (decisionsDB and evidenceDB do not name it) and obligation_id in src/dblayer/recovery.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligation categories Engineering, Risk, Compliance, Audit, Security, Operational, Customer and Organisational Learning exist, and Packs may add categories.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/ontologyConcepts.json:92-137<br>src/dblayer/seed/data/ontologyConcepts.json:1955-1990<br>src/routes/seu/core/obligations.ts:60<br>src/routes/seu/core/obligations.ts:296</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the Ontology holds the eight named categories plus Review Finding. createObligation and reviseObligation accept only a category found in the category:obligation Ontology set, so new categories are an Ontology data change.<br>Gap: Pack contribution of categories is not a separate mechanism. A Pack's contribution keys (src/dblayer/seuTypes.ts:84-105) include no category list, and Pack authoring does not check an obligation definition's category (src/routes/seu/core/packs.ts:329-349). A category reaches an Obligation only as an Ontology concept, checked when createObligation runs.<br>Searched: PackContributions keys; assertCanonicalCategory in packs.ts.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Resolution of an Organisational Learning Obligation typically needs a revised Capability, Service or Policy Pack version composed by the Composition Engine into a new Engineering Behavior Model, and resolving it produces that revised version.<br>Ref: §7, §12, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/obligations.ts:333-360<br>src/dblayer/seed/data/transitionDefinitions.json:398-576</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: an Organisational Learning Obligation moves through the normal lifecycle to Verified and Closed.<br>Gap: no code links the Obligation to a revised Pack version or to a Composition Engine run. Resolving the Obligation requires no such version, and publishing a new Pack version does not resolve it.<br>Searched: Organisational Learning (src/**/*.ts: only knowledge.ts and telemetry.ts name it); Obligation in src/domain/engine (the only files naming it are the conflicts settle files, deliverableKickoff, dependencyDefinitionEngine, dispatchEngine, ebmSettled, entityAdapters, executionEngine, executionEngineKickoff, profileCompositionUnravel, qualityGateEngine, redispatch, transitionEngine and workItemGenerator, and none ties an Obligation to a Pack publish); PackPublished, resolvesObligation and obligationId in packs.ts and compositionCompleted.ts.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Obligation has an explicit lifecycle: Identified, Analysed, Assigned, In Progress, Resolved, Verified, Closed, Archived.<br>Ref: OM-006, §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:398-576</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Transition Definition rows exist for None to Identified, Identified to Analysed, Analysed to Assigned, Assigned to In Progress, In Progress to Resolved, Resolved to Verified, Verified to Closed and Closed to Archived. Each hop row has a verb, an event and a version event. The birth row has a verb, an event and the governed trigger, and no version event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Closure requires verification. Resolution alone does not close an Obligation.<br>Ref: §9, §12, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:398-576<br>src/domain/engine/entityTransition.ts:24-50<br>tests/obligation-event-lifecycle-table.test.ts:63-84<br>tests/obligation-event-lifecycle-table.test.ts:172</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No row leads from Resolved to Closed. Closed is reachable only from Verified. transitionEntity refuses a hop with no Transition Definition. The tests at lines 63-84 and 172 assert closure cannot skip verification.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Lifecycle transitions are deterministic and an Obligation holds only the stated lifecycle states.<br>Ref: §16, §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/entityTransition.ts:24-78<br>src/domain/engine/entityAdapters.ts:322-341<br>src/dblayer/seed/data/transitionDefinitions.json:398-576</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: each hop is a single Transition Definition row, applied in one transaction by the Transition Engine. The state write is done only by the Obligation adapter.<br>Gap: the table adds states Reopened and Escalated beyond the §9 list. The Escalated state has no outgoing row, so an escalated Obligation cannot continue its lifecycle.<br>Searched: fromState "Escalated" in src/dblayer/seed/data/transitionDefinitions.json (0 rows).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligation state transitions are fully traceable and Obligations preserve complete engineering history.<br>Ref: FR-23.5, FR-23.6, OM-004, §16, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/entityTransition.ts:64-95<br>src/domain/engine/entityAdapters.ts:322-341<br>src/dblayer/obligationsDB.ts:89-115<br>src/routes/seu/core/obligations.ts:333-360<br>tests/obligation-event-lifecycle-table.test.ts:179</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: every hop publishes its named event and ObligationTransitioned with actor, badge, from state and to state, and a version event. updateStatus increments version. Field revisions append to revision_history with actor and changed fields.<br>Gap: the revision history records the actor but no badge (src/routes/seu/core/obligations.ts:312). Status history lives in the event stream. It is readable on the Events page, filtered by SEU and entity type (src/routes/seu/core/events.ts:10-23, src/dblayer/eventsDB.ts:196-225), and on the Version Events page (src/routes/seu/web/versionEvents.ts:13). No read is keyed by one Obligation id, and none combines events with the revision history. No route or view reads revision_history. The revise route has no badge requirement (src/dblayer/seed/data/routeAuthority.json:1769-1775).<br>Searched: revision_history (src/**/*.ts and *.ejs); eventsDB.find* callers.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every transition runs with a real actor and the matching noun_verb authority badge.<br>Ref: §16, FR-23.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:90-100<br>src/domain/engine/badgeAuthorityEngine.ts:30-36<br>src/domain/engine/entityTransition.ts:24-53<br>src/dblayer/seed/data/routeAuthority.json:1776-1857</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">transitionEntity authorises the hop against obligation_<verb>. An actor without the badge makes resolveAuthorBadge throw, so the hop does not run. Each of the nine web transition routes has a route_authority row with its obligation_ badge. The tests at tests/obligation-event-lifecycle-table.test.ts:222 and 233 assert that a refused hop (no participant row in the SEU, no Transition Definition) writes nothing.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The origin of an Obligation remains permanently recorded.<br>Ref: §10, §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/obligations.ts:65-71<br>src/dblayer/obligationsDB.ts:102-115</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: originating_entity_type is always set. When the caller gives no originating entity it defaults to the SEU's active EBM, and the id is null when the SEU has no active EBM. The update function cannot change origin or originating entity.<br>Gap: the origin text is optional. The dispatch, redispatch, Capability-unavailable and Finding conversion paths pass no origin, so it is stored empty. Origin is protected only by omission from the update function; the schema has no trigger or constraint on it.<br>Searched: every createObligation caller in src/ for an origin argument.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligations may originate from the EBM, Policies, Authority evaluations, Reviews, Quality Gates, Compliance Packs, Organisation Packs, Customer requests, Participants, External systems and Telemetry.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/ontologyConcepts.json:1991-2089<br>src/routes/seu/core/obligations.ts:41-267<br>src/routes/seu/core/findings.ts:132-141<br>src/routes/seu/core/participantHome.ts:129-141<br>src/routes/seu/core/demoSimulator.ts:219-224</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: all eleven origin values exist as Ontology concepts. Policies, Pack definitions, Participants and telemetry have working raise paths that record the origin.<br>The origin of a Pack-raised Obligation is the value the definition declares. The seeded Pack obligation definitions declare Compliance Packs (7), Customer requests (2), EBM (7), External systems (11), Organisation Packs (1), Policies (10), Quality Gates (63), Reviews (12) and Telemetry and Knowledge Model (17). The seeded Policy related Obligations declare Policies (2) and Quality Gates (2). The demo simulator passes a step's payload origin through (src/routes/seu/core/demoSimulator.ts:219-224).<br>Gap: Finding conversion (the Reviews source) passes no origin or originating entity. No seeded definition and no code uses Authority evaluations, and no code raises an Obligation from an Authority evaluation. The Pack-declared origin is a label and is not derived from the event that raised the Obligation. The raise paths in code set only Policies, Participants, Quality Gates (the sustained-pattern detector) and Telemetry and Knowledge Model.<br>Searched: the origin literals (Authority evaluations, External systems, Customer requests, Compliance Packs, Organisation Packs) in src/**/*.ts (no hit); obligationDefinitions and relatedObligations origin in src/dblayer/seed/data/*.json; raiseAttentionItem in src/routes/seu/core/externalInteractions.ts (it raises an Attention Item, not an Obligation).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligations support composition from multiple Packs.<br>Ref: OM-005, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/conflicts/unravelObligationDefinitions.ts:19-32<br>src/domain/engine/conflicts/obligationDefinitions.ts:5-30<br>src/domain/engine/conflicts/settleObligationDefinitions.ts:22-54<br>src/routes/seu/core/obligations.ts:196-267</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The EBM settles the obligationDefinitions of every composed Pack per Deliverable, step and definition code. Definitions with the same fields, including the governing condition, merge into one definition that lists every Pack that gives it. Definitions with the same code and different fields are a recorded conflict, and the user picks which definitions the EBM takes. Definitions with different codes are different Obligations. The raise path reads the settled result, raises each definition with its first Pack as the originating entity, and skips a definition whose title already exists for the same hop. Pack and Policy definitions both feed Obligations.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligation owner is the SEU.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/obligations_schema_recovery.sql:5<br>src/routes/seu/core/obligations.ts:21-39</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">seu_id is a NOT NULL foreign key to seus. The SEU is resolved from the related object when the Obligation is created.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All Obligation data is tenant scoped through the owning SEU.<br>Ref: §13, platform rule</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/entityAdapters.ts:335-339<br>src/dblayer/recovery/obligations_schema_recovery.sql:5<br>src/dblayer/obligationsDB.ts:56-68<br>src/middleware/seuTenantScope.ts:11-13<br>src/routes/seu/web/seus.ts:5-6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the tenant of an Obligation is derived from its SEU for version events.<br>The obligations table has no tenant column. An Obligation takes its tenant from its owning SEU (seu_id is NOT NULL). The SEU web router guards the SEU named by :id with seuTenantScope and the Obligation named by :obligationId with obligationTenantScope, which reads the tenant through the Obligation's SEU. A viewer outside that tenant receives the same answer as for an Obligation that does not exist.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligations may define escalation rules based on severity, prolonged unresolved state, repeated verification failures, approaching milestones and dependency impact, and Packs govern the behaviour.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:511-576</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: Pack obligation definitions carry no escalation rule field (src/dblayer/seuTypes.ts:245-254). No code evaluates severity, age, failed verifications, milestones or dependency impact to escalate an Obligation. Escalation is only a manual verb hop. The code that raises Escalation Attention Items acts on work items, Capability retries, redispatch limits and sustained patterns (src/routes/seu/core/workItemHeartbeat.ts:15-60, capabilityRetrySweep.ts:44, src/domain/engine/redispatch.ts:95, telemetry.ts:166). A Pack's assurance field states that escalation is "declared only — not yet enforced" (src/domain/sdk/formGenerator.ts:459).<br>Searched: escalat (src/**/*.ts, case-insensitive).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The subsystem publishes ObligationCreated, ObligationAssigned, ObligationResolved, ObligationVerified, ObligationClosed, ObligationEscalated and ObligationReopened.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/obligations.ts:105-114<br>src/domain/engine/entityTransition.ts:84-95<br>src/dblayer/seed/data/transitionDefinitions.json:398-576</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">createObligation publishes the birth event named by the birth row (ObligationCreated). Each hop publishes the event named on its Transition Definition: ObligationAssigned, ObligationResolved, ObligationVerified, ObligationClosed, ObligationEscalated and ObligationReopened. The tests at tests/obligation-event-lifecycle-table.test.ts:119-170 assert each.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The subsystem publishes ObligationUpdated.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:412-421<br>src/routes/seu/core/obligations.ts:281-320</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: ObligationUpdated is the event of the Identified to Analysed hop.<br>Gap: a field revision through reviseObligation publishes no event. The test at tests/obligation-event-lifecycle-table.test.ts:179 asserts this. Editing an Obligation therefore raises no ObligationUpdated.<br>Searched: ObligationUpdated (src/**/*.ts): no hit; it appears only in the transition row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Escalation is delivered as an Obligation state and event so that dependent governance can react.<br>Ref: §14, §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:511-576<br>src/routes/seu/web/seus.ts:389-407</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a manual escalate verb moves an Obligation in Identified, Analysed, Assigned, In Progress, Resolved or Verified to Escalated and publishes ObligationEscalated. No row leads from Reopened to Escalated.<br>Gap: no subscriber reacts to the event and Escalated has no exit transition (see lifecycle row). The only Obligation subscriptions are ObligationTransitioned handlers (src/dblayer/seed/data/eventSubscriptions.json:53 and 64), and each returns unless the new state is Verified, Closed or Archived (executionEngineKickoff.ts:21, deliverableKickoff.ts:33).<br>Searched: ObligationEscalated (src/**/*.ts and eventSubscriptions.json); handlerName values in eventSubscriptions.json.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Obligation subsystem provides a domain model, registry, lifecycle service, verification service, escalation service, dependency integration interfaces, APIs and events.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/obligationsDB.ts:5-116<br>src/routes/seu/core/obligations.ts:322-360<br>src/routes/seu/api/obligations.ts:9-11<br>src/routes/seu/web/seus.ts:389-428</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: domain model (ObligationRow), registry (obligationsDB), lifecycle service (transitionObligation), dependency integration (qualityGateEngine and dependencyDefinitionEngine), web routes (transition and revise) and events.<br>Gap: verification is only the Resolved to Verified hop and has no separate service. No escalation service exists (searched verifyObligation, escalateObligation, obligationVerif and obligationEscal in src/**/*.ts: no hit). The three Obligation API routes (create, list, revise) answer notImplemented, and transitions and revisions run through the web routes.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants and operators can see and act on Obligations in the SEU view with only the actions their badges allow.<br>Ref: §9, §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/views/seu/seus/detail.ejs:258-319<br>src/routes/seu/web/seus.ts:389-407<br>src/domain/engine/entityTransition.ts:104-115</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SEU detail page lists Obligations with category, severity and state, and shows a button for each manual next transition whose badge the actor holds. The route re-checks the verb against nextActionsFor before transitioning.</td>
    </tr>
  </tbody>
</table>

## Summary

| Measure | Count |
|---|---|
| Total intents analysed | 32 |
| Fully met ✅ | 15 |
| Partially met ⚠️ | 15 |
| Not met ❌ | 2 |
| Not verifiable ❓ | 0 |

Major implementation gaps:

- Escalation rules (§14) have no definition field and no evaluator. Escalated is a dead-end state.
- Resolving an Organisational Learning Obligation is not tied to a revised Pack version (§12, §17).
- Telemetry detectors cover Quality Gate, Policy and Capability patterns only. Service Level and rework patterns have no detector.
- Related Risks, Policies and Authority Rules (§8) are not stored, and Decisions and Evidence are not linkable.
- ObligationUpdated is not published by a field revision.
- Completion criteria are optional free text and are not checked as measurable.
- Severity is not validated against its Ontology set.
