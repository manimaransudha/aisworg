# Chapter 9 – Dependency Engine: Implementation Traceability

**Date of report: 4-10-2026**

Note: the chapter's own §19 "Implementation Specifics" section already contains an extensive, repeatedly-revised self-review (dated 2026-08-20, post CR-039–046). This table independently re-verifies that review against the current repository state. Two citation drifts were found (code moved under later CRs, same behaviour) and one substantive drift (Capability-type dependency materialisation, retired 2026-09-04, after the chapter's own last review pass) — called out below where they occur.

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
      <td style="word-break:break-word; overflow-wrap:anywhere;">Dependency Engine governs execution by evaluating deliverable/artefact dependencies, not schedules<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:164-176</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>isTargetReady</code> resolves a Deliverable/Capability's governing <code>dependency_definitions</code> rows and evaluates them live; no scheduling/task-date concept exists anywhere in the module.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Execution is initiated only once dependency conditions are satisfied<br> Ref: §1 Purpose</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:76-100</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>evaluateDeliverableTransition</code> calls <code>isTargetReady</code> before any transition is allowed to proceed; an unsatisfied target returns <code>dependency_not_satisfied</code> and the transition is refused.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable Dependency Graph (nodes: Deliverable/Decision/Knowledge/Evidence/Obligation/External; edges as dependency relationships; authoritative execution model)<br> Ref: §7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/dependencyDefinitionsDB.ts<br>src/dblayer/migrations (072, 074)<br>src/domain/engine/dependencyDefinitionEngine.ts:40-45</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>dependency_definitions</code> is a Template/Pack/Profile-scoped rule set (<code>owning_entity_type IN ('Template','Pack','Profile')</code>), re-evaluated live per SEU via <code>resolveOwningScope</code>, not a per-SEU edge table. Node shape is <code>(entity_type, name?, state)</code>, symmetric on both FROM and TO sides. This is a real graph and is the actual gate on <code>transitionDeliverable</code>/<code>evaluateDeliverableTransition</code>, not a display artefact. Visualisation is a flat per-row list, not a graph view — a cosmetic, not structural, gap against §7's own "graph" framing.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">At minimum: Deliverable, Decision, Knowledge, Evidence, Obligation, External, Capability dependency types are supported<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:75-95 (resolveNamedNode)<br>src/domain/engine/dependencyDefinitionEngine.ts:102-135 (isUnnamedNodeSatisfied)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable, Capability, Decision, Obligation, Evidence, Knowledge all have real evaluation branches. External has none — falls into <code>isUnnamedNodeSatisfied</code>'s fail-closed default (line 131-134) and is never satisfiable.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Capability dependency references the specific Service the Capability exposes, not the Capability in the abstract<br> Ref: §8 (Capability Dependency)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:81-93</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evaluation layer resolves a Capability-type row to the Service/<code>seu_capabilities</code> instance correctly (Service-scoped, as required). However, the authoring/materialisation path that would create such rows from a Template no longer exists: <code>materialiseDependencyGraph.ts:35-44,105-127</code> shows the entire Capability-type materialisation branch commented out, retired 2026-09-04 per an explicit owner decision recorded in-file ("there is no Capability-type edge... deliverable dependency is what is real"). A Capability-type <code>dependency_definitions</code> row can be evaluated correctly if one exists, but nothing in the current platform authors one.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Additional dependency types may be introduced through Packs<br> Ref: §8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/migrations (072:29-38, <code>entity_type</code> as unconstrained <code>TEXT</code>)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Schema deliberately has no CHECK constraint on <code>entity_type</code>, enabling new types without a migration. No Pack-introduced custom dependency type exists today; this is an open extensibility point, not a built feature.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Each dependency exists in one of: Unknown/Pending/Satisfied/Blocked/Invalid/Waived, with traceable state transitions<br> Ref: §9</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:137-149 (isRowSatisfied)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No <code>readiness_state</code> column or per-row state machine exists. <code>dependency_definitions</code> rows are Template-scoped config, not per-SEU stateful instances; satisfaction is a pure recomputation on every check. There is no mechanism for <code>Invalid</code> or <code>Waived</code> (no waiver flow exists). The specification describes a stateful-edge model the implementation does not have, by design, not by omission.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Deliverable is Ready when mandatory dependencies, evidence, decisions, obligations and capabilities are all satisfied; a DeliverableReady event is published<br> Ref: §10</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:148-160,189-221<br>src/domain/engine/qualityGateEngine.ts (requires_accepted_evidence_or_approved_decision, no_unresolved_obligations)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Readiness is satisfied by the combination of two engines: <code>dependencyDefinitionEngine</code> for mandatory dependencies/capabilities, <code>qualityGateEngine</code> for evidence/decisions/obligations. <code>tests/governance-depth.test.ts</code> demonstrates a Deliverable with zero dependency rows still correctly blocked by an unresolved Obligation via Quality Gate. <code>DeliverableReady</code> publishes from <code>evaluateAndPublishFromTransition</code> (dependencyDefinitionEngine.ts:210-220) once a target's governing rows are all satisfied.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Dependency Engine identifies constraints preventing engineering flow (unresolved decisions, missing evidence, incomplete knowledge, unresolved obligations, unavailable capabilities, external approvals), independent of elapsed time<br> Ref: §11</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No Constraint object, table, or proactive detection function exists in <code>src/</code>. <code>isRowSatisfied</code> computes per-row satisfaction but is only invoked on-demand for one target (<code>isTargetReady</code>) or reactively at refusal time, never proactively swept across the whole graph. Quality Gate block reasons and <code>dispatch_deferred</code> are refusal-time analogues, not first-class detected Constraints.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">On Deliverable readiness: identify required capabilities, determine eligible Participants, generate Work Items, select/assign executing Participant via Dispatch Engine; Dependency Engine itself does not assign or execute<br> Ref: §12</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:210-220 (DeliverableReady publish)<br>src/domain/engine/executionEngine.ts (execute chain)<br>src/domain/engine/dispatchEngine.ts</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Full chain (<code>transitionDeliverable</code>/<code>evaluateDeliverableTransition</code> → dependency gate → Quality Gate → Authority/Policy → <code>executionEngine.execute</code> → Work Item → <code>dispatchEngine.dispatch</code>) exists and the Dependency Engine performs no assignment or execution itself. However the chain is pull-only: nothing subscribes to <code>DeliverableReady</code> to auto-trigger the downstream steps; <code>transitionDeliverable</code> must still be invoked by a separate caller. Dispatch itself assigns the sole eligible Participant (<code>SOLE_ELIGIBLE_PARTICIPANT</code>), not a selection among an eligible pool.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Readiness is automatically re-evaluated when Deliverables/Decisions/Knowledge/Evidence/Obligations change, external dependencies change, or the EBM recomposes<br> Ref: §13</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:189-222<br>src/routes/seu/core/workItems.ts:128<br>src/routes/seu/core/capabilities.ts:108</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Event-driven re-evaluation (<code>evaluateAndPublishFromTransition</code>) is wired for exactly 2 of 6 named triggers: Deliverable lifecycle-state change (workItems.ts:128) and Capability fulfilment (capabilities.ts:108). Decision/Knowledge/Evidence/Obligation state changes do not call this function anywhere (<code>decisions.ts</code>/<code>evidence.ts</code>/<code>knowledge.ts</code>/<code>obligations.ts</code> do not import it). External-dependency change has no mechanism (External type unbuilt). EBM recomposition has no runtime event to hook into (<code>ebmsDB.create</code> has one call site, at commissioning).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Dependency Engine maximises engineering flow: identifies unnecessary blocking dependencies, exposes parallel-execution opportunities, detects bottlenecks, recommends decomposition; does not optimise for elapsed time<br> Ref: §14</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No implementation of any of the four listed analyses exists anywhere in <code>src/</code>. The "do not optimise for elapsed time" negative constraint is vacuously true only because no time-based optimisation of any kind exists either.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Dependency Engine publishes: DependencyCreated, DependencySatisfied, DependencyBlocked, DependencyWaived, DeliverableReady, DeliverableBlocked, ConstraintDetected, ConstraintResolved, CircularDependencyDetected<br> Ref: §15</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:210-220 (DeliverableReady)<br>src/domain/engine/executionEngine.ts:84-92 (DeliverableBlocked)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">2 of 9 named events are published. <code>DeliverableReady</code> fires aggregate-only (all governing rows for a target satisfied), not per-row <code>DependencySatisfied</code>. <code>DeliverableBlocked</code> fires with a flattened human-readable <code>reason</code> string, not structured per-row data. Citation note: the chapter's own §19.9 cites <code>deliverables.ts:145</code> for <code>DeliverableBlocked</code>; this logic was moved to <code>executionEngine.ts:84-92</code> under CR-107 (<code>evaluateDeliverableTransition</code>, extracted verbatim from <code>transitionDeliverable</code>) — same behaviour, different file, a citation drift against current code. The remaining 7 events (DependencyCreated, per-row DependencySatisfied/DependencyBlocked, DependencyWaived, ConstraintDetected, ConstraintResolved, CircularDependencyDetected) have no publish site anywhere in <code>src/</code>.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❓</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">NFR: incremental graph updates, deterministic readiness evaluation, concurrent-execution support, scale to large graphs, independence from participant implementation<br> Ref: §16</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:137-176</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evaluation is a pure, stateless recomputation over DB state on every call (deterministic by construction) and carries no participant-implementation dependency. "Incremental updates" and "scale to large graphs" are not independently verifiable from the repository alone — no load/scale test or incremental-update benchmark exists to evidence either claim.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-9.1: every Deliverable exists within the dependency graph<br> Ref: §6 FR-9.1</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:164-176</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">A Deliverable with no governing <code>dependency_definitions</code> row is trivially ready (zero rows = ready). This satisfies "participates in the graph" only in the weak sense that it is queryable against the graph and defaults to unblocked; it is not registered as a graph member independent of whether a rule happens to reference it.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-9.2: every dependency possesses an explicit type<br> Ref: §6 FR-9.2</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/dblayer/migrations (072:29-38)</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Explicit and correctly typed at the TypeScript layer (<code>DependencyDefinitionEntityType</code>), but <code>entity_type</code> columns are unconstrained <code>TEXT</code> at the DB layer with no CHECK constraint — a malformed value could reach the table uncaught by the schema itself.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-9.3: dependency evaluation occurs continuously throughout SEU execution<br> Ref: §6 FR-9.3</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/workItems.ts:128<br>src/routes/seu/core/capabilities.ts:108</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Evaluation is triggered on 2 specific transition events, not on a scheduler or continuous subscription basis. "Evaluated on specific transitions" is real but is not "continuous" as specified.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-9.4: execution readiness determined solely from dependency satisfaction<br> Ref: §6 FR-9.4</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:164-176</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>isTargetReady</code> reads only <code>dependency_definitions</code> rows and their resolved targets; no other input (e.g. elapsed time, participant state) factors into the readiness boolean.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-9.5: the platform detects circular dependencies<br> Ref: §6 FR-9.5</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:486-513,617-624</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>findDeliverableDependencyCycle</code> performs a real DFS cycle detection, called from Template-seed validation (<code>validateTemplateSeed</code>) and blocks saving a Template whose <code>dependencyGraph</code> contains a Deliverable-to-Deliverable cycle. This is authoring-time (static, against the declared graph shape) rather than runtime detection against live per-SEU graph state, and only covers Deliverable-type edges (Capability-type edges are excluded by design, and are also currently unmaterialised — see the Capability finding above). Citation note: this directly contradicts the chapter's own §19.10/§19.11 verdict ("still not built... no CR yet") and its citation of an unresolved deferral comment at <code>templates.ts:200-206</code> — the function now exists at different line numbers with real logic, evidently added after the chapter's last review pass.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-9.6: the platform publishes dependency state changes<br> Ref: §6 FR-9.6</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:210-220<br>src/domain/engine/executionEngine.ts:84-92</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>DeliverableReady</code>/<code>DeliverableBlocked</code> are real and fire on the two wired triggers (Deliverable lifecycle change, Capability fulfilment). Not a full state-change history, and limited to Deliverable/Capability-driven transitions only — Decision/Obligation/Evidence/Knowledge state changes publish nothing.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-9.7: dependencies are fully traceable<br> Ref: §6 FR-9.7</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:169-176<br>src/domain/engine/executionEngine.ts:84-92</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>isTargetReady</code> returns the actual governing rows (not just a boolean), and the <code>DeliverableBlocked</code> <code>reason</code> string names the specific unsatisfied rows at refusal time. Query-time historical traceability (a durable audit trail of dependency state over time) is not present here and is scoped to Chapter 20 (<code>traceability.ts</code>), outside this chapter's own engine.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">❌</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">FR-9.8: external dependencies are represented explicitly<br> Ref: §6 FR-9.8</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">—</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">No evaluation branch, named or unnamed, exists for an External/ExternalInteraction dependency type anywhere in <code>src/</code>. Unlike Decision/Obligation/Evidence/Knowledge, no settled design exists for this type's shape.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: every Deliverable participates in the dependency graph<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:164-176</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same basis as FR-9.1: true in the weak "queryable, defaults to ready" sense, not as a registered membership guarantee.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: circular dependencies are detected<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/routes/seu/core/templates.ts:486-513,617-624</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Same basis as FR-9.5: real but authoring-time/static, Deliverable-edges-only.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Ready Deliverables are identified correctly<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:76-100</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>tests/governance-depth.test.ts</code> and <code>tests/dependency-definition-engine.test.ts</code> exercise this; the combined dependency+quality-gate check correctly identifies both satisfied and blocked cases in the cited tests.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: Blocked Deliverables identify their blocking dependencies<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:84-92</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>DeliverableBlocked</code>'s <code>reason</code> field names every unsatisfied governing row by type/name/state at the point of refusal.</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">⚠️</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: dependency state changes generate events<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/dependencyDefinitionEngine.ts:210-220<br>src/domain/engine/executionEngine.ts:84-92</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">True only for the aggregate Ready/Blocked signal on the 2 wired triggers; not true for per-row dependency state changes (DependencyCreated/Satisfied/Blocked/Waived are unbuilt).</td>
    </tr>
    <tr>
      <td style="word-break:break-word; overflow-wrap:anywhere;">✅</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">Acceptance: execution is initiated only after dependency satisfaction<br> Ref: §17</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;">src/domain/engine/executionEngine.ts:76-100</td>
      <td style="word-break:break-word; overflow-wrap:anywhere;"><code>evaluateDeliverableTransition</code> is the real gate called before <code>execute()</code> proceeds; an unsatisfied target is refused with <code>dependency_not_satisfied</code>.</td>
    </tr>
  </tbody>
