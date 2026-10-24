# Implementation Traceability: Chapter 23 – Obligation Model

**Date of report: 23-10-2026**

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/obligations.ts:123-185<br>src/routes/seu/core/obligations.ts:187-260<br>src/domain/engine/dispatchEngine.ts:29<br>src/routes/seu/core/participantHome.ts:128<br>src/routes/seu/api/obligations.ts:12-25</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: Obligations are raised from blocking Policies, Pack obligation definitions, dispatch failures, Participant requests, Finding conversion, telemetry patterns, Knowledge promotion and the Obligation API.<br>Gap: no rule makes every significant commitment an Obligation. Authority denials and Quality Gate blocks create Attention Items or errors, not Obligations. Each source is a separate coded path.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform raises an Organisational Learning Obligation when Engineering Telemetry detects a sustained pattern that a Capability, Service or Policy should be improved.<br>Ref: §4, FR-23.8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/telemetry.ts:116-174<br>src/routes/seu/core/telemetry.ts:176-200<br>src/routes/seu/core/telemetry.ts:202-225<br>src/routes/seu/core/telemetry.ts:227-262</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: three detectors raise an Organisational Learning Obligation, for a repeatedly blocking Quality Gate, a repeatedly waived Standard Policy and a Capability unfulfilled across at least 3 SEUs. The raise is de-duplicated by a marker in the description and publishes SustainedPatternDetected.<br>Gap: no detector exists for a Service missing its declared Service Level or for a rework pattern that points at a Capability Pack. The Quality Gate detector targets a Quality Gate, which is not one of Capability, Service or Policy. The threshold 3 and the category text are literals in telemetry.ts.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Knowledge promoted to Capability, Enterprise or Platform Acquisition Scope raises an Organisational Learning Obligation to codify it.<br>Ref: §4, §7 Organisational Learning</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/knowledge.ts:128<br>src/routes/seu/core/knowledge.ts:180-194</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">After a successful scope promotion, createObligation is called with category Organisational Learning, origin Telemetry and Knowledge Model, the Knowledge Item as originating entity and a severity chosen by scope. The test tests/engineering-capital.test.ts:55 asserts the Obligation is visible.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligations are independent of Participants. Participants are assigned responsibility but do not own the Obligation, and reassignment does not change its identity or lifecycle.<br>Ref: OM-002, FR-23.7, §13, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/obligations_schema_recovery.sql:5-29<br>src/routes/seu/core/obligations.ts:262-313<br>src/dblayer/obligationsDB.ts:102-115</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Obligation row is keyed to seu_id. The assignee is held in separate assigned_entity_type and assigned_entity_id columns. reviseObligation changes the assignee without touching id, status or version, and records the change in revision_history. author_id and author_badge record the creator only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligations participate in dependency evaluation and are described in the Dependency Graph.<br>Ref: OM-003, §11, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:55-61<br>src/domain/engine/executionEngine.ts:55-69</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a Dependency Definition row whose from-entity is Obligation is satisfied only when every Obligation on the gated Deliverable has reached the named state. Deliverable readiness calls this check.<br>Gap: Obligations are matched by a single related-object link and a state test. Obligations are not nodes with their own edges in a stored graph.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligations support dependencies upon Deliverables, Decisions, Evidence and other Obligations.<br>Ref: FR-23.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/obligations_schema_recovery.sql:6-7<br>src/routes/seu/core/obligations.ts:19-37</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: an Obligation links to one related object of type SEU, Deliverable, Obligation or Attention Item.<br>Gap: no link from an Obligation to a Decision or Evidence exists. Only one related object is allowed. Other types are refused with an error.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligations may block Deliverable state transitions, and unresolved Obligations block transitions.<br>Ref: FR-23.3, §3, §11, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:16<br>src/domain/engine/qualityGateEngine.ts:100-109<br>src/domain/engine/executionEngine.ts:72-82<br>src/domain/engine/executionEngine.ts:146-153</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The no_unresolved_obligations Quality Gate criterion blocks a transition while any Obligation on the entity is not Verified, Closed or Archived. The Execution Engine also refuses to start a Deliverable while the SEU or the Deliverable has an open blocking Obligation. A Policy block raises the blocking Obligation with the blocked from and to states.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A deployment Deliverable becomes ready automatically once its blocking Obligations are resolved. The Dependency Engine evaluates continuously.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/eventSubscriptions.json:27<br>src/dblayer/seed/data/eventSubscriptions.json:52<br>src/dblayer/seed/data/eventSubscriptions.json:65<br>src/domain/engine/deliverableKickoff.ts:21-24<br>src/domain/engine/executionEngineKickoff.ts:18-33</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">transitionObligation publishes ObligationTransitioned after every hop. Two registered handlers re-attempt the blocked work when the new state is Verified, Closed or Archived. executionEngineKickoff re-attempts SEU commence-work for a blocking SEU Obligation. deliverableKickoff rescans the SEU Deliverables. The test tests/cr108-obligation-model-seu-execution.test.ts:148 asserts unblocking.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Obligation has measurable completion criteria.<br>Ref: FR-23.4, §8, §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/obligations_schema_recovery.sql:18<br>src/routes/seu/core/obligations.ts:39-57</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a completion_criteria text column exists and is set from Pack and Policy definitions.<br>Gap: the column is nullable text and createObligation does not require it. No structure or check makes the criteria measurable, and no step tests the criteria before Resolved.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Obligation shall define Identifier, Title, Category, Description, Origin, Priority, Severity, Completion Criteria and Status.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/obligations_schema_recovery.sql:3-29<br>src/routes/seu/core/obligations.ts:58-60</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: all nine fields exist. Category, origin and priority are checked against Ontology categories.<br>Gap: only category, title, severity and status are NOT NULL. Origin, priority, description and completion criteria may be empty. The API create route does not accept origin, priority or completion criteria (src/routes/seu/api/obligations.ts:14).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Obligation shall define Related Risks, Related Policies and Related Authority Rules.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/obligations_schema_recovery.sql:3-29</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: the table has no column or link table for related Risks, Policies or Authority Rules. The only link to a Policy is the single originating_entity reference set when a Policy block raises the Obligation. Related Authority Rules are not stored.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Obligation shall define Related Deliverables, Related Decisions, Related Evidence and Traceability References.<br>Ref: §8, OM-004</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:90-100<br>src/routes/seu/core/traceability.ts:169</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the Deliverable traceability view lists the Obligations related to a Deliverable.<br>Gap: an Obligation carries one related object. It has no lists of related Deliverables, Decisions or Evidence, and no traceability reference field of its own.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligation categories Engineering, Risk, Compliance, Audit, Security, Operational, Customer and Organisational Learning exist, and Packs may add categories.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/ontologyConcepts.json:93<br>src/routes/seu/core/obligations.ts:58-60</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the Ontology holds the eight named categories plus Review Finding. createObligation accepts only a category found in the category:obligation Ontology set, so new categories are an Ontology data change.<br>Gap: Pack contribution of categories is not a separate mechanism. Categories are added only through Ontology concepts.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Resolution of an Organisational Learning Obligation typically needs a revised Capability, Service or Policy Pack version composed by the Composition Engine into a new Engineering Behavior Model, and resolving it produces that revised version.<br>Ref: §7, §12, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/obligations.ts:326-343<br>src/dblayer/seed/data/transitionDefinitions.json:398-574</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: an Organisational Learning Obligation moves through the normal lifecycle to Verified and Closed.<br>Gap: no code links the Obligation to a revised Pack version or to a Composition Engine run. Resolving the Obligation requires no such version, and publishing a new Pack version does not resolve it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Obligation has an explicit lifecycle: Identified, Analysed, Assigned, In Progress, Resolved, Verified, Closed, Archived.<br>Ref: OM-006, §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:398-574</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Transition Definition rows exist for None to Identified, Identified to Analysed, Analysed to Assigned, Assigned to In Progress, In Progress to Resolved, Resolved to Verified, Verified to Closed and Closed to Archived. Each row has a verb, an event and a version event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Closure requires verification. Resolution alone does not close an Obligation.<br>Ref: §9, §12, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:398-574<br>src/domain/engine/entityTransition.ts:24-50<br>tests/obligation-event-lifecycle-table.test.ts:171</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No row leads from Resolved to Closed. Closed is reachable only from Verified. transitionEntity refuses a hop with no Transition Definition. The test at line 171 asserts closure cannot skip verification.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Lifecycle transitions are deterministic and an Obligation holds only the stated lifecycle states.<br>Ref: §16, §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/entityTransition.ts:24-78<br>src/domain/engine/entityAdapters.ts:322-341<br>src/dblayer/seed/data/transitionDefinitions.json:398-574</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: each hop is a single Transition Definition row, applied in one transaction by the Transition Engine. The state write is done only by the Obligation adapter.<br>Gap: the table adds states Reopened and Escalated beyond the §9 list. The Escalated state has no outgoing row, so an escalated Obligation cannot continue its lifecycle.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligation state transitions are fully traceable and Obligations preserve complete engineering history.<br>Ref: FR-23.5, FR-23.6, OM-004, §16, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/entityTransition.ts:64-93<br>src/domain/engine/entityAdapters.ts:322-341<br>src/dblayer/obligationsDB.ts:89-115<br>tests/obligation-event-lifecycle-table.test.ts:178</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: every hop publishes its named event and ObligationTransitioned with actor, badge, from state and to state, and a version event. updateStatus increments version. Field revisions append to revision_history with actor and changed fields.<br>Gap: the revision history records the actor but no badge. Status history lives only in the event stream. No Obligation read returns a combined history.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every transition runs with a real actor and the matching noun_verb authority badge.<br>Ref: §16, FR-23.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:89-99<br>src/domain/engine/entityTransition.ts:24-53<br>src/dblayer/seed/data/routeAuthority.json:2118-2203</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">transitionEntity authorises the hop against obligation_<verb>. A hop without the badge is refused. Each web transition route has a route_authority row with its obligation_ badge. The test at tests/obligation-event-lifecycle-table.test.ts:221 asserts a refused hop writes nothing.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The origin of an Obligation remains permanently recorded.<br>Ref: §10, §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/obligations.ts:61-69<br>src/dblayer/obligationsDB.ts:102-115</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: originating_entity_type and originating_entity_id are always set, defaulting to the active EBM. The update function cannot change origin or originating entity.<br>Gap: the origin text is optional. The API create route and the dispatch, redispatch and kickoff paths pass no origin, so it is stored empty. Origin is protected only by omission from the update function.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligations may originate from the EBM, Policies, Authority evaluations, Reviews, Quality Gates, Compliance Packs, Organisation Packs, Customer requests, Participants, External systems and Telemetry.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/ontologyConcepts.json:93<br>src/routes/seu/core/obligations.ts:123-260<br>src/routes/seu/core/findings.ts:132-141<br>src/routes/seu/core/participantHome.ts:128-141</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: all eleven origin values exist as Ontology concepts. Policies, Pack definitions, Participants and telemetry have working raise paths that record the origin.<br>Gap: Finding conversion (the Reviews source) passes no origin or originating entity. No raise path exists for Authority evaluations or External systems. Quality Gate origin is used only by the sustained-pattern detector. A Customer request depends on a user entering it through the API.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligations support composition from multiple Packs.<br>Ref: OM-005, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/obligations.ts:187-260<br>src/domain/engine/entityAdapters.ts:119</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: obligationDefinition entries from every composing Pack enter the EBM pool and each is raised separately with the source Pack as the originating entity. Pack and Policy definitions both feed Obligations.<br>Gap: no merge rule applies when two Packs declare equivalent Obligations. De-duplication is by title only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligation owner is the SEU.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/obligations_schema_recovery.sql:5<br>src/routes/seu/core/obligations.ts:19-37</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">seu_id is a NOT NULL foreign key to seus. The SEU is resolved from the related object when the Obligation is created.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All Obligation data is tenant scoped through the owning SEU.<br>Ref: §13, platform rule</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/entityAdapters.ts:335-339<br>src/routes/seu/api/obligations.ts:27-36</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: the tenant of an Obligation is derived from its SEU for version events.<br>Gap: the obligations table has no tenant column. The API list route returns the Obligations of any seuId passed in the query, with no tenant scope call in the route.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligations may define escalation rules based on severity, prolonged unresolved state, repeated verification failures, approaching milestones and dependency impact, and Packs govern the behaviour.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:509-574</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap: Pack obligation definitions carry no escalation rule field (src/dblayer/seuTypes.ts:242-251). No code evaluates severity, age, failed verifications, milestones or dependency impact to escalate an Obligation. Escalation is only a manual verb hop. The work item heartbeat escalates overdue work items, not Obligations (src/routes/seu/core/workItemHeartbeat.ts:19-58).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The subsystem publishes ObligationCreated, ObligationAssigned, ObligationResolved, ObligationVerified, ObligationClosed, ObligationEscalated and ObligationReopened.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/obligations.ts:103-112<br>src/domain/engine/entityTransition.ts:83-93<br>src/dblayer/seed/data/transitionDefinitions.json:398-574</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">createObligation publishes the birth event named by the birth row (ObligationCreated). Each hop publishes the event named on its Transition Definition: ObligationAssigned, ObligationResolved, ObligationVerified, ObligationClosed, ObligationEscalated and ObligationReopened. The tests at tests/obligation-event-lifecycle-table.test.ts:119-170 assert each.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The subsystem publishes ObligationUpdated.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:410-420<br>src/routes/seu/core/obligations.ts:274-313</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: ObligationUpdated is the event of the Identified to Analysed hop.<br>Gap: a field revision through reviseObligation publishes no event. The test at tests/obligation-event-lifecycle-table.test.ts:178 asserts this. Editing an Obligation therefore raises no ObligationUpdated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Escalation is delivered as an Obligation state and event so that dependent governance can react.<br>Ref: §14, §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:509-574<br>src/routes/seu/web/seus.ts:335-352</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: a manual escalate verb moves any pre-Closed Obligation to Escalated and publishes ObligationEscalated.<br>Gap: no subscriber reacts to the event and Escalated has no exit transition (see lifecycle row).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Obligation subsystem provides a domain model, registry, lifecycle service, verification service, escalation service, dependency integration interfaces, APIs and events.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/obligationsDB.ts:5-116<br>src/routes/seu/core/obligations.ts:315-343<br>src/routes/seu/api/obligations.ts:12-68<br>src/routes/seu/web/seus.ts:335-372</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented: domain model (ObligationRow), registry (obligationsDB), lifecycle service (transitionObligation), dependency integration (qualityGateEngine and dependencyDefinitionEngine), APIs (create, list, revise) and events.<br>Gap: verification is only the Resolved to Verified hop and has no separate service. No escalation service exists. The API transition route is commented out (src/routes/seu/api/obligations.ts:38-55) and transitions run through the web route.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants and operators can see and act on Obligations in the SEU view with only the actions their badges allow.<br>Ref: §9, §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/views/seu/seus/detail.ejs:249-305<br>src/routes/seu/web/seus.ts:335-352<br>src/domain/engine/entityTransition.ts:103-114</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SEU detail page lists Obligations with category, severity and state, and shows a button for each manual next transition whose badge the actor holds. The route re-checks the verb against nextActionsFor before transitioning.</td>
    </tr>
  </tbody>
</table>

## Summary

| Measure | Count |
|---|---|
| Total intents analysed | 32 |
| Fully met ✅ | 12 |
| Partially met ⚠️ | 18 |
| Not met ❌ | 2 |
| Not verifiable ❓ | 0 |

Major implementation gaps:

- Escalation rules (§14) have no definition field and no evaluator. Escalated is a dead-end state.
- Resolving an Organisational Learning Obligation is not tied to a revised Pack version (§12, §17).
- Telemetry detectors cover Quality Gate, Policy and Capability patterns only. Service Level and rework patterns have no detector.
- Related Risks, Policies and Authority Rules (§8) are not stored, and Decisions and Evidence are not linkable.
- ObligationUpdated is not published by a field revision.
- Completion criteria are optional free text and are not checked as measurable.
- The obligations table has no tenant column and the list API takes any seuId.
