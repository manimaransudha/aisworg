# Chapter 14 – Engineering Collaboration Model — Implementation Traceability

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Collaboration is artefact-centric: Participants collaborate by creating/consuming/evolving engineering artefacts through the Runtime Kernel, not via direct conversation<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/deliverables.ts:60-120<br>src/routes/seu/core/workItems.ts:55-230</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No Participant-to-Participant call exists anywhere; every interaction is Work Item dispatch (platform→Participant) and completion report (Participant→platform) against a shared artefact row (Deliverable/Knowledge/Decision/Evidence).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Participants collaborate through shared engineering state, not direct interaction (§3 architectural position)<br> Ref: §3 Architectural Position</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dispatchEngine.ts:1-180</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed by search: no route/function/adapter sends a message from one Participant to another. All traffic flows Participant → Runtime Kernel → artefact/event, never Participant → Participant.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ECM-001: engineering artefacts are the primary collaboration mechanism<br> Ref: §5 ECM-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/knowledgeItemsDB.ts:22<br>src/dblayer/deliverableReferencesDB.ts:25<br>src/routes/seu/core/deliverables.ts:60-120</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The 6 artefact kinds named in §7 (Deliverables, Knowledge, Evidence, Decisions, Obligations, Events) all exist as real governed tables/entities and are the actual mechanism through which a Work Item's instructions and a Participant's outputs are exchanged.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ECM-002: Participants shall remain loosely coupled<br> Ref: §5 ECM-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dispatchEngine.ts:27-176 (SLA/dispatch)<br>src/routes/seu/core/attentionItems.ts:41-97</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Participant is resolved generically via Capability Fulfilment at dispatch time; nothing hard-codes a specific Participant identity into a transition or Deliverable. No coupling mechanism (direct reference, callback URL between Participants, etc.) exists.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ECM-003: Collaboration shall remain fully traceable<br> Ref: §5 ECM-003</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/eventsDB.ts:28-53,129-133</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>events.correlation_id</code>/<code>causation_id</code> link every event in one engineering activity, and <code>PublishInput.actorId</code>/<code>authorityBadge</code> (src/domain/engine/eventBus.ts:43-48) record who/under what authority. Traceability is a property of the generic event mechanism rather than a dedicated "Collaboration traceability service."</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ECM-004: Knowledge shall be shared through the Knowledge Repository<br> Ref: §5 ECM-004<br>§10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/knowledgeItemsDB.ts:22-108<br>src/dblayer/seuTypes.ts:1907-1922</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>knowledge_items</code> is the shared repository; <code>deliverable_references</code>/<code>evidence_references</code>/<code>decision_references</code>/<code>knowledge_references</code> columns realise §10's "reference knowledge." Contribute/validate/reference all route through this one table.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ECM-005: Runtime events shall communicate engineering state changes<br> Ref: §5 ECM-005<br>§9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:94-111<br>src/routes/seu/core/workItems.ts:189-220</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>eventBus.publish</code> persists an event row and fires <code>dispatch()</code> fire-and-forget on every governed state change (e.g. <code>DeliverableTransitioned</code>, <code>WorkItemDisposed</code>). State changes are communicated via real, persisted events, not via direct calls.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">ECM-006: Direct participant communication shall not be required for normal execution<br> Ref: §5 ECM-006</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dispatchEngine.ts:1-180</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as ECM-002/§3: the normal execution path (dispatch → completion report) never requires or provides a channel for Participant-to-Participant communication.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-14.1: Participants shall collaborate through shared engineering artefacts<br> Ref: §6 FR-14.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/deliverables.ts:60-120</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same as ECM-001.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-14.2: Participants shall publish engineering state changes<br> Ref: §6 FR-14.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/workItems.ts:91-101,189-220</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>completeWorkItem</code> is the Participant-facing publish point: a report of <code>done</code>/<code>failed</code>/<code>blocked</code> drives <code>eventBus.publish</code> calls (<code>DeliverableTransitioned</code>, <code>WorkItemDisposed</code>, attention-item-raising events).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-14.3: Participants shall consume published engineering state<br> Ref: §6 FR-14.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/workItemGenerator.ts (Execution Context resolution, per Ch.16 §20.7 worked example)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A dispatched Work Item's instructions are pre-resolved by the platform to include the relevant Decisions/Evidence/Knowledge for that Deliverable. A Participant does not itself query another Participant's state; the platform resolves and hands it over at dispatch time.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-14.4: Collaboration shall preserve engineering traceability<br> Ref: §6 FR-14.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/eventsDB.ts:28-53,129-133</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same evidence as ECM-003.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-14.5: Participants shall remain independently replaceable<br> Ref: §6 FR-14.5<br>§14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dispatchEngine.ts:125 (generic <code>participant_ids</code> candidate pool resolved via Capability Fulfilment)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Capability is fulfilled by whichever Participant currently qualifies; nothing in the dispatch path binds a Deliverable/Work Item permanently to one Participant identity. However, the *replacement act itself* (swapping a failed Participant for another) is a governance/human response to an <code>AttentionItem</code>, not an automatic platform mechanism — see Failure Isolation finding below.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-14.6: Engineering decisions shall be visible to authorised Participants<br> Ref: §6 FR-14.6<br>§12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/workItems.ts (Execution Context includes <code>decision_references</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Decisions are exposed through the same Execution Context resolution as Knowledge (FR-14.3); visibility is scoped by the governed artefact-reference mechanism, not an open read. Authorisation specifics for *which* Participants see a given Decision were not independently traced beyond the reference mechanism itself.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Collaboration artefacts: Deliverables / Knowledge / Evidence / Decisions / Obligations / Events all recognised as first-class artefact kinds<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts (table-backed types for each kind)<br>src/dblayer/knowledgeItemsDB.ts, deliverableReferencesDB.ts, eventsDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All 6 named kinds are real, governed, persisted entities in the codebase, consistent with §19.8's own table.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Collaboration Flow: Produce Deliverable → Knowledge Updated → Dependency Evaluated → Event Published → Interested Participants Continue, with no Participant needing to know who consumes the event<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/deliverables.ts:100-120<br>src/routes/seu/core/workItems.ts:189-220</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The real flow is more asynchronous than the diagram implies: <code>transitionDeliverable</code> does not apply the state change or publish synchronously — it dispatches a Work Item via <code>executionEngine.execute()</code> and returns <code>dispatched: true</code>; the state change and <code>DeliverableTransitioned</code> publish happen later, asynchronously, when <code>completeWorkItem</code> is called. The "no Participant needs to know who consumes the event" property holds (subscribers are resolved generically from <code>event_subscriptions</code>), but the flow's actual sequencing differs from the diagram's implied synchronous chain.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Event-driven collaboration: Participants publish domain events rather than invoking one another directly, examples <code>DeliverableApproved</code>/<code>DecisionAccepted</code>/<code>EvidenceSubmitted</code>/<code>ObligationResolved</code>/<code>KnowledgeAccepted</code><br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:94-111</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The architectural property (publish, don't call) is real and verified (ECM-005). But of the 5 named example event types, only <code>KnowledgeAccepted</code> exists as a literal <code>event_type</code> anywhere (grep of <code>transition_definitions.event_type</code> and <code>events</code>, confirmed zero rows for the other 4). <code>DeliverableApproved</code> specifically does not exist — the real event on a Deliverable transition is the generic <code>DeliverableTransitioned</code> (src/routes/seu/core/workItems.ts:194).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Knowledge-Centred Collaboration: Participants contribute, consume, validate, reference knowledge through a shared Knowledge Repository that becomes authoritative engineering memory<br> Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/knowledgeItemsDB.ts:22-108<br>src/dblayer/seuTypes.ts:1907-1922</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Contribute (<code>createKnowledgeItem</code>), validate (governed lifecycle, badge-gated), and reference (typed <code>*_references</code> columns) are all real and backed by <code>knowledge_items</code>. Consume is realised via workItemGenerator's Execution Context resolution rather than a Participant-initiated query, which is a legitimate implementation choice satisfying the same intent.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable-Centred Collaboration: collaboration focus is the Deliverable, with examples of Architecture evolving Requirements, Development evolving Architecture, etc.<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/deliverables.ts:60-120</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables are the real collaboration focus; <code>transitionDeliverable</code> dispatches work rather than applying changes directly, consistent with the artefact-centred model. The chapter's named example pairs (Architecture→Requirements, etc.) are illustrative domain content, not independently verifiable as code — this is examples, not a separate normative intent.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Decision-Centred Collaboration: decisions become shared artefacts; propose/review/approve/consume; ownership stays traceable<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/workItems.ts (decision_references in Execution Context)<br>src/dblayer/eventsDB.ts (actorId/authorityBadge on every event)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Decisions exist as governed artefacts referenced into Execution Context (consume), and every state-changing event carries <code>actorId</code>/<code>authorityBadge</code> for traceable ownership. Propose/review/approve as a lifecycle were not independently traced against a Decision-specific transition table in this pass; evidence here is at the level of the generic artefact/event mechanism shared with other chapters' decisions.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Collaboration Independence: Participants shall never assume identity, implementation technology, or internal reasoning of another Participant<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dispatchEngine.ts:1-180 (no Participant-to-Participant comment: "the platform is deliberately blind to what the Participant does in its own environment")</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Verified by search: no API surface exists through which a Participant could observe another Participant's identity, technology, or reasoning. The only touchpoints are Work Item dispatch (in) and completion report (out).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Failure Isolation: Participant failure shall not invalidate collaboration; Participants may be restarted, replaced, or execute concurrently; engineering continuity unaffected<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/workItems.ts:91-101<br>src/routes/seu/core/attentionItems.ts:41-97<br>src/domain/engine/dispatchEngine.ts:27-176 (SLA stall detection)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A <code>failed</code>/<code>blocked</code> report raises a real <code>AttentionItem</code> rather than corrupting or losing the Deliverable's state — engineering state is preserved. However, "may be restarted/replaced" is not an automatic platform behaviour: reassignment to a different Participant is a governance/human action responding to the <code>AttentionItem</code>, not something the dispatch engine does on its own. Concurrent execution across different Work Items is supported (generic candidate-pool resolution), but no automatic failover for a single failed Work Item was found.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Events: Collaboration subsystem shall publish <code>CollaborationStarted</code>/<code>CollaborationCompleted</code>/<code>KnowledgeShared</code>/<code>DeliverableShared</code>/<code>DecisionPublished</code>/<code>EvidencePublished</code>/<code>CollaborationFailed</code><br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">n/a</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Grep across <code>transition_definitions.event_type</code> and the <code>events</code> table for all 7 literal names returns zero matches, and no <code>collaborations</code> table or dedicated Collaboration module exists at all (confirmed by repo-wide search for a "Collaboration" entity/service). The platform's real per-entity events (<code>DeliverableTransitioned</code>, <code>KnowledgeAccepted</code>, per-state Decision/Evidence events, etc.) carry the same substance under different, entity-owned names.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Non-Functional: support asynchronous execution, support concurrent Participants, remain loosely coupled, preserve traceability, remain implementation independent<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:94-111 (fire-and-forget publish)<br>src/domain/engine/dispatchEngine.ts:27-176 (generic candidate pool)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Asynchronous execution is real (publish never blocks on handler/Participant work; Deliverable transitions resolve later via <code>completeWorkItem</code>). Concurrency, loose coupling, traceability, and implementation independence are each evidenced by the findings above (dispatch via generic Capability resolution; no Participant-to-Participant coupling; correlation/causation ids; platform blind to Participant's own implementation).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance Criteria: 6 checklist items (no direct coupling, artefacts as primary mechanism, events communicate state changes, independent replaceability, centralised knowledge, full traceability)<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(aggregate of above citations)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each of the 6 criteria maps to an intent already assessed above. 5 of 6 are Fully met on the evidence gathered (no direct coupling; artefacts as primary mechanism; events communicate changes; centralised knowledge; traceability). "Independently replaceable" is Partially met: a Participant is generically resolvable (no hard binding), but automatic replacement on failure is not implemented — replacement is a governance action, not a platform behaviour.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Collaboration services, Event publication framework, Collaboration APIs, Shared engineering artefact interfaces, Collaboration traceability services, Event subscriptions<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts<br>src/domain/engine/eventHandlerRegistry.ts:37-49<br>src/dblayer/knowledgeItemsDB.ts, deliverableReferencesDB.ts, eventsDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">"Event publication framework" (eventBus.ts/eventsDB.ts/event_subscriptions+HANDLER_REGISTRY), "Shared engineering artefact interfaces" (the 6 artefact tables), "Event subscriptions" (event_subscriptions table + HANDLER_REGISTRY, now 11 real handlers, not the 5 the chapter's own §19.2 narrative states — registry has grown since that note was written), and "Collaboration traceability services" (correlation_id/causation_id + actorId/authorityBadge, a property of the generic event mechanism) are all real. "Collaboration services" and "Collaboration APIs" as dedicated, separately named artifacts do not exist: no <code>collaborations</code> table, no <code>CollaborationService</code>, no chapter-specific API route. The capability they would have provided is instead distributed across every entity's own <code>core/<entity>.ts</code> + transitionEngine/eventBus pair.</td>
    </tr>
  </tbody>
</table>
## Summary

Total intents analysed: 24

- Fully met: 13
- Partially met: 9
- Not met: 1
- Not Verifiable: 0

### Major implementation gaps

1. **No dedicated Collaboration layer exists** (§18, §15). There is no `collaborations` table, `CollaborationService`, or Collaboration-specific API surface. The chapter's own capability is realised generically by every other entity's `core/<entity>.ts` + `transitionEngine`/`eventBus` pair — a deliberate structural choice, not an omission in intent, but it means §18's "Collaboration services" and "Collaboration APIs" deliverables have no literal counterpart to cite.

2. **§15's 7 named Collaboration-subsystem events, and §9's 5 named example events, are almost entirely illustrative and not literal event types in the system.** Only `KnowledgeAccepted` (of 5 in §9) exists literally; none of the 7 in §15 exists at all. The real events (`DeliverableTransitioned`, per-state Decision/Evidence events, etc.) carry equivalent substance under different, entity-owned names — this is a naming/illustration gap, not a behavioural one, but §15's specific events are Not Met as literal requirements.

3. **Automatic Participant replacement on failure is not implemented** (§14, FR-14.5, §17 acceptance criterion). A failed/blocked Work Item raises an `AttentionItem` (engineering state is preserved, satisfying the chapter's core continuity concern), but reassignment to a different Participant is a governance/human action, not an automatic platform behaviour. The spec's "Participants may be restarted/replaced" reads as more automatic than the implementation provides.

4. **The actual collaboration flow (§8) is more asynchronous than its own diagram implies.** Deliverable transitions dispatch a Work Item and return immediately; the state change and event publish happen later, on `completeWorkItem`. This does not contradict the chapter's principles (§13 is in fact realised more literally this way) but is a deviation from the diagram's apparent synchronous sequencing.
