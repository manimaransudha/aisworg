# Chapter 32 — Work Item Model: Implementation Traceability

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Work Items are transient execution artefacts, not persistent engineering objects; engineering truth stays in Deliverables/Decisions/Knowledge/Evidence/Obligations<br> Ref: §1 Purpose, §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/workItemsDB.ts:1-197<br>src/routes/seu/core/workItems.ts:204-212</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>work_items</code> rows are created, updated through a lifecycle, and finally moved to <code>Disposed</code> (never deleted). Engineering state lives in <code>deliverables</code>/<code>decisions</code>/<code>knowledge_items</code>/<code>evidence</code>/<code>obligations</code>, written separately from the Work Item row (<code>deliverablesDB.updateLifecycleState</code>, <code>deliverableReferencesDB.record</code>, <code>attestationsDB.create</code>).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Work Items translate engineering intent (Engineering State → Execution Engine → Command → Work Item Generator → Participant → Execution → Engineering State Transition)<br> Ref: §3 Architectural Position</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/workItemGenerator.ts:221-248<br>src/domain/engine/dispatchEngine.ts:91-231<br>src/routes/seu/core/workItems.ts:55-232</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The pipeline is real: a <code>CommandRow</code> is turned into a Work Item (<code>workItemGenerator.generate</code>), dispatched to a Participant (<code>dispatchEngine.dispatch</code>), and the Participant's reported outcome drives the Deliverable's own lifecycle transition (<code>completeWorkItem</code> → <code>deliverablesDB.updateLifecycleState</code>).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">WI-001: Work Items are transient<br> Ref: §5 WI-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/workItems.ts:204-212</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every Work Item that reaches a terminal outcome (<code>done</code> or <code>failed</code>) is moved to <code>Disposed</code>/<code>Failed</code> within the same call; no code path keeps a Work Item open indefinitely once outcome is known.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">WI-002: Work Items are derived from Commands<br> Ref: §5 WI-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/workItemGenerator.ts:228-247</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>generate()</code> takes a <code>CommandRow</code> as its required input and writes <code>command_id</code> as a NOT NULL FK (<code>work_items_schema_recovery.sql:5</code>).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">WI-003: Work Items shall never become the system of record<br> Ref: §5 WI-003</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/workItems.ts:122-164</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Deliverable's own <code>lifecycle_state</code>, <code>deliverable_references</code>, and <code>attestations</code> rows are the durable record of what happened; <code>work_items.output_reference</code> is explicitly commented as non-durable ("not work_items.output_reference" is rejected as the durable home at workItems.ts:140).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">WI-004: Work Items are participant-specific<br> Ref: §5 WI-004</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/workItemsDB.ts:22-33<br>src/domain/engine/dispatchEngine.ts:159-163</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each Work Item carries a single <code>participant_id</code> set at dispatch (<code>assign</code>). However no content on the Work Item is actually shaped per Participant identity/type beyond which one it is routed to (see §10 finding below) — the row itself is identical regardless of which Participant it is assigned to.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">WI-005: Completion of a Work Item does not imply engineering completion; only a successful state transition establishes it<br> Ref: §5 WI-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/workItems.ts:116-213</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>completeWorkItem</code> applies <code>deliverablesDB.updateLifecycleState</code> as its own explicit step, separate from and prior to marking the Work Item <code>Completed</code>/<code>Disposed</code>. On <code>failed</code>/<code>blocked</code> outcome, no Deliverable transition is applied at all (lines 80-113) — only the Work Item and Command are marked <code>Failed</code> and an Attention Item is raised.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">WI-006: Work Items shall remain reproducible<br> Ref: §5 WI-006</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/workItemGenerator.ts:135-201</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>buildDeliverableExecutionContext</code> resolves the execution context deterministically from the Command's own <code>entity_id</code>, the SEU's active EBM pool, and the Command's <code>governance_outcome_id</code> — the same Command input always resolves against the same persisted upstream rows. No randomness or non-deterministic step is present in generation. Re-running generation against the same Command/EBM/governance-outcome state would produce an equivalent context, though the function is not itself invoked twice to re-derive an existing Work Item (no explicit "regenerate" path exists to exercise this).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-32.1: Every Work Item shall reference exactly one Command<br> Ref: §6 FR-32.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/work_items_schema_recovery.sql:5<br>src/domain/engine/workItemGenerator.ts:232</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>command_id UUID NOT NULL REFERENCES commands(id)</code>; <code>create()</code> always supplies exactly one <code>commandId</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-32.2: Multiple Work Items may be generated from the same Command<br> Ref: §6 FR-32.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/workItemGenerator.ts:228-247</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>generate()</code> creates exactly one Work Item per call and is invoked once per Command (no fan-out loop over multiple Participants exists). The chapter's own stated reason, also visible in the code's own header comment (lines 1-11), is that Capability Fulfilment (Ch.12) does not yet support more than one concurrently eligible Participant per Capability, so there is no case today where a second Work Item for the same Command would be generated.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-32.3: Work Items shall reference the current engineering context<br> Ref: §6 FR-32.3, §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/workItemGenerator.ts:135-200<br>src/dblayer/seuTypes.ts:1585-1619</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>execution_context</code> (JSONB) is populated at generation with <code>relevantDeliverable</code>, <code>service</code>, <code>relevantDecisions</code>, <code>supportingEvidence</code>, <code>relevantKnowledge</code>, <code>governingPolicies</code>, <code>applicableAuthority</code>, <code>activeObligations</code>, <code>openAttentionItems</code>, <code>qualityGate</code>, <code>applicableChecklists</code>, <code>engineeringCapital</code>, <code>profileConfiguration</code> — a structured, resolved snapshot, not a bare pointer. This satisfies FR-32.3 directly (stronger than a reference) and also materially satisfies §11's list (see below). Limited to <code>entity_type === "Deliverable"</code> Commands; a non-Deliverable Command (none exist yet in the codebase) gets <code>execution_context: null</code> (workItemGenerator.ts:229).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-32.4: Work Items shall support Participant-specific execution guidance<br> Ref: §6 FR-32.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dispatchEngine.ts:159-163</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Work Item is assigned to one <code>participant_id</code>, but the execution-context payload built in <code>buildDeliverableExecutionContext</code> is identical regardless of which Participant (or Participant type) is later assigned — there is no per-Participant-type shaping of guidance content (see §10 finding).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-32.5: Completed Work Items shall remain traceable<br> Ref: §6 FR-32.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/workItemsDB.ts:187-196<br>src/dblayer/deliverableReferencesDB.ts (referenced at workItems.ts:154-164)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>work_items</code> rows persist after <code>Disposed</code> (never deleted); <code>deliverableReferencesDB.record</code> and <code>attestationsDB.create</code> link <code>workItemId</code> to a durable row. <code>findByCommandIds</code> supports reconstruction by Command.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-32.6: Work Items shall support cancellation<br> Ref: §6 FR-32.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No code path sets a Work Item's status to <code>Cancelled</code>. <code>grep</code> across <code>src/</code> for <code>WorkItemCancelled</code> finds no publisher; <code>Cancelled</code> exists only as a string literal in the <code>WorkItemStatus</code> type and the DB CHECK constraint (<code>work_items_schema_recovery.sql:17</code>), never written by any function.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-32.7: Work Items shall never directly modify engineering state<br> Ref: §6 FR-32.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/workItems.ts:122</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Deliverable transition is applied via <code>deliverablesDB.updateLifecycleState</code>, a dblayer function on the Deliverable's own table, called from <code>completeWorkItem</code> as an explicit, separate step — the Work Item row itself (<code>work_items</code> table) has no write path to <code>deliverables</code>/other engineering tables other than through this one controlled call.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Work Item Components: Identifier, Command Reference, Assigned Participant, Execution Context, Engineering Objective, Input References, Expected Outputs, Constraints, Priority, Status<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/work_items_schema_recovery.sql:3-24<br>src/dblayer/seuTypes.ts:1585-1619</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Present: <code>id</code>, <code>command_id</code>, <code>participant_id</code>, <code>status</code>, <code>execution_context</code> (which itself carries <code>engineeringObjective</code>, <code>inputLocation</code>/<code>outputLocation</code>). Not present as a Work Item field, in <code>execution_context</code> or elsewhere on the row: a distinct "Expected Outputs" field (only <code>outputLocation</code>, a path, not an expectation statement), a "Constraints" field (profile configuration/checklists are adjacent but not a <code>constraints</code> field), and "Priority" (no priority field or value anywhere on <code>work_items</code>). The spec permits implementation-defined internal representation, but these three named components have no corresponding data anywhere on the Work Item.</td>
    </tr>
