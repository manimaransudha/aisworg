# Implementation Traceability: Chapter 15 – Dependency Engine

**Date of report: 23-10-2026**

Specification: src/docs/SEU Studio Specifications/02_SEU Composition/15_Dependency Engine.md

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Execution within an SEU is organised around Deliverables and their dependencies, not schedules or tasks.<br>Ref: §1, §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:99-111<br>src/domain/engine/executionEngine.ts:55-70<br>src/domain/engine/deliverableKickoff.ts:101-129</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A Deliverable hop is refused until every dependency row governing it is satisfied (executionEngine.ts:55-70, dependencyDefinitionEngine.ts:99-111). The producing Command is created only after the Deliverable reaches In Progress (deliverableKickoff.ts:101-129). No schedule or task object takes part in the decision.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine continuously evaluates engineering readiness and determines which Deliverables can progress from the current engineering state.<br>Ref: §1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:84-111<br>src/domain/engine/deliverableKickoff.ts:18-49<br>src/domain/engine/deliverableKickoff.ts:35-35<br>src/dblayer/seed/data/eventSubscriptions.json:48-68</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Readiness is evaluated on demand from the Deliverable states and Capability status read at that moment (dependencyDefinitionEngine.ts:84-111). The kickoff handler re-scans every Deliverable of the SEU on each subscribed event and attempts each governed hop (deliverableKickoff.ts:18-49, eventSubscriptions.json:55-62,65-67).<br>Gap:<br>The scan runs only while the SEU is Operational (deliverableKickoff.ts:35). No periodic or standing evaluation exists, and the events that trigger it are a fixed list. Decision, Evidence and Knowledge changes are not on the list (see §13).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Execution is initiated only when dependency conditions have been satisfied.<br>Ref: §1, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:55-70<br>src/domain/engine/deliverableKickoff.ts:101-129<br>src/domain/engine/deliverableKickoff.ts:161-190<br>src/domain/engine/materialiseDependencyGraph.ts:25-48<br>src/routes/seu/core/templates.ts:305-320</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The hop to In Progress runs the dependency check first (executionEngine.ts:55). A produce Command is issued only for a Deliverable that is In Progress (deliverableKickoff.ts:112-128, deliverableKickoff.ts:167).<br>Gap:<br>Only Deliverable prerequisites become dependency rows (materialiseDependencyGraph.ts:28-46). Capability prerequisites that a Template declares and validates (templates.ts:313-316) are dropped when the graph is materialised (materialiseDependencyGraph.ts:45-48). Execution can therefore start while a declared Capability prerequisite is unmet.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine reads the state of Knowledge, Deliverables, Obligations, Decisions and Evidence to decide what may execute.<br>Ref: §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:55-82<br>src/domain/engine/executionEngine.ts:72-89<br>src/domain/engine/qualityGateEngine.ts:100-124<br>src/domain/engine/materialiseDependencyGraph.ts:25-48</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The evaluator has branches that read Obligations, Decisions, Evidence and Knowledge as unnamed source nodes (dependencyDefinitionEngine.ts:55-82). Obligations and Decisions related to a Deliverable block its hop through checks in the execution engine (executionEngine.ts:72-89). Evidence is read by the Quality Gate criteria (qualityGateEngine.ts:111-124).<br>Gap:<br>No dependency row of those source kinds is ever written, because materialisation creates Deliverable rows only (materialiseDependencyGraph.ts:25-48). The Obligation, Decision and Evidence checks run in the hop governance, not as graph edges, and the Knowledge branch is unreachable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Ready Deliverables flow to Capability Fulfilment and then to Execution.<br>Ref: §3, §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:136-146<br>src/domain/engine/capabilityOnReady.ts:14-48<br>src/routes/seu/core/capabilities.ts:99-118<br>src/routes/seu/core/capabilities.ts:123-183<br>src/domain/engine/deliverableKickoff.ts:74-84<br>src/domain/engine/commandGenerated.ts:7-22<br>src/domain/engine/workItemGenerated.ts:20-50</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>DeliverableReady is consumed by capabilityOnReady, which requests fulfilment of the producing Capability (capabilityOnReady.ts:14-48, capabilities.ts:99-118). The CapabilityRequested handler fulfils it from the eligible pool and publishes CapabilityFulfilled (capabilities.ts:123-183). Kickoff then moves the Deliverable and issues the produce Command (deliverableKickoff.ts:74-84, deliverableKickoff.ts:161-190). CommandGenerated leads to a Work Item and WorkItemGenerated leads to dispatch (commandGenerated.ts:7-22, workItemGenerated.ts:20-50).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Dependency Engine determines what may execute and never performs execution itself.<br>Ref: §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:99-148<br>src/domain/engine/deliverableKickoff.ts:112-128</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>dependencyDefinitionEngine reads state and publishes DeliverableReady. It creates no Command, Work Item or assignment (dependencyDefinitionEngine.ts:99-148). The produce Command is created by the kickoff handler through the execution engine (deliverableKickoff.ts:112-128).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine maintains the Deliverable Dependency Graph.<br>Ref: §4, FR-15.1, §7, §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/materialiseDependencyGraph.ts:17-46<br>src/dblayer/recovery/dependency_definitions_schema_recovery.sql:3-26<br>src/dblayer/dependencyDefinitionsDB.ts:11-15<br>src/dblayer/dependencyDefinitionsDB.ts:59-67<br>src/routes/seu/core/templates.ts:593-609<br>src/domain/engine/seuCompositionScope.ts:4-8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The graph is the set of dependency_definitions rows owned by a Template (dependency_definitions_schema_recovery.sql:3-26). Template materialisation deletes the owner's rows and re-creates them from the Template (materialiseDependencyGraph.ts:21-22, templates.ts:593-609). Each SEU reads the rows of its Template, Profile and composed Packs (dependencyDefinitionsDB.ts:11-15, seuCompositionScope.ts:4-8).<br>Gap:<br>There is no graph instance per SEU. Nodes are matched by Deliverable name at evaluation time. Only Template owners ever write rows although the table admits Pack and Profile (dependency_definitions_schema_recovery.sql:15-17). Maintenance is a delete and full re-insert without a transaction, so a failure between them leaves the Template with no graph.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine determines engineering readiness.<br>Ref: §4, §10, FR-15.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:99-111<br>src/domain/engine/dependencyDefinitionEngine.ts:84-94<br>src/domain/engine/dependencyDefinitionEngine.ts:23-35</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>isTargetReady loads the rows that govern a Deliverable and a state, evaluates each, and answers ready only when all are satisfied (dependencyDefinitionEngine.ts:99-111). A row is satisfied when the source Deliverable has reached or passed the required state, tested by walking the Transition Definitions (dependencyDefinitionEngine.ts:23-35, dependencyDefinitionEngine.ts:84-94). A Deliverable with no rows is ready (dependencyDefinitionEngine.ts:108).<br>Gap:<br>Readiness covers Deliverable rows only. Evidence, Decisions, Obligations and Capabilities are not part of this answer (see §10).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine identifies blocked Deliverables.<br>Ref: §4, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:55-70<br>src/routes/seu/core/seus.ts:328-346<br>src/views/seu/seus/detail.ejs:93-108</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A refused hop publishes DeliverableBlocked for the Deliverable (executionEngine.ts:55-70). The SEU page lists each dependency edge of each Deliverable with a Satisfied or Pending badge (seus.ts:328-346, detail.ejs:93-108).<br>Gap:<br>Blocked is an event emitted when a hop is attempted. No stored or queryable set of blocked Deliverables exists, and the event repeats on every attempt without a check for an earlier one.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine identifies the dependency constraints that block a Deliverable.<br>Ref: §4, §11, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:55-70<br>src/routes/seu/core/traceability.ts:134-147<br>src/domain/engine/dependencyDefinitionEngine.ts:84-94</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The block reason names the governing rows as source type, name and required state (executionEngine.ts:57). explainDeliverable returns each dependency with a Satisfied or Pending state (traceability.ts:134-147).<br>Gap:<br>The reason lists every governing row, satisfied or not, because isTargetReady returns all rows (dependencyDefinitionEngine.ts:110). The event carries text only, with no row ids.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine detects circular dependencies.<br>Ref: §4, FR-15.5, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:236-274<br>src/routes/seu/core/templates.ts:322-322<br>src/routes/seu/core/templates.ts:338-341</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>findDeliverableDependencyCycle runs a depth-first search over the Deliverable edges of a Template and reports the cycle path (templates.ts:236-274). It is part of Template validation on save (templates.ts:322, templates.ts:338-341).<br>Gap:<br>The check runs when a Template is authored. It ignores Capability edges, does not cover Pack or Profile contributed rows, and nothing re-checks the graph an SEU actually evaluates. No CircularDependencyDetected event is published.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine publishes dependency state.<br>Ref: §4, FR-15.6, §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:115-148<br>src/domain/engine/executionEngine.ts:59-68<br>src/domain/engine/executionEngine.ts:282-288<br>src/dblayer/seed/data/eventSubscriptions.json:23-23</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>DeliverableReady is published when a source transition completes the last unsatisfied row of a target (dependencyDefinitionEngine.ts:136-146). DeliverableBlocked is published when a hop is refused (executionEngine.ts:59-68).<br>Gap:<br>Two readiness events exist. The state of an individual dependency is not published, and DeliverableBlocked is not listed in the event catalogue (eventSubscriptions.json:3-45).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine triggers execution readiness events.<br>Ref: §4, §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:115-148<br>src/domain/engine/executionEngine.ts:278-288<br>src/routes/seu/core/capabilities.ts:84-94</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>After a Deliverable hop is applied, evaluateAndPublishFromTransition finds the rows whose source is that Deliverable and state, tests each target, and publishes DeliverableReady for every target that is ready (executionEngine.ts:282-288, dependencyDefinitionEngine.ts:124-147). The same call runs after a Capability is fulfilled (capabilities.ts:86-94).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine does not schedule Participants, execute work, generate engineering behaviour or preserve knowledge.<br>Ref: §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:1-14<br>src/domain/engine/dependencyDefinitionEngine.ts:99-148</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>dependencyDefinitionEngine imports no Participant, dispatch, Work Item or Knowledge module for writing and performs only reads and event publication (dependencyDefinitionEngine.ts:1-14, dependencyDefinitionEngine.ts:99-148). Participant selection sits in the dispatch engine (dispatchEngine.ts:105-144).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The unit of execution is the Deliverable. Work Items exist to create, modify or validate Deliverables.<br>Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/deliverableKickoff.ts:112-128<br>src/domain/engine/workItemGenerator.ts:158-164<br>src/adapters/assignmentDelivery.ts:63-69</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The produce Command and its Work Item are issued for a Deliverable (deliverableKickoff.ts:112-128). The Work Item context is built only for a Deliverable Command (workItemGenerator.ts:160), and assignment delivery returns for any other entity type (assignmentDelivery.ts:67).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Dependencies are relationships between Deliverables and other engineering artefacts, and the engine operates exclusively on those relationships.<br>Ref: §5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/dependency_definitions_schema_recovery.sql:3-14<br>src/dblayer/seuTypes.ts:470-489<br>src/domain/engine/materialiseDependencyGraph.ts:25-48<br>src/domain/engine/executionEngine.ts:72-89</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Rows relate a source entity type, name and state to a target (dependency_definitions_schema_recovery.sql:3-14, seuTypes.ts:473-489). The execution engine also applies Obligation and Decision checks that are not dependency rows (executionEngine.ts:72-89).<br>Gap:<br>Every stored row relates a Deliverable to a Deliverable (materialiseDependencyGraph.ts:28-46). Relationships to other artefacts are enforced outside the engine's graph.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Deliverable exists within the Deliverable Dependency Graph.<br>Ref: FR-15.1, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:272-285<br>src/domain/engine/dependencyDefinitionEngine.ts:37-42<br>src/domain/engine/dependencyDefinitionEngine.ts:105-108<br>src/dblayer/deliverablesDB.ts:41-43</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Commissioning creates a Deliverable for each catalogue entry (commissioning.ts:272-285). A Deliverable is matched to the graph by its name, and one that has no row is evaluated as ready (dependencyDefinitionEngine.ts:37-42, dependencyDefinitionEngine.ts:105-108).<br>Gap:<br>There is no node for a Deliverable in the graph. A Deliverable absent from every edge, or whose name matches another Deliverable of the SEU, is silently isolated or resolved to the first created (deliverablesDB.ts:43).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every dependency possesses an explicit type.<br>Ref: FR-15.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/dependency_definitions_schema_recovery.sql:7-9<br>src/dblayer/recovery/dependency_definitions_schema_recovery.sql:18-23<br>src/routes/seu/core/templates.ts:313-319</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>from_entity_type is NOT NULL and relationship_kind is NOT NULL with a CHECK on four values (dependency_definitions_schema_recovery.sql:7-9, dependency_definitions_schema_recovery.sql:18-23). Template validation rejects an unrecognised from type (templates.ts:317-319).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Dependency evaluation occurs continuously throughout SEU execution.<br>Ref: FR-15.3, §14, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/eventSubscriptions.json:48-68<br>src/domain/engine/deliverableKickoff.ts:18-49<br>src/domain/engine/deliverableKickoff.ts:21-28<br>src/domain/engine/executionEngine.ts:282-288</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Evaluation runs on each completed Deliverable hop, on SEUOperational, on a resolved Obligation or Attention Item, on CapabilityFulfilled, CapabilityUnavailable and DispatchRejected (eventSubscriptions.json:55-62, eventSubscriptions.json:65-67, deliverableKickoff.ts:21-28).<br>Gap:<br>Evaluation is event-driven with a fixed trigger list. Changes in Decisions, Evidence and Knowledge do not trigger it, and nothing runs while the SEU is not Operational (deliverableKickoff.ts:35).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Execution readiness is determined solely from dependency satisfaction.<br>Ref: FR-15.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:99-111<br>src/domain/engine/dependencyDefinitionEngine.ts:115-148</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The readiness answer and the DeliverableReady event depend only on the rows and the states of their source nodes (dependencyDefinitionEngine.ts:99-111, dependencyDefinitionEngine.ts:124-147). No time, schedule or Participant input is read.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">External dependencies are represented explicitly.<br>Ref: FR-15.8, §7, §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/dependency_definitions_schema_recovery.sql:3-14<br>src/dblayer/seuTypes.ts:470-471<br>src/dblayer/seuTypes.ts:131-131</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>The dependency row types are the transition entity types plus Capability (seuTypes.ts:470-471, dependency_definitions_schema_recovery.sql:7-10). A search of src for an external dependency type, table or column returns nothing. An external organisation, system or Participant cannot be recorded as a node, so it cannot block a Deliverable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Dependencies are fully traceable.<br>Ref: FR-15.7, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:134-147<br>src/routes/seu/core/traceability.ts:175-206<br>src/routes/seu/api/deliverables.ts:47-59<br>src/dblayer/seed/data/routeAuthority.json:60-65<br>src/dblayer/recovery/dependency_definitions_schema_recovery.sql:24-29</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>explainDeliverable lists what a Deliverable depends on with required state and Satisfied or Pending (traceability.ts:134-147). impactOfDeliverable walks downstream edges breadth-first and returns each affected Deliverable with its edge id (traceability.ts:184-206). Both are served by GET /deliverables/:id/traceability (deliverables.ts:47-59, routeAuthority.json:60-65). Each row records its author and badge (dependency_definitions_schema_recovery.sql:27-29).<br>Gap:<br>Traceability is a view of the present. No history of when a dependency became satisfied is recorded. Only Deliverable and Capability edges can appear (traceability.ts:138-146).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The graph is a directed graph in which nodes are Deliverables and edges are dependency relationships.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/dependency_definitions_schema_recovery.sql:3-14<br>src/domain/engine/materialiseDependencyGraph.ts:28-46<br>src/dblayer/dependencyDefinitionsDB.ts:69-98</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Each row is a directed edge from a source node to a target node (dependency_definitions_schema_recovery.sql:8-12). Rows are queried by target and by source (dependencyDefinitionsDB.ts:69-98), which supports upstream and downstream traversal.<br>Gap:<br>Edges are keyed by Deliverable name and a fixed target state. The target state is always In Progress (materialiseDependencyGraph.ts:5, materialiseDependencyGraph.ts:38). A dependency cannot gate the Approved or Baselined hops.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Decisions, Knowledge, Evidence and Obligations are graph nodes.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:55-82<br>src/domain/engine/materialiseDependencyGraph.ts:25-48</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The evaluator can read a Decision, Evidence, Knowledge or Obligation source (dependencyDefinitionEngine.ts:55-82).<br>Gap:<br>No authoring or materialisation path produces a row with such a source (materialiseDependencyGraph.ts:25-48), so these node kinds are not present in any graph.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">External Dependencies are graph nodes.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/dependency_definitions_schema_recovery.sql:3-14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No external node kind exists in the dependency_definitions table or in the evaluator (see FR-15.8).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The graph is the authoritative execution model of the SEU.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:55-89<br>src/domain/engine/deliverableKickoff.ts:18-49<br>src/domain/engine/materialiseDependencyGraph.ts:25-48</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The dependency check is the first governance step on every Deliverable hop (executionEngine.ts:55).<br>Gap:<br>Obligations, Decisions, Quality Gates, Policies and submission are applied beside the graph (executionEngine.ts:72-167). Capability prerequisites of the Template are absent from the graph (materialiseDependencyGraph.ts:45-48), so the graph does not describe the whole execution model.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Deliverable Dependency means one Deliverable depends upon another.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:403-415<br>src/domain/engine/materialiseDependencyGraph.ts:28-46<br>src/domain/engine/dependencyDefinitionEngine.ts:84-94</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A Template graph entry of type Deliverable becomes a row from the prerequisite Deliverable and required state to the gated Deliverable (materialiseDependencyGraph.ts:28-46). The required state defaults to Approved (materialiseDependencyGraph.ts:6) and is satisfied when the prerequisite has reached or passed it (dependencyDefinitionEngine.ts:84-94, dependencyDefinitionEngine.ts:23-35).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Decision Dependency means execution requires an approved decision.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:84-89<br>src/domain/engine/dependencyDefinitionEngine.ts:62-67</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A Decision related to a Deliverable blocks every governed hop of it until the Decision has reached Approved (executionEngine.ts:84-89).<br>Gap:<br>The rule is not declared as a dependency. It applies to any related Decision and not to a named required Decision. The Decision branch of the graph evaluator (dependencyDefinitionEngine.ts:62-67) has no rows.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Knowledge Dependency means execution requires sufficient engineering knowledge.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:74-80<br>src/domain/engine/materialiseDependencyGraph.ts:25-48</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>The evaluator has a Knowledge branch that accepts any one Knowledge Item of the Deliverable in the required state (dependencyDefinitionEngine.ts:74-80). No row of that kind can be authored or materialised (materialiseDependencyGraph.ts:25-48), and the branch has no notion of sufficiency. Knowledge never blocks a hop.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An Evidence Dependency means execution requires evidence.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:16-21<br>src/domain/engine/qualityGateEngine.ts:111-124<br>src/domain/engine/dependencyDefinitionEngine.ts:68-73</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A Quality Gate with the criteria type requires_accepted_evidence_or_approved_decision blocks a hop unless Accepted or Referenced Evidence of the gate category exists (qualityGateEngine.ts:111-124).<br>Gap:<br>The check lives in a Quality Gate and is satisfied by an approved Decision as well. The Evidence branch of the graph evaluator (dependencyDefinitionEngine.ts:68-73) has no rows.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An Obligation Dependency means execution is blocked by an unresolved obligation.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:72-82<br>src/domain/engine/deliverableKickoff.ts:21-24<br>src/domain/engine/qualityGateEngine.ts:100-109</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>An open Obligation of the SEU or the Deliverable that names a blocked from-state and to-state refuses the hop (executionEngine.ts:72-82). Resolving an Obligation re-runs the kickoff (deliverableKickoff.ts:21-24).<br>Gap:<br>Only Obligations that declare a blocked hop gate the engine. The generic unresolved-Obligation test belongs to the Quality Gate criteria (qualityGateEngine.ts:100-109). The Obligation branch of the graph evaluator (dependencyDefinitionEngine.ts:56-61) has no rows.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An External Dependency means execution depends on an external organisation, system or Participant.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/dependency_definitions_schema_recovery.sql:3-14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No external dependency kind exists (see FR-15.8).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Capability Dependency means execution requires one or more Capabilities to become available.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:305-320<br>src/dblayer/seed/data/web-application.template.json:27-31<br>src/domain/engine/materialiseDependencyGraph.ts:25-48<br>src/domain/engine/dependencyDefinitionEngine.ts:43-51<br>src/routes/seu/core/capabilities.ts:84-94</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A Template can declare a Capability prerequisite and validation checks that the Capability is contributed by the selected Packs (templates.ts:313-316, web-application.template.json:27-31). The evaluator and the fulfilment hook have a Capability branch (dependencyDefinitionEngine.ts:43-51, capabilities.ts:84-94).<br>Gap:<br>materialiseDependencyGraph writes rows for Deliverable prerequisites only, so each declared Capability edge is discarded (materialiseDependencyGraph.ts:25-48). No Capability row exists, nothing waits for a Capability, and capabilities.ts:88 evaluates sources that have no rows. The SDK list view preserves these edges on save as if they were materialised rows (_referentialListGroup.ejs:681-690).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Capability Dependency that concerns a contracted output references the specific Service the Capability exposes.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/schemaDefinitions.json:2145-2200<br>src/domain/engine/dependencyDefinitionEngine.ts:43-51<br>src/routes/seu/core/templates.ts:313-316</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The evaluator resolves a Capability node by Service code and compares the SEU Capability status (dependencyDefinitionEngine.ts:43-51).<br>Gap:<br>A Template names a Capability by its Capability code, not a Service (schemaDefinitions.json:2182-2186, templates.ts:313-316), and no row is written (materialiseDependencyGraph.ts:25-48). A Service-level dependency cannot be authored.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Additional dependency types can be introduced through Packs.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:84-105<br>src/dblayer/recovery/dependency_definitions_schema_recovery.sql:15-23<br>src/dblayer/dependencyDefinitionsDB.ts:11-15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>PackContributions has no dependency member (seuTypes.ts:84-105). The table admits a Pack owner and the lookup reads Pack-owned rows (dependency_definitions_schema_recovery.sql:15-17, dependencyDefinitionsDB.ts:11-15), but no code writes one. The relationship kinds are a closed CHECK list of four values (dependency_definitions_schema_recovery.sql:18-23).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each dependency exists in one of Unknown, Pending, Satisfied, Blocked, Invalid or Waived.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:137-137<br>src/routes/seu/core/seus.ts:336-342<br>src/dblayer/seuTypes.ts:471-471<br>src/dblayer/recovery/dependency_definitions_schema_recovery.sql:3-14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A dependency is shown as Satisfied or Pending, computed from isRowSatisfied each time it is displayed (traceability.ts:137, seus.ts:336-342). ReadinessState is an unconstrained string (seuTypes.ts:471).<br>Gap:<br>The state is not stored. Only two of the six values are produced.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A dependency is Blocked, Unknown or Invalid when its condition so requires.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:84-94<br>src/domain/engine/dependencyDefinitionEngine.ts:37-53</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>A source that cannot be found returns false and shows as Pending (dependencyDefinitionEngine.ts:86-91). No code distinguishes an unresolvable reference (Unknown), a dependency that can no longer be satisfied (Invalid) or an actively blocked one (Blocked).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A dependency can be Waived.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:164-167<br>src/dblayer/recovery/dependency_definitions_schema_recovery.sql:3-14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>Waivers exist for Quality Gates (qualityGateEngine.ts:164-167) and no waiver mechanism, column or state exists for a dependency row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Dependency state transitions remain fully traceable.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/dependency_definitions_schema_recovery.sql:3-14<br>src/domain/engine/executionEngine.ts:59-68<br>src/domain/engine/dependencyDefinitionEngine.ts:136-146</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>Dependency state is derived on read and is not stored, so no transition of it is recorded. The only records of the dependency evaluation are the DeliverableReady and DeliverableBlocked events (dependencyDefinitionEngine.ts:136-146, executionEngine.ts:59-68).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Deliverable is Ready when all mandatory dependencies are satisfied.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:99-111<br>src/dblayer/recovery/dependency_definitions_schema_recovery.sql:3-14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Ready means every governing row is satisfied (dependencyDefinitionEngine.ts:109-110).<br>Gap:<br>The table has no mandatory or optional marker, so every row is mandatory. Rows of every relationship kind gate equally, since the lookup does not filter on kind (dependencyDefinitionsDB.ts:69-82).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Deliverable is Ready when required evidence exists.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/qualityGateEngine.ts:111-124<br>src/domain/engine/executionEngine.ts:109-130</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Required Evidence is tested by a Quality Gate when the hop to In Progress is requested (qualityGateEngine.ts:111-124, executionEngine.ts:109-130).<br>Gap:<br>It is not part of the Ready determination. DeliverableReady is published without regard to Evidence.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Deliverable is Ready when required decisions are approved.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:84-89</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>An unapproved related Decision refuses the hop (executionEngine.ts:84-89).<br>Gap:<br>It is not part of the Ready determination, and DeliverableReady is published regardless.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Deliverable is Ready when blocking obligations have been resolved.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:72-82<br>src/domain/engine/deliverableKickoff.ts:21-24<br>src/domain/engine/deliverableKickoff.ts:193-196</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Blocking Obligations refuse the hop (executionEngine.ts:72-82), and resolution re-triggers the scan (deliverableKickoff.ts:21-24).<br>Gap:<br>It is not part of the Ready determination, and DeliverableReady is published regardless.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Deliverable is Ready when required capabilities are available.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/capabilityOnReady.ts:32-48<br>src/domain/engine/deliverableKickoff.ts:58-72</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>Availability of the producing Capability is not a precondition of Ready or of the hop to In Progress. capabilityOnReady requests fulfilment after Ready (capabilityOnReady.ts:32-48). When no Participant is eligible the Deliverable is blocked after it has become In Progress, by an Obligation raised from CapabilityUnavailable (deliverableKickoff.ts:58-72).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine publishes a DeliverableReady event when a Deliverable is Ready.<br>Ref: §10, §15, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:124-147<br>src/domain/engine/executionEngine.ts:282-327<br>src/domain/engine/capabilityOnReady.ts:18-30<br>src/dblayer/seed/data/eventSubscriptions.json:23-23<br>src/dblayer/seed/data/eventSubscriptions.json:58-59</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>DeliverableReady is published for each target whose rows are all satisfied after a source transition, with the target name and state in the payload (dependencyDefinitionEngine.ts:124-147). A Deliverable with no rows never receives the event, and capabilityOnReady covers it by scanning on SEUCommissioned (capabilityOnReady.ts:23-30, eventSubscriptions.json:58-59).<br>Gap:<br>The event follows a source transition only. It is published again for each later source transition while the target is still ready. executionEngine.ts:282 publishes it before the attestation and the hop events of the same transition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine continuously identifies constraints that prevent engineering flow.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:55-70<br>src/domain/engine/executionEngine.ts:118-130<br>src/domain/engine/executionEngine.ts:147-152<br>src/domain/engine/deliverableKickoff.ts:198-231</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A refused hop yields a reason code. A Quality Gate block raises an Attention Item (executionEngine.ts:118-130), a Policy block raises an Obligation (executionEngine.ts:147-152), and an unavailable Capability raises an Obligation and an Attention Item (deliverableKickoff.ts:198-231).<br>Gap:<br>There is no constraint record or ConstraintDetected event, and no constraint detection service. Constraints are raised only when a hop is attempted.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Unresolved decisions, missing evidence and unresolved obligations are identified as constraints.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:72-89<br>src/domain/engine/executionEngine.ts:118-130</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>An open Obligation and an unapproved Decision refuse the hop with a reason (executionEngine.ts:72-89). Missing Evidence blocks through a Quality Gate and raises an Attention Item (executionEngine.ts:118-130).<br>Gap:<br>The Obligation and Decision refusals raise no Attention Item or event, so the constraint is visible only in the response of the request.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Incomplete knowledge is identified as a constraint.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:74-80</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No code reads the sufficiency or completeness of Knowledge to raise a constraint. The only Knowledge branch (dependencyDefinitionEngine.ts:74-80) is unreachable (see §8).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Unavailable capabilities are identified as constraints.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/deliverableKickoff.ts:58-72<br>src/domain/engine/deliverableKickoff.ts:198-231<br>src/routes/seu/core/capabilities.ts:134-147</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>An empty eligible pool publishes CapabilityUnavailable (capabilities.ts:134-147). For each In Progress Deliverable produced by that Capability the handler raises a blocking Obligation and an Action Required Attention Item (deliverableKickoff.ts:58-72, deliverableKickoff.ts:198-231).<br>Gap:<br>The constraint is detected after the Deliverable is already In Progress and only through the fulfilment path. No standing capability dependency exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">External approvals are identified as constraints.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/dependency_definitions_schema_recovery.sql:3-14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No external approval can be recorded or detected (see FR-15.8).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Constraint detection remains independent of elapsed time.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:99-148<br>src/domain/engine/deliverableKickoff.ts:18-49<br>src/routes/seu/core/telemetry.ts:176-200</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Evaluation and kickoff use state only and contain no timer or clock reads (dependencyDefinitionEngine.ts:99-148, deliverableKickoff.ts:18-49). The sustained-block pattern counts Blocked evaluations, not time (telemetry.ts:182-183).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">When a Deliverable becomes Ready the engine identifies the capabilities required to progress it.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/capabilityOnReady.ts:32-33<br>src/dblayer/deliverablesDB.ts:41-43<br>src/routes/seu/core/commissioning.ts:253-262</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>capabilityOnReady takes the producing Capability of the Deliverable (capabilityOnReady.ts:32). The producing Capability is derived at commissioning from the Service Definition outputs (commissioning.ts:253-262).<br>Gap:<br>A Deliverable has one producing Capability. Several required Capabilities cannot be expressed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability Fulfilment determines the eligible Participants for those capabilities.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:123-153<br>src/domain/engine/capabilityOnReady.ts:35-48<br>src/domain/engine/executionEngine.ts:359-378</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>capabilityOnReady requests fulfilment unless the Capability is already Fulfilled or a request is open (capabilityOnReady.ts:35-48). The handler loads the eligible pool or the named Participants and fulfils the Capability (capabilities.ts:123-153). The pool is stored with the Command (executionEngine.ts:359-378).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Work Items are generated as required.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:395-410<br>src/domain/engine/commandGenerated.ts:7-22<br>src/domain/engine/workItemGenerator.ts:158-175</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The execute call stores a Command and publishes CommandGenerated (executionEngine.ts:395-410). The handler generates the Work Item with its execution context (commandGenerated.ts:7-22, workItemGenerator.ts:158-175).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Dispatch Engine selects and assigns the executing Participant from the eligible pool.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/workItemGenerated.ts:20-50<br>src/domain/engine/dispatchEngine.ts:80-113</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>WorkItemGenerated leads to dispatch, which reads the stored pool, filters the available candidates, selects one by the Dispatch Strategy and assigns the Work Item (workItemGenerated.ts:42-50, dispatchEngine.ts:80-113).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Execution may commence once the Participant is assigned, with the upstream Deliverables as inputs.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dispatchEngine.ts:112-144<br>src/adapters/assignmentDelivery.ts:22-41<br>src/adapters/assignmentDelivery.ts:63-92</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The assignment is delivered to the Participant through the adapter and carries the references of the upstream Deliverables named by the dependency rows (assignmentDelivery.ts:22-41, assignmentDelivery.ts:63-92).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine does not assign Participants or generate engineering behaviour.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:99-148</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The engine has no assignment or Command code (dependencyDefinitionEngine.ts:99-148). Assignment sits in the dispatch engine (dispatchEngine.ts:105-113).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Readiness is re-evaluated when Deliverables change.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:282-288<br>src/dblayer/seed/data/eventSubscriptions.json:55-56<br>src/domain/engine/deliverableKickoff.ts:101-129</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A completed Deliverable hop publishes DeliverableReady for ready targets (executionEngine.ts:282-288) and DeliverableTransitioned, which re-runs the kickoff scan of all Deliverables (eventSubscriptions.json:56, deliverableKickoff.ts:18-49).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Readiness is re-evaluated when Decisions change state.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/eventSubscriptions.json:29-29<br>src/dblayer/seed/data/eventSubscriptions.json:48-68<br>src/domain/engine/executionEngine.ts:84-89</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>DecisionTransitioned is published and has no subscriber (eventSubscriptions.json:29, eventSubscriptions.json:47-68). A Deliverable refused with decision_blocked (executionEngine.ts:84-89) is retried only when an unrelated subscribed event occurs.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Readiness is re-evaluated when Knowledge is accepted.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/eventSubscriptions.json:31-31<br>src/dblayer/seed/data/eventSubscriptions.json:48-68</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>KnowledgeTransitioned is published and has no subscriber (eventSubscriptions.json:31, eventSubscriptions.json:47-68). Knowledge does not gate any hop in any case.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Readiness is re-evaluated when Evidence is added.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/eventSubscriptions.json:28-28<br>src/dblayer/seed/data/eventSubscriptions.json:48-68<br>src/domain/engine/qualityGateEngine.ts:111-124</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>EvidenceTransitioned is published and has no subscriber (eventSubscriptions.json:28, eventSubscriptions.json:47-68). A Deliverable held by a Quality Gate that requires Evidence (qualityGateEngine.ts:111-124) is retried only on an unrelated subscribed event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Readiness is re-evaluated when Obligations are resolved.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/eventSubscriptions.json:65-65<br>src/domain/engine/deliverableKickoff.ts:21-28<br>src/domain/engine/deliverableKickoff.ts:51-56</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>ObligationTransitioned reaches deliverableKickoff, which proceeds only for a resolved state, re-attempts the governed hops and re-issues a held produce Command (deliverableKickoff.ts:21-28, deliverableKickoff.ts:51-56, eventSubscriptions.json:65).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Readiness is re-evaluated when external dependencies change.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/dependency_definitions_schema_recovery.sql:3-14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No external dependency exists, so no change of one can occur or be consumed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Readiness is re-evaluated when the Engineering Behavior Model changes through authorised recomposition.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:16-21<br>src/domain/engine/seuCompositionScope.ts:4-8<br>src/dblayer/seed/data/eventSubscriptions.json:11-12<br>src/domain/engine/ebmActivated.ts:15-40</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The owning scope, including the composed Packs, is resolved from the active EBM on each evaluation (dependencyDefinitionEngine.ts:16-21, seuCompositionScope.ts:4-8), so a new active EBM governs the next evaluation.<br>Gap:<br>No event of an EBM change triggers a re-evaluation. EBMVersioned is not published, and EBMActivated runs commissioning finalisation only (eventSubscriptions.json:12, eventSubscriptions.json:50, ebmActivated.ts:36-40).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine identifies unnecessary blocking dependencies.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/dependencyDefinitionsDB.ts:69-98</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No code analyses the graph for dependencies that do not constrain flow. The lookups return rows for evaluation only (dependencyDefinitionsDB.ts:69-98).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine exposes opportunities for parallel execution.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/deliverableKickoff.ts:38-49</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>The kickoff scan attempts the hop of each Deliverable in turn, so independent Deliverables progress together (deliverableKickoff.ts:38-49). The platform does not report which Deliverables could run in parallel.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine detects bottlenecks.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:32-37<br>src/routes/seu/core/telemetry.ts:176-200</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Flow metrics report Deliverable cycle time (metricRegistryEngine.ts:32-37). A Quality Gate that blocks repeatedly in an SEU raises a learning Obligation (telemetry.ts:176-200).<br>Gap:<br>No analysis of the dependency graph identifies a Deliverable that holds up others.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine recommends decomposition of large Deliverables.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:358-382</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>The decomposition relationship kind exists only as an authored, inheritance-locked edge (templates.ts:358-382). No code recommends decomposition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine does not optimise for elapsed time.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:99-148</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>No evaluation reads a duration or deadline (dependencyDefinitionEngine.ts:99-148).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">DependencyCreated is published.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/materialiseDependencyGraph.ts:28-46<br>src/dblayer/seed/data/eventSubscriptions.json:3-45</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>Rows are created in Template materialisation without an event (materialiseDependencyGraph.ts:30-43). The event is absent from the event catalogue (eventSubscriptions.json:3-45).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">DependencySatisfied is published.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:115-148<br>src/dblayer/seed/data/eventSubscriptions.json:3-45</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>A row becoming satisfied publishes nothing. Only DeliverableReady is published when all rows of a target are satisfied (dependencyDefinitionEngine.ts:136-146).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">DependencyBlocked is published.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:55-70<br>src/dblayer/seed/data/eventSubscriptions.json:3-45</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>A refused hop publishes DeliverableBlocked for the Deliverable (executionEngine.ts:60). No event is published for a dependency.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">DependencyWaived is published.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/eventSubscriptions.json:3-45</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>Dependencies cannot be waived, and the event is absent from the catalogue (eventSubscriptions.json:3-45).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">DeliverableBlocked is published.<br>Ref: §15, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:55-70<br>src/dblayer/seed/data/eventSubscriptions.json:3-45<br>src/domain/engine/eventBus.ts:67-74<br>src/dblayer/recovery/events_schema_recovery.sql:3-13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The event is published with the Deliverable as originating object and a reason (executionEngine.ts:59-68). Publication does not validate the type against the catalogue (eventBus.ts:67-74, events_schema_recovery.sql:5).<br>Gap:<br>The type is missing from the catalogue (eventSubscriptions.json:3-45), so it has no description. It has no subscriber. It is published on every refused attempt, and the kickoff scan makes an attempt on each trigger event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ConstraintDetected is published.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/eventSubscriptions.json:3-45</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No such event type exists. A search of src returns no match.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ConstraintResolved is published.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/eventSubscriptions.json:3-45</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No such event type exists. A resolved Obligation publishes ObligationTransitioned only (eventSubscriptions.json:27).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CircularDependencyDetected is published.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:338-341<br>src/dblayer/seed/data/eventSubscriptions.json:3-45</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>A cycle yields a validation error message on save (templates.ts:338-341). No event is published and the type is absent from the catalogue.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine supports incremental graph updates.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/materialiseDependencyGraph.ts:21-22<br>src/dblayer/dependencyDefinitionsDB.ts:59-67<br>src/domain/engine/dependencyDefinitionEngine.ts:124-147</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Propagation after a transition is incremental: only the rows whose source matches the changed Deliverable and state are examined (dependencyDefinitionEngine.ts:124-147).<br>Gap:<br>Updating the graph itself deletes all rows of the owner and re-creates them (materialiseDependencyGraph.ts:21-22, dependencyDefinitionsDB.ts:59-67). A single edge cannot be added or removed alone.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine evaluates readiness deterministically.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:23-35<br>src/domain/engine/dependencyDefinitionEngine.ts:37-42<br>src/dblayer/deliverablesDB.ts:43-43</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The result is a function of the rows and current states, and the state walk over Transition Definitions is breadth-first with a visited set (dependencyDefinitionEngine.ts:23-35).<br>Gap:<br>Nodes are matched by name. When two Deliverables of an SEU share a name, the first by creation time is used (dependencyDefinitionEngine.ts:40, deliverablesDB.ts:43), and no uniqueness is enforced on the name.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine supports concurrent execution.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:38-49<br>src/domain/engine/deliverableKickoff.ts:143-154<br>src/domain/engine/capabilityOnReady.ts:35-48</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Hops and produce Command issue for one Deliverable are serialised in per-Deliverable promise queues (executionEngine.ts:38-49, deliverableKickoff.ts:143-154). capabilityOnReady skips a Capability with a request already open (capabilityOnReady.ts:35-42).<br>Gap:<br>The queues are held in process memory and do not span processes. The readiness evaluation and the publication of DeliverableReady are not serialised, so two sources completing together can each publish it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine scales to large dependency graphs.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:37-53<br>src/domain/engine/dependencyDefinitionEngine.ts:23-35<br>src/domain/engine/deliverableKickoff.ts:38-49<br>src/dblayer/dependencyDefinitionsDB.ts:69-82</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Lookups by target and by source are single queries on the owner scope (dependencyDefinitionsDB.ts:69-98).<br>Gap:<br>Evaluation of one row loads all Deliverables of the SEU (dependencyDefinitionEngine.ts:39) and walks Transition Definitions with a query per frontier (dependencyDefinitionEngine.ts:28). The kickoff scan repeats this for every Deliverable on every trigger event (deliverableKickoff.ts:38-49). The graph is never cached and no scaling evidence exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The engine remains independent of participant implementation.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:1-14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The engine's imports contain no Participant adapter or Participant module (dependencyDefinitionEngine.ts:1-14).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Deliverable participates in the dependency graph.<br>Ref: §17, FR-15.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:37-42<br>src/domain/engine/dependencyDefinitionEngine.ts:105-108</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Deliverables are matched to rows by name (dependencyDefinitionEngine.ts:37-42).<br>Gap:<br>Participation is implicit through the name match. See FR-15.1.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Circular dependencies are detected.<br>Ref: §17, FR-15.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:236-274<br>src/routes/seu/core/templates.ts:338-341</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Cycles in the Template Deliverable edges are rejected on save (templates.ts:236-274, templates.ts:338-341).<br>Gap:<br>See §4. Detection is at authoring time only and raises no event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Ready Deliverables are identified correctly.<br>Ref: §17, §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:99-111<br>src/domain/engine/dependencyDefinitionEngine.ts:124-147</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A Deliverable is identified Ready when all its Deliverable rows are satisfied (dependencyDefinitionEngine.ts:109-110).<br>Gap:<br>Capability prerequisites are not rows (materialiseDependencyGraph.ts:45-48), and Evidence, Decisions and Obligations are outside the answer. A Deliverable that cannot start for those reasons is still announced Ready.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Blocked Deliverables identify their blocking dependencies.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:55-70<br>src/routes/seu/core/traceability.ts:134-147<br>src/views/seu/seus/detail.ejs:93-108</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The SEU page and explainDeliverable show each dependency with Satisfied or Pending (traceability.ts:134-147, detail.ejs:93-108).<br>Gap:<br>The DeliverableBlocked reason lists all governing rows, not the unsatisfied ones (executionEngine.ts:57, dependencyDefinitionEngine.ts:110).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Dependency state changes generate events.<br>Ref: §17, FR-15.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:136-146<br>src/domain/engine/executionEngine.ts:59-68</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>DeliverableReady and DeliverableBlocked are published.<br>Gap:<br>Changes of a single dependency generate no event (see §15).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Execution is initiated only after dependency satisfaction.<br>Ref: §17, §1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:55-70<br>src/domain/engine/deliverableKickoff.ts:112-128<br>src/domain/engine/materialiseDependencyGraph.ts:25-48</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The dependency check precedes every governed Deliverable hop, and the produce Command follows the hop to In Progress (executionEngine.ts:55, deliverableKickoff.ts:112-128).<br>Gap:<br>Declared Capability prerequisites are dropped (materialiseDependencyGraph.ts:45-48), so they cannot delay execution.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The implementation produces a Deliverable Dependency Graph.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/dependency_definitions_schema_recovery.sql:3-26<br>src/domain/engine/materialiseDependencyGraph.ts:8-50<br>src/routes/seu/core/traceability.ts:175-206</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The dependency_definitions table, the materialiser and the impact traversal exist (dependency_definitions_schema_recovery.sql:3-26, materialiseDependencyGraph.ts:8-50, traceability.ts:175-206).<br>Gap:<br>The graph covers Deliverable-to-Deliverable edges authored in a Template. See §4 and §7.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The implementation produces a Dependency Engine.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:96-149</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>dependencyDefinitionEngine provides isTargetReady, isRowSatisfied, isReachedOrPassed and evaluateAndPublishFromTransition (dependencyDefinitionEngine.ts:96-148).<br>Gap:<br>It does not detect cycles, track dependency state or publish the other events of §15.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The implementation produces a Dependency Evaluation Service.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:84-111<br>src/routes/seu/core/traceability.ts:134-147</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Evaluation of a row and of a target is used by the execution engine, the SEU page, the traceability view and capabilityOnReady (dependencyDefinitionEngine.ts:84-111, executionEngine.ts:55, traceability.ts:136, capabilityOnReady.ts:27).<br>Gap:<br>The Obligation, Decision, Evidence and Knowledge branches are reachable by no stored row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The implementation produces a Constraint Detection Service.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:55-153<br>src/domain/engine/deliverableKickoff.ts:198-231</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>Constraints are handled where a hop is refused (executionEngine.ts:55-153, deliverableKickoff.ts:198-231). No service identifies, records or resolves constraints independently.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The implementation produces a Flow Analysis Service.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/metricRegistryEngine.ts:32-37</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>Cycle time is reported by the metric registry (metricRegistryEngine.ts:32-37). No service analyses blocking, parallelism, bottlenecks or decomposition (see §14).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The implementation produces a Readiness Evaluation API.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/deliverables.ts:47-59<br>src/dblayer/seed/data/routeAuthority.json:60-65<br>src/routes/seu/core/traceability.ts:82-173</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>GET /deliverables/:id/traceability returns a Deliverable's dependencies with their Satisfied or Pending state and its downstream impact (deliverables.ts:47-59, routeAuthority.json:60-65).<br>Gap:<br>No API answers whether a Deliverable is Ready or lists the Ready and Blocked Deliverables of an SEU.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The implementation produces Dependency Events.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/eventSubscriptions.json:3-45<br>src/domain/engine/dependencyDefinitionEngine.ts:136-146<br>src/domain/engine/executionEngine.ts:59-68</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>DeliverableReady is catalogued and published, and DeliverableBlocked is published (eventSubscriptions.json:23, dependencyDefinitionEngine.ts:136-146, executionEngine.ts:59-68).<br>Gap:<br>Two of the nine events exist and one of those is not catalogued.</td>
    </tr>
  </tbody>
