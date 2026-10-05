# Chapter 37 – SEU Lifecycle Management: Implementation Traceability

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Runtime Kernel controls creation, activation, operation, evolution, suspension and retirement of an SEU; EBM stays responsible for engineering behaviour<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:353-521<br>src/dblayer/seusDB.ts:117-127</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Creation, activation and operation (Pending → Activated → Operational) are implemented end to end. Evolution, suspension and retirement have no implemented code path (see §9, §10, §12 findings). Engineering behaviour is kept in EBM (<code>ebmsDB</code>/<code>transitionEbm</code>), not in the SEU lifecycle functions.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Chapter scope: lifecycle, transitions, runtime administration, operational evolution, suspension/recovery, retirement<br> Ref: §2 Scope</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Lifecycle and transitions (Commissioned through Operational) are implemented. Runtime administration beyond commissioning, operational evolution, suspension/recovery, and retirement are not implemented anywhere in the repository.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Architectural position: Commissioning → SEU Lifecycle Management → Runtime Kernel → Engineering Execution<br> Ref: §3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:353-521<br>src/routes/seu/core/commissioning.ts:538-611 (<code>attemptSeuCommenceWork</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissioning hands off to lifecycle transitions (<code>finalizeCommissioning</code>), which hand off to the Execution Engine (<code>attemptSeuCommenceWork</code>, triggered off <code>SEUActivated</code>). The ordering matches the diagram for the Commissioned→Operational segment; no code governs anything past Operational.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Lifecycle Management determines whether an SEU may execute, not what it executes<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:538-611</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>attemptSeuCommenceWork</code> gates the Activated→Operational hop on Authority/Policy/Obligations, not on engineering content; what work is dispatched is governed elsewhere (dispatch/execution engine).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">LM-001 Every SEU possesses an explicit lifecycle<br> Ref: §5 LM-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:854-863</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>SeuLifecycleState</code> is a closed union of 9 states (<code>Pending</code>, <code>Commissioned</code>, <code>Configured</code>, <code>Activated</code>, <code>Operational</code>, <code>Suspended</code>, <code>Retired</code>, <code>Archived</code>, <code>Failed</code>), stored as <code>seus.lifecycle_state</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">LM-002 Lifecycle transitions are governed<br> Ref: §5 LM-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:386, 508<br>src/dblayer/seed/data/transitionDefinitions.json (SEU rows)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every state change up to Operational runs through <code>transitionEngine.evaluate</code> before <code>updateLifecycleState</code> is called. For states beyond Operational (Suspend/Resume/Retire/Archive), <code>transition_definitions</code> rows exist but no code ever calls <code>transitionEngine.evaluate</code>/<code>updateLifecycleState</code> to reach them — "governed" is unverifiable for a transition no code can trigger.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">LM-003 Lifecycle transitions are traceable<br> Ref: §5 LM-003</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:391-394, 516-519, 606-610</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each applied transition (Configured, Commissioned, Activated, Operational) publishes an event (<code>SEUConfigured</code>/<code>SEUCommissioned</code>/<code>SEUActivated</code>/<code>SEUOperational</code>) with <code>correlationId</code>/<code>causationId</code>/<code>actorId</code>/<code>authorityBadge</code>, appended immutably to the <code>events</code> table. Transitions beyond Operational are never reached, so they produce no trace at all.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">LM-004 Lifecycle management is independent of engineering behaviour<br> Ref: §5 LM-004</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:636-745 (<code>transitionEbm</code>) vs. 353-521 (<code>finalizeCommissioning</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SEU lifecycle state (<code>seus.lifecycle_state</code>) and EBM status (<code>ebms.status</code>) are separate columns updated by separate functions; one entity's transition does not directly set the other's state field (EBM Activate triggers <code>finalizeCommissioning</code> via an async event subscriber, not a direct state write).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">LM-005 SEUs may evolve without recommissioning where permitted<br> Ref: §5 LM-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No code implements any "evolve an Operational SEU" path (Pack addition/removal, Profile change, Authority/Policy update, Participant change against a live SEU). The only way to change an SEU's composition is a fresh <code>commissionSeu</code> call, which is commissioning, not evolution.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">LM-006 Historical lifecycle state shall remain reproducible<br> Ref: §5 LM-006</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts (append-only <code>events</code> table)<br>src/dblayer/seusDB.ts:117-127</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every lifecycle transition that is actually reached publishes an immutable event recording from/to state and timestamp, so the sequence up to the SEU's current state is reconstructible from the event log. <code>seus.lifecycle_state</code> itself is a single mutable column with no separate history table — reproducibility depends entirely on the event log, not on the SEU row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-37.1 Every commissioned SEU shall possess a globally unique identifier<br> Ref: §6 FR-37.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seusDB.ts:20-30 (INSERT ... id UUID)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>seus.id</code> is a UUID primary key generated at creation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-37.2 Every SEU shall maintain an explicit operational lifecycle state<br> Ref: §6 FR-37.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:854-863, 884</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>lifecycle_state: SeuLifecycleState</code> is a required column on every SEU row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-37.3 Lifecycle transitions shall be governed through Transition Definitions<br> Ref: §6 FR-37.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json (SEU rows)<br>src/routes/seu/core/commissioning.ts:386, 508</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">True for every transition the code actually exercises (Pending through Operational), each routed through a <code>transition_definitions</code> row via <code>transitionEngine</code>. Transitions beyond Operational have rows defined but are dead code (§LM-002).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-37.4 Lifecycle changes shall preserve engineering continuity<br> Ref: §6 FR-37.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:353-521</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commissioning's own asset-creation step (Deliverables, Capabilities) runs once, inside the governed sequence, and is not re-run on any subsequent lifecycle change, because no subsequent lifecycle change (suspend/resume/evolve) is ever triggered in the first place. Continuity is preserved vacuously, not because a tested suspend/resume/evolve path was shown to preserve it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-37.5 Lifecycle history shall remain permanently traceable<br> Ref: §6 FR-37.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:94-111</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed for the reachable portion of the lifecycle (Commissioned→Operational) via the append-only <code>events</code> table. Unreachable transitions (Suspended/Retired/Archived) have no history because they never occur.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-37.6 Multiple SEUs shall execute concurrently<br> Ref: §6 FR-37.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seusDB.ts:20-30, 117-127</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each SEU is an independent row keyed by its own UUID with its own lifecycle state; nothing in <code>commissionSeu</code>/<code>finalizeCommissioning</code>/<code>attemptSeuCommenceWork</code> holds a global lock across SEUs, so concurrent SEUs proceed independently through the same stateless, per-SEU functions.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-37.7 SEUs shall remain operationally isolated<br> Ref: §6 FR-37.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seusDB.ts (seus.tenant_id)<br>src/routes/seu/core/seus.ts:474-481</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each SEU carries its own <code>tenant_id</code>, and dispatch/eligibility lookups (<code>findEligibleParticipants</code>) are scoped by that SEU's <code>tenant_id</code>. Isolation of event streams, telemetry, and Attention Items is structural (every row of those tables carries its own <code>seu_id</code>), but no explicit runtime boundary (e.g. a per-SEU execution context/sandbox) was found — isolation is by foreign-key scoping, not a dedicated isolation mechanism.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">SEU Lifecycle: Commissioned → Configured → Activated → Operational → Suspended → Operational → Retired → Archived<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json (SEU rows)<br>src/routes/seu/core/commissioning.ts:385-394, 508-519, 605-611</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>Commissioned → Configured</code>, and <code>Configured → Activated → Operational</code> match the spec order (note: the code's own comment at commissioning.ts:50-52 states the owner deliberately reordered <code>Configured</code> before <code>Commissioned</code>, i.e. <code>Pending → Configured → Commissioned → Activated</code>, which differs from this section's stated order of <code>Commissioned → Configured → Activated</code>). <code>Operational → Suspended → Operational → Retired → Archived</code> exist only as <code>transition_definitions</code> rows; no code ever calls them.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Suspended SEU may return to Operational without recommissioning<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json (<code>Suspended</code>→<code>Operational</code> row)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The transition row exists, satisfying the governance precondition, but no code path ever reaches <code>Suspended</code> in the first place, so "returning without recommissioning" cannot be exercised.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Archived SEUs remain available for historical reconstruction<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No SEU ever reaches <code>Archived</code> (no code transitions to it), and no "historical reconstruction" view/query for an archived SEU was found.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Lifecycle Transitions: Commission, Configure, Activate, Suspend, Resume, Upgrade, Retire, Archive, each governed through a Transition Definition<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/transitionDefinitions.json (SEU rows)<br>src/routes/seu/core/commissioning.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commission/Configure/Activate are implemented and governed. Suspend/Resume/Retire/Archive have <code>transition_definitions</code> rows but no invoking code. Upgrade has neither a <code>transition_definitions</code> row (no <code>Operational</code>→<code>Operational</code> "Upgrade" or equivalent state-preserving transition was found) nor any code.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Configuration Evolution: active SEU may evolve (EBM updates, Pack add/remove, Profile changes, Authority updates, Policy revisions, Participant changes), preserving continuity; recommissioning required where continuity can't be preserved<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No code implements evolution of an already-Operational SEU's composition. The only composition-changing path is <code>commissionSeu</code>, which only runs against a <code>Pending</code> SEU (reuse-existing-Pending check at commissioning.ts:262-266) — there is no "evolve this Operational SEU in place" function, and consequently no code decides whether continuity can be preserved or forces recommissioning.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Suspension: for maintenance/governance/infrastructure/customer/incident reasons; preserves engineering state, runtime state, pending Commands, active Obligations, engineering traceability<br> Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No suspend action exists in any route, core module, or DB layer function. Nothing in the repository sets <code>lifecycle_state = 'Suspended'</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Recovery: following suspension/failure, restore engineering state, active Participants, runtime services, pending Commands, event subscriptions, engineering context, preserving consistency<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/validateRequest.ts:40, 106, 125 (sets <code>Failed</code>)<br>src/domain/engine/ebmActivated.ts:28 (sets <code>Failed</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A <code>Failed</code> SEU is a terminal dead end — the code sets <code>lifecycle_state = 'Failed'</code> and raises Attention Items/Obligations, but no "recover a Failed SEU back to an operable state" transition or function exists. There is no recovery service of any kind, for either <code>Failed</code> or (the never-reached) <code>Suspended</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Retirement: ends active execution; preserves engineering history, traceability, Knowledge, Decisions, Evidence; does not delete engineering assets<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No retirement action exists. <code>Retired</code>/<code>Archived</code> are unreachable states, so there is no code that stops execution, and no deletion code exists either (so the "does not delete" criterion holds only because no retirement code runs at all, not because a tested retirement path was shown to be non-destructive).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Operational Isolation: isolated runtime services, state, event streams, telemetry, attention items, external interactions per SEU; isolation policies contributed through Packs<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seusDB.ts (seus.tenant_id)<br>every <code>*DB.ts</code> module's <code>seu_id</code>-scoped queries (e.g. externalInteractionsDB.findBySeuId)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every relevant table (events, attention items, external interactions, telemetry) is keyed by <code>seu_id</code> and queried scoped to it, giving structural per-SEU isolation. No "isolation policy contributed through a Pack" mechanism was found — isolation is a fixed schema property, not something a Pack can configure or vary.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Lifecycle Traceability: every transition preserves transition definition, governing authority, engineering rationale, initiating event, timestamp, resulting state; history immutable<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:386-394, 508-519, 605-610<br>src/domain/engine/eventBus.ts:94-111</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">For each reached transition: the transition definition is resolved via <code>transitionEngine.evaluate</code>, the resulting state and timestamp are recorded on the published event, and <code>authorityBadge</code> is recorded (defaulting to <code>"system"</code> for the ungoverned MVP hops). No distinct "engineering rationale" field is captured anywhere (no free-text/structured reason is attached to a lifecycle transition). History is immutable at the event-table level (append-only), but <code>seus.lifecycle_state</code> itself is overwritten in place, so the SEU row alone does not preserve history.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Events: SEUConfigured, SEUActivated, SEUSuspended, SEUResumed, SEUUpgraded, SEURetired, SEUArchived<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:391-394 (<code>SEUConfigured</code>, <code>SEUCommissioned</code>), 516-519 (<code>SEUActivated</code>), 605-610 (<code>SEUOperational</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Published: <code>SEUConfigured</code>, <code>SEUActivated</code> (plus two events the spec list omits: <code>SEUCommissioned</code> and <code>SEUOperational</code>). Never published anywhere in the codebase: <code>SEUSuspended</code>, <code>SEUResumed</code>, <code>SEUUpgraded</code>, <code>SEURetired</code>, <code>SEUArchived</code> — consistent with there being no code that ever drives the SEU into those states.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Non-functional: concurrent SEUs, continuity, runtime recovery, operational isolation, infrastructure-technology independence<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seusDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Concurrency (FR-37.6) and isolation-by-scoping (FR-37.7) hold. Runtime recovery is not implemented (§11). Infrastructure-technology independence is plausible (no infra-specific code in the lifecycle functions) but not verifiable from the repository alone, since no actual infrastructure adapter exists to test swapping.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: every SEU possesses an explicit lifecycle<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seuTypes.ts:854-863</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed — see LM-001.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: lifecycle transitions are governed<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts:386, 508</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">True only for the reachable Pending→Operational segment; see LM-002.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: suspension preserves engineering continuity<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not applicable/not demonstrable: suspension is never triggered.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: retirement preserves engineering history<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not applicable/not demonstrable: retirement is never triggered.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: multiple SEUs execute concurrently<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seusDB.ts:20-30, 117-127</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Confirmed — see FR-37.6.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: lifecycle history remains permanently traceable<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:94-111</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">True for the reachable segment only; see LM-003/FR-37.5.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: SEU Lifecycle Manager, Lifecycle registry, Lifecycle transition service, Suspension and recovery services, Lifecycle APIs, Lifecycle events, Operational administration interfaces<br> Ref: §18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/commissioning.ts<br>src/dblayer/transitionDefinitionsDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Delivered: a lifecycle transition service (<code>finalizeCommissioning</code>/<code>attemptSeuCommenceWork</code>) and the shared <code>transition_definitions</code> table acting as the lifecycle registry, for the Pending→Operational segment. Lifecycle APIs exist only indirectly (commissioning/EBM routes), with no dedicated <code>/seus/:id/suspend</code>, <code>/retire</code>, <code>/archive</code>, <code>/resume</code>, or <code>/upgrade</code> endpoint found in <code>src/routes/seu/api</code> or <code>src/routes/seu/web</code>. Not delivered at all: Suspension and recovery services, and any operational administration interface for suspend/retire/archive/upgrade.</td>
    </tr>
  </tbody>
</table>
## Summary

- Total intents analysed: 32
- Fully met: 7
- Partially met: 17
- Not met: 8
- Not Verifiable: 1

## Major Implementation Gaps

1. **The lifecycle stops at Operational.** Everything from Commissioned through Operational (Commission, Configure, Activate) is implemented, governed, and traceable. Suspend, Resume, Retire, Archive, and Upgrade have `transition_definitions` rows seeded but no code anywhere ever calls `transitionEngine.evaluate`/`updateLifecycleState` to reach them — there are no routes, no core service functions, and no triggering events for any of these five transitions.
2. **No Suspension/Recovery service exists** (§10, §11): nothing preserves/restores pending Commands, active Obligations, or runtime state around a suspension, because suspension itself cannot occur. The only terminal non-Operational state actually reachable is `Failed`, which has no recovery path back either.
3. **No Retirement service exists** (§12): no code stops execution, and no "preserve Knowledge/Decisions/Evidence on retirement" logic was found, because retirement is never triggered.
4. **No Configuration Evolution mechanism exists** (§9, LM-005): an Operational SEU cannot have its Packs/Profile/Authority/Policy/Participants changed in place; the only composition-changing operation is a fresh commission against a `Pending` SEU.
5. **Event vocabulary gap** (§15): `SEUSuspended`, `SEUResumed`, `SEUUpgraded`, `SEURetired`, `SEUArchived` are never published anywhere in the codebase; the implementation additionally publishes two events the chapter does not list (`SEUCommissioned`, `SEUOperational`).
6. **No per-SEU operational administration interface** (§18): no API/web routes for suspend, resume, retire, archive, or upgrade exist, consistent with the missing service logic above.
7. **Lifecycle order deviates from §7's stated sequence**: the implementation runs `Pending → Configured → Commissioned → Activated`, deliberately reordering `Configured` ahead of `Commissioned` (commissioning.ts:50-52's own comment records this as an explicit owner decision), whereas §7 states `Commissioned → Configured → Activated`.