| Work Item Lifecycle: Generated → Assigned → Executing → Completed → Disposed; Cancelled → Disposed directly | §8 | src/dblayer/seuTypes.ts:1556<br>src/dblayer/workItemsDB.ts:22-46<br>src/routes/seu/core/workItems.ts:62,80-82,204-212 | Actual type is `"Generated" \| "Assigned" \| "Dispatched" \| "Executing" \| "Completed" \| "Failed" \| "Cancelled" \| "Disposed"` — a superset with `Dispatched` and `Failed` added. Real transitions driven: `Generated → Dispatched → Completed → Disposed` (happy path, `dispatchEngine.ts:198` then `workItems.ts:204,211`) or `Generated → Dispatched → Failed` (failure path, `workItems.ts:81`). `Assigned` is set by `workItemsDB.assign` (dispatchEngine.ts:163) but is immediately overwritten to `Dispatched` three lines later (dispatchEngine.ts:198) before anything reads it as a distinct state, and no `WorkItemAssigned` event is ever published for it. `Executing` is declared in the type but no function anywhere sets a Work Item's status to it. `Cancelled` is never set by any code path (FR-32.6 above). | Partially met |
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Disposed Work Items remain available for traceability but are no longer active<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/workItemsDB.ts:177 (<code>countActiveByParticipantId</code> excludes <code>Disposed</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>Disposed</code>/<code>Completed</code>/<code>Failed</code>/<code>Cancelled</code> are excluded from the "active" count used for load-balancing dispatch strategies, and rows are never deleted — satisfies "retained but inactive."</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Work Item Generator derives Work Items from Command, EBM, Participant capabilities, current engineering context, applicable Packs, active Deliverables<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/workItemGenerator.ts:58-201</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>loadEbmPool</code> reads the SEU's active EBM; <code>resolvePackContributedContent</code> traces which Pack(s) contributed the producing Capability and pulls their checklist/engineering-capital entries; <code>buildDeliverableExecutionContext</code> reads the Deliverable itself. Participant capabilities are not consulted inside the Generator — capability-based eligibility is resolved earlier, at Capability Fulfilment time (Ch.12), and consumed downstream by <code>dispatchEngine</code>/<code>dispatchStrategies.ts</code>, not by the Generator itself. This matches the chapter's own architectural position diagram (§3), where Participant selection is a separate stage (Ch.33) after Work Item generation, so the Generator's own inputs are satisfied for Command/EBM/Pack/Deliverable; "Participant capabilities" is satisfied by the pipeline as a whole, not by the Generator function in isolation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Different Participants may receive different Work Items for the same engineering Command<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/workItemGenerator.ts:228-247 (one Work Item per <code>generate()</code> call)<br>src/domain/engine/dispatchStrategies.ts:1-13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Exactly one Work Item is generated per Command today (see FR-32.2 finding); the "different Work Items for different Participants" case cannot occur because only one Work Item, assigned to one Participant, is ever produced per Command. <code>dispatchStrategies.ts</code>'s own header states the seam exists ("different Participants may receive different Work Items... §9/Ch.33 describes") but is not yet exercised because Capability Fulfilment allows only one eligible Participant per Capability today.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Platform shall adapt Work Items according to Participant type (AI: structured prompt/contextual knowledge/execution constraints/expected outputs; Human: objective/background/documents/acceptance expectations; External System: API invocation/payload/parameters/response)<br> Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No adaptation service or function exists anywhere in the codebase. <code>work_items</code> carries no participant-type-specific content field, and <code>execution_context</code> is built identically in <code>buildDeliverableExecutionContext</code> regardless of the eventual Participant's type — the same payload is used whether the assignee is a human, an AI, or an external system. <code>grep</code> for participant-type-conditioned content shaping in the Work Item path returns no matches.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Execution Context shall include relevant Deliverables, applicable Knowledge, supporting Evidence, governing Policies, applicable Authority, active Obligations, current EBM, relevant Ontology concepts<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/workItemGenerator.ts:151-200<br>src/dblayer/seuTypes.ts:1585-1619</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Present on <code>execution_context</code>: <code>relevantDeliverable</code>, <code>relevantKnowledge</code>, <code>supportingEvidence</code>, <code>governingPolicies</code>, <code>applicableAuthority</code>, <code>activeObligations</code>. The current EBM is consulted to build <code>inputLocation</code>/<code>outputLocation</code>, <code>applicableChecklists</code>, <code>engineeringCapital</code>, <code>profileConfiguration</code>, but the EBM itself (e.g. its own identifier/behaviours) is not carried as a field on the context. No "relevant Ontology concepts" field or equivalent exists anywhere on <code>WorkItemExecutionContext</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Completion of a Work Item indicates the assigned Participant completed the requested execution activity; it does not imply Deliverable approval, Decision approval, Knowledge publication, or engineering completion — further governance evaluation remains required<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/workItems.ts:55-232</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>completeWorkItem</code> records the Participant's reported outcome (<code>done</code>/<code>failed</code>/<code>blocked</code>) and, only on <code>done</code>, applies the single governed transition the Command was dispatched for (<code>command.to_state</code>) — it does not independently approve a Deliverable, Decision, or publish Knowledge; those remain separate entities/flows driven by their own transition definitions elsewhere. Governance (policy/authority/quality-gate) checks already ran upstream at dispatch time, not re-run here — this matches the comment at workItems.ts:116-121 explaining why no re-check happens, consistent with "further governance evaluation remains required" being satisfied earlier in the pipeline rather than skipped.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">After completion or cancellation, a Work Item shall be disposed, retaining execution history, execution duration, assigned Participant, generated outputs, originating Command; Disposed Work Items shall not participate in future execution<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/workItems.ts:204-212<br>src/dblayer/workItemsDB.ts:177 (exclusion from active count)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Disposal after completion is real (<code>Completed → Disposed</code> in the same call). Disposal after cancellation cannot occur because cancellation itself is unimplemented (FR-32.6). Retained: assigned Participant (<code>participant_id</code>), originating Command (<code>command_id</code>), generated outputs (via <code>deliverable_references</code>, keyed by <code>work_item_id</code>). Not retained as a discrete field: "execution duration" — <code>created_at</code>/<code>updated_at</code> exist but no computed or stored duration value. Disposed items are excluded from <code>countActiveByParticipantId</code>, satisfying "shall not participate in future execution."</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Traceability: every Work Item shall preserve originating Command, assigned Participant, related Deliverables, execution timestamps, generated outputs, resulting Events, subsequent state transitions, enabling complete reconstruction<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/workItemsDB.ts:136-196<br>src/routes/seu/core/workItems.ts:154-164,193-212</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All named elements are reconstructable, though distributed across tables rather than on one row: <code>command_id</code>→Command; <code>participant_id</code>+<code>ParticipantAssigned</code>/<code>ParticipantIdle</code> events→Participant; <code>deliverable_references</code> (keyed by <code>work_item_id</code>)→related Deliverable and generated output; <code>created_at</code>/<code>updated_at</code>/<code>target_completion_at</code>→timestamps; <code>DeliverableTransitioned</code>/<code>WorkItemCompleted</code>/<code>WorkItemDisposed</code>, correlation/causation-linked via <code>eventBus</code>→resulting Events and state transitions. Reconstruction requires joining across <code>work_items</code>, <code>commands</code>, <code>deliverable_references</code>, and the <code>events</code> table rather than reading one record.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Work Item subsystem shall publish WorkItemGenerated, WorkItemAssigned, WorkItemStarted, WorkItemCompleted, WorkItemCancelled, WorkItemDisposed<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/workItemGenerator.ts:235-245 (<code>WorkItemGenerated</code>)<br>src/routes/seu/core/workItems.ts:91-100,193-212 (<code>WorkItemFailed</code>, <code>WorkItemCompleted</code>, <code>WorkItemDisposed</code>)<br>src/domain/engine/dispatchEngine.ts:209-218 (<code>WorkItemDispatched</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Of the 6 named events: <code>WorkItemGenerated</code> — published. <code>WorkItemCompleted</code> — published. <code>WorkItemDisposed</code> — published. <code>WorkItemAssigned</code> — never published (superseded in practice by <code>WorkItemDispatched</code>, an event not named in §15). <code>WorkItemStarted</code> — never published anywhere (confirmed by <code>grep</code>; only a stale reference exists in <code>src/dblayer/runtimeTelemetryDB.ts:58,76</code> that joins against an event type nothing ever writes). <code>WorkItemCancelled</code> — never published (no cancellation path, FR-32.6). The codebase also publishes <code>WorkItemFailed</code>, <code>WorkItemDispatched</code>, and <code>WorkItemStalled</code> (<code>src/routes/seu/core/workItemHeartbeat.ts:65-74</code>), none named in §15.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Non-Functional: support heterogeneous Participants, remain lightweight, support rapid generation, preserve execution traceability, remain independent of Participant implementations<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/workItemGenerator.ts:1-20<br>src/domain/engine/dispatchStrategies.ts:1-13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">"Preserve execution traceability" is satisfied (§14 finding). "Remain independent of Participant implementations" is satisfied structurally — <code>dispatchEngine</code>/<code>workItemGenerator</code> never branch on Participant implementation details, treating every Participant uniformly via <code>participants</code>/<code>participants_master</code> rows. "Support heterogeneous Participants" cannot be fully assessed because Participant-type-specific adaptation is unimplemented (§10); the platform is heterogeneity-agnostic rather than heterogeneity-aware at the Work Item layer. "Remain lightweight" and "support rapid generation" are not measurable from static code inspection (no performance benchmarks or load tests reference Work Item generation throughput in the repository).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance Criteria: Work Items transient; derived from Commands; different Participants can receive different Work Items for the same Command; Work Items never become engineering records; completion does not itself change engineering state; Work Item history remains traceable<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/workItems.ts:116-213<br>src/dblayer/workItemsDB.ts:187-196</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Five of six criteria hold (transience, Command-derivation, non-system-of-record, completion-does-not-itself-change-state, traceable history — see corresponding findings above). "Different Participants can receive different Work Items for the same Command" does not hold today — only one Work Item is ever generated per Command (FR-32.2/§9 finding).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Work Item Generator, Work Item domain model, Participant adaptation service, Work Item lifecycle service, Work Item APIs, Work Item events, Execution traceability service<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/workItemGenerator.ts<br>src/dblayer/seuTypes.ts:1550-1619<br>src/dblayer/workItemsDB.ts<br>src/routes/seu/core/workItems.ts<br>src/domain/engine/dispatchEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Present: Work Item Generator (<code>workItemGenerator.ts</code>), Work Item domain model (<code>WorkItemRow</code>/<code>WorkItemExecutionContext</code> in <code>seuTypes.ts</code>), Work Item lifecycle service (<code>workItemsDB.ts</code> + <code>completeWorkItem</code>), Work Item events (publishes listed in §15 finding), Execution traceability service (distributed across <code>workItemsDB</code>/<code>deliverableReferencesDB</code>/<code>eventBus</code>, §14 finding). No dedicated "Work Item API" route file was found under <code>src/routes/</code> exposing Work Items directly as a resource (completion is reached via <code>completeWorkItem</code>, called from elsewhere, not from a <code>/work-items</code> REST surface); Participant adaptation service does not exist (§10 finding).</td>
    </tr>
  </tbody>
</table>
## Summary

- Total intents analysed: 25
- Fully met: 12
- Partially met: 9
- Not met: 3
- Not verifiable: 1

## Major Implementation Gaps

1. **One Work Item per Command, always** (§9, FR-32.2, §17) — the "different Participants may receive different Work Items for the same Command" case cannot occur; blocked on Capability Fulfilment (Ch.12) not yet supporting more than one concurrently eligible Participant per Capability. This is a stated, deliberate prerequisite gap, not an oversight.
2. **No Participant Adaptation (§10)** — no service shapes Work Item content differently for AI/Human/External-System Participants; the same `execution_context` payload is used uniformly.
3. **No Cancellation (FR-32.6, §8, §13)** — no code path ever sets a Work Item to `Cancelled`; the "Cancelled → Disposed" lifecycle branch is unrealised.
4. **Event vocabulary diverges from §15** — `WorkItemAssigned` and `WorkItemStarted` are never published (no signal source exists for either); the platform instead publishes `WorkItemDispatched`, `WorkItemFailed`, and `WorkItemStalled`, none named in the chapter.
5. **§7 Work Item Components gap** — no discrete "Expected Outputs," "Constraints," or "Priority" field exists on the Work Item or its execution context.
6. **§11 Execution Context gap** — "relevant Ontology concepts" has no corresponding field anywhere on `WorkItemExecutionContext`; the EBM itself is consulted but not carried as a field.

Note: the chapter's own §19 Implementation Specifics section (dated 2026-09-17) states several of these items as still-open or describes `execution_context` as unassembled. Current code (`workItemGenerator.ts`, `seuTypes.ts`) shows `execution_context` is now a populated, structured field resolved at generation time — §19.7's claim that §7/§11 content is not assembled is out of date; the content is assembled, it is only the specific "Expected Outputs/Constraints/Priority" and "Ontology concepts" fields that remain absent, as reflected in the table rows above.
