# Chapter 31 – Execution Engine: Implementation Traceability

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Execution Engine determines next engineering actions without performing engineering work itself<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:67-490</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>executionEngine</code> only evaluates governance and persists a Command/<code>CommandGenerated</code> event; it never does engineering work itself — <code>commandGeneratedHandler</code>/<code>workItemGeneratedHandler</code>/<code>dispatchEngine</code> carry it from there to a Participant assignment, never to the work itself.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Execution Engine continuously evaluates state and produces execution requests toward Deliverable outcomes<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/deliverableKickoff.ts:19-62<br>src/domain/engine/executionEngineKickoff.ts:27-93</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>deliverableKickoffHandler</code> subscribes to <code>SEUOperational</code>, <code>DeliverableTransitioned</code>, resolved <code>ObligationTransitioned</code>/<code>AttentionItemTransitioned</code> and rescans every Deliverable in the SEU, attempting each one's next Transition Definition. This is a real continuous/reactive evaluation loop, not a one-shot call.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Scope: this chapter covers execution planning, command generation, dependency evaluation, execution coordination, runtime orchestration<br> Ref: §2 Scope</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:67-490<br>src/domain/engine/dependencyDefinitionEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">All five named areas have real code: dependency evaluation is delegated (not duplicated, see §11 row below), command generation and coordination/orchestration live in <code>executionEngine</code>/<code>commandGenerated.ts</code>/<code>workItemGenerated.ts</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Scope exclusion: this chapter does not define engineering behaviour, participant implementations, scheduling algorithms, governance policies<br> Ref: §2 Scope</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">n/a (negative scope statement)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No implementation-relevant intent; confirmed the Execution Engine code does not itself implement Participant behaviour (delegated to <code>dispatchEngine</code>/adapters) or governance rule content (delegated to <code>policyEngine</code>/<code>qualityGateEngine</code>).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Architectural position: Engineering Events -> Execution Engine -> Dependency Evaluation -> Transition Definition Evaluation -> Capability Fulfilment -> Command Generation -> Participants<br> Ref: §3 Architectural Position</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:73-347 (evaluateDeliverableTransition)<br>src/domain/engine/commandGenerated.ts<br>src/domain/engine/workItemGenerated.ts<br>src/domain/engine/dispatchEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>evaluateDeliverableTransition</code> runs the chain in this exact order: dependency readiness (<code>dependencyDefinitionEngine.isTargetReady</code>) -> Transition Definition lookup -> Quality Gate/Policy/Authority -> (in <code>execute</code>) capability-pool snapshot -> Command persisted -> <code>CommandGenerated</code> -> <code>commandGeneratedHandler</code> (Work Item) -> <code>WorkItemGenerated</code> -> <code>workItemGeneratedHandler</code> -> <code>dispatchEngine.dispatch</code> (Participants).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Execution Engine is the central coordinator of engineering execution<br> Ref: §3 Architectural Position</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:67-490</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every step in the chain above either runs inside <code>executionEngine</code> or is triggered directly off an event it publishes (<code>CommandGenerated</code>); no other module independently decides a Deliverable transition should be attempted outside this chain's own entry points (<code>transitionDeliverable</code>, <code>deliverableKickoffHandler</code>, <code>executionEngineKickoffHandler</code>).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Definition: Execution Engine observes Events, evaluates readiness, determines executable transitions, requests capability fulfilment, generates Commands, and does not execute engineering activities directly<br> Ref: §4 Definition</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/deliverableKickoff.ts:19-62<br>src/domain/engine/executionEngine.ts:73-347, 388-419, 432-469</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Observes Events: deliverableKickoff/executionEngineKickoff subscribe to <code>SEUOperational</code>/<code>SEUActivated</code>/<code>DeliverableTransitioned</code>/<code>ObligationTransitioned</code>/<code>AttentionItemTransitioned</code>. Evaluates readiness: dependency/Obligation/Decision/QualityGate/Policy/Authority checks. Requests capability fulfilment: <code>capabilityFulfilmentPoolsDB.create</code> snapshot at lines 388-419. Generates Commands: lines 432-444. Never executes engineering work.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EE-001 Execution is state-driven<br> Ref: §5 EE-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:81-144<br>src/domain/engine/deliverableKickoff.ts:48-61</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every decision reads live DB state at evaluation time (dependency rows, Obligation/Decision rows, SEU <code>lifecycle_state</code>, Deliverable <code>lifecycle_state</code>) rather than trusting any cached/event-carried state.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EE-002 Execution is event-driven<br> Ref: §5 EE-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/eventSubscriptions.json:37-47<br>src/domain/engine/eventHandlerRegistry.ts:37-49</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>SEUActivated</code>, <code>SEUOperational</code>, <code>ObligationTransitioned</code>, <code>AttentionItemTransitioned</code>, <code>CommandGenerated</code>, <code>WorkItemGenerated</code>, <code>DeliverableTransitioned</code> all drive real subscriber calls through <code>HANDLER_REGISTRY</code>; nothing in this chain is polled.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EE-003 Execution shall remain deterministic<br> Ref: §5 EE-003</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:73-347</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Every governance check is a pure function of DB state at call time (no randomness, no wall-clock-only branching observed); re-running the same call against the same DB state yields the same <code>DeliverableGovernanceResult</code>. Dispatch strategy selection (<code>dispatchStrategies.ts</code>, Ch.33) is outside this chapter's own scope.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EE-004 Execution shall remain behaviour-independent<br> Ref: §5 EE-004</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:1-19, 67-490</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>executionEngine</code> never imports or inspects Participant-implementation code; it stops at generating a Command/Work Item and hands Participant selection to <code>dispatchEngine</code> (Ch.33), consistent with the file's own header comment citing this principle.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EE-005 Execution shall remain stateless wherever practical<br> Ref: §5 EE-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngineKickoff.ts:16-18<br>src/domain/engine/deliverableKickoff.ts:1-9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Both kickoff handlers keep no in-memory watch-list; each event carries or resolves to the one entity it concerns, and the handler re-checks live state (<code>attemptSeuCommenceWork</code>'s own re-check, <code>seu.lifecycle_state !== "Operational"</code> guard) rather than trusting the event as authoritative.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">EE-006 Execution shall never bypass governance<br> Ref: §5 EE-006</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:81-291</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>evaluateDeliverableTransition</code> runs dependency readiness, SEU-block/Deliverable-Obligation checks, Decision-approval check, Quality Gate, Policy, and Authority, in that order, before any Command can be generated; every <code>ok:false</code> branch returns before reaching Command generation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-31.1 Execution Engine shall subscribe to engineering Events<br> Ref: §6 FR-31.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seed/data/eventSubscriptions.json:37-47</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real <code>event_subscriptions</code> rows bind <code>executionEngineKickoff</code>/<code>deliverableKickoff</code>/<code>commandGenerated</code>/<code>workItemGenerated</code> handlers to concrete event types, loaded at boot (<code>eventBus.loadSubscriptions</code>).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-31.2 Execution Engine shall continuously evaluate executable engineering transitions<br> Ref: §6 FR-31.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/deliverableKickoff.ts:50-61</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">On each qualifying event, every Deliverable in the affected SEU is rescanned and its next possible transition is attempted — a real continuous evaluation loop driven by the event stream, not a single evaluation per Deliverable lifetime.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-31.3 Execution Engine shall respect Transition Definitions<br> Ref: §6 FR-31.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:172-175, 268-278<br>src/domain/engine/deliverableKickoff.ts:52-53</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>transitionDefinitionsDB.find</code>/<code>findPossibleNextTransitions</code> are the sole source of which hop is attempted and what verb/submit_verb gates it; no hop is attempted without a matching row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-31.4 Execution Engine shall request Capability Fulfilment when required<br> Ref: §6 FR-31.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:396-419</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">When <code>producingCapabilityId</code> is set, <code>execute()</code> snapshots the active-fulfilment pool via <code>capabilityFulfilmentsDB.findActiveManyBySeuCapabilityId</code> into a persisted <code>capability_fulfilment_pools</code> row before dispatch reads it — a real request/snapshot of Capability Fulfilment's own pool, not a re-derivation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-31.5 Execution Engine shall generate Commands<br> Ref: §6 FR-31.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:432-445</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>commandsDB.create</code> persists a real Command row (<code>entityType</code>/<code>entityId</code>/<code>fromState</code>/<code>toState</code>/<code>correlationId</code>/<code>governanceOutcomeId</code>/<code>eligibleParticipantPoolId</code>) on every successful governance evaluation.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-31.6 Execution Engine shall preserve complete execution traceability<br> Ref: §6 FR-31.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/commands_schema_recovery.sql:1-20<br>src/domain/engine/executionEngine.ts:293-345, 369-386</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The Command row links to a persisted <code>governance_evaluation_outcomes</code> row (rationale, quality-gate outcome, satisfied/deviated policy ids, consulted Obligation ids, open Attention Item ids, applicable authority rule) plus <code>correlation_id</code>/<code>created_at</code>. This is the full decision trail for every Command that is generated. <br>**Gap:** a governance evaluation that returns <code>ok:false</code> (blocked) is never persisted as its own record — only the <code>DeliverableBlocked</code> event (no persisted row) or, for Policy/Quality-Gate blocks, a separately-raised Obligation/Attention-Item. There is no durable "this evaluation ran and declined" record for every blocked attempt, only for the ones that happen to also raise an Obligation/Attention Item.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-31.7 Execution decisions shall be reproducible<br> Ref: §6 FR-31.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:81-347</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same as EE-003: every branch is a deterministic function of current DB state; re-running the same evaluation against the same stored state reproduces the same outcome and rationale string.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Execution Inputs: Deliverable state, Dependency Graph, Transition Definitions, active Policies, Review outcomes, Quality Gates, Engineering Behavior Model, incoming Events<br> Ref: §7 Execution Inputs</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:81, 172, 211-219, 247-256</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable state (<code>deliverable.lifecycle_state</code>), Dependency Graph (<code>dependencyDefinitionEngine.isTargetReady</code>), Transition Definitions, Policy (<code>policyEngine.evaluate</code>), Quality Gates (<code>qualityGateEngine.evaluate</code>), EBM (consumed indirectly via Policy's EBM-materialised <code>applicable_policy_ids</code>, and directly in <code>workItemGenerated.ts:22-28</code> for dispatch strategy), incoming Events (the kickoff handlers) are all real, live-read inputs.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Execution Input: active Obligations<br> Ref: §7 Execution Inputs</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:111-124</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>obligationsDB.findByRelatedObject</code> is read for both the owning SEU and the Deliverable itself, and an open (unresolved) block on either returns <code>seu_blocked</code>/<code>obligation_blocked</code> before any Command is generated. This closes the exact gap Chapter 31 §19.3 recorded as 🚩 not built; it is now read and acted on.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Execution Outputs: Commands, capability requests, execution plans, dependency re-evaluations, notification requests, escalation requests<br> Ref: §8 Execution Outputs</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:396-419, 432-469<br>src/routes/seu/core/obligations.ts (raiseObligationForBlockedTransition)<br>src/routes/seu/core/attentionItems.ts (raiseAttentionItem)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Commands: Command row + <code>CommandGenerated</code>. Capability requests: eligible-participant-pool snapshot. Notification/escalation requests: <code>raiseAttentionItem</code> (Quality-Gate block) and <code>raiseObligationForBlockedTransition</code> (Policy block). <br>**Gap:** "execution plans" and "dependency re-evaluations" as distinct output artefacts are not separately represented; a dependency re-evaluation happens only as a side effect of a later kickoff rescan, not as an output the Engine itself emits.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Outputs are requests for action, not engineering outcomes<br> Ref: §8 Execution Outputs</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:450-453</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>execute()</code>'s own comment and code confirm it stops at publishing <code>CommandGenerated</code>; the Command's own <code>status</code> (<code>Generated</code>/<code>Dispatched</code>/<code>Completed</code>/...) tracks the downstream outcome separately, never conflating the request with the result.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Execution Cycle: Observe Events -> Evaluate Engineering State -> Identify Eligible Transitions -> Evaluate Governance -> Request Capabilities -> Generate Commands -> Wait for Events, reactive not sequential<br> Ref: §9 Execution Cycle</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/deliverableKickoff.ts:19-62<br>src/domain/engine/executionEngine.ts:73-347</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The full seven-step cycle is now present end to end: <code>deliverableKickoffHandler</code> observes qualifying Events and re-scans state (steps 1-2); <code>transitionDefinitionsDB.findPossibleNextTransitions</code> identifies eligible transitions (step 3); <code>evaluateDeliverableTransition</code>'s dependency/Obligation/Decision/QualityGate/Policy/Authority chain evaluates governance (step 4); the capability-pool snapshot requests capabilities (step 5); <code>commandsDB.create</code>+<code>CommandGenerated</code> generates Commands (step 6); the handler then returns and the Engine is idle until the next qualifying Event (step 7, "Wait for Events"). This supersedes Chapter 31 §19.1/§19.2's "no component" finding, which predates <code>deliverableKickoff.ts</code>/<code>executionEngineKickoff.ts</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Command Generation: Commands are requests for engineering action, generated only when all prerequisite conditions are satisfied<br> Ref: §10 Command Generation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:81-347, 432-445</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Command is persisted only after <code>evaluateDeliverableTransition</code> returns <code>ok:true</code>, i.e. only after dependency/Obligation/Decision/QualityGate/Policy/Authority/submit/empty-centre checks all pass.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Illustrative Commands (Produce Architecture, Review Design, Execute Tests, Publish Knowledge, Resolve Obligation, Generate Evidence)<br> Ref: §10 Command Generation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">n/a (illustrative only)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">These are stated as examples, not a required enumerated set; <code>commandType</code> is generically <code>${entityType}.Transition</code> and the specific engineering verb is carried by the Transition Definition and Work Item payload, not by a closed Command-type catalogue. No deviation to report — the specification does not mandate these exact labels appear verbatim.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Dependency Integration: Execution Engine collaborates with the Dependency Engine and shall not duplicate dependency logic<br> Ref: §11 Dependency Integration</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:76-100<br>src/domain/engine/dependencyDefinitionEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>evaluateDeliverableTransition</code> calls <code>dependencyDefinitionEngine.isTargetReady</code> rather than re-implementing graph-readiness logic itself; blocked Deliverables, dependency completion, and cascading opportunities are all surfaced through this one call plus the kickoff rescans.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Dependency readiness should reflect the owning SEU's own blocked state, not just the Deliverable's own incoming edges<br> Ref: §11 Dependency Integration (implied by "blocked Deliverables")</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:102-115</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The SEU-blocked check (an open Obligation recorded against the SEU itself) is now a separate, explicit check alongside dependency readiness — closing the gap Chapter 31 §19.4 recorded (dependency readiness alone never saw an SEU-level block).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability Integration: Execution Engine requests Capability Fulfilment; Dispatch Engine subsequently selects the Participant; Execution Engine remains independent of Participant implementations<br> Ref: §12 Capability Integration</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:396-419<br>src/domain/engine/workItemGenerated.ts:53-61<br>src/domain/engine/dispatchEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>execute()</code> snapshots the eligible pool (Capability Fulfilment's own output, Ch.12) and stops; <code>workItemGeneratedHandler</code> hands that snapshot to <code>dispatchEngine.dispatch</code>, which alone picks the Participant and applies the dispatch strategy. <code>executionEngine.ts</code> imports no Participant-implementation code anywhere.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Engineering Parallelism: independent Deliverables may execute simultaneously if dependencies/governance/capabilities allow; concurrency shall never violate correctness<br> Ref: §13 Engineering Parallelism</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/deliverableKickoff.ts:50-61<br>src/domain/engine/executionEngine.ts:146-154</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The kickoff rescan loop attempts every Deliverable in the SEU independently (no artificial serialization across different Deliverables), each gated by its own dependency/governance checks. The <code>already_in_flight</code> check (<code>commandsDB.findInFlight</code>, lines 146-154) prevents a second Command for the *same* Deliverable/hop pair from being generated while one is outstanding, which is the correctness safeguard against duplicate concurrent dispatch for one hop. <br>**Not verifiable:** whether two different Deliverables' concurrent <code>transitionDeliverable</code> calls are safe under true DB-level concurrent execution (e.g. a race inside <code>findInFlight</code> plus <code>create</code>) was not exercised; no test evidence of concurrent-call behaviour was found in this pass.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Execution History: every decision preserves triggering Event, evaluated Transition Definition, Governance outcome, generated Commands, timestamp, rationale, and is immutable<br> Ref: §14 Execution History</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/recovery/commands_schema_recovery.sql:1-20<br>src/domain/engine/executionEngine.ts:293-345, 369-386, 432-445</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">For every successful evaluation: triggering Event is reconstructable via <code>correlation_id</code>; the Transition Definition is implied by <code>from_state</code>/<code>to_state</code> plus the Command's own <code>entity_type</code>; Governance outcome is the linked <code>governance_evaluation_outcomes</code> row (rationale, quality-gate/policy/authority detail); the generated Command is the row itself; timestamp is <code>created_at</code>. No update/delete path was found for <code>commands</code> or <code>governance_evaluation_outcomes</code> rows (append-only via <code>*DB.create</code>), consistent with immutability. <br>**Gap (carried from FR-31.6 above):** a *declined* evaluation (<code>ok:false</code>) has no equivalent persisted row of its own — only Commands for successful evaluations get this full history; a rejected attempt's own triggering Event/rationale is only reconstructable when it happens to coincide with a raised Obligation/Attention Item.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Events: ExecutionEvaluationStarted, ExecutionEvaluationCompleted, CommandGenerated, CapabilityRequested, ExecutionDeferred, ExecutionBlocked<br> Ref: §15 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:90-98, 454-469<br>src/domain/engine/dispatchEngine.ts:137-145</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>CommandGenerated</code> is published exactly as named. The remaining five named events are not published under these literal names: <code>ExecutionEvaluationStarted</code>/<code>ExecutionEvaluationCompleted</code> have no equivalent at all (no event marks the start/end of an evaluation cycle); <code>ExecutionBlocked</code> is realised as <code>DeliverableBlocked</code> (dependency-not-ready case only — Obligation/Decision/QualityGate/Policy/Authority blocks return a result but publish no equivalent "blocked" event, other than the QualityGate case's Attention Item and the Policy case's Obligation); <code>ExecutionDeferred</code> is realised as <code>DispatchDeferred</code>, but that is published by <code>dispatchEngine</code> (Ch.33) for "no eligible Participant," not by the Execution Engine for a governance-level defer; <code>CapabilityRequested</code> has no event at all — the pool snapshot (§12) is a direct DB write, not an event.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Non-Functional: support concurrent execution, remain deterministic, minimise unnecessary evaluations, support horizontal scaling, remain independent of Participant technologies<br> Ref: §16 Non-Functional Requirements</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:146-154<br>src/domain/engine/executionEngineKickoff.ts:16-18</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deterministic: confirmed above (EE-003). Independent of Participant technologies: confirmed above (§12). Minimise unnecessary evaluations: the <code>already_in_flight</code> guard stops a redundant second Command for an outstanding hop. <br>**Not verifiable:** horizontal scaling (multiple Engine instances/workers processing the event stream concurrently without double-processing the same event) was not evidenced one way or the other in this pass — <code>eventBus</code>'s own dispatch-once guarantee under multiple running instances was not inspected.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance Criteria: execution is event-driven; Commands generated only after successful evaluation; dependency/capability evaluation remain independent; execution history is preserved; decisions are reproducible<br> Ref: §17 Acceptance Criteria</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/deliverableKickoff.ts:19-62<br>src/domain/engine/executionEngine.ts:81-490</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Event-driven: ✓ (§9 row). Commands only after success: ✓ (§10 row). Dependency/capability evaluation independent: ✓ (§§11-12 rows). Execution history preserved: partially, per §14's own gap for declined evaluations. Decisions reproducible: ✓ (FR-31.7 row).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverables: Execution Engine, Command generation service, Execution evaluation service, Execution history service, Execution APIs, Execution events, Runtime integration interfaces<br> Ref: §18 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts<br>src/routes/seu/core/deliverables.ts<br>src/routes/seu/api/deliverables.ts<br>src/dblayer/commandsDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Execution Engine / Command generation / evaluation service: <code>executionEngine.ts</code>. Execution history service: <code>commandsDB</code>/<code>governanceEvaluationOutcomesDB</code> (no separate "history service" module, but the capability is present as a queryable trail). Execution APIs: <code>routes/seu/api/deliverables.ts</code> + <code>routes/seu/web/seus.ts</code> (the two call sites of <code>transitionDeliverable</code>). Execution events: <code>CommandGenerated</code>/<code>WorkItemGenerated</code>/<code>DeliverableBlocked</code> (partial per §15 above). Runtime integration interfaces: the <code>event_subscriptions</code>-driven handler chain.</td>
    </tr>
  </tbody>
</table>
## Summary

- Total intents analysed: 32
- Fully met: 22
- Partially met: 9
- Not met: 0
- Not verifiable: 2 (horizontal-scaling NFR not exercised; illustrative Command-type labels not a normative requirement)

## Major implementation gaps

1. **No event for a declined/blocked governance evaluation outside the Obligation/Attention-Item side effects** (FR-31.6, §14, §15) — a governance check that returns `ok:false` without also raising an Obligation or Attention Item (e.g. authority denied, decision blocked, not submitted, empty centre, already in flight) leaves no durable record of the attempt at all, and none of `ExecutionEvaluationStarted`/`ExecutionEvaluationCompleted`/`ExecutionDeferred`/`ExecutionBlocked`/`CapabilityRequested` are published under those names.
2. **"Execution plans" and "dependency re-evaluations" are not distinct output artefacts** (§8) — they exist only as side effects of the next kickoff rescan, not as something the Engine itself emits or records.
3. **Concurrent-call safety for the `already_in_flight` guard is not verified** (§13) — no test evidence found for a true concurrent-dispatch race between two `transitionDeliverable` calls on the same hop.
4. **Horizontal scaling of the event-subscriber chain is not verified** (§16) — whether multiple running Engine instances double-process the same event was not evidenced.

## Note on Chapter 31 §19 (existing Implementation Specifics)

§19 (recorded 2026-09-15) states several items as 🚩 not built that this traceability pass found are now built, evidenced by code dated after that note:

- §19.1/§19.2 ("no component for §9's cycle steps 1-4"): closed by `deliverableKickoff.ts` and `executionEngineKickoff.ts`.
- §19.3 ("active Obligations are not an Execution Input anywhere"): closed by `executionEngine.ts:111-124`.
- §19.4 ("dependency readiness never reads the owning SEU's lifecycle_state/Obligation state"): closed by the SEU-blocked check at `executionEngine.ts:102-115`.
- §19.7 ("retry scoped to one hop, `retrySeuCommenceWork`"): the named function no longer exists; it has been generalised into `executionEngineKickoff.ts`'s shared `attemptSeuCommenceWork`, still SEU-commence-work-scoped but now reached via three event types (`SEUActivated`, `ObligationTransitioned`, `AttentionItemTransitioned`), not Obligation-resolution alone.

§19 itself is left unedited per this skill's constraints; the user should decide whether to refresh it given how much of CR-107's own gap list has since closed.
