
# Chapter 9 – Dependency Engine

[Sudha: 
we've reached the point where **Part I is complete**.

Let's check:

- ✅ SEU
- ✅ Engineering Behavior Model
- ✅ Composition Engine
- ✅ Pack Model
- ✅ Template Model
- ✅ Profile Model
- ✅ SEU Commissioning

There is one thing that is still missing before an SEU starts working.

It is something we have deliberately postponed because we kept discovering better abstractions.

Originally we called it:

- AI Project Manager
- AI Orchestrator
- Scheduler
- Dependency Manager
- Flow Engine

I now think we know exactly what it is.

It is **the Dependency Engine**.

Not because it schedules work.

Because it decides **what engineering outcome becomes achievable next**.

]
---

# 1. Purpose

The **Dependency Engine** is responsible for governing execution within a Software Engineering Unit (SEU).

Unlike traditional project management systems, which organise execution around schedules and tasks, the Dependency Engine organises execution around **deliverables and their dependencies**.

The Dependency Engine continuously evaluates engineering readiness by determining which deliverables are capable of progressing based upon the current engineering state.

Execution within an SEU is initiated only when dependency conditions have been satisfied.

---

# 2. Scope

This chapter defines:

- dependency model;
- dependency graph;
- readiness evaluation;
- dependency state;
- dependency resolution;
- execution triggering;
- dependency monitoring.

This chapter does not define:

- engineering behaviour;
- participant reasoning;
- work item execution;
- project scheduling.

---

# 3. Architectural Position

```
Knowledge
      │

Deliverables
      │

Obligations
      │

Decisions
      │

Evidence
      │

──────────────

Dependency Engine

──────────────

Ready Deliverables

↓

Capability Fulfilment

↓

Execution
```

The Dependency Engine determines **what may execute**.

It never performs execution itself.

---

# 4. Architectural Responsibilities

The Dependency Engine shall:

- maintain the Deliverable Dependency Graph;
- determine engineering readiness;
- identify blocked deliverables;
- identify dependency constraints;
- detect circular dependencies;
- publish dependency state;
- trigger execution readiness events.

The Dependency Engine shall not:

- schedule participants;
- execute work;
- generate engineering behaviour;
- preserve knowledge.

---

# 5. Fundamental Principle

The unit of execution within an SEU is the **Deliverable**.

Work Items exist solely to create, modify or validate Deliverables.

Dependencies are relationships between Deliverables and other engineering artefacts.

The Dependency Engine operates exclusively upon those relationships.

---

# 6. Functional Requirements

### FR-9.1

Every Deliverable shall exist within the Deliverable Dependency Graph.

---

### FR-9.2

Every dependency shall possess an explicit type.

---

### FR-9.3

Dependency evaluation shall occur continuously throughout SEU execution.

---

### FR-9.4

Execution readiness shall be determined solely from dependency satisfaction.

---

### FR-9.5

The platform shall detect circular dependencies.

---

### FR-9.6

The platform shall publish dependency state changes.

---

### FR-9.7

Dependencies shall be fully traceable.

---

### FR-9.8

External dependencies shall be represented explicitly.

---

# 7. Deliverable Dependency Graph

The Dependency Engine maintains a directed graph describing engineering relationships.

Nodes represent:

- Deliverables
- Decisions
- Knowledge
- Evidence
- Obligations
- External Dependencies

Edges represent dependency relationships.

The graph constitutes the authoritative execution model of the SEU.

---

# 8. Dependency Types

The platform shall support, at minimum, the following dependency types.

## Deliverable Dependency

One Deliverable depends upon another.

---

## Decision Dependency

Execution requires an approved decision.

---

## Knowledge Dependency

Execution requires sufficient engineering knowledge.

---

## Evidence Dependency

Execution requires evidence.

---

## Obligation Dependency

Execution is blocked by an unresolved obligation.

---

## External Dependency

Execution depends upon an external organisation, system or participant.

---

## Capability Dependency

Execution requires one or more capabilities to become available.

Where the dependency concerns a specific contracted output rather than the Capability in the abstract, it shall reference the specific Service (Chapter 11) that Capability exposes — for example, the Approved Solution Architecture service, not the Architecture Capability generally. This gives the dependency a precise, evaluable condition rather than a vague notion of availability.

