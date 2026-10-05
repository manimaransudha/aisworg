# Chapter 13 – Participant Model: Implementation Traceability

**Date of report: 4-10-2026**

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Participant is the runtime entity that fulfils Capabilities within a commissioned SEU, under EBM governance<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/participantsDB.ts:20-34<br>src/routes/seu/core/capabilities.ts:74-143</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>participants</code> row is created per-SEU engagement via <code>fulfilOne</code>, always tied to a <code>seu_capability_id</code> through a <code>capability_fulfilments</code> row. EBM governance is enforced at transition time via <code>transitionEngine.evaluate</code> (participants.ts:45-54), not at creation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants may represent AI, human or external autonomous services, treated as equal architectural entities<br> Ref: §1 Purpose<br>§7 Participant Types</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:913<br>src/routes/seu/web/participantRegistry.ts:21</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>ParticipantType</code> is an open, Ontology-backed string (concept type <code>participant-types</code>), not a hardcoded union favoring one kind. Registry UI lists AI/Human/Automated/External uniformly, same row shape (<code>participants_master</code>) for all.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Scope: Participant abstraction, identity, lifecycle, assignment, replacement, collaboration, state are defined by this chapter<br> Ref: §2 Scope</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Scoping statement, reviewed for coverage below; no standalone finding.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants execute engineering work; they do not define engineering behaviour (architectural position)<br> Ref: §3 Architectural Position</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dispatchEngine.ts:160-230<br>src/routes/seu/core/participants.ts:38-81</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participant code only ever assigns/transitions a Participant and records events; no Participant code authors EBM behaviour (<code>ebmsDB</code>/behaviour authoring lives entirely outside this module).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Participant is a runtime instance capable of fulfilling one or more Capabilities, possessing identity, lifecycle, runtime state, assigned Capabilities and engineering history<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/participants_schema_recovery.sql:3-23<br>src/dblayer/seuTypes.ts:916-930</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>participants</code> row carries <code>id</code> (identity), <code>state</code> (lifecycle/runtime state), and is linked to assigned Capabilities via <code>capability_fulfilments.participant_id</code>. "Engineering history" is reconstructable via <code>events</code>/<code>commands</code>/<code>work_items</code> keyed by participant id, not a field on the row itself.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants are transient; Knowledge remains permanent<br> Ref: §4 Definition<br>§15 Participant Memory</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/participantsDB.ts (no memory/knowledge column)<br>src/dblayer/knowledgeItemsDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>participants</code>/<code>participants_master</code> carry no knowledge payload; <code>knowledgeItemsDB</code> is a wholly separate table keyed to Deliverables, not to a Participant. Replacement (§13) never copies or deletes knowledge. No explicit "transient working memory" construct exists in the schema (see §15 row below) — this half of the intent (permanence of Knowledge) is demonstrated; the Participant-side "transient" half has no explicit memory construct to evaluate against.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PM-001: Participants are replaceable<br> Ref: §5 PM-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:101-176</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>replaceParticipant</code> drives the old Participant through governed Released→Archived transitions, creates a new Participant row, and re-points the active <code>capability_fulfilments</code> row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PM-002: Participants possess identity<br> Ref: §5 PM-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/participants_schema_recovery.sql:4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>id UUID PRIMARY KEY</code>, stable for the row's lifetime; identity is never reassigned across replacement (replacement mints a new id).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PM-003: Participants shall not own engineering knowledge<br> Ref: §5 PM-003</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/knowledgeItemsDB.ts<br>src/routes/seu/core/participants.ts:96-100</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>knowledge_items</code> has no <code>participant_id</code> column; design comment in <code>replaceParticipant</code> explicitly confirms "none of those reference participant_id at all (PM-003, confirmed in the design doc's own review)."</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PM-004: Participants execute behaviour, they do not define behaviour<br> Ref: §5 PM-004</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dispatchEngine.ts:160-230</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participant code only consumes EBM-driven dispatch outcomes (assignment, state transition); no Participant-side code authors <code>transition_definitions</code>/EBM behaviour rows.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PM-005: Participants fulfil Capabilities, they do not own Capabilities<br> Ref: §5 PM-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/capabilityFulfilmentsDB.ts<br>src/routes/seu/core/capabilities.ts:91-98</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability ownership lives on <code>seu_capabilities</code>/<code>capabilities</code>; <code>capability_fulfilments</code> is a join row recording which Participant currently fulfils which <code>seu_capability_id</code>, revocable without altering the Capability itself.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">PM-006: Participants shall remain independent of AI technologies<br> Ref: §5 PM-006</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:913</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>ParticipantType</code> is a plain Ontology-backed string; no AI-technology-specific field, dependency, or import exists on <code>participants</code>/<code>participants_master</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-13.1: Every Participant shall possess a globally unique identifier<br> Ref: §6 FR-13.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/participants_schema_recovery.sql:4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>id UUID PRIMARY KEY DEFAULT gen_random_uuid()</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-13.2: Every Participant shall belong to exactly one active SEU<br> Ref: §6 FR-13.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/participants_schema_recovery.sql:5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>seu_id UUID NOT NULL REFERENCES seus(id)</code>; a Participant row is always scoped to exactly one SEU by schema constraint. No cross-SEU participant row exists — a given identity's presence in multiple SEUs is modeled as multiple distinct <code>participants</code> rows (one per SEU) linked to one shared <code>participants_master</code> identity.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-13.3: Participants may fulfil multiple Capabilities<br> Ref: §6 FR-13.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/capabilityFulfilmentsDB.ts<br>src/routes/seu/core/capabilities.ts:74-143</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>fulfilOne</code> is called once per (Participant, Capability) pair; nothing restricts a given <code>participants_master</code> identity, or a given lifecycle <code>participants</code> row's underlying identity, from being fulfilled against more than one Capability — each call creates its own <code>participants</code> engagement row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-13.4: Multiple Participants may jointly fulfil one Capability<br> Ref: §6 FR-13.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:185-204</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>fulfilCapabilityWithParticipants</code> creates one lifecycle Participant + one <code>capability_fulfilments</code> row per selected <code>participants_master</code> identity against the same <code>seu_capability_id</code>; <code>fulfilmentStrategy</code> becomes <code>"Composite"</code> when more than one is selected.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-13.5: Participants shall support replacement<br> Ref: §6 FR-13.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:101-176</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same as PM-001 above.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-13.6: Replacement shall preserve engineering continuity<br> Ref: §6 FR-13.6<br>§13 Participant Replacement</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:148-176</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>capability_fulfilments.revoke</code> ends the old row and a new row is created for the new Participant rather than mutating history in place, preserving <code>established_at</code>/<code>revoked_at</code> lineage. Deliverable/Knowledge/Decision/Evidence/Obligation rows carry no <code>participant_id</code> reference at all (confirmed PM-003 above), so nothing needs re-pointing for them.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-13.7: Participant activities shall remain fully traceable<br> Ref: §6 FR-13.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/eventsDB.ts<br>src/routes/seu/core/participants.ts:66-78<br>src/domain/engine/dispatchEngine.ts:186-230</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every lifecycle transition and assignment publishes a corresponding event (<code>ParticipantActivated</code>/<code>ParticipantAssigned</code>/<code>ParticipantIdle</code>/<code>ParticipantReleased</code>/<code>ParticipantArchived</code>/<code>ParticipantCreated</code>/<code>ParticipantReplaced</code>/<code>ParticipantSelected</code>) carrying <code>actorId</code>/<code>authorityBadge</code>, queryable by <code>originating_object_id</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Platform recognises four Participant Types: AI, Human, External, Automated<br> Ref: §7 Participant Types</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/participantRegistry.ts:21</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>PARTICIPANT_TYPES = ["AI", "Human", "Automated", "External"]</code> matches exactly the four types named in the spec.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AI Participant implementation technology is outside platform scope<br> Ref: §7 AI Participant</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:913</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>ParticipantType</code> carries no technology-specific metadata; type value is an opaque Ontology code (e.g. "AI"), consistent with "implementation technology is outside the scope."</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Human Participant models engineering participation only, not HR<br> Ref: §7 Human Participant</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:975-978</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>participants_master.user_id</code> links only to the platform login identity for visibility purposes ("SEUs I'm a Participant on"); no HR-domain fields (payroll, employment status, etc.) exist on the row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">External Participant represents outside oversight/authority parties (Auditors, Certifying Authorities)<br> Ref: §7 External Participant</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/participantRegistry.ts:21</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">"External" is a recognised type value in the registry; no distinct oversight/authority-specific behaviour (e.g. a certification workflow) is implemented beyond being an ordinary Participant Type value.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Automated Participant represents internal deterministic tooling/systems (Static Analysis, CI/CD, Scanner, Deployment Service)<br> Ref: §7 Automated Participant</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/participantRegistry.ts:21</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">"Automated" is a recognised type value; no distinct wiring to an actual CI/CD, static-analysis or scanner integration exists in the repository — the type exists as a classification only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Participant shall maintain identity fields: Participant Identifier, Type, Display Name, Assigned Capabilities/Capability Context, Current State, SEU Identifier, Engineering/Authority/Behaviour Context<br> Ref: §8 Participant Identity</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/participants_schema_recovery.sql:3-23<br>src/dblayer/seuTypes.ts:916-930, 937-981</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Identifier (<code>id</code>), Type (<code>type</code>), Display Name (<code>display_name</code>), Current State (<code>state</code>), SEU Identifier (<code>seu_id</code>) are columns on <code>participants</code>. Capability Context is derivable via <code>capability_fulfilments</code>. Authority Context is <code>participants_master.authorised_role</code>/<code>authorised_badges</code>. Behaviour Context is <code>participants_master.behaviour_context</code>. Engineering Context (currently progressed Deliverables) has no dedicated field and is derived at read-time (<code>participantHome.ts:scopeToParticipant</code>), not stored as an identity attribute.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Identity shall remain stable throughout the Participant lifecycle<br> Ref: §8 Participant Identity</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/participantsDB.ts:86-97</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>updateStatus</code> only ever mutates <code>state</code>/<code>updated_at</code>; <code>id</code>, <code>type</code>, <code>display_name</code>, <code>seu_id</code>, <code>participant_id</code> are never rewritten by any lifecycle transition.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participant lifecycle: Created → Available → Assigned → Executing → Idle → Released → Archived, with repeat cycling between Assigned/Executing/Idle<br> Ref: §9 Participant Lifecycle</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/participants_schema_recovery.sql:8-9<br>src/dblayer/seed/data/transitionDefinitions.json:811-899<br>src/routes/seu/core/participants.ts:38-81</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>state</code> CHECK constraint enumerates exactly the seven named states. <code>transition_definitions</code> seeds exactly: Created→Available, Available→Assigned, Assigned→Executing, Executing→Idle, Idle→Assigned, Idle→Released, Released→Archived, plus direct-to-Released edges from Available/Assigned/Executing (for replacement, §13). All transitions are gated through <code>transitionEngine.evaluate</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Participant becomes eligible for a Capability only through Capability Fulfilment (Ch.12)<br> Ref: §10 Participant Assignment</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participantEligibility.ts:101-116<br>src/routes/seu/core/capabilities.ts:56-72</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>resolveMasterParticipant</code> re-derives eligibility through <code>findEligibleParticipants</code> (the same function backing the Fulfil dropdown) before creating any <code>participants</code>/<code>capability_fulfilments</code> row — no path creates a lifecycle Participant without going through this eligibility check first.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Participant is assigned to a Deliverable/Work Item only through the Dispatch Engine (Ch.33), selecting among Capability-Fulfilment-established eligible candidates<br> Ref: §10 Participant Assignment</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dispatchEngine.ts:91-230<br>src/domain/engine/dispatchStrategies.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>dispatchEngine.dispatch</code> reads the <code>capability_fulfilment_pools</code> snapshot (never re-resolves eligibility live, per code comment) and calls <code>selectParticipant</code>/<code>loadAvailableCandidates</code> to choose among that pool before calling <code>workItemsDB.assign</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Assignment establishes runtime relationships between Participant, Capability, Deliverable, EBM<br> Ref: §10 Participant Assignment</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dispatchEngine.ts:162-218</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>workItemsDB.assign</code> links the Work Item (tied to a Command→Deliverable) to the Participant; the dispatch pool and strategy selection are themselves derived from the EBM-driven <code>capability_fulfilment_pools</code>/dispatch strategies.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Assignment shall not modify the Participant definition<br> Ref: §10 Participant Assignment</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/participantsDB.ts:86-97</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Assignment (<code>dispatchEngine.dispatch:185</code>) only calls <code>participantsDB.updateStatus</code>, mutating <code>state</code>, never <code>type</code>/<code>display_name</code>/<code>seu_id</code>/<code>participant_id</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants may collaborate when multiple Capabilities contribute to a Deliverable; the mechanism is implementation-defined<br> Ref: §11 Participant Collaboration</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:185-204</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>fulfilCapabilityWithParticipants</code> implements joint fulfilment of a single Capability by multiple Participants (<code>"Composite"</code> strategy); cross-Capability collaboration toward one Deliverable is not a separate modeled construct, it emerges from multiple Capabilities each independently being fulfilled and their Work Items both targeting the same Deliverable via Commands.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Platform shall preserve collaboration history, engineering decisions, evidence, traceability<br> Ref: §11 Participant Collaboration</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/eventsDB.ts<br>src/routes/seu/core/seus.ts (events/decisions/evidence aggregation)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>getSeuDetailView</code>/<code>participantHome.ts</code> aggregate <code>events</code>, <code>decisions</code>, <code>evidence</code> keyed off Deliverable/Command/Participant ids, none of which are deleted on replacement or release.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants shall maintain runtime state: availability, assigned Deliverables, current Work Items, execution history, pending decisions, outstanding obligations<br> Ref: §12 Participant State</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/participants_schema_recovery.sql:8-9<br>src/routes/seu/core/participantHome.ts:35-96</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>state</code> column covers availability. Assigned Deliverables/current Work Items/execution history/obligations are all derived at read-time in <code>scopeToParticipant</code> (via Commands/WorkItems/Obligations joins), not stored as fields on the Participant row itself. "Pending decisions" scoping is explicitly reinterpreted in code as "decisions actable under this Participant's held badge," not a stored queue (see comment at participantHome.ts:64-70).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Runtime state shall not contain permanent engineering knowledge<br> Ref: §12 Participant State</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/knowledgeItemsDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Consistent with PM-003 — no engineering knowledge payload is stored on <code>participants</code>/<code>participants_master</code>, only derived/queried references.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Platform shall permit replacement of any Participant<br> Ref: §13 Participant Replacement</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:88-125</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Code comment and transition seed confirm replacement is not limited to Idle: Available, Assigned, Executing and Idle each have a direct edge into Released (transitionDefinitions.json:811-899), and <code>replaceParticipant</code> drives whatever state the old Participant is actually in to Released then Archived.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Replacement shall preserve Deliverable state, Knowledge, Decisions, Evidence, Traceability, Outstanding Obligations<br> Ref: §13 Participant Replacement</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:88-176</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None of <code>deliverables</code>, <code>knowledge_items</code>, <code>decisions</code>, <code>evidence</code>/<code>evidence_relationships</code>, <code>obligations</code> carry a <code>participant_id</code> column (confirmed by grep and design comment at line 96-100); only <code>capability_fulfilments.participant_id</code> is re-pointed by <code>replaceParticipant</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Replacement shall not require recommissioning of the SEU<br> Ref: §13 Participant Replacement</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:101-176</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>replaceParticipant</code> never touches <code>seus</code>/commissioning state; it only transitions Participant rows and the one affected <code>capability_fulfilments</code> row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Engineering Context: the Deliverables currently being progressed<br> Ref: §14 Participant Context</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participantHome.ts:35-53</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>scopeToParticipant</code> derives <code>myDeliverableIds</code> from Commands/WorkItems keyed to the Participant's engagement id; not a stored field, but a correctly-derived live context.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Behaviour Context: the EBM governing execution<br> Ref: §14 Participant Context</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:959-961<br>src/routes/seu/core/participantEligibility.ts:57-63</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>participants_master.behaviour_context</code> (array of <code>{policy, payload}</code>) is read by <code>matchesRequiredPolicies</code> during eligibility, and is distinct from the SEU's own active EBM — the spec's "EBM governing execution" sense of Behaviour Context is implemented as EBM-driven transition gating (<code>transitionEngine.evaluate</code>) rather than as a field literally named Behaviour Context tied to the EBM itself. The stored <code>behaviour_context</code> field is onboarding/eligibility data, not the EBM reference.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability Context: the Capabilities currently being fulfilled<br> Ref: §14 Participant Context</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/capabilityFulfilmentsDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>capability_fulfilments</code> rows with <code>revoked_at IS NULL</code> for a given <code>participant_id</code> give the live Capability Context; derived, not a stored field on <code>participants</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authority Context: the decision rights applicable at the current stage of execution<br> Ref: §14 Participant Context</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:962-973<br>src/domain/engine/badgeAuthorityEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>participants_master.authorised_role</code>/<code>authorised_badges</code> plus <code>badgeAuthorityEngine.getHeldBadges</code> resolve which badges/roles a Participant's underlying identity holds; gating applied via <code>requireBadge</code>/<code>transitionEngine</code>, consistent with the "current stage" qualifier since badges carry <code>effective_till</code>/<code>seu_ids</code> scoping.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Knowledge Context: the engineering knowledge available to the Participant<br> Ref: §14 Participant Context</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No construct resolves "knowledge available to a given Participant" (e.g. a filtered view of <code>knowledge_items</code> scoped to a Participant's current Deliverables/Capabilities); Knowledge Context as a named, queryable context is absent.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Obligation Context: outstanding obligations affecting assigned Deliverables<br> Ref: §14 Participant Context</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participantHome.ts:53, 86</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>scopeToParticipant</code> filters <code>detail.obligations</code> down to <code>myDeliverableIds</code>, exactly matching "outstanding obligations affecting assigned Deliverables."</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants may maintain transient working memory to support execution; memory is ephemeral<br> Ref: §15 Participant Memory</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No schema column, in-memory cache, or session-scoped store represents Participant working memory anywhere in <code>participants</code>/<code>participants_master</code> or the dispatch/execution path.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Authoritative engineering knowledge shall be stored only in the Knowledge Repository<br> Ref: §15 Participant Memory</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/knowledgeItemsDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>knowledge_items</code> is the sole knowledge store and is never written to or read from by Participant-side code paths (participantsDB/participantsMasterDB/participants.ts/capabilities.ts).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">If a Participant is replaced, its transient memory may be discarded without loss of engineering continuity<br> Ref: §15 Participant Memory</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:101-176</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Since no transient-memory construct exists at all (see row above), there is nothing for <code>replaceParticipant</code> to discard; the discard behaviour is vacuously true rather than demonstrated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Platform shall publish: ParticipantCreated, ParticipantAssigned, ParticipantReleased, ParticipantActivated, ParticipantIdle, ParticipantReplaced, ParticipantArchived, ParticipantUnavailable<br> Ref: §16 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:29-36, 66-78<br>src/routes/seu/core/capabilities.ts:119-128<br>src/domain/engine/dispatchEngine.ts:79-88, 186-194</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All eight named events are published: <code>ParticipantCreated</code> (capabilities.ts:120, participants.ts:138), <code>ParticipantAssigned</code> (participants.ts via CH13_EVENT_BY_TRANSITION, and dispatchEngine.ts:187), <code>ParticipantReleased</code>/<code>ParticipantActivated</code>/<code>ParticipantIdle</code>/<code>ParticipantArchived</code> (participants.ts CH13_EVENT_BY_TRANSITION map), <code>ParticipantReplaced</code> (participants.ts:165), <code>ParticipantUnavailable</code> (dispatchEngine.ts eventType parameter at line 156).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participant subsystem shall support concurrent Participants<br> Ref: §17 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:185-204</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Multiple <code>participants</code> rows per SEU/Capability are first-class (<code>fulfilCapabilityWithParticipants</code>, Composite strategy); no singleton constraint exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participant subsystem shall support heterogeneous Participant implementations<br> Ref: §17 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:913</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Open, Ontology-backed <code>type</code> imposes no implementation-specific shape.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participant subsystem shall support dynamic replacement<br> Ref: §17 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:101-176</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as FR-13.5/§13.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participant subsystem shall preserve engineering continuity<br> Ref: §17 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:148-176</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as FR-13.6.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participant subsystem shall maintain complete traceability<br> Ref: §17 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/eventsDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as FR-13.7.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Participants possess unique identities<br> Ref: §18 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/participants_schema_recovery.sql:4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as FR-13.1.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Participants can fulfil multiple Capabilities<br> Ref: §18 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:153-174</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as FR-13.3.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Multiple Participants can collaborate on a Deliverable<br> Ref: §18 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:185-204</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as §11.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Participants can be replaced without affecting engineering continuity<br> Ref: §18 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:101-176</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as §13.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Participant history remains traceable<br> Ref: §18 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/eventsDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as FR-13.7.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Participant memory remains transient<br> Ref: §18 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No memory construct exists to evaluate transience against (see §15 findings).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Participant domain model<br> Ref: §19 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:916-981</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>ParticipantRow</code>/<code>ParticipantMasterRow</code> types, with backing tables.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Participant lifecycle service<br> Ref: §19 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>transitionParticipant</code>/<code>replaceParticipant</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Participant registry<br> Ref: §19 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/participantsMasterDB.ts<br>src/routes/seu/web/participantRegistry.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Tenant-scoped <code>participants_master</code> registry with list UI.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Participant assignment interfaces<br> Ref: §19 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts<br>src/domain/engine/dispatchEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfilment (eligibility-gated) and Dispatch (strategy-gated) assignment paths.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Participant context model<br> Ref: §19 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participantHome.ts:35-96</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>scopeToParticipant</code> implements most contexts; Knowledge Context absent (see §14 row).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Participant state management<br> Ref: §19 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/participantsDB.ts:86-97</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>updateStatus</code>, gated through <code>transitionEngine</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Participant APIs<br> Ref: §19 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts<br>src/routes/seu/core/participantHome.ts<br>src/routes/seu/web/participantRegistry.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Core functions plus web routes (registry, home page, replace route at routeAuthority.json:1719).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Participant events<br> Ref: §19 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts:29-36</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CH13_EVENT_BY_TRANSITION map plus dispatchEngine/capabilities.ts publishes.</td>
    </tr>
  </tbody>
