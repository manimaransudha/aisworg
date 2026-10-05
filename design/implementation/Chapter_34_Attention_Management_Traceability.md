# Chapter 34 – Attention Management Model: Implementation Traceability

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Platform identifies, prioritises, routes and manages situations requiring intervention<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/attentionItems.ts:41-69</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An AttentionItem entity is created with category and priority, but there is no independent evaluation/routing/prioritisation stage — see rows below.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Attention directed only toward situations requiring action/awareness (minimise unnecessary interruptions)<br> Ref: §1 Purpose, AM-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/attentionItems.ts:78-95<br>src/dblayer/attentionItemsDB.ts:79-93</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>raiseAttentionItem</code> dedups against an already-OPEN item for the same (seuId, category, relatedObjectType, relatedObjectId); it does not decide whether the first raise was ever warranted — every call site unconditionally creates one.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Architecture: Events → Attention Evaluation → Attention Items → Routing → Participants/Users/External Systems<br> Ref: §3 Architectural Position</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/attentionItems.ts:41-69<br>src/routes/seu/core/obligations.ts, deliverables.ts, commissioning.ts, workItems.ts, workItemHeartbeat.ts, telemetry.ts, findings.ts, externalInteractions.ts, transitionEngine.ts, executionEngine.ts (all call <code>raiseAttentionItem</code>/<code>createAttentionItem</code> directly)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No Attention Evaluation stage exists. Governance/engine code calls <code>raiseAttentionItem</code> inline at each call site, deciding for itself; no routing stage follows creation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">An Attention Item represents a situation requiring awareness, acknowledgement or action, derived from Events/runtime state<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/attentionItemsDB.ts:5-41<br>src/dblayer/recovery/attention_items_schema_recovery.sql</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>attention_items</code> is a real table; rows are created from call sites embedded in governance/engine code, not from a general Event stream.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not every Event produces an Attention Item<br> Ref: §4 Definition, AM-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none — no evaluation layer)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No code decides, per Event, whether to produce an AttentionItem; creation is at the discretion of whichever call site chooses to call <code>raiseAttentionItem</code>. There is no Event-driven filter.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AM-001 Attention is demand-driven<br> Ref: §5 AM-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/obligations.ts (raiseObligationForBlockedTransition), workItemHeartbeat.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each raise is triggered by a concrete blocked/stalled condition at its call site (a real "demand"), but there is no subsystem that receives all Events and decides demand centrally.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AM-002 Attention shall be minimised; only situations requiring intervention generate items<br> Ref: §5 AM-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/attentionItemsDB.ts:79-93</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only the duplicate-suppression piece exists (§19.3). No judgment of "does this situation actually require intervention" precedes the first raise.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AM-003 Attention shall be prioritised<br> Ref: §5 AM-003</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/attentionItemsDB.ts:17-41 (priority column, default "Medium")</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>priority</code> is a free-text field set by the caller or defaulted; no prioritisation logic evaluates or ranks items.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AM-004 Attention shall be context-aware<br> Ref: §5 AM-004</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/attentionItems.ts:41-69 (seuId, relatedObjectType/Id carried)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Items carry SEU and related-object context, but nothing consumes that context to shape routing or priority (no routing exists at all).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AM-005 Attention routing shall be declarative<br> Ref: §5 AM-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No routing mechanism exists, declarative or otherwise.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">AM-006 Attention decisions shall be traceable<br> Ref: §5 AM-006</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/attentionItems.ts:57-66, 168-177</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>AttentionCreated</code> and <code>AttentionItemTransitioned</code> events are published and presumably persisted via the platform event log; the underlying "decision to raise" is traceable only to its call site in source, not to a routing/evaluation decision record (none exists).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-34.1 Platform shall evaluate Events to determine whether attention is required<br> Ref: §6 FR-34.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none — see §3/§4 rows)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No Event-evaluation function exists; creation is decided inline by each governance/engine call site, not by evaluating an Event against rules.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-34.2 Attention rules shall be contributed through Packs<br> Ref: §6 FR-34.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">grep of src/routes/seu/core/packs.ts and contributionX[] fields</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No <code>contributionAttentionRules[]</code> (or equivalent) exists on Pack composition, unlike <code>contributionQualityGates[]</code>/<code>contributionPolicies[]</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-34.3 Attention Items shall possess explicit priority<br> Ref: §6 FR-34.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/attentionItemsDB.ts:9,26</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>priority</code> column is present and populated (default "Medium"), satisfying "possesses a priority" literally, but it is plain text, not Ontology-backed (no <code>assertCanonicalCategory</code> in attentionItems.ts), and not produced by any priority algorithm (§12/AM-003 gap above).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-34.4 Attention Items shall support acknowledgement<br> Ref: §6 FR-34.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/attentionItems.ts:127-180<br>src/dblayer/seed/data/transitionDefinitions.json:656-662 (Delivered→Acknowledged)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A real, authority- and policy-gated <code>Delivered → Acknowledged</code> transition exists in the lifecycle and is enforced by the generic transitionEngine/qualityGateEngine.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-34.5 Attention Items shall support escalation<br> Ref: §6 FR-34.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/workItemHeartbeat.ts:10,38-80</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No <code>Escalation</code> lifecycle state or declarative escalation-rule mechanism exists. <code>workItemHeartbeat</code> raises an AttentionItem with <code>category: "Escalation"</code> as a plain category value on a stalled Work Item; this is one hardcoded call site, not a general escalation capability, and produces no <code>AttentionEscalated</code> event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-34.6 Attention routing shall consider Authority, responsibility and engineering context<br> Ref: §6 FR-34.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none — no routing exists)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No code resolves recipients from Authority/responsibility/context; <code>AttentionItemRow</code> has no recipient field.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-34.7 Attention history shall remain permanently traceable<br> Ref: §6 FR-34.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/attentionItemsDB.ts:43-74 (no delete/purge function); eventBus publish calls</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Rows are never deleted (no delete method in <code>attentionItemsDB</code>) and <code>findAll</code>/<code>findBySeuId</code> return full history; transitions emit events. History is preserved, though not all six named events are emitted (see §15 row).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Attention Categories (Informational, Action Required, Approval Required, Escalation, Exception, Advisory), extensible via Packs<br> Ref: §7 Attention Categories</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/attentionItemsDB.ts:8,20 (category column)<br>src/routes/seu/core/obligations.ts, etc. (category values used)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>category</code> is a real, used, free-text field; call sites use values matching §7's list (e.g. "Action Required", "Escalation"). Not Ontology-validated and not extensible through a Pack contribution kind (FR-34.2 gap).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§8 Attention Structure: Identifier, Category, Priority, Triggering Event, Related Engineering Objects, Intended Recipients, Required Action, Due Context, Escalation Rules, Status<br> Ref: §8 Attention Structure</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:2037-2050<br>src/dblayer/attentionItemsDB.ts:5-41</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>AttentionItemRow</code> has id, category, priority, triggering_event_id (column exists but never populated by any current caller), related_object_type/id, status. Missing entirely: Intended Recipients, Required Action, Due Context, Escalation Rules — no columns or JSONB for any of the four.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§9 Attention Lifecycle: Created → Delivered → Acknowledged → In Progress → Resolved → Closed; history remains available<br> Ref: §9 Attention Lifecycle</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json:646-684<br>src/routes/seu/core/attentionItems.ts:127-180</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The exact six-state lifecycle is seeded as <code>transition_definitions</code> rows for <code>entityType: "AttentionItem"</code>, each authority- and policy-gated, and driven through the shared <code>transitionEngine</code>/<code>qualityGateEngine</code>. Historical rows are retained (no delete path) and queryable via <code>findBySeuId</code>/<code>findAll</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§10 Attention Evaluation shall consider Events, Deliverable state, Governance outcomes, unresolved Obligations, Review findings, runtime failures<br> Ref: §10 Attention Evaluation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/obligations.ts, deliverables.ts, findings.ts, telemetry.ts (each independently calls raiseAttentionItem)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each named source (Obligations, Deliverables/Quality Gates, Findings, Telemetry) does trigger an AttentionItem raise somewhere in its own module, but there is no single Attention Evaluation function that consumes these six categories of input and decides; the "evaluation" is scattered and ad hoc per call site, with no combined/centralised judgment.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§11 Routing: to AI Participants, Human Participants, SEU Managers, Organisation representatives, external systems; considering Authority, responsibility, availability, organisational preferences<br> Ref: §11 Routing</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(none found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No routing code, no recipient resolution, no consideration of Authority/responsibility/availability/preferences. <code>Delivered</code> exists only as a lifecycle status value; nothing populates who received it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§12 Prioritisation considering engineering/dependency/governance/customer impact, operational risk, urgency; algorithms contributed through Packs<br> Ref: §12 Prioritisation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/attentionItemsDB.ts:9,26</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>priority</code> is whatever the caller hardcodes (or "Medium" default); no algorithm weighs any of the listed impact factors, and no Pack contribution kind supplies one.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§13 Escalation per declarative rules depending on elapsed time, engineering stage, unresolved obligations, repeated failures, governance rules; traceability preserved<br> Ref: §13 Escalation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/workItemHeartbeat.ts:38-80</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only one hardcoded elapsed-time-based escalation exists (stalled Work Item sweep raising a <code>category: "Escalation"</code> item); it is not a declarative rule engine and the other four triggers (engineering stage, unresolved obligations, repeated failures, governance rules) are not implemented. No <code>AttentionEscalated</code> event is published.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§14 Attention Traceability: triggering Event, originating object, routing decision, recipients, acknowledgements, escalations, resolution history all preserved<br> Ref: §14 Attention Traceability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:2037-2050<br>src/routes/seu/core/attentionItems.ts:168-177</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>related_object_type/id</code> (originating object) and <code>status</code>/lifecycle transitions (acknowledgements, resolution) are preserved. <code>triggering_event_id</code> exists as a column but is never populated. Routing decision and recipients are not preserved because they are never produced (§11 gap).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§15 Events: AttentionCreated, AttentionDelivered, AttentionAcknowledged, AttentionEscalated, AttentionResolved, AttentionClosed<br> Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/attentionItems.ts:57-66 (AttentionCreated)<br>src/routes/seu/core/attentionItems.ts:168-177 (AttentionItemTransitioned, generic)<br>src/dblayer/seed/data/eventSubscriptions.json:19,46-47</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only <code>AttentionCreated</code> is published by name. All other lifecycle moves (Delivered, Acknowledged, Escalated, Resolved, Closed) publish the single generic <code>AttentionItemTransitioned</code> event instead of the five specifically named events; <code>executionEngineKickoff</code>/<code>deliverableKickoff</code> subscribe to the generic event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§16 Non-Functional: minimise unnecessary notifications, intelligent routing, traceability, high-volume support, independence from communication technologies<br> Ref: §16 Non-Functional Requirements</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/attentionItemsDB.ts:79-93 (dedup); (no routing, no comms-technology coupling found)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Dedup partially addresses "minimise notifications." No "intelligent routing" exists to assess. Traceability is partial (per §14). No comms-technology coupling was found in attentionItems.ts/attentionItemsDB.ts, so independence from communication technologies holds trivially (nothing sends notifications at all). High-volume support is unverifiable without load evidence.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§17 Acceptance: not every Event creates an item; items prioritised; routing context-aware; escalation declarative; history preserved; routing extensible via Packs<br> Ref: §17 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">(see rows above for each criterion)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Of the six criteria: "not every Event creates an item" — Not met (§4/FR-34.1 row); "items prioritised" — Partially met (free-text only); "routing context-aware" — Not met (no routing); "escalation declarative" — Partially met (one hardcoded case); "history preserved" — Fully met; "routing extensible via Packs" — Not met (no routing, no Pack contribution kind).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§18 Deliverables: Attention Engine, Attention rule framework, Routing service, Escalation service, Attention registry, Attention APIs, Attention events<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/api/attentionItems.ts<br>src/routes/seu/core/attentionItems.ts<br>src/dblayer/attentionItemsDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Built: Attention registry (<code>attention_items</code> table + CRUD/list), Attention APIs (src/routes/seu/api/attentionItems.ts), partial Attention events (AttentionCreated + generic transitioned event). Not built: Attention Engine (no independent evaluation stage), Attention rule framework (no Pack contribution kind), Routing service, Escalation service (only one hardcoded sweep).</td>
    </tr>
  </tbody>
