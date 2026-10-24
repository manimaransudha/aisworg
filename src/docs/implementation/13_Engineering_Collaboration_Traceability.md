# Implementation Traceability: Chapter 13 – Engineering Collaboration

**Date of report: 23-10-2026**

Specification: src/docs/SEU Studio Specifications/02_SEU Composition/13_Engineering Collaboration.md

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants collaborate by creating, consuming and evolving engineering artefacts through the Runtime Kernel.<br>Ref: §1, §4, FR-13.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/knowledge.ts:20-81<br>src/routes/seu/core/decisions.ts:11-83<br>src/routes/seu/core/evidence.ts:31-99<br>src/domain/engine/entityTransition.ts:24-78<br>src/domain/engine/workItemGenerator.ts:96-100</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>createKnowledgeItem, createDecision and createEvidence resolve the actor to a participants row of the SEU, persist the artefact and publish its birth event. transitionEntity evolves each artefact through governed hops. The Work Item context lists the Decisions, Evidence, Knowledge and Obligations of the Deliverable being worked.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Human-style conversation is not the execution mechanism of the SEU.<br>Ref: §1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/adapters/assignmentDelivery.ts:43-61<br>src/domain/engine/eventBus.ts:67-104<br>src/views/seu/attention/index.ejs:31-31</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Execution is driven by events and state rows. The assignment carries the Deliverable, the transition and upstream references. A search of src for chat, direct message, participant_message, sendMessage and inbox found no Participant messaging store. The only inbox is the Attention Item list.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants collaborate through shared engineering state and not through direct interaction.<br>Ref: §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/adapters/assignmentDelivery.ts:63-92<br>src/routes/seu/api/workItems.ts:14-47<br>src/routes/seu/core/workItems.ts:82-118<br>src/domain/engine/deliverableKickoff.ts:101-130</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The platform delivers an assignment to the adapter. The Participant reports through POST /work-items/:id/result, which records a deliverable_references row and idles the Participant. The next Command is issued from state by deliverableKickoff. The cited path contains no call from one Participant to another.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Engineering Artefacts feed the Knowledge Repository, which feeds the Dependency Engine, which informs Participants.<br>Ref: §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:55-82<br>src/domain/engine/executionEngine.ts:282-288<br>src/dblayer/seed/data/eventSubscriptions.json:28-29<br>src/dblayer/seed/data/eventSubscriptions.json:31-31</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The Dependency Engine reads Knowledge, Decision, Evidence and Obligation state when it evaluates a dependency row.<br>Gap:<br>A search of src finds two callers of evaluateAndPublishFromTransition, the Deliverable hop in executionEngine and the Capability fulfilment. A Knowledge, Evidence or Decision hop starts none. KnowledgeTransitioned, EvidenceTransitioned and DecisionTransitioned have no subscriber.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The collaboration artefacts are Deliverables, Knowledge, Evidence, Decisions, Obligations and Events.<br>Ref: §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:278-288<br>src/domain/engine/executionEngine.ts:305-317<br>src/routes/seu/core/knowledge.ts:51-78<br>src/routes/seu/core/evidence.ts:58-83<br>src/routes/seu/core/decisions.ts:53-80<br>src/routes/seu/core/obligations.ts:95-114<br>src/dblayer/recovery/events_schema_recovery.sql:3-19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Each kind has a table and a creation or transition path that publishes an event. Events are rows in the events table.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The artefacts constitute the shared engineering memory of the SEU.<br>Ref: §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/knowledge_items_schema_recovery.sql:3-8<br>src/dblayer/recovery/decisions_schema_recovery.sql:3-6<br>src/dblayer/recovery/obligations_schema_recovery.sql:3-6<br>src/dblayer/evidenceDB.ts:29-33<br>src/dblayer/evidenceDB.ts:107-109<br>src/dblayer/recovery/events_schema_recovery.sql:3-19<br>src/routes/seu/core/seus.ts:419-423<br>src/routes/seu/core/seus.ts:468-472</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Knowledge, Decisions and Obligations carry the SEU id and Events carry an optional SEU id. Evidence is tied to the SEU by an evidence_relationships row of type SEU, and findBySeuId reads that link. All are listed per SEU in the SEU detail view.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Engineering artefacts are the primary collaboration mechanism.<br>Ref: ECM-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:72-89<br>src/domain/engine/workItemGenerator.ts:96-100<br>src/domain/engine/workItemGenerator.ts:134-139</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Starting a Deliverable hop is gated by open blocking Obligations and by Decisions that are not Approved. The Work Item context carries Decisions, Evidence, Knowledge and Obligations.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants remain loosely coupled.<br>Ref: ECM-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:48-61<br>src/domain/engine/eventBus.ts:67-76<br>src/domain/engine/eventHandlerRegistry.ts:15-28<br>src/dblayer/seed/data/eventSubscriptions.json:48-68</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A publisher names an event type and a payload only. The subscribers are rows in event_subscriptions that map an event type to a handler in the registry.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Collaboration remains fully traceable.<br>Ref: ECM-003</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/events_schema_recovery.sql:3-19<br>src/dblayer/knowledgeItemsDB.ts:71-85<br>src/dblayer/decisionsDB.ts:98-113<br>src/routes/seu/core/knowledge.ts:202-221<br>src/routes/seu/core/evidence.ts:165-184<br>src/dblayer/recovery/knowledge_items_schema_recovery.sql:27-28<br>src/dblayer/recovery/decisions_schema_recovery.sql:27-28<br>src/dblayer/recovery/evidence_schema_recovery.sql:37-38<br>src/dblayer/recovery/obligations_schema_recovery.sql:28-29</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Every event row stores actor_id, authority_badge, correlation_id and causation_id. Knowledge, Decision, Evidence and Obligation rows store an author and a badge.<br>Gap:<br>Knowledge and Decision updates overwrite the author and badge on every hop, so the row shows the last actor only. addKnowledgeValidationNote, recordValidationAssessment and updateKnowledgeReferences change artefacts and publish no event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Knowledge is shared through the Knowledge Repository.<br>Ref: ECM-004</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/knowledge_items_schema_recovery.sql:3-28<br>src/routes/seu/core/knowledge.ts:83-86<br>src/dblayer/knowledgeItemsDB.ts:143-163<br>src/routes/seu/core/knowledge.ts:137-195</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>knowledge_items is the single store. Items are listed per SEU, and Items promoted beyond SEU scope are read across SEUs as Engineering Capital.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Runtime events communicate engineering state changes.<br>Ref: ECM-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/entityTransition.ts:83-93<br>src/routes/seu/core/knowledge.ts:109-126<br>src/routes/seu/core/decisions.ts:96-113<br>src/routes/seu/core/evidence.ts:192-209<br>src/routes/seu/core/obligations.ts:326-343<br>src/dblayer/seed/data/eventSubscriptions.json:28-31<br>src/dblayer/seed/data/eventSubscriptions.json:48-68</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Every governed hop of Knowledge, Decision, Evidence and Obligation publishes its hop event and a Transitioned event.<br>Gap:<br>Of the Transitioned events only ObligationTransitioned, AttentionItemTransitioned and DeliverableTransitioned have a subscriber. The Knowledge, Evidence and Decision events are recorded and consumed by nothing. A hop whose Transition Definition names no event publishes the undefined-event pair.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Direct Participant communication is not required for normal execution.<br>Ref: ECM-006</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/adapters/assignmentDelivery.ts:63-92<br>src/domain/engine/deliverableKickoff.ts:18-130</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Assignment, result, dispatch and succession are carried out by platform handlers on events and by the result route. No step in the cited code waits for a Participant to contact another.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants collaborate through shared engineering artefacts.<br>Ref: FR-13.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/knowledge.ts:12-38<br>src/routes/seu/api/evidence.ts:12-29<br>src/routes/seu/api/decisions.ts:11-37<br>src/routes/seu/api/obligations.ts:12-26<br>src/routes/seu/api/knowledge.ts:78-87<br>src/routes/seu/api/decisions.ts:39-48</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The API exposes create routes for Knowledge, Evidence, Decisions and Obligations, and list routes for Knowledge and Decisions by SEU. Every artefact is stored per SEU.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants publish engineering state changes.<br>Ref: FR-13.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/workItems.ts:14-47<br>src/routes/seu/core/knowledge.ts:69-78<br>src/routes/seu/api/decisions.ts:50-67<br>src/routes/seu/api/knowledge.ts:118-135<br>src/routes/seu/api/evidence.ts:12-96<br>src/routes/seu/api/obligations.ts:12-70<br>src/routes/seu/web/seus.ts:337-337<br>src/routes/seu/web/seus.ts:469-469<br>src/routes/seu/web/seus.ts:541-541<br>src/routes/seu/web/seus.ts:619-619</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Creating an artefact and reporting a Work Item result publish events. The platform publishes on behalf of the actor.<br>Gap:<br>The API routes that moved a Decision or a Knowledge Item through its lifecycle are commented out, and Evidence and Obligations have none. The hops of all four artefacts have web routes that need a web session. A Participant that is not a web session user cannot publish a hop of these artefacts.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants consume published engineering state.<br>Ref: FR-13.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/seus.ts:46-54<br>src/routes/seu/api/knowledge.ts:78-87<br>src/routes/seu/api/decisions.ts:39-48<br>src/adapters/assignmentDelivery.ts:43-61<br>src/adapters/participantAdapter.ts:3-12<br>src/dblayer/seed/data/eventSubscriptions.json:48-68</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A Participant can read the SEU event list and the artefact lists through the API. Platform handlers consume the Obligation, Attention Item, Deliverable, Capability and Dispatch events.<br>Gap:<br>No artefact event is pushed to a Participant. The assignment payload holds no Decision, Knowledge or Evidence reference. A Participant must poll.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Collaboration preserves engineering traceability.<br>Ref: FR-13.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:82-173<br>src/routes/seu/core/traceability.ts:175-224<br>src/routes/seu/api/deliverables.ts:47-59<br>src/routes/seu/core/knowledge.ts:69-78<br>src/routes/seu/core/decisions.ts:71-80<br>src/routes/seu/core/evidence.ts:74-83<br>src/routes/seu/core/obligations.ts:103-112</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>explainDeliverable returns provenance, dependencies, Evidence, Decisions, Knowledge, Obligations, Reviews and Findings of a Deliverable. impactOfDeliverable returns downstream Deliverables. Each query publishes TraceabilityQueryExecuted.<br>Gap:<br>Both queries exist only for a Deliverable and are served by the API only. The birth events of Knowledge, Decisions, Evidence and Obligations set no causationId.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants remain independently replaceable.<br>Ref: FR-13.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:91-147<br>src/routes/seu/core/capabilities.ts:185-217<br>src/adapters/participantAdapter.ts:3-12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The assignment names no other Participant, so a replacement receives the same payload. replaceParticipant releases and archives the old Participant, creates the new one and moves the fulfilment.<br>Gap:<br>replaceParticipant does not touch Work Items, so an outstanding Work Item stays assigned to the archived Participant.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Engineering decisions are visible to authorised Participants.<br>Ref: FR-13.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/decisions.ts:39-48<br>src/dblayer/seed/data/routeAuthority.json:46-52<br>src/routes/seu/core/seus.ts:419-423<br>src/routes/seu/core/seus.ts:445-448<br>src/dblayer/seed/data/routeAuthority.json:1699-1705<br>src/routes/seu/core/participantHome.ts:41-43<br>src/dblayer/decisionsDB.ts:98-113</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>GET /decisions and the SEU detail view list all Decisions of the SEU. The Participant home view lists the Decisions whose recorded badge the viewer holds.<br>Gap:<br>The decisions routes have empty badges and roles, so any logged-in user passes. A search of src/routes/seu for requireTenantScope finds it on the objectives, packs, SDK authoring and demo routes only, so no SEU membership or tenant check applies to the SEU id. The Participant filter keys on the badge of the last actor of the Decision.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables represent engineering outcomes.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:278-288<br>src/routes/seu/core/workItems.ts:86-96<br>src/dblayer/seed/data/transitionDefinitions.json:246-292</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A Deliverable moves through Defined, In Progress, Approved and Baselined. A reported result is stored as a deliverable_references row with its output reference.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Knowledge represents reusable engineering understanding.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/knowledge_items_schema_recovery.sql:11-12<br>src/routes/seu/core/knowledge.ts:137-195<br>src/dblayer/knowledgeItemsDB.ts:143-163</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A Knowledge Item has an acquisition scope of SEU, Capability, Enterprise or Platform. Promotion moves it up one tier and raises a codification Obligation. Engineering Capital lists items above SEU scope.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evidence supports engineering decisions.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/decisions.ts:27-30<br>src/dblayer/recovery/decisions_schema_recovery.sql:24-25<br>src/routes/seu/core/knowledge.ts:35-38</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A Decision must reference at least one Evidence or Knowledge item. A Knowledge Item must reference supporting Evidence.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Decisions capture engineering intent.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/decisions_schema_recovery.sql:3-26<br>src/routes/seu/core/decisions.ts:25-25<br>src/routes/seu/core/decisions.ts:41-43<br>src/routes/seu/core/decisions.ts:53-69</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A Decision stores the engineering question, a category from the Ontology and the alternatives with their status.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligations represent engineering commitments.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/obligations_schema_recovery.sql:3-26<br>src/routes/seu/core/obligations.ts:39-114<br>src/domain/engine/executionEngine.ts:72-82</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>An Obligation stores category, severity, completion criteria and the object it relates to. An open Obligation that records a blocked transition stops the SEU or Deliverable hop.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Events notify changes in engineering state.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:67-104<br>src/dblayer/recovery/events_schema_recovery.sql:3-19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>publish stores the event, records pending consumption per handler and dispatches the handlers.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Participant produces a Deliverable.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/workItems.ts:14-47<br>src/routes/seu/core/workItems.ts:82-118</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The Participant reports done with a reference. The platform records the reference, completes and disposes the Work Item, completes the Command and idles the Participant.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Knowledge is updated after a Deliverable is produced.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/workItems.ts:82-118<br>src/routes/seu/core/knowledge.ts:20-81<br>src/routes/seu/api/knowledge.ts:12-38<br>src/routes/seu/web/seus.ts:524-524<br>src/dblayer/seed/data/eventSubscriptions.json:48-68</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A Knowledge Item can be created through the API or the web form after production.<br>Gap:<br>Producing a Deliverable neither creates nor requires Knowledge. WorkItemCompleted has no subscriber, so no handler reacts to a completed result.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Dependencies are evaluated after the artefact state changes.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:282-288<br>src/routes/seu/core/capabilities.ts:84-94<br>src/domain/engine/dependencyDefinitionEngine.ts:115-148</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A Deliverable hop and a Capability fulfilment evaluate the dependency rows that name them as source and publish DeliverableReady for each ready target.<br>Gap:<br>A hop of Knowledge, Evidence, Decision or Obligation starts no evaluation, although a dependency row can name them. A search of src finds only these two callers of evaluateAndPublishFromTransition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An event is published for the state change.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:305-327<br>src/domain/engine/dependencyDefinitionEngine.ts:136-146</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A Deliverable hop publishes its own domain event and DeliverableTransitioned. A target that becomes ready publishes DeliverableReady.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Interested Participants continue when the event arrives.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/deliverableKickoff.ts:18-49<br>src/domain/engine/deliverableKickoff.ts:101-130<br>src/dblayer/seed/data/eventSubscriptions.json:48-68<br>src/dblayer/seed/data/transitionDefinitions.json:257-289<br>src/dblayer/seed/seedTransitionDefinitions.ts:156-156</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>On DeliverableTransitioned, deliverableKickoff attempts every governed next hop of the SEU Deliverables and issues the producing Command, which is dispatched to a Participant.<br>Gap:<br>As seeded, Defined to In Progress is the only governed Deliverable hop and a hop without a trigger value is stored as manual. In Progress to Approved and Approved to Baselined are manual. A completed Work Item causes no next step until a person or Participant performs the approval hop.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants need not know who consumes an event.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:67-76<br>src/domain/engine/eventBus.ts:97-101</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>publish takes the event data. The handlers are chosen from the subscription table after the event is stored.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants publish domain events rather than invoking one another.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventHandlerRegistry.ts:15-28<br>src/dblayer/seed/data/eventSubscriptions.json:48-68</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The engine reactions to state changes (kickoff, command generation, work item generation, assignment delivery, capability requests) are handlers registered on event types. The assignment reaches a Participant through the assignmentDelivery handler on WorkItemDispatched.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The domain events DeliverableApproved, DecisionAccepted, EvidenceSubmitted, ObligationResolved and KnowledgeAccepted are published.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:268-279<br>src/dblayer/seed/data/transitionDefinitions.json:444-452<br>src/dblayer/seed/data/transitionDefinitions.json:576-587<br>src/dblayer/seed/data/transitionDefinitions.json:676-685<br>src/dblayer/seed/data/transitionDefinitions.json:748-757<br>src/domain/engine/executionEngine.ts:305-317<br>src/domain/engine/entityTransition.ts:83-93</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>DeliverableApproved, ObligationResolved and KnowledgeAccepted are the event names of those hops. The Decision approval hop publishes DecisionApproved and the Evidence birth publishes EvidenceCollected, which are the equivalents of DecisionAccepted and EvidenceSubmitted.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Subscribers determine whether action is required.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/deliverableKickoff.ts:18-35<br>src/dblayer/seed/data/eventSubscriptions.json:48-68</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>For an Obligation or Attention Item event deliverableKickoff returns unless the new state is resolved. For every event it returns unless the SEU is Operational.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants contribute knowledge.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/knowledge.ts:12-38<br>src/routes/seu/core/knowledge.ts:20-81<br>src/dblayer/seed/data/routeAuthority.json:151-157</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>POST /knowledge creates a Knowledge Item in the birth state with the author and badge of the actor.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants consume knowledge.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/knowledge.ts:78-87<br>src/routes/seu/api/knowledge.ts:89-96<br>src/domain/engine/workItemGenerator.ts:134-139<br>src/adapters/participantAdapter.ts:3-12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>GET /knowledge lists the Knowledge of an SEU, and GET /knowledge/capital lists Knowledge promoted beyond SEU scope. The Work Item context shows the id, title and status of the Knowledge of the Deliverable.<br>Gap:<br>The assignment delivered to an adapter holds no Knowledge. The Work Item context omits the description.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants validate knowledge.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/knowledge.ts:202-209<br>src/routes/seu/api/knowledge.ts:54-76<br>src/dblayer/seed/data/transitionDefinitions.json:667-675<br>src/dblayer/seed/data/routeAuthority.json:2064-2072</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The Validated hop needs the knowledge_validate badge. A validation note is stored with the actor and badge.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants reference knowledge.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/knowledge.ts:14-18<br>src/routes/seu/core/knowledge.ts:216-221<br>src/routes/seu/core/decisions.ts:27-30<br>src/routes/seu/core/decisions.ts:53-69<br>src/dblayer/recovery/decisions_schema_recovery.sql:24-25<br>src/routes/seu/core/knowledge.ts:35-38<br>src/dblayer/recovery/knowledge_items_schema_recovery.sql:19-24</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A Decision stores knowledge ids. A Knowledge Item stores Deliverable, Evidence, Decision and Knowledge references and rejects a self reference.<br>Gap:<br>The referenced ids are not checked for existence, and the Decision id arrays have no foreign key.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Knowledge Repository is the authoritative engineering memory.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/knowledge_items_schema_recovery.sql:3-28<br>src/routes/seu/core/knowledge.ts:109-126<br>src/domain/engine/dependencyDefinitionEngine.ts:74-80<br>src/dblayer/seed/data/transitionDefinitions.json:648-711</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Knowledge has one store with a lifecycle of Observed, Proposed, Validated, Accepted, Published, Deprecated and Archived. The Dependency Engine reads its state for Deliverable readiness.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants collaborate primarily around Deliverables.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/knowledge_items_schema_recovery.sql:6<br>src/domain/engine/workItemGenerator.ts:96-100<br>src/routes/seu/core/traceability.ts:82-173</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A Knowledge Item requires a Deliverable. Decisions, Evidence and Obligations are read by the Deliverable they relate to. The Work Item context and the explanation are built per Deliverable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Downstream Deliverables evolve from upstream Deliverables.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/adapters/assignmentDelivery.ts:22-41<br>src/domain/engine/dependencyDefinitionEngine.ts:84-94</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The assignment lists the latest reference of each upstream Deliverable that a dependency row requires. A hop is gated until the upstream state is reached.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The collaboration focus is the Deliverable and not the Participant.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/adapters/assignmentDelivery.ts:43-61<br>src/routes/seu/core/participantHome.ts:23-31</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The assignment is built from the Work Item, Command and Deliverable. The Participant view is scoped to the Deliverables of the Participant.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Engineering decisions become shared engineering artefacts.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/decisions.ts:11-83<br>src/routes/seu/core/seus.ts:445-448<br>src/domain/engine/executionEngine.ts:84-89</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A Decision is stored per SEU, listed in the SEU view and read by the Execution Engine.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants may propose decisions.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:730-738<br>src/dblayer/seed/data/routeAuthority.json:1821-1829<br>src/routes/seu/core/decisions.ts:96-113</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The Analysed to Proposed hop needs the decision_propose badge and publishes DecisionProposed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants may review decisions.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:739-747<br>src/dblayer/seed/data/routeAuthority.json:1830-1838<br>src/routes/seu/core/decisions.ts:96-113</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The Proposed to Reviewed hop needs the decision_review badge and publishes DecisionReviewed.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants may approve decisions.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:748-756<br>src/dblayer/seed/data/routeAuthority.json:1839-1847<br>src/routes/seu/core/decisions.ts:96-113</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The Reviewed to Approved hop needs the decision_approve badge and publishes DecisionApproved.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants may consume decisions.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:84-89<br>src/domain/engine/workItemGenerator.ts:134</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A Deliverable hop is blocked while a related Decision has not reached Approved. The Work Item context lists the Decisions.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Decision ownership remains traceable.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/decisions_schema_recovery.sql:27-28<br>src/dblayer/decisionsDB.ts:98-113<br>src/domain/engine/entityAdapters.ts:436-446<br>src/routes/seu/core/decisions.ts:71-80</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The birth event records the actor and badge of the creator.<br>Gap:<br>updateStatus overwrites participant_id and authority_badge on every hop, so the row names the latest actor. The original owner is found only in the events table.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants never need the identity of another Participant.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/adapters/participantAdapter.ts:3-12<br>src/adapters/assignmentDelivery.ts:22-41<br>src/adapters/assignmentDelivery.ts:43-61</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The assignment holds no Participant identity. The producer of an upstream Deliverable is not named.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants never need the implementation technology of another Participant.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/adapters/assignmentDelivery.ts:77-88<br>src/adapters/participantAdapter.ts:25-28</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The adapter is chosen from the execution mode of the target. Technology specifics stay inside the adapter.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants never need the internal reasoning of another Participant.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/workItems.ts:14-28<br>src/routes/seu/core/workItems.ts:86-96</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The result carries an outcome and an output reference string. No reasoning is received or stored.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants collaborate through published engineering state.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:67-104<br>src/routes/seu/api/seus.ts:46-54</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>State changes are stored as events and rows. The SEU events are readable through the API.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Participant failure does not invalidate the collaboration.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/workItems.ts:40-80</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A failed or blocked result marks the Work Item and Command Failed, idles the Participant and raises an Exception Attention Item. Deliverable state, references and artefacts are untouched.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants may be restarted.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/deliverableKickoff.ts:51-99<br>src/routes/seu/core/workItemHeartbeat.ts:15-59<br>src/routes/seu/api/workItems.ts:49-58<br>src/routes/seu/core/workItems.ts:40-52<br>src/dblayer/seed/data/eventSubscriptions.json:48-68</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>After a failed result the Participant is set Idle and can be dispatched again. A Failed producing Command is re-issued on CapabilityFulfilled, on DispatchRejected and when a blocking Obligation resolves. A stalled Work Item raises an Escalation Attention Item.<br>Gap:<br>A failed Work Item is not re-dispatched by itself. The stall sweep is run through an API call and only raises the Attention Item.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants may be replaced.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:91-147<br>src/routes/seu/core/capabilities.ts:185-217<br>src/domain/engine/executionEngine.ts:359-392</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>replaceParticipant moves the fulfilment to a new Participant and the dispatch pool is read from active fulfilments.<br>Gap:<br>The replacement is not started on a failure. An outstanding Work Item of the replaced Participant is not reassigned.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants may execute concurrently.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dispatchEngine.ts:88-134<br>src/domain/engine/deliverableKickoff.ts:145-154</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Each Work Item is dispatched to an available candidate from the pool, so several Participants hold Work Items at once. Issuing a producing Command is serialised per Deliverable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Engineering continuity is unaffected by a Participant failure.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:97-101<br>src/dblayer/eventsDB.ts:52-65<br>src/dblayer/recovery/events_schema_recovery.sql:3-19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Artefacts and events are rows in the database, not in a Participant.<br>Gap:<br>A handler runs after the event row is stored and is not awaited. If the process stops first, the consumption state stays pending, and no code replays pending events. A search of src for consumption_state finds only the event bus, the events DB, the types and the schema.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CollaborationStarted is published.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/eventSubscriptions.json:3-45</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No Collaboration lifecycle exists. A search of src and design/foundations for the event name finds only the specification. The registry lists no such event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CollaborationCompleted is published.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/eventSubscriptions.json:3-45</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No code publishes or registers this event. Nothing models a collaboration as a unit that completes.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">KnowledgeShared is published.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:685-693<br>src/routes/seu/core/knowledge.ts:169-178</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>KnowledgePublished is published at Accepted to Published, and KnowledgeScopePromoted is published when scope widens.<br>Gap:<br>No event is named KnowledgeShared, and none is published when a Participant first consumes the Knowledge.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">DeliverableShared is published.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:279-289<br>src/domain/engine/executionEngine.ts:305-317<br>src/routes/seu/core/workItems.ts:99-102</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>DeliverableBaselined is published at Approved to Baselined.<br>Gap:<br>No event named DeliverableShared exists. A reported result publishes WorkItemCompleted, which carries no Deliverable reference.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">DecisionPublished is published.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:748-765<br>src/dblayer/seed/data/transitionDefinitions.json:712-784<br>src/routes/seu/core/decisions.ts:96-113</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>DecisionApproved and DecisionApplied are published at those hops.<br>Gap:<br>No event is named DecisionPublished and the Decision lifecycle has no Published state.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EvidencePublished is published.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:598-617<br>src/routes/seu/core/evidence.ts:192-209</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>EvidenceAccepted and EvidenceReferenced are published at those hops.<br>Gap:<br>No event is named EvidencePublished.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CollaborationFailed is published.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/workItems.ts:57-66</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>A failed result publishes WorkItemFailed. No event is named CollaborationFailed, and no failure of a collaboration as a whole is detected.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Collaboration Model supports asynchronous execution.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:97-101<br>src/routes/seu/api/workItems.ts:14-47</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Handlers are dispatched without awaiting. A Participant works after the assignment and reports later.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Collaboration Model supports concurrent Participants correctly.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/deliverableKickoff.ts:145-154<br>src/domain/engine/entityTransition.ts:33-62<br>src/dblayer/decisionsDB.ts:98-113<br>src/domain/engine/dispatchEngine.ts:88-134</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A per-Deliverable lock serialises Command issue.<br>Gap:<br>The lock is a map inside one process. A hop reads the state and then writes it with no version check. Dispatch reads the available candidates and assigns later.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Collaboration Model remains loosely coupled.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:48-61<br>src/domain/engine/eventHandlerRegistry.ts:15-28</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Components meet only through events and stored state.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Collaboration Model preserves engineering traceability.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/events_schema_recovery.sql:3-19<br>src/routes/seu/core/traceability.ts:82-173<br>src/dblayer/knowledgeItemsDB.ts:71-85</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Events keep the actor, the badge and the correlation chain.<br>Gap:<br>Same as ECM-003. The Knowledge and Decision rows keep only the last actor, and some changes publish no event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Collaboration Model remains implementation independent.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/adapters/assignmentDelivery.ts:77-88<br>src/adapters/participantAdapter.ts:25-28</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Participant technology is behind the adapter interface selected by execution mode.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants collaborate without direct coupling.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:67-104<br>src/adapters/assignmentDelivery.ts:63-92</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>See ECM-002 and §3. Components are coupled only through events and stored state.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Engineering artefacts constitute the primary collaboration mechanism.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:72-89<br>src/domain/engine/workItemGenerator.ts:96-100</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>See ECM-001.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Events communicate engineering state changes.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/eventSubscriptions.json:28-31<br>src/dblayer/seed/data/eventSubscriptions.json:48-68</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Hops publish events.<br>Gap:<br>Same as ECM-005. Artefact events have no subscriber and some changes publish none.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants remain independently replaceable.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:91-147</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Replacement exists.<br>Gap:<br>Same as FR-13.5. Outstanding Work Items are not reassigned.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Engineering knowledge remains centralised.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/knowledge_items_schema_recovery.sql:3-28<br>src/dblayer/knowledgeItemsDB.ts:143-163</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Knowledge is kept in one table and read per SEU or across SEUs.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Collaboration remains fully traceable.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/events_schema_recovery.sql:3-19<br>src/dblayer/knowledgeItemsDB.ts:71-85<br>src/dblayer/decisionsDB.ts:98-113</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Same as ECM-003. The row-level author is overwritten and some changes publish no event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Collaboration services are produced.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/knowledge.ts:20-20<br>src/routes/seu/core/knowledge.ts:109-109<br>src/routes/seu/core/knowledge.ts:137-137<br>src/routes/seu/core/decisions.ts:11-11<br>src/routes/seu/core/decisions.ts:96-96<br>src/routes/seu/core/evidence.ts:31-31<br>src/routes/seu/core/evidence.ts:192-192<br>src/routes/seu/core/obligations.ts:39-39<br>src/routes/seu/core/obligations.ts:326-326</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Knowledge, Decision, Evidence and Obligation services exist.<br>Gap:<br>No service coordinates collaboration across them. There is no Collaboration module.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An event publication framework is produced.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:17-31<br>src/domain/engine/eventBus.ts:33-45<br>src/domain/engine/eventBus.ts:67-104<br>src/dblayer/eventsDB.ts:15-50<br>src/dblayer/eventsDB.ts:52-65<br>src/dblayer/eventsDB.ts:67-75</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>eventBus publishes, stores and dispatches events with per-handler consumption state.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Collaboration APIs are produced.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/knowledge.ts:12-12<br>src/routes/seu/api/knowledge.ts:78-78<br>src/routes/seu/api/decisions.ts:11-11<br>src/routes/seu/api/decisions.ts:39-39<br>src/routes/seu/api/evidence.ts:12-12<br>src/routes/seu/api/evidence.ts:46-46<br>src/routes/seu/api/obligations.ts:12-12<br>src/routes/seu/api/obligations.ts:27-27<br>src/routes/seu/web/seus.ts:541-541<br>src/routes/seu/web/seus.ts:619-619</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>APIs exist to create and list Knowledge, Decisions, Evidence and Obligations.<br>Gap:<br>Lifecycle hops of these artefacts are web routes only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Shared engineering artefact interfaces are produced.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/entityAdapters.ts:24-38<br>src/domain/engine/entityAdapters.ts:322-344<br>src/domain/engine/entityAdapters.ts:345-369<br>src/domain/engine/entityAdapters.ts:429-460<br>src/domain/engine/entityAdapters.ts:461-480</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Every artefact is moved by transitionEntity through one adapter interface of findById, getState, setState, tenantId and an optional seuId. Obligation, Knowledge, Decision and Evidence each register an adapter.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Collaboration traceability services are produced.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:82-82<br>src/routes/seu/core/traceability.ts:175-175<br>src/routes/seu/api/deliverables.ts:47-47</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>explainDeliverable and impactOfDeliverable exist and publish TraceabilityQueryExecuted.<br>Gap:<br>They cover Deliverables only and have no web page.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Event subscriptions are produced.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:48-61<br>src/dblayer/seed/data/eventSubscriptions.json:48-68<br>src/dblayer/eventsDB.ts:99-112</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Subscriptions are seeded into event_subscriptions and loaded at start.</td>
    </tr>
  </tbody>