</table>
## Summary

- Total intents analysed: 48
- Fully met: 38
- Partially met: 7
- Not met: 2
- Not verifiable: 1

### Major implementation gaps

1. **Participant Memory (§15) is unimplemented.** No transient working-memory construct exists anywhere in the Participant schema or execution path. The "memory is ephemeral / discarded on replacement" requirement and the corresponding §18 acceptance criterion ("Participant memory remains transient") cannot be verified as met because there is nothing to observe.
2. **Knowledge Context (§14) has no implementation.** Unlike Engineering/Behaviour/Capability/Authority/Obligation Context, which are all derivable from existing data (participantHome.ts, participantsMasterDB, badgeAuthorityEngine), there is no mechanism that resolves "the engineering knowledge available to a given Participant."
3. **External and Automated Participant Types (§7) are classification-only.** Both are valid `type` values but have no distinct behavioural wiring (e.g. an actual CI/CD/scanner integration, or an auditor/certifying-authority workflow) beyond being an ordinary Participant Type.
4. **Identity's "Engineering Context"/"Behaviour Context" fields (§8) are derived, not stored.** The stored `behaviour_context` field on `participants_master` is onboarding/eligibility data (CR-104), not the "EBM governing execution" sense the spec's Behaviour Context section (§14) describes; the two uses of the term diverge.
