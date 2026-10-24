# Implementation Traceability: Chapter 11 – Participant Model

**Date of report: 23-10-2026**

Specification: src/docs/SEU Studio Specifications/02_SEU Composition/11_Participant.md

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Participant is the runtime entity that fulfils Capabilities within an SEU.<br>Ref: §1, §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:57-97<br>src/routes/seu/core/capabilities.ts:123-183<br>src/dblayer/recovery/participants_schema_recovery.sql:3-11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>fulfilOne creates a participants row for the SEU and a capability_fulfilments row that links it to the SEU Capability. fulfilRequestedCapability does this for the named Participants or the whole eligible pool and publishes CapabilityFulfilled.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants execute engineering work under the governance of the EBM.<br>Ref: §1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dispatchStrategies.ts:25-31<br>src/domain/engine/dispatchEngine.ts:105-134<br>src/routes/seu/core/workItems.ts:23-35<br>src/routes/seu/core/workItems.ts:107-116</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Dispatch reads its strategy settings from the active EBM pool and assigns the Participant through a governed hop. completeWorkItem drives the Deliverable transition and returns the Participant to Idle.<br>Gap:<br>No code moves a Participant to Executing. The Participant goes from Assigned straight to Idle.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants may be AI systems, human engineers or external services, and the platform treats all of them as equal entities.<br>Ref: §1, §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/participants_schema_recovery.sql:3-11<br>src/dblayer/recovery/participants_master_schema_recovery.sql:3-15<br>src/dblayer/seed/data/ontologyConcepts.json:4395-4429<br>src/dblayer/participantsDB.ts:8-26</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>One participants_master table and one participants table serve every type. The type is an Ontology-checked text value (participant-types: AI, Human, Automated, External). The lifecycle service has no branch on type.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The chain is Capability, Capability Fulfilment, Participant, Work Item Execution, Deliverable.<br>Ref: §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:359-377<br>src/domain/engine/dispatchEngine.ts:80-88<br>src/domain/engine/dispatchEngine.ts:112-134<br>src/routes/seu/core/workItems.ts:23-35</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>executionEngine persists a pool of the participant ids from the active fulfilments of the producing Capability. dispatchEngine selects from that pool, assigns the Work Item and hops the Participant to Assigned. completeWorkItem acts on the Command's Deliverable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants execute behaviour and do not define it.<br>Ref: §3, PM-004</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participantEligibility.ts:24-30<br>src/routes/seu/core/participantEligibility.ts:40-45<br>src/domain/engine/dispatchStrategies.ts:25-31</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The participants row carries no behaviour. participants_master.behaviour_context payloads are read only to test eligibility against Eligibility Policies. Competency requirements and dispatch settings are read from the EBM.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Participant possesses an identity.<br>Ref: §4, PM-002, §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/participants_schema_recovery.sql:3-11<br>src/dblayer/participantsDB.ts:8-26<br>src/dblayer/seuTypes.ts:413-422</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>id, type, display_name, state, seu_id and the master reference participant_id are stored on the participants row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Participant has assigned Capabilities.<br>Ref: §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/capability_fulfilments_schema_recovery.sql:3-10<br>src/dblayer/capabilityFulfilmentsDB.ts:53-62<br>src/dblayer/recovery/participants_master_schema_recovery.sql:8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>capability_fulfilments.participant_id links a Participant to an SEU Capability and findActiveByParticipantId resolves it. participants_master.capabilities lists the Capability codes a master can fulfil.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Participant has an engineering history.<br>Ref: §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/decisions_schema_recovery.sql:27<br>src/dblayer/recovery/deliverable_references_schema_recovery.sql:8<br>src/dblayer/recovery/attestations_schema_recovery.sql:8<br>src/dblayer/recovery/work_items_schema_recovery.sql:6<br>src/routes/seu/core/participantHome.ts:65-79</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Decisions, Deliverable references, attestations and Work Items each record the Participant row. Events record the actor of every hop. getParticipantHomeView returns a master's own engagements.<br>Gap:<br>No page or API returns the history of a Participant. History is only reachable per Deliverable or per SEU.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants are transient and knowledge remains permanent.<br>Ref: §4, PM-003</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/knowledge_items_schema_recovery.sql:6<br>src/dblayer/recovery/knowledge_items_schema_recovery.sql:27<br>src/dblayer/recovery/participants_schema_recovery.sql:3-11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>knowledge_items.deliverable_id is NOT NULL, so knowledge belongs to a Deliverable. author_id references the authoring Participant row for attribution only. The participants table has no knowledge column.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants are replaceable.<br>Ref: PM-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:185-216<br>src/routes/seu/core/capabilities.ts:123-183<br>src/routes/seu/web/seus.ts:200-220<br>src/routes/seu/web/seus.ts:250-272</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>releaseParticipants moves each Participant to Released and Archived, revokes its fulfilment and marks the SEU Capability unfulfilled. The SEU page then offers the eligible masters again and fulfilRequestedCapability fulfils with the new pick.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants fulfil Capabilities and do not own them.<br>Ref: PM-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/capability_fulfilments_schema_recovery.sql:3-10<br>src/dblayer/capabilityFulfilmentsDB.ts:82-93</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The SEU Capability is its own record. The fulfilment row is a link with revoked_at, so a Participant can be removed without changing the Capability.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants remain independent of AI technologies.<br>Ref: PM-006</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:16-49<br>src/routes/seu/core/participants.ts:53-80<br>src/adapters/participantAdapter.ts:25-28</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The lifecycle service does not refer to any AI technology. Delivery of an assignment goes through the ParticipantAdapter interface.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Participant has a globally unique identifier.<br>Ref: FR-13.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/participants_schema_recovery.sql:4<br>src/dblayer/recovery/participants_master_schema_recovery.sql:4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Both tables use a UUID primary key with gen_random_uuid().</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Participant belongs to exactly one active SEU.<br>Ref: FR-13.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/participants_schema_recovery.sql:5<br>src/routes/seu/core/capabilities.ts:22-31<br>src/routes/seu/core/participants.ts:16-35</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>participants.seu_id is NOT NULL with a foreign key, so a Participant belongs to one SEU.<br>Gap:<br>loadContext and createParticipant do not check that the SEU is active. A Participant can be created for an SEU in any state.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants may fulfil multiple Capabilities.<br>Ref: FR-13.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:57-97<br>src/dblayer/capabilityFulfilmentsDB.ts:53-62<br>src/dblayer/recovery/participants_master_schema_recovery.sql:8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A master can list many Capability codes and be recruited for several Capabilities of one SEU.<br>Gap:<br>fulfilOne creates a new participants row for every fulfilment. Each row has its own state and exactly one active fulfilment (findActiveByParticipantId returns one row). The runtime Participant fulfils one Capability.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Multiple Participants may jointly fulfil one Capability.<br>Ref: FR-13.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:149-153<br>src/domain/engine/executionEngine.ts:359-377</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>With more than one pick, each master gets a participants row and a fulfilment with strategy Composite. findActiveManyBySeuCapabilityId returns all of them and the dispatch pool holds all their ids.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants support replacement.<br>Ref: FR-13.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:91-147<br>src/routes/seu/web/seus.ts:222-248<br>src/dblayer/seed/data/routeAuthority.json:1770-1790<br>src/domain/engine/dispatchStrategies.ts:12-22</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>replaceParticipant releases and archives the old Participant, creates the new one, revokes the old fulfilment, creates a new one and publishes ParticipantReplaced.<br>Gap:<br>The web route passes no participantMasterId, so the new row has participant_id null. loadAvailableCandidates skips such a row, so it can never be dispatched. No view posts to the replace route. The fulfil, replace and release route authority entries require no badge and no role.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Replacement preserves engineering continuity.<br>Ref: FR-13.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:91-147<br>src/routes/seu/core/workItems.ts:107-116<br>src/dblayer/seed/data/transitionDefinitions.json:1011-1130</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Replacement touches only Participant and fulfilment rows. Deliverables, knowledge, decisions and evidence are keyed to Deliverables and the SEU and are unchanged.<br>Gap:<br>An in-flight Work Item stays assigned to the archived Participant. When it completes, the hop to Idle finds no Archived to Idle row, applyParticipantHop returns not ok and completeWorkItem throws. replaceParticipant never reassigns the Work Item.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participant activities remain fully traceable.<br>Ref: FR-13.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:53-80<br>src/domain/engine/entityTransition.ts:24-93<br>src/routes/seu/core/traceability.ts:71-76<br>src/routes/seu/core/traceability.ts:100-124<br>src/dblayer/recovery/evidence_schema_recovery.sql:32</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Every hop is a governed transition that records the actor and badge and publishes the row's event and ParticipantTransitioned. Deliverable provenance shows the Participant name and type.<br>Gap:<br>Executing is never recorded, so the start of execution is not traceable. evidence_schema_recovery.sql drops originating_participant_id, so Evidence no longer records its Participant directly.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform recognises four Participant Types: AI, Human, External and Automated.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/ontologyConcepts.json:4395-4429<br>src/routes/seu/core/participantsMaster.ts:20<br>src/routes/seu/core/participants.ts:113</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The four codes are seeded in the participant-types concept set. createParticipantMaster and replaceParticipant check the type against it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each Participant Type is supported by its own execution mechanism.<br>Ref: §7, §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:657<br>src/adapters/adapterRegistry.ts:5-16<br>src/adapters/executionTargetResolver.ts:11-19<br>src/dblayer/seed/seedParticipantsMaster.ts:113</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Assignments are delivered through an adapter chosen by execution mode: human-on-ui or external-orchestrator. The mode is resolved per tenant and Capability. Onboarding adapters per type exist for seed data.<br>Gap:<br>The mode does not depend on the Participant type. An unknown mode falls back to the human-on-UI adapter. No adapter exists for AI or Automated Participants at runtime.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Participant maintains Participant Identifier, Type, Display Name, SEU Identifier and Current State.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/participants_schema_recovery.sql:3-11<br>src/dblayer/seuTypes.ts:413-422</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>id, type, display_name, seu_id and state are columns of participants.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Participant maintains Assigned Capabilities, Engineering Context, Authority Context and Behaviour Context.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/participants_master_schema_recovery.sql:8-20<br>src/dblayer/recovery/capability_fulfilments_schema_recovery.sql:3-10<br>src/routes/seu/core/participantHome.ts:23-63</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Authority (authorised_role, authorised_badges) and Behaviour (behaviour_context) are held on participants_master. Capabilities are held through fulfilments. Engineering Context is derived for the home page.<br>Gap:<br>The participants row stores none of these. They are not held as one identity record per Participant.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Identity remains stable throughout the lifecycle.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/participantsDB.ts:71-82</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The only update to a participants row after creation is state and updated_at.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The lifecycle is Created, Available, Assigned, Executing, Idle, Released, Archived.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1011-1130<br>src/dblayer/recovery/participants_schema_recovery.sql:8-9<br>src/dblayer/participantsDB.ts:8-26</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The CHECK constraint lists the seven states. Transition rows exist for every step. Early Released rows exist from Available, Assigned and Executing.<br>Gap:<br>The birth row goes from None to Available, so no Participant is ever Created. The Created to Available row (event ParticipantActivated) is unreachable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Participant moves to Executing while it performs a Work Item.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1053-1062<br>src/routes/seu/core/workItems.ts:43-52<br>src/routes/seu/core/workItems.ts:107-116</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>The Assigned to Executing row is seeded but no code requests it. Both completion paths hop Assigned directly to Idle through the Assigned to Idle row. The Executing state and the ParticipantExecuting event are never reached.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants may transition repeatedly between Assigned, Executing and Idle.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1073-1082<br>src/domain/engine/dispatchStrategies.ts:12-22<br>src/domain/engine/dispatchEngine.ts:125-132</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Idle to Assigned is a row and loadAvailableCandidates accepts Available and Idle Participants, so a Participant is reused for later Work Items.<br>Gap:<br>The cycle runs Assigned to Idle only. Executing is not part of it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants are released and archived.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1083-1130<br>src/routes/seu/core/capabilities.ts:185-216<br>src/routes/seu/core/participants.ts:91-147</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Idle, Available, Assigned and Executing can go to Released and Released to Archived. releaseParticipants and replaceParticipant apply both hops.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Participant becomes eligible for a Capability only through Capability Fulfilment.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:359-377<br>src/domain/engine/dispatchEngine.ts:80-88</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The dispatch pool is built from capability_fulfilments and dispatchEngine reads candidates from that pool only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Participant is assigned to a Deliverable or Work Item only through the Dispatch Engine, which selects among eligible Participants.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dispatchEngine.ts:105-134<br>src/dblayer/workItemsDB.ts:19-30</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>workItemsDB.assign has one caller, dispatchEngine.dispatch. selectParticipant picks from the available candidates by the configured strategies.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Assignment establishes relationships between Participant, Capability, Deliverable and EBM.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dispatchEngine.ts:112-134<br>src/dblayer/recovery/commands_schema_recovery.sql:22<br>src/dblayer/recovery/work_items_schema_recovery.sql:6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The Work Item holds participant_id and its Command names the Deliverable and the pool of the producing Capability.<br>Gap:<br>Neither the Command nor the Work Item records the EBM. The EBM link is only reachable through the SEU.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Assignment does not modify the Participant definition.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/participantsDB.ts:71-82<br>src/domain/engine/dispatchEngine.ts:125-132</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The assignment hop changes state only. type, display_name and the master reference stay as created.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants collaborate when multiple Capabilities contribute to a Deliverable.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:359-377<br>src/domain/engine/dispatchEngine.ts:80-134<br>src/routes/seu/core/traceability.ts:100-124</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Each Command carries one producing Capability and its pool. Several Participants contribute to a Deliverable through successive Commands and Work Items, and the provenance lists each Participant.<br>Gap:<br>No construct records that Participants of several Capabilities work on one Deliverable together.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform preserves collaboration history, decisions, evidence and traceability.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/decisions_schema_recovery.sql:27<br>src/dblayer/recovery/deliverable_references_schema_recovery.sql:8<br>src/dblayer/recovery/attestations_schema_recovery.sql:8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Decisions, references and attestations persist with their Participant.<br>Gap:<br>No collaboration record exists. The collaboration history is the union of those tables.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants maintain runtime availability.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/participants_schema_recovery.sql:8-9<br>src/domain/engine/dispatchStrategies.ts:12-22</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>state is the availability. Dispatch treats only Available and Idle Participants with a master reference as candidates.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants maintain assigned Deliverables, current Work Items and execution history.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participantHome.ts:23-47<br>src/dblayer/recovery/work_items_schema_recovery.sql:6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The assigned Deliverables and current Work Items are derived from work_items.participant_id and the Commands. Events record execution.<br>Gap:<br>They are not stored as state of the Participant. Only the home page of a master derives them.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants maintain pending decisions and outstanding obligations.<br>Ref: §12, §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participantHome.ts:35<br>src/routes/seu/core/participantHome.ts:42-43</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The home page lists Obligations on the Participant's Deliverables and Decisions whose badge the master holds.<br>Gap:<br>Pending decisions are matched by held badge, not by the Participant. No store of pending decisions per Participant exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Runtime state contains no permanent engineering knowledge.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/participants_schema_recovery.sql:3-11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The participants row holds identity and state only. Knowledge sits in knowledge_items.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform permits replacement of any Participant.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:99-104<br>src/routes/seu/core/capabilities.ts:185-216</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>replaceParticipant and releaseParticipants work for any Participant that has an active fulfilment.<br>Gap:<br>replaceParticipant returns no_active_fulfilment for a Participant without one. A Participant created outside a fulfilment cannot be replaced.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Replacement preserves Deliverable state, Knowledge, Decisions, Evidence, Traceability and Outstanding Obligations.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:106-147<br>src/dblayer/recovery/knowledge_items_schema_recovery.sql:6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Replacement writes only Participant and fulfilment rows and publishes ParticipantReplaced with the old and new ids. Knowledge, Deliverables, Decisions, Evidence and Obligations are keyed to Deliverables and the SEU.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Replacement does not require recommissioning of the SEU.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:91-147</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>replaceParticipant does not call the commissioning functions and does not change the SEU state.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Engineering, Capability, Knowledge and Obligation Contexts are available to a Participant.<br>Ref: §14, §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participantHome.ts:23-63<br>src/adapters/participantAdapter.ts:3-12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The home page scopes Deliverables, Commands, Obligations, Evidence and Knowledge Items to the Participant's Work Items. An adapter receives the Deliverable, transition, targets and input references.<br>Gap:<br>The scoped view omits the Capability list. The adapter assignment carries no Knowledge or Obligation Context.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Behaviour and Authority Contexts are available to a Participant.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participantHome.ts:23-63<br>src/domain/engine/badgeAuthorityEngine.ts:16-25<br>src/dblayer/recovery/participants_master_schema_recovery.sql:17-20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The scoped view carries the SEU row with active_ebm_id. getHeldBadges returns the unexpired authorised_badges of the master.<br>Gap:<br>getHeldBadges ignores seu_ids, so the Authority Context is not specific to the SEU or the stage. The EBM is not delivered to the Participant.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Contexts define the environment without embedding permanent knowledge in the Participant.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participantHome.ts:23-63<br>src/dblayer/recovery/participants_schema_recovery.sql:3-11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The contexts are computed from other tables on read. Nothing is stored on the participants row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authoritative engineering knowledge is stored only in the Knowledge Repository.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/knowledge_items_schema_recovery.sql:6<br>src/routes/seu/core/knowledge.ts:20-82</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Knowledge items are written to knowledge_items by the Knowledge routes. Neither Participant table has a memory or knowledge column.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participant memory is ephemeral and can be discarded on replacement without loss.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:91-147<br>src/dblayer/recovery/participants_schema_recovery.sql:3-11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The platform persists no Participant memory. Replacement creates a new Participant row and archives the old one.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ParticipantCreated is published when a Participant is created.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:24-46<br>src/dblayer/seed/data/transitionDefinitions.json:1011-1020</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>createParticipant publishes the event named by the birth row as its last statement, with the real actor and badge.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ParticipantAssigned is published on assignment.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1043-1052<br>src/dblayer/seed/data/transitionDefinitions.json:1073-1082<br>src/domain/engine/dispatchEngine.ts:125-132<br>src/routes/seu/core/participants.ts:67</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The Available to Assigned and Idle to Assigned rows name the event. publishTransition publishes it with the Work Item id in the payload.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ParticipantReleased is published on release.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1083-1092<br>src/dblayer/seed/data/transitionDefinitions.json:1103-1130<br>src/routes/seu/core/capabilities.ts:204-207</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Each Released row names the event and releaseParticipants and replaceParticipant apply the hop.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ParticipantActivated is published when a Participant becomes active.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1033-1042<br>src/dblayer/seed/data/transitionDefinitions.json:1011-1020</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>The event is named only by the Created to Available row. No Participant is ever Created, so the event is never published.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ParticipantIdle is published when a Participant becomes idle.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1023-1032<br>src/dblayer/seed/data/transitionDefinitions.json:1063-1072<br>src/routes/seu/core/workItems.ts:43-52<br>src/routes/seu/core/workItems.ts:107-116</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Work Item completion and failure hop the Participant to Idle and the row's event is published.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ParticipantReplaced is published on replacement.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:135-144</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>replaceParticipant publishes ParticipantReplaced with the old and new Participant ids and the Capability.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ParticipantArchived is published on archiving.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1093-1102<br>src/routes/seu/core/participants.ts:110</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The Released to Archived row names the event and both release and replace apply the hop.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ParticipantUnavailable is published when a Participant is unavailable.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dispatchEngine.ts:23-59<br>src/domain/engine/dispatchEngine.ts:105-109<br>src/dblayer/seed/data/eventSubscriptions.json:40</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The event is registered and the Dispatch Engine publishes it when strategy filtering leaves no candidate.<br>Gap:<br>It is published against a Work Item as a dispatch rejection. No event is published when a Participant itself becomes unavailable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participant events are registered event types.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/eventSubscriptions.json:30<br>src/dblayer/seed/data/eventSubscriptions.json:40<br>src/dblayer/recovery/event_registry_schema_recovery.sql:3-12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>ParticipantTransitioned and ParticipantUnavailable are registered in event_registry.<br>Gap:<br>ParticipantCreated, ParticipantAssigned, ParticipantReleased, ParticipantActivated, ParticipantIdle, ParticipantReplaced, ParticipantArchived and ParticipantExecuting are published but not registered. A subscriber cannot be seeded for them.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Participant subsystem supports concurrent Participants.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dispatchStrategies.ts:12-22<br>src/domain/engine/dispatchEngine.ts:112-132</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Participants are separate rows and the hop guard has no Assigned to Assigned row, so a second assignment of a busy Participant is rejected.<br>Gap:<br>dispatch assigns the Work Item (workItemsDB.assign) before the Participant hop. When the hop is rejected the Work Item stays assigned and dispatch throws.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Participant subsystem supports heterogeneous Participant implementations.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:657<br>src/adapters/adapterRegistry.ts:5-16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Two delivery adapters are registered and new ones can be added by mode.<br>Gap:<br>See the Participant Type row. Only human-on-ui and external-orchestrator exist.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Participant subsystem supports dynamic replacement.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:91-147<br>src/routes/seu/core/capabilities.ts:185-216</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Release and fulfil work on a running SEU.<br>Gap:<br>In-flight Work Items are not handed over.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Participant subsystem preserves continuity and maintains complete traceability.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:91-147<br>src/routes/seu/core/participants.ts:53-80</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Governed hops with actors, events and persisted Deliverable data.<br>Gap:<br>Same gaps as FR-13.6 and FR-13.7.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants possess unique identities.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/participants_schema_recovery.sql:4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>UUID primary key per participants row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants can fulfil multiple Capabilities.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:57-97</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>One master can be recruited for several Capabilities.<br>Gap:<br>Each recruitment is a separate participants row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Multiple Participants can collaborate on a Deliverable.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dispatchEngine.ts:80-134</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Several Participants work on a Deliverable through successive Work Items.<br>Gap:<br>No collaboration construct exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants can be replaced without affecting engineering continuity.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:91-147<br>src/routes/seu/core/workItems.ts:107-116</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Deliverable, knowledge and decision data is unchanged by replacement.<br>Gap:<br>In-flight Work Items are not reassigned and fail at completion.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participant history remains traceable.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:53-80<br>src/routes/seu/core/traceability.ts:100-124</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Hops and Deliverable provenance are recorded.<br>Gap:<br>No per-Participant history view and no Executing record.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participant memory remains transient.<br>Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/participants_schema_recovery.sql:3-11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>No Participant memory is persisted.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participant domain model.<br>Ref: §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:410-440<br>src/dblayer/recovery/participants_schema_recovery.sql:3-24<br>src/dblayer/recovery/participants_master_schema_recovery.sql:3-24</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>ParticipantRow, ParticipantMasterRow and both tables.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participant lifecycle service.<br>Ref: §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:16-84<br>src/dblayer/seed/data/transitionDefinitions.json:1011-1130</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>createParticipant, applyParticipantHop and transitionParticipant apply governed hops.<br>Gap:<br>Created and Executing are never reached.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participant registry.<br>Ref: §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/participants_master_schema_recovery.sql:3-15<br>src/routes/seu/web/participantRegistry.ts:18-55<br>src/dblayer/seed/data/routeAuthority.json:1291-1299</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>participants_master is the tenant registry. GET /participants lists it sorted and paginated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participant assignment interfaces.<br>Ref: §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:99-118<br>src/routes/seu/web/seus.ts:200-220<br>src/domain/engine/dispatchEngine.ts:62-160</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>requestCapabilityFulfilment and the SEU page fulfil route establish eligibility. dispatchEngine.dispatch assigns.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participant context model.<br>Ref: §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participantHome.ts:23-63</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A derived scoped view exists for a master's home page.<br>Gap:<br>See the context rows in §14.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participant state management.<br>Ref: §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/participantsDB.ts:71-82<br>src/routes/seu/core/participants.ts:53-80</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>State is stored and changed only through governed hops.<br>Gap:<br>Only lifecycle state is stored. Assigned Deliverables and Work Items are derived.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participant APIs.<br>Ref: §19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/index.ts:27-46</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>src/routes/seu/api has no Participant route file and src/routes/seu/api/index.ts mounts no Participant router. The only Participant routes are web routes (GET /participants, fulfil, replace, release). Replace and release are not reachable through any API.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participant events.<br>Ref: §19, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1011-1130<br>src/dblayer/seed/data/eventSubscriptions.json:30<br>src/dblayer/seed/data/eventSubscriptions.json:40</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Seven of the eight listed events are published.<br>Gap:<br>ParticipantActivated is never published, and most Participant events are not registered.</td>
    </tr>
  </tbody>
</table>

## Summary

- Total intents analysed: 73
- Fully met ✅: 37
- Partially met ⚠️: 33
- Not met ❌: 3
- Not verifiable ❓: 0

### Major implementation gaps

- Created and Executing are never entered. The birth row goes to Available and completion hops Assigned straight to Idle. ParticipantActivated is never published.
- A Participant row fulfils one Capability. Multi-Capability fulfilment exists only at the master level.
- Replacement does not hand over in-flight Work Items. The web replace route passes no master id, so the replacement can never be dispatched, and no view posts to it.
- Eight Participant lifecycle events are published but not registered in the event registry.
- ParticipantUnavailable is a dispatch rejection against a Work Item, not a Participant event.
- No Participant API exists, and no per-Participant history view.
- Participant context is a derived home-page view for a human master. Authority ignores seu_ids and the EBM is not delivered.
- Only human-on-ui and external-orchestrator delivery adapters exist, chosen by Capability and not by Participant type.