</table>

## Summary

- Total intents analysed: 80
- Fully met ✅: 48
- Partially met ⚠️: 29
- Not met ❌: 3
- Not verifiable ❓: 0

### Major implementation gaps

- No Collaboration subsystem exists. CollaborationStarted, CollaborationCompleted and CollaborationFailed are never published. KnowledgeShared, DeliverableShared, DecisionPublished and EvidencePublished have only differently named equivalents.
- Knowledge, Evidence and Decision events have no subscriber, and a hop of these artefacts starts no dependency evaluation.
- A completed Work Item causes no next step. The Approved hop is manual and WorkItemCompleted has no subscriber.
- Lifecycle hops of Decisions and Knowledge have no API route. A Participant that is not a web user cannot publish them.
- The assignment sent to a Participant adapter holds no Decision, Knowledge or Evidence. The Work Item context that holds them is shown in the UI only.
- Knowledge and Decision rows overwrite the author and badge on every hop. Validation notes, assessments and reference updates publish no event.
- Decision visibility has no SEU or tenant check, and the Participant filter keys on the last actor badge.
- Events are dispatched in process without replay. A stopped process leaves pending consumption with no retry.
- Replacement does not reassign outstanding Work Items, and a failed Work Item is not re-dispatched by itself.
- Traceability queries exist for Deliverables only and are API only.