---

Additional dependency types may be introduced through Packs.

---

# 9. Dependency States

Each dependency shall exist in one of the following states.

- Unknown
- Pending
- Satisfied
- Blocked
- Invalid
- Waived

State transitions shall remain fully traceable.

---

# 10. Deliverable Readiness

A Deliverable shall be considered **Ready** when:

- all mandatory dependencies are satisfied;
- required evidence exists;
- required decisions are approved;
- blocking obligations have been resolved;
- required capabilities are available.

The Dependency Engine shall publish a **DeliverableReady** event.

---

# 11. Constraint Detection

The Dependency Engine continuously identifies constraints preventing engineering flow.

Examples include:

- unresolved engineering decisions;
- missing evidence;
- incomplete knowledge;
- unresolved obligations;
- unavailable capabilities;
- external approvals.

Constraint detection shall remain independent of elapsed time.

---

# 12. Execution Trigger

When a Deliverable becomes Ready:

- the Dependency Engine shall identify the capabilities required to progress it;
- the Capability Fulfilment service shall determine the eligible Participants for those capabilities;
- Work Items shall be generated as required;
- the Dispatch Engine shall select and assign the executing Participant from the eligible pool;
- execution may commence.

The Dependency Engine does not assign Participants or generate engineering behaviour.

---

# 13. Dynamic Re-evaluation

The Dependency Engine shall automatically re-evaluate readiness whenever:

- Deliverables change;
- Decisions change state;
- Knowledge is accepted;
- Evidence is added;
- Obligations are resolved;
- external dependencies change;
- the Engineering Behavior Model changes through authorised recomposition.

---

# 14. Flow Optimisation

The Dependency Engine shall maximise engineering flow by:

- identifying unnecessary blocking dependencies;
- exposing opportunities for parallel execution;
- detecting bottlenecks;
- recommending decomposition of large Deliverables where appropriate;
- continuously re-evaluating execution readiness.

The Dependency Engine shall not optimise for elapsed time.

---

# 15. Events

The Dependency Engine shall publish:

- DependencyCreated
- DependencySatisfied
- DependencyBlocked
- DependencyWaived
- DeliverableReady
- DeliverableBlocked
- ConstraintDetected
- ConstraintResolved
- CircularDependencyDetected

---

# 16. Non-Functional Requirements

The Dependency Engine shall:

- support incremental graph updates;
- evaluate readiness deterministically;
- support concurrent execution;
- scale to large dependency graphs;
- remain independent of participant implementation.

---

# 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Every Deliverable participates in the dependency graph.

✓ Circular dependencies are detected.

✓ Ready Deliverables are identified correctly.

✓ Blocked Deliverables identify their blocking dependencies.

✓ Dependency state changes generate events.

✓ Execution is initiated only after dependency satisfaction.

---

# 18. Deliverables

Implementation of this chapter shall produce:

- Deliverable Dependency Graph.
- Dependency Engine.
- Dependency Evaluation Service.
- Constraint Detection Service.
- Flow Analysis Service.
- Readiness Evaluation API.
- Dependency Events.