</table>

## Summary

- Total intents analysed: 95
- Fully met ✅: 19
- Partially met ⚠️: 47
- Not met ❌: 29
- Not verifiable ❓: 0

### Major implementation gaps

- Only Deliverable-to-Deliverable edges exist. Capability prerequisites that a Template declares and validates are dropped by materialiseDependencyGraph, and no Decision, Knowledge, Evidence, Obligation or external source can be authored as a row.
- Dependency state is not stored. Only Satisfied and Pending are computed on read. Unknown, Blocked, Invalid and Waived do not exist, and state transitions leave no record.
- External dependencies, external approvals and Pack-contributed dependency types are not represented.
- Seven of the nine events do not exist. DependencyCreated, DependencySatisfied, DependencyBlocked, DependencyWaived, ConstraintDetected, ConstraintResolved and CircularDependencyDetected are never published. DeliverableBlocked is published but absent from the event catalogue and repeats on every refused attempt.
- Ready covers dependency rows only. Evidence, Decisions, Obligations and Capability availability are tested later in hop governance, so a Deliverable is announced Ready while still blocked by them.
- Re-evaluation is not triggered by Decision, Evidence or Knowledge changes or by an EBM change. A Deliverable refused for those reasons waits for an unrelated subscribed event.
- Circular dependencies are detected only when a Template is saved, for Deliverable edges. No runtime check and no event exist.
- Dependencies are keyed by Deliverable name and gate only the In Progress hop. All relationship kinds gate equally, and there is no mandatory or optional marker.
- No Constraint Detection Service and no Flow Analysis Service exist. Unnecessary dependencies, parallel opportunities, bottlenecks and decomposition are not analysed.
- Graph maintenance deletes and re-inserts all rows of a Template without a transaction, the concurrency queues are in process memory, and evaluation loads all Deliverables per row with no caching.
