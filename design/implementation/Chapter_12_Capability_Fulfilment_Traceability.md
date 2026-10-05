# Chapter 12 – Capability Fulfilment: Implementation Traceability

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability Fulfilment ensures required engineering capabilities are available, independent of Participant implementation<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:153-174, 185-204</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>fulfilCapability</code>/<code>fulfilCapabilityWithParticipants</code> operate purely on <code>participantType</code>/<code>participants_master</code> identity, never on how a Participant actually performs work.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability Fulfilment is distinct from per-Work-Item Participant selection (Dispatch Engine, Ch.33)<br> Ref: §2 Scope</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts (whole file)<br>src/domain/engine/dispatchEngine.ts:91-232</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfilment (this chapter) only registers eligible Participants against a SEU Capability; <code>dispatchEngine.dispatch</code> (Ch.33) is the separate runtime decision that assigns a specific WorkItem to one Participant, reading a pool this chapter produces.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability Fulfilment forms a bridge between engineering intent (Deliverable → Required Capabilities) and execution (Participants)<br> Ref: §3 Architectural Position</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts (capability derivation, see row below)<br>src/routes/seu/core/capabilities.ts:74-143</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>seu_capabilities</code> rows (from commissioning) are the intent; <code>fulfilOne</code> creates the Participant/<code>capability_fulfilments</code> link and pushes dependency re-evaluation. The chain exists end to end.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability Fulfilment is the runtime process identifying suitable Participants for required competencies, and is dynamic over the SEU's life<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participantEligibility.ts:101-116<br>src/routes/seu/core/capabilities.ts:220-253 (releaseParticipants)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>findEligibleParticipants</code> re-evaluates live at fulfilment time; <code>releaseParticipants</code>/re-fulfilment let Participants change mid-SEU without touching the Capability or EBM definitions.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CF-001: Capabilities are permanent, Participants are replaceable<br> Ref: §5 CF-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts (replaceParticipant)<br>src/routes/seu/core/capabilities.ts:220-253</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability definitions (<code>capabilities</code> table, Ch.10) are never touched by fulfilment/release/replace; only <code>participants</code>/<code>capability_fulfilments</code> rows change.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CF-002: Capability Fulfilment independent of Participant implementation<br> Ref: §5 CF-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:74-143</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>fulfilOne</code> only records <code>type</code>/<code>displayName</code>/<code>participantMasterId</code>; no code path inspects or depends on how an AI/human/external Participant actually executes work.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CF-003: AI, human and external Participants equally supported<br> Ref: §5 CF-003</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts (ParticipantType)<br>src/routes/seu/core/capabilities.ts:82-88</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>participantsDB.create</code> takes a <code>ParticipantType</code> uniformly (AI/Human/Automated/External per migration 194); no branching by type anywhere in <code>fulfilOne</code>/<code>fulfilCapability</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CF-004: engineering continuity preserved when Participants change<br> Ref: §5 CF-004</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:220-253 (releaseParticipants)<br>src/routes/seu/core/participants.ts (replaceParticipant)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">See §10/§12 rows below — continuity holds because no continuity-bearing table references <code>participant_id</code> except <code>capability_fulfilments</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">CF-005: Capability Fulfilment remains fully traceable<br> Ref: §5 CF-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/capabilityFulfilmentsDB.ts:11-18<br>src/routes/seu/web/seus.ts:168-194, 202-233</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>capability_fulfilments</code> now carries real, NOT-NULL <code>author_id</code>/<code>author_badge</code> (resolved via <code>route_authority</code>/CR-110 on the Fulfil and Replace web routes), and <code>fulfilOne</code> publishes <code>ParticipantCreated</code>/<code>CapabilityFulfilled</code> with a real <code>actorId</code>. The <code>/release</code> route (seus.ts:243-266) records no actor/badge at all — see §14 row below.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-12.1: platform determines capabilities required to progress a Deliverable<br> Ref: §6 FR-12.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts (Template <code>getRequiredCapabilities</code> union into <code>seu_capabilities</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capabilities required are a fixed snapshot unioned from the SEU's Templates at commissioning time, not re-derived as Deliverables actually progress. The spec's wording ("to progress a Deliverable") implies a live, per-Deliverable derivation that does not exist; what's built is a one-time, Template-driven set (tracked separately as CR-011, Ch.1 §10 / Ch.5 §19.12).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-12.2: Capability Fulfilment shall identify one or more suitable Participants<br> Ref: §6 FR-12.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participantEligibility.ts:101-116<br>src/routes/seu/core/capabilities.ts:153-174</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>findEligibleParticipants</code> returns the full qualifying set (capability match + optional competency/policy filters); a human then picks from a dropdown built off that set via the Fulfil form — there is no automated best-fit selection evaluating §8's full criteria list (behavioural EBM compatibility, required knowledge/authority beyond Policy, engineering constraints, Pack-specific requirements are not implemented in this function).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-12.3: multiple Participants may jointly fulfil a Capability<br> Ref: §6 FR-12.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:185-204</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>fulfilCapabilityWithParticipants</code> creates one <code>participants</code> row + one <code>capability_fulfilments</code> row per selected <code>participants_master</code> id against the same SEU Capability, in one call, with <code>fulfilmentStrategy</code> set to <code>"Composite"</code> when more than one is selected.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-12.4: one Participant may fulfil multiple Capabilities<br> Ref: §6 FR-12.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:56-72, 82-88</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>resolveMasterParticipant</code>/<code>fulfilOne</code> let the same <code>participants_master</code> resource be selected for more than one SEU Capability; each call still mints its own per-Capability <code>participants</code> lifecycle row, but all such rows share one <code>participant_id</code> FK back to the master. Realised within one SEU; <code>replaceParticipant</code> (Ch.13 §13) still only creates an ad hoc identity, not wired to the registry.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-12.5: Capability Fulfilment shall support dynamic reassignment<br> Ref: §6 FR-12.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:220-253 (releaseParticipants)<br>src/routes/seu/core/participants.ts (replaceParticipant)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Two live mechanisms exist: <code>releaseParticipants</code> (release → revert to Unfulfilled → re-fulfil) and the older atomic <code>replaceParticipant</code> swap, both reachable from the SEU detail page.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-12.6: Capability reassignment shall preserve engineering continuity<br> Ref: §6 FR-12.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts (replaceParticipant: Released→Archived via <code>transitionParticipant</code>, fulfilment revoke/create)<br>src/routes/seu/core/capabilities.ts:220-253</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Continuity holds because Deliverable/Knowledge/Decision/Evidence/Obligation tables carry no <code>participant_id</code> reference at all; only <code>capability_fulfilments</code> is re-pointed on reassignment.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-12.7: Capability Fulfilment decisions shall remain traceable<br> Ref: §6 FR-12.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/web/seus.ts:168-194, 202-214<br>src/dblayer/capabilityFulfilmentsDB.ts:11-18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfil and Replace routes resolve a real held badge through <code>route_authority</code> (CR-110) and pass it through to <code>author_id</code>/<code>author_badge</code>, now NOT NULL on <code>capability_fulfilments</code>. The <code>/release</code> route records no actor/badge (gap, see §14).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AI Participant fulfilment strategy<br> Ref: §7 Fulfilment Strategies</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:82-97</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>fulfilOne</code> records <code>fulfilmentStrategy</code> as the Participant's own <code>type</code> (e.g. <code>"AI"</code>) when a single Participant is selected.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Human Participant fulfilment strategy<br> Ref: §7 Fulfilment Strategies</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:82-97</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same path, <code>type: "Human"</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">External Service fulfilment strategy<br> Ref: §7 Fulfilment Strategies</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:82-97</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same path, <code>type: "External"</code> (per migration 194's widened <code>ParticipantType</code>).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Hybrid fulfilment strategy (AI+Human jointly, distinctly from Composite)<br> Ref: §7 Fulfilment Strategies</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:195</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>fulfilmentStrategy</code> is hard-set to <code>"Composite"</code> whenever more than one Participant is selected together; no code path distinguishes a specifically AI+Human pairing as <code>"Hybrid"</code>. The column accepts the value (migration 002/194) but nothing ever writes it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Composite fulfilment strategy (multiple coordinated Participants)<br> Ref: §7 Fulfilment Strategies</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:185-204</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Realised exactly as described: <code>fulfilCapabilityWithParticipants</code> sets <code>fulfilmentStrategy: "Composite"</code> for any multi-Participant selection.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfilment Criteria: capability compatibility<br> Ref: §8 Fulfilment Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participantEligibility.ts:101-102<br>src/dblayer/participantsMasterDB.ts (findEligibleForCapability)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>findEligibleParticipants</code> narrows on tenant/<code>is_active</code>/capability-containment first.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfilment Criteria: behavioural compatibility with the EBM<br> Ref: §8 Fulfilment Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participantEligibility.ts:94-99 (getSeuCompetencyRequirements)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Technology/Domain competency union (CR-101) is read off the EBM's <code>behaviors.competencyRequirements</code> and matched (§8's competency criterion, via <code>matchesCompetency</code>). No broader "behavioural compatibility" beyond this Technology/Domain dimension (e.g. EBM <code>applicable_policy_ids</code> as a behavioural gate) exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfilment Criteria: required knowledge<br> Ref: §8 Fulfilment Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No code path filters eligible Participants by a "required knowledge" criterion distinct from capability/competency. Not found anywhere in <code>participantEligibility.ts</code> or its callers.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfilment Criteria: required authority<br> Ref: §8 Fulfilment Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No eligibility-time authority check exists; authority (<code>route_authority</code>/badges) gates who may *perform the fulfil action*, not which Participants are eligible to *be* fulfilled. These are different concerns and the latter is unbuilt.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfilment Criteria: availability<br> Ref: §8 Fulfilment Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/participantsMasterDB.ts (findEligibleForCapability: <code>is_active</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only a coarse <code>is_active</code> tenant-level flag is checked at eligibility time; there is no availability/capacity signal (load, schedule) at Fulfilment. (A separate, later-stage availability check exists in Dispatch Engine's <code>loadAvailableCandidates</code>, Ch.33, out of this chapter's scope.)</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfilment Criteria: engineering constraints<br> Ref: §8 Fulfilment Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No implementation found matching "engineering constraints" as a distinct eligibility filter.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfilment Criteria: Pack-specific requirements<br> Ref: §8 Fulfilment Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participantEligibility.ts:65-79 (resolveEligibilityPolicies)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The closest realised equivalent is CR-104's "Eligibility"-scoped Policies resolved from the SEU's composed Packs (<code>resolveEligibilityPolicies</code> + <code>matchesRequiredPolicies</code>), checked against a Participant's own <code>behaviour_context</code>. This covers Policy-declared Pack requirements, not arbitrary Pack-specific requirements generally.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Selection algorithms are implementation-defined<br> Ref: §8 Fulfilment Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:153-174</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">True in the narrow sense that none is defined: selection is "every eligible Participant, a human picks one or more from a dropdown," not an automated best-fit algorithm.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability Fulfilment registers eligibility, creating a runtime relationship between Capability, Participant and EBM<br> Ref: §9 Eligibility Registration</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/capabilityFulfilmentsDB.ts (capability_fulfilments row: seu_capability_id, participant_id)<br>src/routes/seu/core/participantEligibility.ts:94-99</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>capability_fulfilments</code> links Capability↔Participant; the EBM relationship is indirect — competency requirements are read from the EBM at eligibility-check time (not stored on the fulfilment row itself) via <code>getSeuCompetencyRequirements</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Eligibility registration makes the Participant a dispatch candidate, not bound to a specific Deliverable/Work Item<br> Ref: §9 Eligibility Registration</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/capabilityFulfilmentPoolsDB.ts:1-34<br>src/domain/engine/dispatchEngine.ts:124-133</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A <code>capability_fulfilment_pools</code> snapshot (migration 240, CR-109 §6.2) is taken per Command from the live eligible-fulfilment set; <code>dispatchEngine.dispatch</code> reads that pool and picks a Participant per WorkItem — the eligible pool itself is never bound to one WorkItem.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Eligibility registration shall not modify the Capability definition<br> Ref: §9 Eligibility Registration</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:91-100</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>fulfilOne</code> writes to <code>capability_fulfilments</code>/<code>seu_capabilities.status</code> only; the <code>capabilities</code> definition table (Ch.10) is never written by this path.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The eligible-Participant pool can genuinely hold more than one candidate<br> Ref: §9 (cf. §18.2's correction)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/capabilityFulfilmentsDB.ts (findActiveManyBySeuCapabilityId)<br>src/dblayer/capabilityFulfilmentPoolsDB.ts:20-34</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed: the pool is a real multi-Participant set as of Composite (§7) + CR-109's persisted snapshot. The legacy singular <code>findActiveBySeuCapabilityId</code> (<code>LIMIT 1</code>) is kept only for <code>dispatchEngine.ts</code>'s own superseded direct-query path and <code>replaceParticipant</code>; <code>dispatchEngine.dispatch</code> as currently written (dispatchEngine.ts:124-133) reads the persisted pool, not the singular query.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Dynamic reassignment: Participants may be replaced during SEU execution (AI upgrade, human unavailable, etc.)<br> Ref: §10 Dynamic Reassignment</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:220-253<br>src/routes/seu/core/participants.ts (replaceParticipant)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Both the two-step release/re-fulfil flow and the older atomic replace flow are live, reachable from the SEU detail page, with no restriction on the reason for replacement.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Reassignment preserves Deliverable state, Knowledge, Traceability, Outstanding Obligations, engineering history<br> Ref: §10 Dynamic Reassignment</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts (replaceParticipant)<br>src/routes/seu/core/capabilities.ts:247-251</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Verified structurally: Deliverable/Knowledge/Obligation/Decision/Evidence tables carry no <code>participant_id</code> column; only <code>capability_fulfilments.participant_id</code> is revoked/re-created, so nothing participant-shaped is lost.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Continuous monitoring of available/unavailable/degraded/newly available Participants<br> Ref: §11 Capability Availability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No implementation found. <code>ParticipantState</code> (Ch.13) has no "degraded" value; no background monitoring process polls or tracks Participant availability transitions for this chapter's purposes.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Availability changes may trigger Dependency Engine re-evaluation<br> Ref: §11 Capability Availability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:106-114</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A re-evaluation push (<code>dependencyDefinitionEngine.evaluateAndPublishFromTransition</code>) exists, but only on successful fulfilment (Capability→Fulfilled), not on an availability *change* (degradation, Participant going unavailable) — the triggering event §11 describes does not exist to fire it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability continuity maintained through Knowledge Repository, Deliverable state, Traceability, EBM, Decision history<br> Ref: §12 Capability Continuity</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts (no participant_id on Knowledge/Decision/Evidence tables, confirmed via schema)<br>src/routes/seu/core/participants.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Holds structurally: none of Knowledge Items, Decisions, Evidence, or the EBM itself are Participant-scoped; all are SEU/Deliverable-scoped. This is a schema property, not an enforced business rule.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants shall not become the primary repository of engineering knowledge<br> Ref: §12 Capability Continuity</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer schema (participants/participants_master carry identity+lifecycle only)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed: no knowledge/decision/evidence content is stored on either Participant table.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfilment Failure: detect no suitable Participant exists<br> Ref: §13 Fulfilment Failure</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/telemetry.ts:149-205 (checkSustainedCapabilityShortages)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only a cross-SEU, sustained-pattern (platform-wide, threshold-based) detection exists via Telemetry (Ch.35 §11), raising an Organisational Learning Obligation. No real-time, single-SEU-attempt detection exists — there is no selection algorithm (§8 gap) to fail from in the first place at fulfilment time.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfilment Failure: detect required authority cannot be satisfied<br> Ref: §13 Fulfilment Failure</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No implementation; authority is not evaluated at eligibility/fulfilment time at all (see §8 "required authority" row).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfilment Failure: detect Pack constraints cannot be met<br> Ref: §13 Fulfilment Failure</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participantEligibility.ts:57-63, 73-78</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The nearest real behaviour: <code>matchesRequiredPolicies</code> fails closed (returns false, i.e. excludes the candidate) when a required Eligibility Policy's condition isn't satisfied — but this silently narrows the eligible set rather than surfacing a distinct "Pack constraint failure" signal or Obligation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fulfilment Failure: detect mandatory capabilities unavailable<br> Ref: §13 Fulfilment Failure</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/telemetry.ts:149-205</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same sustained-pattern mechanism as above; no immediate single-attempt detection.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Failures shall generate engineering obligations<br> Ref: §13 Fulfilment Failure</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/telemetry.ts:205-240 (createObligation)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>raiseSustainedPatternObligation</code> creates a real Obligation, but only for the sustained cross-SEU pattern case, not for an individual failed fulfilment attempt (no such attempt is ever recorded as failed — see §8/§13 gaps above).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissioning or execution may be suspended on fulfilment failure<br> Ref: §13 Fulfilment Failure</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No implementation found suspending commissioning or execution in response to a fulfilment failure.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Event: CapabilityRequested<br> Ref: §14 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not published anywhere in the codebase (confirmed by repository-wide search).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Event: CapabilityFulfilmentStarted<br> Ref: §14 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not published anywhere (confirmed).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Event: CapabilityFulfilled<br> Ref: §14 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:131-140</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Published by <code>fulfilOne</code> with real <code>actorId</code>/<code>authorityBadge</code> and <code>capabilityId</code>/<code>participantId</code> payload.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Event: CapabilityUnavailable<br> Ref: §14 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not published anywhere (confirmed). <code>dispatchEngine.ts</code> publishes a differently-scoped <code>ParticipantUnavailable</code> (Ch.33, a dispatch-time event, not this chapter's <code>CapabilityUnavailable</code>).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Event: ParticipantAssigned<br> Ref: §14 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dispatchEngine.ts:186-195</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Published, but by Dispatch Engine (Ch.33) at WorkItem-assignment time, not by Capability Fulfilment itself at Capability-fulfilment time. Semantically adjacent but a different trigger than §14 implies for this chapter.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Event: ParticipantReleased<br> Ref: §14 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts (transitionParticipant Released state) + Ch.13's own Participant-lifecycle event publication</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Published via the governed Participant lifecycle transition (Ch.13), triggered from <code>releaseParticipants</code>/<code>replaceParticipant</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Event: ParticipantReassigned<br> Ref: §14 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not published under this name. Chapter 13 publishes <code>ParticipantReplaced</code> instead for the same underlying fact — functionally equivalent, differently named, confirmed by repository search finding no <code>ParticipantReassigned</code> occurrence.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Event: CapabilityContinuityMaintained<br> Ref: §14 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not published anywhere (confirmed). Continuity is structural (§12), never asserted via an explicit event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Event: CapabilityFulfilmentFailed<br> Ref: §14 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not published anywhere (confirmed), consistent with §13's gap — there is no failure detection path to publish it from.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: support dynamic reassignment<br> Ref: §15 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:220-253</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as FR-12.5/§10.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: support concurrent fulfilment<br> Ref: §15 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:185-204</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>fulfilCapabilityWithParticipants</code> loops sequentially per Participant within one call; no explicit concurrency control or guarantee is implemented or tested for concurrent *separate* fulfilment requests against the same Capability (e.g. two simultaneous web requests). Not verifiable from code alone whether a race is actually handled (no DB-level unique constraint found preventing duplicate active fulfilments).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: remain independent of AI providers<br> Ref: §15 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts (whole file, no provider-specific import)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No AI-provider-specific code anywhere in the fulfilment path; <code>type: "AI"</code> is a plain enum value.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: preserve engineering continuity<br> Ref: §15 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(see §10/§12 rows)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: maintain complete traceability<br> Ref: §15 NFR</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(see CF-005/FR-12.7 rows)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same partial-met evidence — real author/badge on Fulfil/Replace, absent on Release.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Required Capabilities are identified<br> Ref: §16 AC</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Identified at commissioning time, not live per-Deliverable (same FR-12.1 gap).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Appropriate Participants are assigned<br> Ref: §16 AC</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:74-143</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Assignment happens, but "appropriate" is a human's dropdown pick among all eligible Participants, not an automated appropriateness evaluation against §8's full criteria.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Participants can be replaced without affecting Deliverables<br> Ref: §16 AC</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts, src/routes/seu/core/capabilities.ts:220-253</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Verified structurally (§10/§12).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Capability Fulfilment remains traceable<br> Ref: §16 AC</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(see CF-005 row)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Partial — Release route lacks actor/badge.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: AI, human and external Participants are equally supported<br> Ref: §16 AC</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts:82-97</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Verified (§7 rows).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Capability continuity is preserved during reassignment<br> Ref: §16 AC</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(see §10/§12 rows)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Verified.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Capability Fulfilment service<br> Ref: §17 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/capabilities.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Exists; scope of what it evaluates is partial (§8).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Participant assignment service<br> Ref: §17 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/participants.ts (transitionParticipant, replaceParticipant)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Capability continuity service<br> Ref: §17 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">— (no dedicated module; structural property)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No dedicated service exists or is needed — continuity holds by schema construction (§12).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Fulfilment registry<br> Ref: §17 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/capabilityFulfilmentsDB.ts<br>src/dblayer/capabilityFulfilmentPoolsDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>capability_fulfilments</code> is a real, queryable table with no dedicated browse/registry UI page (visible only embedded in a SEU's own detail page); <code>capability_fulfilment_pools</code> is a separate point-in-time snapshot artifact with no display surface at all (by design, for Dispatch Engine consumption only).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Assignment APIs<br> Ref: §17 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/seus.ts (POST .../capabilities/:capabilityId/fulfil)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real JSON API exists, but only for the legacy <code>{participant:{type,displayName}}</code> shape; no API path for Replace, and none for the newer <code>participantMasterId</code>/multi-select selection.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Capability Fulfilment events<br> Ref: §17 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(see §14 rows)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>CapabilityFulfilled</code> and the Ch.13 lifecycle events (<code>ParticipantAssigned</code> via Dispatch, <code>ParticipantReleased</code>) are published; five of nine named events in §14 are not.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable: Runtime monitoring services<br> Ref: §17 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not built (see §11 row). <code>ParticipantState</code> has no "degraded" value.</td>
    </tr>
  </tbody>
</table>
## Summary

- Total intents analysed: 58
- Fully met: 28
- Partially met: 20
- Not met: 9
- Not verifiable: 1

## Major implementation gaps

1. **No automated selection algorithm (§8).** Fulfilment is a human picking from an eligible-candidate dropdown. Of §8's seven criteria, only capability match, Technology/Domain competency (CR-101), and Eligibility-scoped Policy (CR-104) are evaluated; required knowledge, required authority, general availability, engineering constraints, and general Pack-specific requirements are not.
2. **FR-12.1's "live per-Deliverable" derivation is a one-time commissioning-time snapshot** (tracked separately as CR-011).
3. **Hybrid strategy is never distinguished from Composite** — the `"Hybrid"` enum value is dead; any multi-Participant fulfilment is written as `"Composite"`.
4. **Five of nine §14 events are never published**: `CapabilityRequested`, `CapabilityFulfilmentStarted`, `CapabilityUnavailable`, `ParticipantReassigned` (Ch.13 publishes `ParticipantReplaced` instead), `CapabilityFulfilmentFailed`.
5. **No real-time, single-attempt fulfilment-failure detection or suspension (§13).** Only a cross-SEU, sustained-pattern telemetry check exists; no individual failed fulfilment attempt is ever recorded, detected, or escalated, and nothing suspends commissioning/execution.
6. **No continuous availability monitoring (§11)**: no "degraded" Participant state, no background monitoring service.
7. **Traceability gap on the Release route**: `/seus/:id/capabilities/:capabilityId/release` (`src/routes/seu/web/seus.ts:243-266`) records no actor/badge, unlike the Fulfil and Replace routes which now resolve one through `route_authority` (CR-110).
8. **Two corrections to the spec's own §18 narrative**: §18.2's "eligible pool capped at one via `SOLE_ELIGIBLE_PARTICIPANT`" is stale — `dispatchEngine.ts` no longer contains that constant and reads a real multi-Participant pool snapshot. §18.7's "no authority gate, no actor attribution" is stale — the Fulfil and Replace web routes now resolve a badge via `route_authority` and `capability_fulfilments.author_id`/`author_badge` are real NOT NULL columns.
