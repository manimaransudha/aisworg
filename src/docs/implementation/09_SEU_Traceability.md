# Implementation Traceability: Chapter 9 – Software Engineering Unit (SEU)

**Date of report: 23-10-2026**

Specification: src/docs/SEU Studio Specifications/02_SEU Composition/09_SEU.md

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SEU is the primary execution entity, commissioned for an Objective, with an executable runtime.<br>Ref: §1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/seus_schema_recovery.sql:3-15<br>src/routes/seu/core/commissioning.ts:111-165</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The seus table holds the Objective, Template, Profile, active EBM, lifecycle state and commissioning report. initiateSeu creates the row and publishes CommissionInitiated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every SEU&#x27;s required Capabilities derive from the Objective it is commissioned for.<br>Ref: §1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:111-135<br>src/routes/seu/core/commissioning.ts:241-249</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>finalizeCommissioning creates seu_capabilities from the Template's required Capabilities. The Template is chosen against the Objective's capabilities.<br>Chapter 8 records that no check compares the two at commission time. The derivation therefore rests on the Template choice.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An SEU is a temporary construct that reaches a retired and archived end.<br>Ref: §1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:106-155<br>src/dblayer/seusDB.ts:10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Operational or Suspended SEUs retire. A Retired SEU archives. Live-state queries exclude Retired and Archived.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants may be AI, human or external systems, and the SEU keeps knowledge, governance and traceability independent of any participant.<br>Ref: §1, §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/ontologyConcepts.json:4395-4404<br>src/dblayer/recovery/participants_schema_recovery.sql:5-9<br>src/routes/seu/core/participants.ts:91-146</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Participant types are an Ontology set. Participants hold a seu_id. Knowledge, Evidence, Decisions and Obligations are keyed by the SEU, not by a Participant.<br>Gap:<br>The set of types is data. Nothing in the repository establishes an external-system Participant adapter beyond the type value.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SEU&#x27;s scope covers lifecycle, runtime model, composition, responsibilities, interaction with the kernel and engine, commissioning and archival.<br>Ref: §2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/seus.ts:273-476</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>getSeuDetailView assembles Capabilities, Deliverables, Commands, Obligations, Attention Items, Evidence, Knowledge, Decisions, External Interactions and Events for one SEU.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SEU does not interact directly with Packs. All engineering behaviour is inherited through the EBM.<br>Ref: §3, §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:44-87<br>src/domain/engine/ebmActivated.ts:14-52<br>src/routes/seu/core/seus.ts:292-326</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Runtime behaviour (policies, Quality Gates, competency requirements, pool, composed Pack ids) is read from the EBM row.<br>Gap:<br>checkRequestLiveness reads Packs directly through packsDB at the Validate step, before the EBM exists. checkEbmLiveness (commissioning.ts:89-105) reads Packs again. The SEU module therefore touches Packs for liveness.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SEU is not responsible for composing practices, loading Packs, authenticating users or managing infrastructure.<br>Ref: §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:60-105<br>src/routes/seu/web/seus.ts:112-143</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Composition is run by the Composition Engine and persisted as the EBM. The SEU receives it through setActiveEbm.<br>Gap:<br>The same SEU module (commissioning.ts) hosts the Validate-time Pack liveness reads and the previewCommissioningValidation unravel call (commissioning.ts:441-462), so composition-adjacent logic sits in the SEU core.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SEU executes engineering work.<br>Ref: §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/deliverableKickoff.ts:17-45<br>src/domain/engine/executionEngine.ts:51-130<br>src/domain/engine/workItemGenerator.ts:1-180</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>On an Operational SEU, governed Deliverable hops run. The Execution Engine records a Command, generates Work Items and dispatches them to Participants.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SEU maintains engineering governance.<br>Ref: §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:72-130<br>src/domain/engine/transitionEngine.ts:61-86<br>src/routes/seu/core/commissioning.ts:311-357</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Deliverable hops check open Obligations, Decisions, Quality Gates and badges. SEU hops evaluate the EBM's SEU-scoped Policies and raise Obligations on a block.<br>Gap:<br>The SEU states Monitoring (governance) and Completing have no hops, so governance evaluation ends at Operational.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SEU coordinates participants.<br>Ref: §4, §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:99-212<br>src/domain/engine/dispatchEngine.ts:1-168<br>src/domain/engine/capabilityOnReady.ts:14-47</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Ready Deliverables request fulfilment of their producing Capability. Fulfilment assigns Participants. The dispatch engine selects a Participant for each Work Item.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SEU maintains dependency graphs.<br>Ref: §4, §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:96-149<br>src/domain/engine/materialiseDependencyGraph.ts:8-51<br>src/routes/seu/core/seus.ts:326-357</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Dependency definitions are materialised from the Template and evaluated per SEU. The detail view shows each Deliverable's edges with Satisfied or Pending.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SEU manages engineering obligations.<br>Ref: §4, §14, FR-2.11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/obligations.ts:39-120<br>src/routes/seu/core/obligations.ts:123-260<br>src/domain/engine/executionEngine.ts:72-82</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Obligations are created manually, from Pack definitions and from blocked transitions. Open blocking Obligations stop SEU and Deliverable hops.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SEU preserves knowledge.<br>Ref: §4, FR-2.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/knowledge.ts:20-82<br>src/routes/seu/core/knowledge.ts:137-196<br>src/dblayer/recovery/knowledge_items_schema_recovery.sql:5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Knowledge Items are keyed by seu_id and Deliverable, not by Participant. Scope promotion creates Engineering Capital. Replacing a Participant archives that Participant only (participants.ts:106-146).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SEU maintains traceability.<br>Ref: §4, FR-2.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:82-210<br>src/domain/engine/executionEngine.ts:255-280</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>explainDeliverable and impactOfDeliverable return provenance and impact. Every hop records a Command, a governance outcome and events with actor and badge.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SEU reports engineering state.<br>Ref: §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/seus.ts:54-66<br>src/routes/seu/core/seus.ts:153-170<br>src/routes/seu/core/telemetry.ts:60-110</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Status, quickview, detail and the five telemetry metric groups report per SEU.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authorised users can commission an SEU.<br>Ref: FR-2.1, §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/seus.ts:98-110<br>src/routes/seu/core/commissioning.ts:111-165<br>src/dblayer/seed/data/routeAuthority.json</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The Save button calls initiateSeu with the actor. Birth requires the seu_commission badge through transitionEngine.beginBirth. The route is gated by route_authority.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissioning is a single request that commissions an SEU from an Engineering Behavior Model.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/seus.ts:98-143<br>src/routes/seu/api/seus.ts:13-32</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Commissioning runs as Save, Validate, Compose EBM, Validate EBM and Activate EBM on the web router.<br>Gap:<br>The API commission route is commented out (api/seus.ts:13-32). No single call commissions an SEU from an EBM.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every SEU executes against exactly one EBM.<br>Ref: FR-2.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/seus_schema_recovery.sql:8<br>src/domain/engine/compositionCompleted.ts:74-105<br>src/dblayer/ebmsDB.ts:57-62</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>seus.active_ebm_id holds one EBM. The EBM is created once by compositionCompleted and the pointer is set there. Later changes only move the EBM's status.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An EBM exists before an SEU is commissioned.<br>Ref: FR-2.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:74-105<br>src/domain/engine/ebmActivated.ts:14-52<br>src/routes/seu/core/commissioning.ts:288-292</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The SEU is born Initiated and Validated without an EBM. The hop to Commissioned is made only by finalizeCommissioning, which runs off EBMActivated. An EBM exists before Commissioned.<br>Gap:<br>The SEU row exists, and an Initiated or Validated SEU is live, before any EBM exists (active_ebm_id is nullable, seus_schema_recovery.sql:8).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every runtime object belongs to exactly one active SEU.<br>Ref: FR-2.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/commands_schema_recovery.sql:5<br>src/dblayer/recovery/deliverables_schema_recovery.sql:3-8<br>src/dblayer/recovery/knowledge_items_schema_recovery.sql:5<br>src/dblayer/recovery/evidence_schema_recovery.sql:23-30<br>src/dblayer/recovery/work_items_schema_recovery.sql:3-10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Commands, Deliverables, Obligations, Decisions, Knowledge Items, Attention Items and Participants carry a NOT NULL seu_id with a foreign key.<br>Gap:<br>Work Items hold no seu_id and reach the SEU through the Command. Evidence has no direct seu_id column and reaches the SEU through relationships. No guard stops a write to a Retired or Archived SEU.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An SEU supports human, AI and external-system participants.<br>Ref: FR-2.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/ontologyConcepts.json:4395-4404<br>src/routes/seu/core/participants.ts:91-122</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Participant type is validated against the participant-types Ontology set when a Participant is created or replaced.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Complete engineering traceability is maintained.<br>Ref: FR-2.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/traceability.ts:82-210<br>src/domain/engine/executionEngine.ts:255-290</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Commands, governance outcomes, deliverable references, attestations and events are recorded per hop.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Knowledge is preserved independently of the participant lifecycle.<br>Ref: FR-2.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:91-146<br>src/dblayer/recovery/knowledge_items_schema_recovery.sql:5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Replacement archives the old Participant and creates a new one on the same Capability fulfilment. Knowledge Items are not tied to a Participant.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SEU exposes runtime state through published services.<br>Ref: FR-2.8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/seus.ts:35-62<br>src/routes/seu/api/telemetry.ts:10-25<br>src/routes/seu/api/workItems.ts:1-60</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The API exposes the SEU status, events, governance model, telemetry and Work Item operations.<br>Gap:<br>The SEU API has no list, detail view with Obligations, Knowledge or Deliverable state, and no transition route. Those are on the web router only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SEU maintains dependency relationships between Deliverables.<br>Ref: FR-2.9, §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/materialiseDependencyGraph.ts:25-48<br>src/domain/engine/dependencyDefinitionEngine.ts:55-94</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Deliverable to Deliverable rows are materialised from the Template graph. Rows for Decisions, Obligations, Evidence and Knowledge are evaluated.<br>Gap:<br>materialiseDependencyGraph skips every entry that is not Deliverable-to-Deliverable (materialiseDependencyGraph.ts:28-48). Nothing materialises External dependencies. resolveNamedNode returns null for every other node type.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Execution occurs only when dependency conditions are satisfied.<br>Ref: FR-2.10, §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:52-70<br>src/domain/engine/dependencyDefinitionEngine.ts:99-111</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>evaluateDeliverableTransition calls isTargetReady first. Unsatisfied rows reject the hop and publish DeliverableBlocked. Producing work starts only after the hop to In Progress.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An SEU preserves a complete audit history.<br>Ref: FR-2.12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:67-104<br>src/dblayer/recovery/events_schema_recovery.sql</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Every publish appends an event row with actor, badge and correlation id before any handler runs. SEU events are listed per SEU (events.ts:6-9).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SEU lifecycle passes through Requested, Engineering Behavior Composition, Commissioned, Executing, Monitoring, Completing, Knowledge Preservation and Archived.<br>Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:3-148<br>src/dblayer/seusDB.ts:10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The live lifecycle is Initiated, Validated, Configured, Commissioned, Activated, Operational, Suspended, Retired, Archived, plus Failed.<br>Gap:<br>Requested maps to Initiated. Composition, Executing and Commissioned have different names or positions. Monitoring, Completing and Knowledge Preservation have no state and no transition. Retired and Suspended are not in the spec lifecycle.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Requested: the objective is defined and no runtime resources exist.<br>Ref: §6 Requested</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:111-165</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The Initiated SEU has no Capabilities, Deliverables or EBM. Those are created later.<br>Gap:<br>The state is named Initiated, not Requested. The Requested event is CommissionInitiated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Engineering Behavior Composition: the Composition Engine builds the EBM and no participants are active.<br>Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:60-115<br>src/routes/seu/core/commissioning.ts:200-219</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Compose EBM runs while the SEU is Validated. No Participants exist yet.<br>Gap:<br>No SEU state represents composition. Composed, RuntimeAllocated, KnowledgeInitialised and ParticipantsRecruited rows exist in the seed (transitionDefinitions.json:156-190) and nothing performs them.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissioned: runtime resources are allocated, Capabilities become available and Participants may be recruited.<br>Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:241-249<br>src/routes/seu/core/commissioning.ts:272-292</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>finalizeCommissioning creates the SEU's Capabilities and Deliverables and moves the SEU Configured then Commissioned.<br>Gap:<br>Participants are recruited when a Deliverable becomes Ready, after Operational (capabilityOnReady.ts), not at Commissioned. Commissioned is a transient step before Activated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Executing: the SEU performs work and the Dependency Engine continuously evaluates readiness.<br>Ref: §6 Executing</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:311-357<br>src/domain/engine/dependencyDefinitionEngine.ts:115-148<br>src/domain/engine/capabilityOnReady.ts:14-47</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Operational is the executing state. Readiness is evaluated on every Deliverable or Capability transition and published as DeliverableReady.<br>Gap:<br>The state is named Operational. Evaluation is event-driven, not continuous.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Monitoring: the SEU continuously evaluates dependency health, obligations, governance, knowledge completeness and execution flow.<br>Ref: §6 Monitoring</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/telemetry.ts:60-110<br>src/routes/seu/core/workItemHeartbeat.ts:15-30</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No Monitoring state or transition exists. Metrics are computed on request. The stall sweep and the Capability retry sweep run only when their API routes are called (api/workItems.ts:52). No scheduler runs them.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Completing: outstanding work reaches a terminal state and knowledge is consolidated.<br>Ref: §6 Completing</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:106-155</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No Completing state exists. Operational moves to Suspended or Retired by a manual button. No code checks that Deliverables, Work Items and Obligations are terminal before Retired.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Knowledge Preservation: knowledge, evidence and traceability are finalised for long-term reuse.<br>Ref: §6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:106-155</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No Knowledge Preservation state or step exists. Retired to Archived is a manual hop that checks no Knowledge, Evidence or traceability finalisation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Archived: the SEU becomes read-only, runtime execution ceases and knowledge remains accessible.<br>Ref: §6 Archived</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:140-155<br>src/dblayer/seusDB.ts:10<br>src/domain/engine/deliverableKickoff.ts:35</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Archived is reachable from Retired and SEUArchived is published. Archived SEUs are excluded from the live-state set. Governed Deliverable hops run only on Operational SEUs. Knowledge rows remain and are listed per SEU.<br>Gap:<br>No guard makes an Archived SEU read-only. Web routes for Evidence, Knowledge, Decisions, Obligations and Attention Items do not check the SEU state (web/seus.ts:274-693).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SEU is composed of Objectives, Participants, Capabilities, Services, Roles, Deliverables, Work Items, a Dependency Graph, Knowledge, Evidence, Governance, Obligations, Traceability, Metrics and Runtime State.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/seus.ts:244-271<br>src/dblayer/recovery/seus_schema_recovery.sql:3-15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The SEU detail view carries Capabilities, Participants, Deliverables, Commands and Work Items, Dependency edges, Obligations, Evidence, Knowledge, Decisions, Events and Governance.<br>Gap:<br>Roles are not a component; no SEU role entity or column exists. Services are looked up by code only for labels (seus.ts:323-324). Metrics are computed per SEU in telemetry and not held on the SEU.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Execution within an SEU is dependency-driven and not time-driven.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:52-70<br>src/domain/engine/capabilityOnReady.ts:14-47</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Deliverable start is gated by isTargetReady. Capability requests are triggered by DeliverableReady or SEU commissioning events.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Dependencies may arise from deliverables, decisions, approvals, evidence, obligations, external systems and human input.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:55-94<br>src/domain/engine/executionEngine.ts:72-89</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Deliverable, Decision, Obligation, Evidence and Knowledge nodes are evaluated. Open Obligations and unapproved Decisions block.<br>Gap:<br>No External dependency node type exists in the evaluator. Approvals and human input have no dedicated node type.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Runtime Kernel executes only work items declared ready by the Dependency Engine.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:52-70<br>src/domain/engine/deliverableKickoff.ts:122-137<br>src/domain/engine/workItemGenerator.ts:1-180</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A producing Command is issued only for an In Progress Deliverable, which could be entered only after isTargetReady passed.<br>Gap:<br>The Work Item generator and dispatch engine do not re-check readiness; they trust that the Command was issued after the check.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SEU inherits all behaviour from its EBM, which defines standards, governance, decision rules, Quality Gates, Review Gates, authority rules, terminology and practices.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/compositionCompleted.ts:60-103<br>src/routes/seu/core/governanceModel.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The EBM row stores behaviours, applicable Quality Gate and Policy ids and SEU-scoped Policy ids. The governance model endpoint reads them from the EBM.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SEU does not modify the EBM directly. Changes require recomposition.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/ebmsDB.ts:57-62<br>src/domain/engine/compositionCompleted.ts:105</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The only EBM update is its status, through governed hops. Behaviours are written once at creation.<br>Gap:<br>Recomposition is not built. EBMVersioned is registered and never published (eventSubscriptions.json). A change needs a new SEU or a manual re-compose before Activate.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants execute Capabilities within assigned roles.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dispatchEngine.ts:1-168<br>src/routes/seu/core/capabilities.ts:99-212</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Participants are assigned to Capabilities by fulfilment and receive Work Items for the Capability that produces a Deliverable.<br>Gap:<br>No role entity exists. The Capability is the only assignment unit.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants are replaceable, and replacement does not invalidate knowledge, traceability or completed work.<br>Ref: §10, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:91-146<br>src/routes/seu/web/seus.ts:222-248</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>replaceParticipant releases and archives the old Participant, creates the new one, revokes the old fulfilment and creates a new one, then publishes ParticipantReplaced. Work, Knowledge and Evidence rows keep their references.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Deliverable is a measurable outcome and defines dependencies, producing capabilities, required evidence, acceptance criteria and completion status.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/deliverables_schema_recovery.sql:3-14<br>src/routes/seu/core/commissioning.ts:263-285</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Deliverables hold acceptance_criteria, producing_capability_id, a lifecycle state as completion status and dependency rows by name.<br>Gap:<br>There is no required-evidence field on the Deliverable. Required evidence is held only as Quality Gate conditions.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Work Item is an executable unit that exists only to produce or modify Deliverables, references one or more Deliverables and never exists independently.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/work_items_schema_recovery.sql:3-10<br>src/routes/seu/core/workItems.ts:29-33</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Each Work Item is created from a Command whose entity is a Deliverable. completeWorkItem rejects any other entity type.<br>Gap:<br>The reference is indirect through command_id. A Work Item holds one Deliverable, never several, and the schema does not require the entity to be a Deliverable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable dependency graph covers Deliverables, Decisions, Obligations, Knowledge, Evidence and External dependencies, and readiness comes only from this graph.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:55-94<br>src/domain/engine/executionEngine.ts:52-70</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Readiness is isTargetReady over dependency rows. Deliverable nodes are named and the other types are checked by relation to the gated Deliverable.<br>Open Obligations and Decisions are also checked by direct queries in executionEngine.ts:72-89, outside the graph.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Obligation has an owner, severity, priority, required evidence, blocking conditions and status.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/obligations_schema_recovery.sql:3-26<br>src/routes/seu/core/obligations.ts:39-120</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Severity, priority, status, blocked_from_state and blocked_to_state (blocking conditions) and assigned entity (owner) exist.<br>Gap:<br>The owner is optional (assigned_entity_*) and priority is nullable. Required evidence is the free-text completion_criteria, not an Evidence reference.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligations originate from risks, audits, customer observations, compliance, security reviews, architecture reviews and dependency analysis.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/obligations.ts:39-260<br>src/routes/seu/core/findings.ts:132</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Obligations come from blocked transitions, Pack definitions and Review Findings (findings.ts:132). Category is an Ontology value.<br>Gap:<br>Origin is a free field. There is no source for risk, audit, customer observation, compliance, security review, architecture review or dependency analysis.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SEU publishes domain events SEUCommissioned, DeliverableReady, WorkItemStarted, WorkItemCompleted, DependencySatisfied, DependencyBlocked, ObligationRaised, ObligationResolved, KnowledgeAccepted, KnowledgeArchived and SEUArchived.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/eventSubscriptions.json:1-60<br>src/dblayer/seed/data/transitionDefinitions.json:144-155<br>src/routes/seu/core/workItems.ts:99-102<br>src/domain/engine/executionEngine.ts:59-68</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>SEUCommissioned, DeliverableReady, WorkItemCompleted, ObligationResolved, KnowledgeAccepted, KnowledgeArchived and SEUArchived are published.<br>Gap:<br>WorkItemStarted is never published (only queried in runtimeTelemetryDB.ts:51). DependencyBlocked is published as DeliverableBlocked. DependencySatisfied is published as DeliverableReady. ObligationRaised is published as ObligationCreated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Multiple SEUs execute concurrently.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seusDB.ts:10-22<br>src/domain/engine/executionEngine.ts:38-49</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>All state is keyed by seu_id. Per-Deliverable turn locks serialise work on one Deliverable.<br>Gap:<br>The locks are in-process maps. Two server processes would not share them.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SEU execution survives runtime restarts and runtime state is recoverable.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:97-101</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>Events and consumption state are persisted. Handlers run in process after commit with no replay of pending or failed consumption at start-up (app.ts:238-262). A restart between publish and dispatch leaves the event pending permanently.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All engineering decisions remain traceable.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/decisions.ts<br>src/dblayer/recovery/decisions_schema_recovery.sql:5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Decisions are keyed by seu_id, hold related objects and author, and record events per hop.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All execution is externally observable.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/telemetry.ts:10-25<br>src/routes/seu/api/seus.ts:44-53</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Events and telemetry are exposed through API and web pages.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SEU is independent of specific AI providers.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dispatchStrategies.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Dispatch selects Participants by Capability and strategy. No AI provider SDK is referenced in the SEU or engine modules.<br>Gap:<br>There is no adapter contract in the repository for AI or external Participants to execute Work Items; execution is reported back by completeWorkItem.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An SEU can be commissioned from an EBM, Participants can be assigned and replaced, Deliverables drive execution, Work Items execute only when dependencies are satisfied.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:225-309<br>src/domain/engine/executionEngine.ts:52-70<br>src/routes/seu/core/participants.ts:91-146</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The commissioning chain, assignment, replacement and dependency-gated start exist.<br>Gap:<br>Commissioning has several manual web steps and no API.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Engineering obligations influence execution and knowledge survives SEU archival.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:72-89<br>src/routes/seu/core/commissioning.ts:311-357</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Open blocking Obligations stop Deliverable hops and the Activated to Operational hop. Knowledge rows are not deleted on Archive.<br>Gap:<br>No archive-time knowledge finalisation exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Chapter deliverables: domain model, lifecycle, aggregate, dependency graph interfaces, Deliverable and Work Item models, runtime services, event definitions and API.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/seus.ts:1-515<br>src/dblayer/seed/data/transitionDefinitions.json:3-148<br>src/dblayer/seed/data/eventSubscriptions.json:1-60<br>src/routes/seu/api/seus.ts:35-62</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Domain model, lifecycle rows, Deliverable and Work Item models, runtime services and event definitions exist.<br>Gap:<br>There is no single SEU aggregate definition. The API does not cover commissioning or lifecycle transitions.</td>
    </tr>
  </tbody>
</table>

## Summary

- Total intents analysed: 58
- Fully met ✅: 24
- Partially met ⚠️: 30
- Not met ❌: 4
- Not verifiable ❓: 0

### Major implementation gaps

- The lifecycle differs from the spec. Monitoring, Completing and Knowledge Preservation have no state or transition, and Composed, RuntimeAllocated, KnowledgeInitialised and ParticipantsRecruited rows exist in the seed with no performer.
- No SEU is read-only after Archive. Runtime routes do not check the SEU state.
- Restart recovery is missing. Pending and failed event consumption is not replayed at start-up.
- Monitoring is not continuous. The sweeps and metrics run only on request.
- Event names differ: WorkItemStarted is never published, and DependencySatisfied, DependencyBlocked and ObligationRaised are published as DeliverableReady, DeliverableBlocked and ObligationCreated.
- The dependency graph materialises only Deliverable-to-Deliverable rows, and External dependencies have no node type.
- Roles are not a component of the SEU. A Deliverable has no required-evidence field, and an Obligation holds required evidence as free text.
- The SEU module reads Packs directly for liveness, and EBM recomposition is not built.
- The API has no commissioning or lifecycle transition route.