[Sudha: This chapter captures one of the most significant departures from traditional software engineering platforms.

However, while writing it, I realised there's an important distinction we should preserve going forward.

The **Dependency Engine** should not decide **how** to satisfy a dependency. It should only determine **whether** the dependency has been satisfied.

For example:

- It should determine that an architecture decision is required.
- It should not decide what the architecture should be.
- It should determine that a security review is outstanding.
- It should not perform the security review.
- It should determine that a capability is required.
- It should not decide whether that capability is fulfilled by an AI participant, a human expert or an external service.

This reinforces a principle that has been emerging throughout the architecture:

> **Evaluation and execution are separate responsibilities.**

The Dependency Engine evaluates engineering state. Other components act upon that evaluation. Maintaining that separation will keep the architecture modular, testable and extensible as the platform evolves. I think it's worth capturing this as another ADR because it clearly delineates responsibilities between orchestration and execution.]

---

# 19. Implementation Specifics

*(2026-08-20 — reviewed against the real codebase, not assumed from the chapter alone. The whole real footprint of this chapter is two files: `src/domain/engine/dependencyEngine.ts` (81 lines) and `src/dblayer/dependencyEdgesDB.ts` (85 lines) — everything below cites real file:line evidence, not intent.)*

**The honest one-line characterisation:** what got built is a *Deliverable sequencing gate* — it answers "has the upstream artefact reached the required state, and is someone assigned to the upstream Capability?" — not the general-purpose Dependency Engine this chapter describes. The platform's own dashboard already says as much (`src/routes/seu/core/dashboard.ts:42`): *"Dependency Engine sequences Deliverables; no separate Workflow abstraction."*

## 19.1 ⚠️ Deliverable Dependency Graph (§7) — a Deliverable→Deliverable/Service edge table, not a general graph

`dependency_edges` (`src/dblayer/migrations/002_seu_platform.sql:234-249`) is a single table, not a general node/edge model: `from_deliverable_id` is always a Deliverable; `to_deliverable_id` or `to_service_id` (exactly one, enforced by the `dependency_target_matches_type` CHECK, `:244-248`) is the target. **2 of the 6 node types §7 lists are representable** (Deliverable, and Service as the concrete stand-in for Capability) — Decisions, Knowledge, Evidence, and Obligations have no column and no CHECK value; the constraint would reject them outright.

This is stated in the migration's own header (`:229-232`): *"Only Deliverable and Capability edge types (of the six Ch.9 names) — Obligation/Decision/Knowledge/Evidence edges don't exist because those four object models don't exist in MVP."* That comment is now dated — those four object models exist today with real tables — they were just never wired into `dependency_edges`; they gate through `qualityGateEngine` instead (§19.4 below).

The graph is per-SEU (`seu_id NOT NULL`) and populated only at commissioning from the Template's `deliverableCatalogue` (`src/routes/seu/core/commissioning.ts:186-208`) or via `createDeliverable` (`src/routes/seu/core/deliverables.ts:54-67`) — there is no route to add a dependency edge to an already-commissioned Deliverable. The only visualisation is a per-Deliverable list on the SEU detail page (`src/views/seu/seus/detail.ejs`, fed by `src/routes/seu/core/seus.ts:265-292`), not a graph view.

## 19.2 ⚠️ Dependency Types (§8) — 2 of 7 built, and the built ones are done properly

| Type | Status |
|---|---|
| Deliverable Dependency | ✅ built (`dependencyEdgesDB.createDeliverableEdge`, `:6-24`; evaluated `dependencyEngine.ts:43-52`) |
| Capability Dependency | ✅ built, and correctly Service-scoped |
| Decision / Knowledge / Evidence / Obligation / External Dependency | ❌ not built — zero references anywhere in `src/` |

The Capability type's Service-scoping (§8's own requirement — "the Approved Solution Architecture service, not the Architecture Capability generally") is genuinely honoured: `commissioning.ts:198-208` resolves a required capability to its `services` rows and creates one edge per Service, with a comment explicitly citing "Ch.9 §8." The Deliverable/Capability distinction is real and non-redundant (`src/dblayer/seuTypes.ts:151-155`: a Deliverable edge asks "is the upstream artefact in the right state?", a Capability edge asks "is anyone actually assigned to it for this SEU?") — `tests/service-dependency.test.ts:36-58` proves both exist side by side on the same Deliverable.

Authoring surface is exactly two Template seed fields (`dependsOnDeliverableCodes`, `dependsOnCapabilityServiceCodes`, `seuTypes.ts:145-157`) — no authoring path exists for the other five types.

## 19.3 ⚠️ Dependency States (§9) — 4 of 6 declared, only 3 of 6 ever produced

```ts
export type ReadinessState = "Unknown" | "Pending" | "Satisfied" | "Blocked";  // seuTypes.ts:313
```

`Invalid` and `Waived` don't exist anywhere in the codebase — no waiver mechanism for a dependency edge at all. Of the 4 declared, **`Blocked` is never actually produced** — `dependencyEngine.evaluateEdge` (`:42-65`) only ever returns `Unknown`, `Satisfied`, or `Pending`. A dependency that will never be satisfied is indistinguishable from one that's merely pending.

