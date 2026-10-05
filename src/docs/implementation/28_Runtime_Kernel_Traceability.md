# Chapter 28 – Runtime Kernel: Implementation Traceability

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Runtime Kernel is the foundational runtime environment hosting every commissioned SEU, independent of engineering behaviour<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/dashboard.ts:56-66<br>src/domain/engine/eventBus.ts:1-112</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No single module named "Runtime Kernel" exists. The concept is realised as a set of independent cross-cutting services (Event Bus, telemetry, adapters, middleware) listed explicitly in the dashboard's own architecture self-audit. These services carry no engineering-domain knowledge; engineering behaviour lives in transitionEngine/policyEngine/qualityGateEngine, which the "services" layer merely invokes.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Engineering behaviour belongs exclusively to the EBM; Runtime Kernel provides only the execution environment<br> Ref: §1, RK-001</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/transitionEngine.ts:1-222<br>src/domain/engine/executionEngine.ts:1-60</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Transition/governance logic is isolated in dedicated engine files described in-repo as "pure decision engines" kept separate from orchestration (executionEngine.ts:9-16 comment: "Ch.30's 'engine layer never calls back into core' boundary protects the pure decision engines"). The separation exists, but there is no single bounded "kernel" artefact distinct from the engines — the boundary is a comment-documented convention, not an enforced module boundary (e.g. no separate package/interface preventing an engine file from importing routes/core).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">RK-002: no business-domain logic in the Runtime Kernel<br> Ref: §5 RK-002</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:1-112</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">eventBus.ts, the clearest kernel-service candidate, contains no domain logic — it only persists events and dispatches to registered handlers via HANDLER_REGISTRY. Domain logic lives entirely in the handler functions it calls, outside this file.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">RK-003: Runtime Kernel is Pack-independent; Packs extend behaviour without modifying it<br> Ref: §5 RK-003</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/adapters/adapterRegistry.ts:1-27</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The adapter registry is the one place demonstrating "extend without modifying core": a new ParticipantAdapter is added via <code>registerAdapter</code> with no change to resolution logic (adapterRegistry.ts:19-21 comment makes this claim explicitly). No equivalent exists for Packs extending runtime *services* themselves — dashboard.ts:51 reports "Dependency Manager... nothing resolves them yet (no Pack SDK)" and :50 "Extension Registry... No dynamic Pack discovery."</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">RK-004: Runtime Kernel provides services, not decisions<br> Ref: §5 RK-004</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:94-111</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">eventBus.publish/dispatch make no engineering decisions; they only route. Decisions are made by callers (policyEngine, qualityGateEngine, etc.) before publish is invoked.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">RK-005: runtime services are composable, each with a single responsibility<br> Ref: §5 RK-005</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts<br>src/dblayer/runtimeTelemetryDB.ts<br>src/adapters/adapterRegistry.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The services that do exist (event bus, telemetry queries, adapter resolution) are each single-purpose and independently callable. No composed "kernel" object aggregates them into one addressable runtime surface — composability is file-level, not an explicit kernel API.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">RK-006: Runtime Kernel remains replaceable; individual services evolve independently<br> Ref: §5 RK-006</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Event Bus is documented (eventBus.ts:9-15) as having been redesigned (DB-backed subscriptions, publish/dispatch split) without touching callers' publish-call signatures beyond the actorId/badge requirement. This is evidence of one service evolving independently. No equivalent evidence exists for Scheduling, Observability, Notifications, or Integration Framework, since those are not implemented as distinct replaceable services (see FR-28.5 row below).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-28.1: Runtime Kernel shall host multiple concurrent SEUs<br> Ref: §6 FR-28.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seusDB.ts:16,59,78</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Multiple SEU rows coexist in the <code>seus</code> table and are queried/filtered by <code>lifecycle_state</code>; nothing in the request-handling path restricts the platform to one SEU at a time. "Hosting" is implicit (rows in a shared table, shared Express process) rather than an explicit kernel-managed hosting construct.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-28.2: runtime services shall be isolated between SEUs<br> Ref: §6 FR-28.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/runtimeTelemetryDB.ts:13-19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Telemetry queries accept an optional <code>seuId</code> filter, giving per-SEU data isolation at the query level. Event Bus has no SEU-scoped dispatch isolation — <code>subscribersByEventType</code> is a single process-wide map (eventBus.ts:29) shared across all SEUs; a handler failure or slow handler for one SEU's event is not sandboxed from another SEU's events beyond ordinary per-event try/catch (eventBus.ts:56-66).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-28.3: Runtime Kernel shall expose services through stable interfaces<br> Ref: §6 FR-28.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:69-112<br>src/adapters/participantAdapter.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>eventBus.publish</code>/<code>loadSubscriptions</code> and the <code>ParticipantAdapter</code> interface are the two genuinely stable, typed service contracts found. Scheduling, Observability (beyond ad hoc DB queries), Notifications, and Runtime Administration have no corresponding interface — callers reach the underlying DB layer or route file directly instead of a service interface.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-28.4: runtime services shall remain independent of engineering behaviour<br> Ref: §6 FR-28.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Consistent with RK-002's finding: the Event Bus and adapter registry carry no engineering semantics.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-28.5: Runtime Kernel shall support runtime extensibility<br> Ref: §6 FR-28.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/adapters/adapterRegistry.ts:19-27<br>src/routes/seu/core/dashboard.ts:50-52</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Adapter extensibility is real (RK-003 finding). Pack-driven extensibility of runtime services is explicitly reported absent by the codebase's own architecture audit ("Extension Registry: deferred... no dynamic Pack discovery").</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-28.6: Runtime Kernel shall preserve complete runtime traceability<br> Ref: §6 FR-28.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/eventsDB.ts<br>src/dblayer/runtimeTelemetryDB.ts:30-50</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Event log (<code>events</code> table with correlation_id/causation_id) gives structural traceability of what was published and consumed (eventBus.ts:61,64 records consumption state per handler). State transitions and execution planning are traceable through the same event log and <code>commands</code>/<code>events</code> join (runtimeTelemetryDB.ts:30-50). Scheduling decisions have no traceable record since no Scheduling service exists (dashboard.ts:60: "Scheduling... deferred"). "Complete" traceability is therefore not met for every listed category in §13.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-28.7: Runtime Kernel shall support graceful recovery from runtime failures<br> Ref: §6 FR-28.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:55-66<br>src/app.ts:349-350</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Per-handler failures are caught and recorded as <code>"failed"</code> consumption state without crashing dispatch for other handlers (eventBus.ts:62-64) — this is graceful degradation at the single-event level. There is no broader runtime-failure detection/recovery mechanism (no restart-of-a-failed-service, no RuntimeFailureDetected/RuntimeRecovered event — see §14 row). Process-level signals (SIGTERM/SIGINT) only exit cleanly; they do not recover a failed runtime service.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 State Management: maintains the runtime state of engineering objects<br> Ref: §7 State Management</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seusDB.ts:120<br>src/domain/engine/transitionEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Runtime/lifecycle state is maintained as DB columns (e.g. <code>lifecycle_state</code> on <code>seus</code>, updated via direct UPDATE) and governed through transitionEngine's transition logic. This is state management in substance, implemented as ordinary DB-layer code rather than a distinct "State Management" service.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Event Bus: distributes engineering events<br> Ref: §7 Event Bus</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:69-112</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Fully implemented: DB-backed subscription registry loaded once at boot (app.ts:43), publish persists then dispatches fire-and-forget to resolved handlers.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Execution Planning: produces transient execution plans<br> Ref: §7 Execution Planning</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:63-90<br>src/domain/engine/workItemGenerator.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>executionEngine.evaluateDeliverableTransition</code>/<code>execute</code> compute the next step (Command → Work Item → Dispatch) per transition request, which functions as an execution plan, but the result is not persisted as a standalone "plan" object — it is immediately acted upon and only observable afterward via the Command/Work Item rows and events it produced.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Scheduling: coordinates execution opportunities<br> Ref: §7 Scheduling</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/dashboard.ts:60</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The codebase's own architecture audit states this explicitly: "Scheduling... deferred... Dependency-driven, not time-driven — by design (AP-004)." Work is sequenced by dependency readiness (dependencyDefinitionEngine), not by a Scheduling service that coordinates execution opportunities as the chapter describes.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Observability: provides runtime telemetry<br> Ref: §7 Observability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/runtimeTelemetryDB.ts:1-60<br>src/routes/seu/core/telemetry.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Real: dispatch-latency and command-generation telemetry queries exist and back a UI (telemetry routes/views). Scoped to Engineering Telemetry (Ch.35) categories (Flow, Governance); the chapter's broader "runtime telemetry" (service invocations, scheduling decisions, integration activity) is not covered, consistent with dashboard.ts:59's own "No Runtime/Knowledge/Quality/Collaboration Telemetry categories yet."</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Notifications: publishes engineering notifications<br> Ref: §7 Notifications</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Event Bus publishes events that downstream handlers can act on (e.g. raiseAttentionItem calls seen in executionEngine.ts), but there is no distinct Notifications service (e.g. outbound email/webhook/user-facing alert delivery). Attention Items (src/dblayer/attentionItemsDB.ts) are the closest analogue — an in-app record, not a dispatched notification.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Integration Framework: connects external systems<br> Ref: §7 Integration Framework</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/adapters/adapterRegistry.ts:1-27<br>src/adapters/externalOrchestratorAdapter.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>ParticipantAdapter</code>/<code>adapterRegistry</code> is a real integration seam for Participant delivery (human-on-UI vs. external orchestrator), matching the chapter's extensibility intent for that one surface. No general-purpose Integration Framework exists for other external systems (e.g. the seeded integration Packs for PagerDuty/Datadog/ServiceNow/AWS are static Pack JSON content, not live adapters — dashboard.ts:65: "Messaging... deferred... No broker").</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§7 Runtime Administration: supports operational management<br> Ref: §7 Runtime Administration</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/dashboard.ts:28-69</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The dashboard itself (component status table) is the closest implementation: an admin-facing view of platform/architecture state. No operational controls (start/stop/restart a runtime service, configure a service at runtime) exist — the dashboard is read-only reporting.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§8 Runtime Boundaries: Runtime Kernel shall not define engineering behaviour, governance, knowledge, workflows, or domain semantics<br> Ref: §8 Runtime Boundaries</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts<br>src/adapters/adapterRegistry.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The two clearest kernel-service files (Event Bus, adapter registry) hold no governance/domain logic, consistent with the boundary. Since there is no single bounded "kernel" module, the boundary cannot be verified exhaustively against every file that could be mistaken for kernel code; verified only for the services actually identified as kernel-equivalent.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§9 Runtime Isolation: each SEU executes within an isolated runtime context (state, events, planning, notifications, observability, configuration)<br> Ref: §9 Runtime Isolation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/requireTenant.ts:12-16<br>src/dblayer/runtimeTelemetryDB.ts:13-19</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Isolation exists at the tenancy layer (<code>requireTenant</code> attaches <code>tenantId</code>/<code>isRoot</code>, enforced at DB-query level per CLAUDE.md convention) and at the per-SEU telemetry-query level (<code>seuId</code> filter). Event streams are not SEU-isolated: <code>subscribersByEventType</code> and the dispatch loop are shared process-wide state with no per-SEU partition (eventBus.ts:29,94-111). Configuration isolation per SEU does not exist (dashboard.ts:64: "Configuration... Environment variables, same convention as the rest of this app" — platform-wide, not per-SEU).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Isolation does not prevent controlled collaboration between SEUs where explicitly supported<br> Ref: §9 Runtime Isolation</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/materialiseDependencyGraph.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Not directly evidenced as a deliberate "controlled collaboration" mechanism between separate SEUs; dependency graphs are built per-SEU composition scope (seuCompositionScope.ts). No cross-SEU collaboration pathway was found.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§10 Runtime Lifecycle: Initialised → Available → Hosting SEUs → Maintenance → Shutdown → Archived<br> Ref: §10 Runtime Lifecycle</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/app.ts:331-350</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No lifecycle state machine for the Runtime Kernel itself exists. The process has only a binary listen/exit lifecycle (app.listen, SIGTERM/SIGINT → process.exit). There is no "Maintenance" state, no "Archived" state, and no persisted kernel-lifecycle record. This is distinct from, and not to be confused with, the SEU's own lifecycle (<code>Pending → Commissioned → Configured → Activated → Operational → Suspended</code>, seusDB.ts:16), which is a different, already-implemented lifecycle for a different entity (Ch.37).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Individual SEUs possess independent lifecycles<br> Ref: §10 Runtime Lifecycle</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seusDB.ts:16,120</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each SEU row has its own <code>lifecycle_state</code>, updated independently per row.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§11 Runtime Extensibility: services extend via Packs, configuration, service implementations, integration adapters, without kernel modification<br> Ref: §11 Runtime Extensibility</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/adapters/adapterRegistry.ts:19-27</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Only the "integration adapters" extension path is demonstrated (ParticipantAdapter). Extension via Packs is explicitly reported deferred (dashboard.ts:50-52); extension via "service implementations" has no example beyond the adapter registry.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§12 Runtime Resilience: recover from service failures, isolate failing services, preserve engineering state, maintain event consistency, support controlled restart<br> Ref: §12 Runtime Resilience</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:55-66</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Per-handler failure isolation and state recording exist (consumption state marked <code>"failed"</code>, other handlers unaffected). No controlled-restart mechanism for a failed runtime service exists, and no explicit "isolate failing runtime services" construct beyond the per-handler try/catch — there is no notion of a runtime *service* (as opposed to a single handler invocation) being marked failed/restarted.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§13 Runtime Traceability: service invocations, state transitions, event publication, execution planning, scheduling decisions, integration activities<br> Ref: §13 Runtime Traceability</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/eventsDB.ts<br>src/dblayer/runtimeTelemetryDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Event publication and state transitions are traceable through the <code>events</code> table and telemetry joins. Scheduling decisions are not traceable because no Scheduling service exists (§7 finding above). Integration activities are not traceable beyond the Participant adapter path (no general integration-activity log).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§14 Events: KernelStarted, KernelAvailable, RuntimeServiceStarted, RuntimeServiceStopped, RuntimeFailureDetected, RuntimeRecovered, SEUHosted, SEUReleased<br> Ref: §14 Events</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">None of these eight event types appear anywhere in <code>src/</code> (checked <code>event_registry</code>/<code>event_subscriptions</code> seed, HANDLER_REGISTRY, and all source files). Chapter 30's own traceability note (design/foundations/.../Chapter 30.md:485) independently confirms <code>RuntimeRecovered</code> as "❌ absent, no equivalent." No kernel-level event of any kind is published; the platform publishes engineering-level events (CommandGenerated, WorkItemDispatched, DeliverableBlocked, etc.) exclusively.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§15 Non-Functional Requirements: horizontal scalability, concurrent SEUs, stateless where practical, service isolation, high availability, implementation independence<br> Ref: §15 Non-Functional Requirements</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/app.ts:331-350</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">The app runs as a single Node/Express process with in-memory <code>subscribersByEventType</code> state (eventBus.ts:29) rebuilt once at boot — this is not stateless in a way that supports horizontal scaling (a second instance would need its own boot-time <code>loadSubscriptions</code> call but shares no runtime coordination with the first beyond the shared Postgres DB). No evidence of multi-instance deployment, load balancing, or high-availability configuration in the repository. Concurrent SEUs are supported (FR-28.1 finding).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§16 Acceptance Criteria: multiple SEUs execute concurrently<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/seusDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Consistent with FR-28.1.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§16 Acceptance Criteria: runtime services remain behaviour-independent<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Consistent with RK-002/RK-004.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§16 Acceptance Criteria: runtime services are isolated<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/middleware/requireTenant.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Partial — tenant/SEU-scoped data isolation exists; process-wide shared state (event subscription map) is not isolated. Consistent with FR-28.2/§9 findings.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§16 Acceptance Criteria: runtime failures do not compromise engineering history<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts:55-66<br>src/dblayer/eventsDB.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A failed handler does not roll back or delete the already-persisted event; the event row and its <code>"failed"</code> consumption state remain in the log. Engineering history (the event log itself) is preserved even when a handler fails.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§16 Acceptance Criteria: runtime services expose stable interfaces<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/eventBus.ts<br>src/adapters/participantAdapter.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Consistent with FR-28.3 — true for the two services that exist as named interfaces, not demonstrable for the services that were never built as distinct interfaces (Scheduling, Notifications, Integration Framework, Runtime Administration).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§16 Acceptance Criteria: runtime extensions do not require Runtime Kernel modification<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/adapters/adapterRegistry.ts:19-27</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Consistent with RK-003/FR-28.5 — demonstrated only for Participant adapters.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">§17 Deliverables: Runtime Kernel architecture, service registry, lifecycle management, service interfaces, Kernel APIs, Runtime events, operational documentation<br> Ref: §17 Deliverables</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/dashboard.ts:1-69</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A "Runtime Kernel architecture" is documented, but as an honest-status report of what was *not* built as much as what was (dashboard.ts:1-8 frames itself exactly this way, citing design/mvp-build-plan/MVP Build Plan.md as the authority for each status). No dedicated "runtime service registry" (distinct from eventBus's internal subscription map and adapterRegistry's adapter map — neither is exposed as a unified kernel-wide registry). No Runtime Kernel lifecycle management (§10 finding). No "Kernel APIs" as a named, versioned surface. No Runtime events (§14 finding). Operational documentation exists only as the in-code architecture comments and the dashboard view itself, not a separate operational document.</td>
    </tr>
  </tbody>
