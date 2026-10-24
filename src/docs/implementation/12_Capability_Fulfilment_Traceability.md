# Implementation Traceability: Chapter 12 – Capability Fulfilment

**Date of report: 23-10-2026**

Specification: src/docs/SEU Studio Specifications/02_SEU Composition/12_Capability Fulfilment.md

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability Fulfilment satisfies the Capabilities an SEU needs to achieve its Deliverables.<br>Ref: §1, §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:249<br>src/domain/engine/capabilityOnReady.ts:14-49<br>src/routes/seu/core/capabilities.ts:57-97</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Commissioning creates one seu_capabilities row per Capability the Templates require. A ready Deliverable requests its producing Capability. The request creates a Participant and a capability_fulfilments row and marks the SEU Capability Fulfilled.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability Fulfilment identifies eligible Participants and does not recruit or bind them to work.<br>Ref: §1, §2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:33-38<br>src/routes/seu/core/capabilities.ts:123-153<br>src/routes/seu/core/participantEligibility.ts:47-62</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The request builds an eligible pool from the tenant Participant registry. It registers fulfilments for the pool or for the named picks. Choosing the executing Participant is left to dispatch.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants are one mechanism for fulfilling a Capability. Fulfilment is independent of how a Participant is implemented.<br>Ref: §1, CF-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:42-55<br>src/dblayer/participantsMasterDB.ts:177-190</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The eligible pool is read from participants_master by tenant, active flag and the Capability code in the capabilities array. Nothing in fulfilment branches on implementation or provider.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability Fulfilment does not choose the Participant for a specific Work Item. Dispatch consumes the pool.<br>Ref: §2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:359-377<br>src/domain/engine/dispatchEngine.ts:80-107</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The execution engine snapshots the active fulfilments into capability_fulfilment_pools for the Command. dispatchEngine reads that pool and selects the candidate.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfilment is a runtime process and can change during the SEU lifetime without changing the EBM or Capability definitions.<br>Ref: §4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:57-97<br>src/routes/seu/core/capabilities.ts:185-217</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Fulfilment and release write only capability_fulfilments, participants and seu_capabilities.status. Neither touches capabilities or ebms rows.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capabilities are permanent and Participants are replaceable.<br>Ref: CF-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/seu_capabilities_schema_recovery.sql:3-9<br>src/dblayer/recovery/capability_fulfilments_schema_recovery.sql:3-11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>seu_capabilities is created at commissioning and only its status changes. Participants are linked through revocable capability_fulfilments rows (revoked_at).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfilment supports AI, human and external Participants equally.<br>Ref: CF-003, §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:40-55<br>src/dblayer/capabilityFulfilmentsDB.ts:6-25</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>fulfilOne passes the master type through for every type. The eligibility filter and the fulfilment insert have no type branch.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfilment preserves engineering continuity when Participants change.<br>Ref: CF-004, FR-12.6, §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:91-147<br>src/routes/seu/core/capabilities.ts:185-217</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Deliverable state, Knowledge and Decisions are held on other tables keyed by SEU, so a Participant row change does not remove them. Replacement revokes the old fulfilment and creates a new one in the same call.<br>Gap:<br>Nothing hands over or re-offers in-flight Work Items and Commands of the released Participant. No Obligation transfer is performed. Continuity is not verified or evented.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every fulfilment decision is traceable.<br>Ref: CF-005, FR-12.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/capability_fulfilments_schema_recovery.sql:3-14<br>src/dblayer/recovery/capability_fulfilment_pools_schema_recovery.sql:3-13<br>src/domain/engine/executionEngine.ts:359-392</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Each fulfilment row has author_id, author_badge, established_at and revoked_at. Each Command records the pool of Participants it was dispatched from.<br>Gap:<br>The row does not record which selection criteria or policies admitted the Participant, and not the request event. Evaluation reasons for excluded Participants are not stored.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The platform determines the Capabilities required to progress a Deliverable.<br>Ref: FR-12.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/capabilityOnReady.ts:14-49</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>capabilityOnReady takes the producing Capability of each Deliverable that is ready for In Progress. It requests only those SEU Capabilities that are Unfulfilled and have no request in flight.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfilment identifies one or more suitable Participants.<br>Ref: FR-12.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:129-132<br>src/routes/seu/core/participantEligibility.ts:47-62</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A named pick is validated against the eligible pool. With no pick, the whole pool is used. An empty result takes the unavailable path.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Multiple Participants may jointly fulfil a Capability.<br>Ref: FR-12.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:149-153<br>src/dblayer/capabilityFulfilmentsDB.ts:40-51</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>With more than one Participant each gets its own fulfilment row. The strategy is Composite. The schema allows many active rows per SEU Capability.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">One Participant may fulfil multiple Capabilities.<br>Ref: FR-12.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:57-97<br>src/dblayer/capabilityFulfilmentsDB.ts:53-64<br>src/dblayer/recovery/participants_schema_recovery.sql:3-20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>One master Participant can be fulfilled against many Capabilities. participants has no uniqueness on participant_id.<br>Gap:<br>fulfilOne creates a new participants row per fulfilment, so a runtime Participant fulfils exactly one Capability. findActiveByParticipantId returns one fulfilment per runtime Participant.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfilment supports dynamic reassignment.<br>Ref: FR-12.5, §10, §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:91-147<br>src/routes/seu/core/capabilities.ts:185-217<br>src/routes/seu/web/seus.ts:222-272</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>replaceParticipant releases and archives the old Participant, creates the new one, revokes the old fulfilment and creates a new one. releaseParticipants plus a fresh fulfil request also works from the UI.<br>Gap:<br>The web replace route passes no master id, so the replacement has no participant_id and cannot be dispatched. replaceParticipant takes a free type and display name and runs no eligibility check on the replacement. releaseParticipants marks the Capability Unfulfilled even when other active fulfilments remain (line 215). No API route exists for either path. No reassignment is started by availability changes.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The strategies AI, Human and External are supported.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:78<br>src/dblayer/recovery/capability_fulfilments_schema_recovery.sql:5-8<br>src/dblayer/seuTypes.ts:441</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>fulfilment_strategy defaults to the Participant type. The strategy check constraint is dropped. The stored value is the master type, Hybrid or Composite.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Hybrid strategy lets an AI and a Human jointly fulfil a Capability.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:441<br>src/routes/seu/core/capabilities.ts:149</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Hybrid is a legal FulfilmentStrategy value and joint fulfilment is possible.<br>Gap:<br>No code assigns Hybrid. A mix of types is labelled Composite like any group of two or more picks.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Composite strategy covers multiple coordinated Participants.<br>Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:149-153</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>More than one Participant for a request sets strategy Composite on every fulfilment row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Selection evaluates capability compatibility.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/participantsMasterDB.ts:177-190<br>src/routes/seu/core/participantEligibility.ts:47-52</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The pool is filtered on the Capability code in the master capabilities array.<br>Gap:<br>Matching is by Capability code only. No Capability Version is considered.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Selection evaluates behavioural compatibility with the EBM.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participantEligibility.ts:17-22<br>src/routes/seu/core/participantEligibility.ts:40-45</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Competency requirements stored on the active EBM are matched against the master competency by dimension.<br>Gap:<br>Other EBM behaviours are not evaluated. An SEU with no active EBM matches on no competency requirement.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Selection evaluates required knowledge.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participantEligibility.ts:17-22</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Competency codes are matched per dimension.<br>Gap:<br>Proficiency is not compared. Knowledge items held in the Knowledge Repository are not used.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Selection evaluates required authority.<br>Ref: §8, §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participantEligibility.ts:47-62</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>findEligibleParticipants does not read authorised_role or authorised_badges from the master. A Participant who lacks the authority for the Capability is still admitted.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Selection evaluates availability.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/participantsMasterDB.ts:177-190<br>src/dblayer/capabilityFulfilmentsDB.ts:66-80</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Only active masters are returned. Masters whose earlier fulfilment of the same SEU Capability was revoked are excluded.<br>Gap:<br>Availability means the is_active flag only. Workload, runtime Participant state and degraded status are not evaluated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Selection evaluates engineering constraints.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participantEligibility.ts:24-38</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Eligibility Policies from the composed Packs are evaluated against the master behaviour context.<br>Gap:<br>Only Policies with scope Eligibility apply. No other engineering constraints are evaluated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Selection evaluates Pack-specific requirements.<br>Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participantEligibility.ts:32-38<br>src/routes/seu/core/capabilities.ts:33-38</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The SEU's composed Packs are unravelled and the Eligibility Policies they contribute must pass for each candidate.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Registering eligibility creates a runtime link between the Capability, the Participant and the EBM.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:57-97<br>src/dblayer/recovery/capability_fulfilments_schema_recovery.sql:3-14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The link row holds the SEU Capability and the Participant.<br>Gap:<br>The row has no EBM reference. The EBM is reachable only through the SEU active_ebm_id, so the link does not record which EBM was active when it was made.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Eligibility registration does not bind the Participant to a Deliverable or Work Item.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:57-97<br>src/domain/engine/dispatchEngine.ts:80-107</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The fulfilment row has no Deliverable or Work Item reference. Binding is done in dispatch, which assigns the Work Item to one candidate. With no pick, every eligible master is registered as a candidate.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Eligibility registration does not modify the Capability definition.<br>Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:57-97</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>fulfilOne writes participants, capability_fulfilments and seu_capabilities.status only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants may be replaced during execution for reasons such as upgrade or unavailability.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:91-147<br>src/routes/seu/web/seus.ts:222-272</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Replacement and release exist as service functions and as web routes.<br>Gap:<br>Replacement can only be started by a person and it runs no eligibility check on the replacement. No path replaces a Participant on a detected unavailability. The web replace route yields an undispatchable Participant.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Reassignment preserves Deliverable state, Knowledge, Traceability and engineering history.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:91-147<br>src/dblayer/capabilityFulfilmentsDB.ts:82-93</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The old fulfilment is revoked and kept. Deliverable and knowledge rows are untouched. The old Participant is kept as Archived.<br>Gap:<br>Outstanding Obligations and open Work Items are not carried to the replacement.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Reassignment preserves Outstanding Obligations.<br>Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:91-147</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>replaceParticipant does not read or change Obligations, so Obligations on the Deliverable or SEU stay as they were.<br>Gap:<br>No check or hand-over exists for Obligations that name the replaced Participant.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfilment monitors available, unavailable, degraded and newly available Participants.<br>Ref: §11, §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilityRetrySweep.ts:18-69<br>src/routes/seu/api/workItems.ts:61-70<br>src/dblayer/recovery/participants_schema_recovery.sql:8-9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A sweep re-requests Capabilities whose last request was CapabilityUnavailable after the retry delay. It is started by an API call.<br>Gap:<br>No continuous monitor exists. Degraded Participants are not modelled; the Participant state check has no such state. Newly available Participants do not trigger anything unless the sweep is called.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Availability changes may trigger re-evaluation by the Dependency Engine.<br>Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:84-94<br>src/domain/engine/deliverableKickoff.ts:74-84<br>src/routes/seu/core/capabilities.ts:185-217</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Fulfilling a Capability evaluates Dependency rows for the Services it fulfils. CapabilityFulfilled re-issues the producing Command.<br>Gap:<br>releaseParticipants marks the Capability Unfulfilled and triggers no re-evaluation. A Participant going unavailable triggers nothing.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability continuity is maintained through the Knowledge Repository, Deliverable state, traceability, EBM and Decision history.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:185-217<br>src/routes/seu/core/participants.ts:91-147<br>src/dblayer/recovery/knowledge_items_schema_recovery.sql:5<br>src/dblayer/recovery/decisions_schema_recovery.sql:5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>These records are keyed by SEU and stay when Participants change. Participants hold no knowledge store of their own.<br>Gap:<br>No continuity service exists. Nothing checks that Knowledge and Decisions are still reachable by the replacement.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants are not the primary repository of engineering knowledge.<br>Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/participants_schema_recovery.sql:3-20</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The participants table holds identity, type, state and the master link only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfilment detects when no suitable Participant exists.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:134-147<br>src/domain/engine/deliverableKickoff.ts:58-72</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>An empty pool publishes CapabilityUnavailable. For an In Progress Deliverable the handler creates a blocking Obligation and an Action Required Attention Item.<br>Gap:<br>Detection happens only when a request is made. A Capability needed by a Deliverable that has not yet reached In Progress is not checked.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfilment detects when required authority cannot be satisfied.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participantEligibility.ts:47-62</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>Authority is not evaluated in selection, so the case where the pool has no Participant with the required authority is never detected. A pool of unauthorised Participants counts as available.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfilment detects when Pack constraints cannot be met.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participantEligibility.ts:32-38<br>src/routes/seu/core/capabilities.ts:134-147</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Eligibility Policies from Packs filter the pool, so an unsatisfiable set gives an empty pool and CapabilityUnavailable.<br>Gap:<br>The event does not state that a Pack constraint was the reason.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfilment detects when mandatory capabilities are unavailable.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/seu_capabilities_schema_recovery.sql:3-9<br>src/routes/seu/core/capabilities.ts:134-147</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Every required Capability is an seu_capabilities row, and an unfulfilled one takes the unavailable path when requested.<br>Gap:<br>Mandatory is not distinguished from other Capabilities. Apart from the request handlers, only the SEU view and telemetry read the Fulfilled status, so nothing gates commissioning or Operational on it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Failures generate engineering obligations.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/deliverableKickoff.ts:198-232<br>src/routes/seu/core/capabilityRetrySweep.ts:37-47</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>A blocking Obligation is created for an In Progress Deliverable. The sweep raises an Escalation Attention Item at the threshold.<br>Gap:<br>No Obligation is created for a Capability without an In Progress Deliverable. At the retry limit the sweep only lists the Capability as exhausted.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissioning or execution may be suspended depending on the affected Deliverables.<br>Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/deliverableKickoff.ts:198-232<br>src/domain/engine/deliverableKickoff.ts:165-180</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The Deliverable stays held by a blocking Obligation and its producing Command is not re-issued while the Obligation is open.<br>Gap:<br>Only the affected Deliverable is held. Commissioning is not suspended.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CapabilityRequested is published.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:99-118<br>src/dblayer/seed/data/eventSubscriptions.json:24<br>src/dblayer/seed/data/eventSubscriptions.json:57</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Published by requestCapabilityFulfilment with a real actor and badge. Registered and handled by capabilityRequested.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CapabilityFulfilmentStarted is published.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:123-153</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No event of this name exists in any .ts or .json file under src. Fulfilment goes from CapabilityRequested straight to creating rows.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CapabilityFulfilled is published.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:172-182<br>src/dblayer/seed/data/eventSubscriptions.json:26<br>src/dblayer/seed/data/eventSubscriptions.json:60</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Published once per request as the last statement with the Participant ids. Registered. deliverableKickoff consumes it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CapabilityUnavailable is published.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:134-147<br>src/dblayer/seed/data/eventSubscriptions.json:25<br>src/dblayer/seed/data/eventSubscriptions.json:61</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Published for an empty pool. Registered. deliverableKickoff consumes it to block the Deliverable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ParticipantAssigned is published.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1044-1050<br>src/dblayer/seed/data/transitionDefinitions.json:1074-1080<br>src/domain/engine/dispatchEngine.ts:113-132</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The Available to Assigned and Idle to Assigned rows carry the event and dispatch hops through them.<br>Gap:<br>The event is published at dispatch of a Work Item, not when fulfilment registers the Participant. It is not in the event registry.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ParticipantReleased is published.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:1084-1090<br>src/routes/seu/core/capabilities.ts:204-209<br>src/routes/seu/core/participants.ts:53-80</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The Released rows carry the event and release goes through them.<br>Gap:<br>The event is not in the event registry and has no subscriber.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ParticipantReassigned is published.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:135-144</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>replaceParticipant publishes ParticipantReplaced with old and new Participant ids and the SEU Capability.<br>Gap:<br>The name differs from the specified one and the event is not in the event registry.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CapabilityContinuityMaintained is published.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:91-147</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No event of this name exists. Replacement ends with ParticipantReplaced.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CapabilityFulfilmentFailed is published.<br>Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:134-147</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No event of this name exists. CapabilityUnavailable is the only failure event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Concurrent fulfilment is supported.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/capabilityOnReady.ts:35-47<br>src/dblayer/recovery/capability_fulfilments_schema_recovery.sql:3-11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Separate Capabilities are requested independently and several fulfilment rows per Capability are allowed. A request still in flight prevents a second one.<br>Gap:<br>No uniqueness or lock stops two concurrent requests for the same Capability from both creating fulfilments.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfilment is independent of AI providers.<br>Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:33-55<br>src/routes/seu/core/participantEligibility.ts:47-62</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Eligibility reads masters and Policies only. No provider call or setting appears in fulfilment.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Required Capabilities are identified.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/capabilityOnReady.ts:14-49<br>src/routes/seu/core/commissioning.ts:249</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>seu_capabilities holds the Capabilities the Templates require, and Deliverables name the producing Capability.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Appropriate Participants are assigned.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:123-153<br>src/routes/seu/core/participantEligibility.ts:47-62</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Participants that pass code, competency and Policy checks are registered.<br>Gap:<br>Authority is not checked and with no pick every eligible master is registered.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants can be replaced without affecting Deliverables.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:91-147<br>src/routes/seu/web/seus.ts:222-272</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Deliverable rows are not changed by replacement or release.<br>Gap:<br>In-flight Work Items are not moved. The web replace route gives a non-dispatchable replacement.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability Fulfilment remains traceable.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/capability_fulfilments_schema_recovery.sql:3-14<br>src/dblayer/recovery/capability_fulfilment_pools_schema_recovery.sql:3-13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Fulfilment rows and pools are retained with actor and badge, and revoked rows are kept.<br>Gap:<br>The admission criteria and the request event are not recorded on the row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AI, human and external Participants are equally supported.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:40-55</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Same path for every type.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability continuity is preserved during reassignment.<br>Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:91-147</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The old fulfilment, Participant and events are kept and the new fulfilment is created in the same call.<br>Gap:<br>In-flight Work Items and Obligations are not handed over and continuity is not verified.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Capability Fulfilment service exists.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:99-183</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>requestCapabilityFulfilment and fulfilRequestedCapability, with the capabilityRequested handler.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Participant assignment service exists.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:16-49<br>src/routes/seu/core/capabilities.ts:185-217<br>src/domain/engine/dispatchEngine.ts:105-134</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>createParticipant, release and replace exist, and dispatch assigns.<br>Gap:<br>Replace runs no eligibility check and the web path produces a non-dispatchable Participant.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Capability continuity service exists.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:91-147</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>No service verifies or reports continuity. Continuity is a side effect of replaceParticipant.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A fulfilment registry exists.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/capability_fulfilments_schema_recovery.sql:3-14<br>src/routes/seu/core/seus.ts:296-322</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>capability_fulfilments holds the registry. The SEU detail view lists active Participants by type and the eligible pool for each Capability.<br>Gap:<br>The view reads active fulfilments only, so revoked fulfilments are not shown.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Assignment APIs exist.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/index.ts:27-46<br>src/dblayer/seed/data/routeAuthority.json:1770-1790</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Gap:<br>src/routes/seu/api mounts no Capability fulfilment router and no file there has a fulfil, replace or release route. Those exist only as web routes, and their route_authority rows have empty badges and roles.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability Fulfilment events exist.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/eventSubscriptions.json:24-26<br>src/dblayer/seed/data/eventSubscriptions.json:57-61</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>Three of the nine events are registered and published.<br>Gap:<br>Started, Continuity Maintained and Failed are never published. Reassigned is published as ParticipantReplaced. Assigned, Released and Replaced are unregistered.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Runtime monitoring services exist.<br>Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilityRetrySweep.ts:18-69</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Implemented:<br>The unavailable-Capability sweep.<br>Gap:<br>It runs only on an API call. No scheduler or monitor of Participant availability.</td>
    </tr>
  </tbody>
</table>

## Summary

- Total intents analysed: 64
- Fully met ✅: 23
- Partially met ⚠️: 34
- Not met ❌: 7
- Not verifiable ❓: 0

### Major implementation gaps

- Required authority is not part of selection or failure detection. Eligibility ignores authorised_role and authorised_badges.
- Four specified events are not published: CapabilityFulfilmentStarted, CapabilityContinuityMaintained, CapabilityFulfilmentFailed and ParticipantReassigned (published as ParticipantReplaced). Participant events are not registered.
- Reassignment does not move in-flight Work Items or Obligations. No continuity service exists.
- The web replace route passes no master id, so the replacement is never dispatchable.
- A runtime Participant fulfils one Capability. Hybrid is never assigned.
- No Assignment API exists. Fulfil, replace and release routes have empty badges and roles.
- Monitoring is a sweep started by an API call. Degraded Participants are not modelled and availability changes do not trigger re-evaluation.
- Failure Obligations exist only for an In Progress Deliverable. Commissioning is not suspended.