</table>
## Summary

- Total intents analysed: 25
- Fully met: 3 (FR-34.4 acknowledgement support, FR-34.7 history retention, §9 lifecycle)
- Partially met: 16
- Not met: 6 (§3 architecture/routing stage, "not every Event produces an item," FR-34.1 evaluation, FR-34.2 Pack-contributed rules, FR-34.6 routing by authority/responsibility, §11 routing, §12 prioritisation algorithm, §17 acceptance criteria as a set — note: §17 is counted once as a composite Not met since a majority of its six sub-criteria fail)
- Not Verifiable: 0

Major gaps, consistent with the chapter's own §19 Implementation Specifics:
1. No independent Attention Evaluation stage — creation is inline, scattered across governance/engine call sites (§3, FR-34.1).
2. No routing mechanism at all — no recipients, no Authority/responsibility/availability resolution (§11, FR-34.6).
3. No prioritisation algorithm — `priority` is caller-supplied free text (§12, FR-34.3/AM-003).
4. No declarative escalation framework — one hardcoded elapsed-time sweep only, no `AttentionEscalated` event (§13, FR-34.5).
5. No Pack-contributed attention rules or categories (FR-34.2, §7 extensibility).
6. §8 structure missing Intended Recipients, Required Action, Due Context, Escalation Rules columns entirely.
7. Only 1 of 6 named events (`AttentionCreated`) is published by name; the rest collapse into the generic `AttentionItemTransitioned` (§15).
8. `AttentionItem` transition rows in `transitionDefinitions.json` carry no `eventType`/version-event wiring, unlike other entities following the Version Feature Plan.