</table>
## Summary

Total intents analysed: 40

- Fully met: 10
- Partially met: 26
- Not met: 4
- Not verifiable: 1

## Major implementation gaps

1. **No bounded "Runtime Kernel" artefact.** The chapter describes a single architectural layer with eight named services; the codebase implements some of those services as independent files (Event Bus, telemetry queries, Participant adapters) with no unifying module, registry, or interface that corresponds to "the Runtime Kernel" as an addressable thing. The platform's own dashboard (`src/routes/seu/core/dashboard.ts`) is the only place the concept is named, and it is presented as a self-audit of gaps, not as evidence of a built kernel.
2. **Scheduling is explicitly absent**, by the codebase's own stated design decision (dependency-driven execution instead of time-driven scheduling, "AP-004"). This is a deliberate deviation from §7's "Scheduling" service, not an oversight.
3. **No Runtime Kernel lifecycle** (Initialised → Available → Hosting SEUs → Maintenance → Shutdown → Archived, §10) exists. The only lifecycle in the repository at this layer is the process's listen/exit sequence and the unrelated, already-implemented SEU-entity lifecycle (Ch.37).
4. **None of the eight specified Runtime Kernel events** (§14) are published anywhere in the codebase; the event system publishes only engineering-level events.
5. **No Runtime Administration, Notifications, or general Integration Framework service** exists as a distinct, named construct; the closest analogues (dashboard view, Attention Items, Participant adapter registry) cover only narrow slices of each intent.
6. **Runtime isolation is inconsistent across categories**: tenant/SEU-scoped data isolation is real at the DB-query level, but the Event Bus's subscription-routing state is a single shared in-process map with no per-SEU partition, so "isolation shall include event streams" (§9) is not satisfied for that service.
