# Traceability Analysis: Chapter 31 – Execution Engine / Planning Model

**Specification File**: [`03_Book 3 (Refined)/05_Part 5/Chapter 31.md`](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book%203%20%28Refined%29/05_Part%205/Chapter%2031.md)  
**Implementation Source Files**:
- Execution Engine: [`src/domain/engine/executionEngine.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/domain/engine/executionEngine.ts)
- Work Item Generator & Dispatch: [`src/domain/engine/workItemGenerator.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/domain/engine/workItemGenerator.ts), [`src/domain/engine/dispatchEngine.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/domain/engine/dispatchEngine.ts)
- Database Layer: [`src/dblayer/commandsDB.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/commandsDB.ts), [`src/dblayer/workItemsDB.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/workItemsDB.ts)

**Date**: September 8, 2026  
**Status**: Completed  

---

## 1. Executive Summary

This document establishes the formal traceability between **Chapter 31 (Execution Engine / Planning Model)** of *Book 3 (Refined)* and the application codebase in `src/`.

The **Execution Engine** (formerly Execution Planning) acts as the central CPU of the Runtime Kernel. Its central architectural decision is **ADR – Command-Driven Execution**: the Execution Engine generates abstract **Commands** rather than creating Work Items directly. Commands express *what* engineering action is required; transient Work Items and participant dispatches are derived downstream (EE-001–006, FR-31.5).

The codebase realizes the Execution Engine through `executionEngine.ts`, `commandsDB.ts`, `workItemGenerator.ts`, and `dispatchEngine.ts`. The implementation cleanly decouples command creation from execution planning and participant dispatch.

Key realization highlights include:
1. **Command-Driven Execution Architecture (ADR, FR-31.5)**: `executionEngine.ts:execute()` creates a persistent `Command` record (`commandsDB.create`) before generating transient Work Items.
2. **Decoupled Work Item Generation (§10, EE-004)**: `workItemGenerator.generate()` converts abstract Commands into transient `WorkItem` plans tailored to target capabilities.
3. **Dispatch & Capability Integration (EE-005, §12)**: Handed off to `dispatchEngine.ts` to locate eligible Participants fulfilling the target Capability.
4. **Causation Tracing (§14)**: `CommandGenerated` event ID is explicitly passed as `causationEventId` to `WorkItemGenerated`.
5. **Gaps**: Fine-grained execution evaluation events (`ExecutionEvaluationStarted`, `ExecutionEvaluationCompleted`) are handled synchronously in-memory rather than emitted as discrete bus events.

---

## 2. Requirement-by-Requirement Traceability Matrix

### 2.1 Architectural Principles (EE-001 – EE-006)

| ID | Principle | Codebase Implementation | Traceability Status | Notes / Observations |
|---|---|---|:---:|---|
| **EE-001** | State-driven execution. | Execution requests triggered when entity state and dependencies are met. | **Fully Met** | Driven by state transitions and prerequisite satisfaction. |
| **EE-002** | Event-driven execution. | `CommandGenerated` events trigger downstream execution steps. | **Fully Met** | Reacts to state transition triggers. |
| **EE-003** | Deterministic execution. | Pure execution pipeline (`Command -> WorkItem -> Dispatch`). | **Fully Met** | Same inputs produce identical command-dispatch sequences. |
| **EE-004** | Behavior-independent. | Execution Engine handles generic `TransitionEntityType` parameters without domain logic. | **Fully Met** | Fully decoupled from domain specifics. |
| **EE-005** | Stateless execution planning. | Transient Work Items generated on-the-fly from persistent Commands. | **Fully Met** | Work Items are transient execution plans. |
| **EE-006** | Never bypass governance. | Pre-requisites (Authority, Policy, Quality Gates) evaluated before `execute()`. | **Fully Met** | Governance runs prior to command generation. |

### 2.2 Functional Requirements (FR-31.1 – FR-31.7)

| FR ID | Requirement | Codebase Implementation | Traceability Status | Notes / Observations |
|---|---|---|:---:|---|
| **FR-31.1** | Subscribe to engineering Events. | `eventBus.ts` triggers execution pipelines upon state transition events. | **Fully Met** | Event-driven execution triggers. |
| **FR-31.2** | Evaluate executable transitions. | `transitionEngine.js` and `dependencyDefinitionEngine.ts` evaluate ready transitions. | **Fully Met** | Continuous transition evaluation. |
| **FR-31.3** | Respect Transition Definitions. | Transition parameters passed directly to `commandsDB.create()`. | **Fully Met** | Gated by transition rules. |
| **FR-31.4** | Request Capability Fulfilment. | `producingCapabilityId` passed to `dispatchEngine.dispatch()`. | **Fully Met** | Capability fulfilment integrated. |
| **FR-31.5** | Generate Commands. | `commandsDB.create()` generates formal persistent Command objects. | **Fully Met** | Core thesis of Chapter 31. |
| **FR-31.6** | Complete execution traceability. | Tracked via `commands`, `work_items`, `events` (`correlation_id`, `causation_id`). | **Fully Met** | End-to-end audit traceability. |
| **FR-31.7** | Execution decisions reproducible. | Deterministic command creation based on explicit input parameters. | **Fully Met** | Fully reproducible pipeline. |

---

## 3. Subsystem Architecture & Execution Pipeline (§3 & §9)

### 3.1 Command-Driven Execution Pipeline (ADR)
```
          State Transition Request / Event
                         │
                         ▼
             Governance Evaluation (Pre-pass)
                         │
                         ▼
    executionEngine.execute({ entityType, entityId, fromState, toState })
                         │
                         ▼
        1. commandsDB.create() ──► Publishes CommandGenerated Event
                         │
                         ▼
        2. workItemGenerator.generate(command) ──► Creates WorkItem
                         │
                         ▼
        3. dispatchEngine.dispatch(workItem, producingCapabilityId)
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
     Participant Found        No Participant
             │                       │
             ▼                       ▼
   Command Status: Dispatched   Command Status: Deferred
```

---

## 4. Identified Gaps & Architectural Clarifications

### Architectural Realization: Synchronous Execution Engine vs Background Polling (§9)
- **Specification**: Describes an Execution Engine continuously running an evaluation loop polling for eligible transitions.
- **Codebase Realization**: Implemented reactivity via event-driven synchronous invocation: when a governed transition occurs or an event arrives, `executionEngine.execute()` is invoked directly to generate Commands and dispatch Work Items without needing a continuous polling daemon.

---

## 5. Conclusion (corrected 2026-09-12)

The prior "~95%, Fully Met" conclusion and the Section 7 audit below contradicted each other (Section 7 called the same EE-001–006 principles "Unbuilt/Deferred"). Re-verified directly against the code; findings below replace both.

The core ADR — Command-Driven Execution — is implemented: `executionEngine.execute()` (`src/domain/engine/executionEngine.ts:23`) creates a `Command` via `commandsDB.create()`, publishes `CommandGenerated`, hands off to `workItemGenerator.generate()` for the transient Work Item, then to `dispatchEngine.dispatch()`. This part of the pipeline is real and matches §10/§12/ADR.

### Gaps against the chapter text

1. **Not event-driven, not a subscriber (FR-31.1, EE-002).** The spec's Execution Cycle (§9) is "Observe Events → … → Wait for Events" — an independent loop that subscribes to the event bus. The actual `executionEngine` has no subscription; it is a synchronous function called directly by the one call site (`src/routes/seu/core/deliverables.ts:242`), inline in the deliverable-transition request handler. Nothing publishes an event that `executionEngine` reacts to later.
2. **Single entity type wired up.** The only caller is the Deliverable transition path in `deliverables.ts`. `TransitionEntityType` is generic in the signature, but no other entity kind currently drives a Command through this engine.
3. **§15 events mostly missing.** Of `ExecutionEvaluationStarted`, `ExecutionEvaluationCompleted`, `CommandGenerated`, `CapabilityRequested`, `ExecutionDeferred`, `ExecutionBlocked` — only `CommandGenerated` is published (`executionEngine.ts:50`). The other five do not exist anywhere in `src/` (verified by grep). Deferral (`no_eligible_participant`) is returned as a plain result value, not an `ExecutionDeferred` event.
4. **No "Execution history service" or "Execution APIs" (§18).** History is reconstructable from the `commands`, `work_items`, and `events` tables (correlation/causation IDs), but there is no dedicated history service or API surface — §18 lists these as separate deliverables and neither exists as a named component.
5. **No standalone "execution evaluation service."** Readiness/governance evaluation lives in the caller (`transitionEngine.evaluate`, quality-gate checks in `deliverables.ts`) before `executionEngine.execute()` is invoked — matching §11's "shall not duplicate dependency logic," but meaning there is no Execution Engine-owned evaluation service distinct from the transition/dependency engines, contrary to §18's listing of it as a discrete deliverable.
6. **Reproducibility/determinism (EE-003, FR-31.7)** hold in the narrow sense that the same inputs produce the same Command → Work Item → Dispatch sequence, but this has not been exercised under concurrency (§13's "maximise safe engineering concurrency" is unverified — no concurrency-specific handling was found in `executionEngine.ts` or `dispatchEngine.ts`).

### What is solid
- ADR (Command-Driven Execution), FR-31.3, FR-31.4, FR-31.5, and the causation/correlation threading in FR-31.6 are implemented and match the spec's intent.
- §11's "Execution Engine shall not duplicate dependency logic" is honored by construction — dependency/governance evaluation happens entirely in the caller.