</table>
## Summary

- Total intents analysed: 26
- Fully met: 7
- Partially met: 14
- Not met: 4
- Not verifiable: 1

## Major Implementation Gaps

- **External dependency type (§8, FR-9.8)**: no evaluation logic or design exists at any layer.
- **Constraint Detection (§11)** and **Flow Optimisation (§14)**: entirely unbuilt; no Constraint object, proactive sweep, parallelism/bottleneck analysis, or decomposition recommendation exists anywhere.
- **Dependency state model (§9)**: the specified six-state per-edge model does not apply to the implemented config-based, always-recomputed design; `Invalid`/`Waived` have no mechanism (no waiver flow).
- **Events (§15)**: 7 of 9 named events are unbuilt (DependencyCreated, per-row DependencySatisfied/Blocked, DependencyWaived, ConstraintDetected, ConstraintResolved, CircularDependencyDetected).
- **Capability-type dependency authoring (§8)**: evaluation logic exists but the Template-authoring/materialisation path for it was retired 2026-09-04 ("deliverable dependency is what is real") — a decision made after the chapter's own last self-review, so §19's "built, correctly Service-scoped" characterisation is now stale against current code.
- **Circular dependency detection (§7/FR-9.5)**: contrary to the chapter's own §19.10/§19.11 verdict, this is now built (`templates.ts:486-513,617-624`, DFS at Template-seed validation time) — but it is authoring-time/static and Deliverable-edges-only, not live-graph/runtime detection across all dependency types.
- **Dynamic re-evaluation (§13)**: wired for 2 of 6 named triggers (Deliverable state change, Capability fulfilment); Decision/Obligation/Evidence/Knowledge state changes and EBM recomposition do not trigger re-evaluation.
- **Citation drift noted, not a functional gap**: `DeliverableBlocked`'s publish site moved from `deliverables.ts` to `executionEngine.ts:84-92` under CR-107; behaviour is unchanged.