"State transitions fully traceable" (§9's own requirement) is not built: `dependencyEdgesDB.updateReadiness` (`:73-84`) is a bare in-place `UPDATE ... SET readiness_state = $1`, no history row, no event — unlike every other governed lifecycle in this platform, which routes through `transitionEngine` and leaves a real events-table record.

Satisfaction is genuinely computed on the fly, not tracked as owned state: `isReachedOrPassed` (`dependencyEngine.ts:27-39`) does a live BFS through the real `transition_definitions` graph (so an upstream Deliverable that moves *past* the required state still satisfies it), and the stored column is explicitly documented as a stale write-side cache (`src/routes/seu/core/seus.ts:271-276`): *"the stored readiness_state is only updated as a side effect of a transition attempt on this exact Deliverable, so reading it raw shows stale status on every plain page load."*

## 19.4 ⚠️ Deliverable Readiness (§10) — split across two engines, not owned by one

`isDeliverableReady` (`dependencyEngine.ts:74-80`) requires every outgoing edge `Satisfied`. Against §10's five criteria:

| §10 criterion | Where it actually lives |
|---|---|
| mandatory dependencies satisfied | ✅ Dependency Engine — but there is no mandatory/optional distinction; every edge is mandatory |
| required capabilities available | ✅ Dependency Engine — Capability-type edges |
| required evidence exists / decisions approved / obligations resolved | ⚠️ **`qualityGateEngine.ts`**, a separate engine, not this one |
| publishes `DeliverableReady` | ❌ not built |

This split is deliberate, not an oversight — `src/routes/seu/core/deliverables.ts:99-105` cites "Ch.26 §3's own architectural position: Policies/Reviews/Evidence/Knowledge/Decisions/Obligations feed a Quality Gate, which is itself an input to Governance" as the reason. `tests/governance-depth.test.ts:63-97` proves the split works (zero dependency edges, `ready: true`, yet still blocked by an Obligation via the Quality Gate). But it does mean §10's own wording — ascribing all five criteria to *this* engine — doesn't match what got built.

A real, documented, still-open gap: `design/mvp-build-plan/Open Design Questions.md` §1 records that `isDeliverableReady` gates *every* transition of a Deliverable, not just the one that actually needs the dependency — an Architecture Document can't even move `Defined -> In Progress` until Requirements is `Approved`. Fixing it needs a real schema change (an edge would need to carry which transition it gates). Deliberately left unresolved.

## 19.5 ❌ Constraint Detection (§11) — not built

No Constraint object, no constraint table, no detection function exists. The nearest analogues are Quality Gate block reasons (`qualityGateEngine.ts:99-101`, `:124`) and `dispatch_deferred` (`deliverables.ts:225-230`) — both are rejection reasons surfaced at the moment a transition is attempted, not first-class detected Constraints existing independently of an attempt. "Incomplete knowledge" and "external approvals" (both named in §11) have no mechanism at all.

## 19.6 ✅ Execution Trigger (§12) — built end to end, but pull-triggered and 1:1 dispatch

The full chain exists: `transitionDeliverable` → dependency gate → Quality Gate → Authority/Policy → `executionEngine.execute` → `CommandGenerated` → `workItemGenerator` → `WorkItemGenerated` → `dispatchEngine.dispatch` → Capability Fulfilment lookup → assign (or `DispatchDeferred`). All real, all cited with file:line in the investigation behind this section.

Two differences from §12 worth recording: (1) **the trigger is pull, not push** — nothing observes readiness and fires; the chain only starts when someone calls `transitionDeliverable`, so a Deliverable that *becomes* ready sits idle until a human or API caller attempts its transition (no `DeliverableReady` event, no subscriber). (2) **Dispatch is 1:1, not a selection** — `dispatchEngine.ts:1-7` states plainly that Capability Fulfilment "today is 1:1 per SEU Capability, so there's nothing to optimise yet" (the constant is literally `SOLE_ELIGIBLE_PARTICIPANT`); §12's "finds eligible Participants [plural] → Dispatch Engine selects" is a single lookup, not a selection.

One real, useful consumer of the graph beyond gating: `src/adapters/assignmentDelivery.ts:28-43` walks outgoing Deliverable edges to pull each upstream Deliverable's recorded VCS reference and hands it to the Participant as `inputReferences`.

## 19.7 ⚠️ Dynamic Re-evaluation (§13) — lazy, not continuous

Exactly two call sites re-evaluate edges in the whole codebase: a transition attempt on that one Deliverable (`deliverables.ts:126`), and rendering the SEU detail page, for display only (`seus.ts:277`). There is no event-driven re-evaluation — `eventBus.subscribe` has exactly one subscriber platform-wide (`assignmentDelivery.ts:102`, unrelated to dependencies) and `dependencyEngine.ts` doesn't import `eventBus` at all. Of §13's six re-evaluation triggers, only "a Deliverable changes" has any effect, and even that is lazy (next transition attempt or next page view, not immediate). Decision/Knowledge/Evidence/Obligation changes, external-dependency changes, and EBM recomposition have zero effect on the graph.

## 19.8 ❌ Flow Optimisation (§14) — not built at all

Exhaustive search confirms nothing exists: no unnecessary-blocking-dependency detection, no parallel-execution exposure (Open Design Questions §1, cited above, notes current semantics actively *prevent* some parallelism), no bottleneck detection, no decomposition recommendation.

## 19.9 ❌ Events (§15) — 0 of 9 built

`DependencyCreated`, `DependencySatisfied`, `DependencyBlocked`, `DependencyWaived`, `DeliverableReady`, `DeliverableBlocked`, `ConstraintDetected`, `ConstraintResolved`, `CircularDependencyDetected` — **zero of these nine literally exist anywhere in the codebase.** `dependencyEngine.ts` does not import `eventBus`; `updateReadiness` writes the DB column and publishes nothing. The nearest functional substitutes are `QualityGateBlocked`/`QualityGatePassed` and `DispatchDeferred` — different subsystems' events, about different things.

## 19.10 Functional Requirements scorecard (§6)

| FR | Verdict |
|---|---|
| FR-9.1 (every Deliverable in the graph) | ⚠️ every Deliverable is reachable by the engine, but only appears in `dependency_edges` if the catalogue declared a dependency for it — one with none has zero edges and is trivially ready |
| FR-9.2 (every dependency has an explicit type) | ✅ built — DB-enforced via CHECK constraints |
| FR-9.3 (continuous evaluation) | ❌ not built as specified — two on-demand call sites, no scheduler, no subscription |
| FR-9.4 (readiness determined solely from dependency satisfaction) | ✅ built, strictly — `isDeliverableReady` reads nothing but edges and their targets (though this holds *because* Evidence/Decision/Obligation gating moved to Quality Gate — see §19.4's tension with §10) |
| FR-9.5 (circular dependency detection) | ❌ not built — `templates.ts:121-128` rejects an out-of-order `dependsOnDeliverableCodes` reference at Template-authoring time, which prevents cycles on that one path (and only that path — `createDeliverable` accepts arbitrary edges unchecked); `traceability.ts`'s `impactOfDeliverable` survives a cycle via a visited set but never reports one. Neither is detection. |
| FR-9.6 (dependency state changes published) | ❌ not built |
| FR-9.7 (dependencies fully traceable) | ⚠️ query-time traceability is genuinely rich — `src/routes/seu/core/traceability.ts`'s `explainDeliverable`/`impactOfDeliverable` (backward provenance + forward impact, real functions, real citations) — but that module is scoped to Ch.20 (FR-20.3–20.7), not this chapter, and state-*change* history (who changed what, when) doesn't exist for a dependency edge at all |
| FR-9.8 (external dependencies represented explicitly) | ❌ not built, and currently unrepresentable — the `dependency_type` CHECK admits only `'Deliverable'`/`'Capability'` |

## 19.11 Summary

Two of the chapter's structural pieces are solidly built: the Deliverable/Capability dependency pair (§19.2) and the end-to-end execution trigger chain (§19.6). Everything else the chapter describes as this engine's job — five of seven dependency types, two of six states, constraint detection, flow optimisation, continuous/event-driven re-evaluation, circular-dependency detection, and all nine named events — does not exist. Some of that is a deliberate, documented architectural choice (Evidence/Decision/Obligation readiness living in `qualityGateEngine` instead, per Ch.26 §3), not an oversight; the rest (events, circular-dependency detection, flow optimisation, the five missing dependency types) is simply unbuilt. What shipped is real, tested, and does real work (`tests/engine.test.ts`, `tests/service-dependency.test.ts`, `tests/governance-depth.test.ts`) — it is a smaller, more literal thing than "the Dependency Engine" as this chapter frames it.