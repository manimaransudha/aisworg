# Chapter 31 – Execution Engine

## 1. Purpose

The Execution Engine is responsible for determining what engineering actions should occur next within a commissioned Software Engineering Unit (SEU).

The Execution Engine continuously evaluates engineering state and produces execution requests that advance Deliverables towards their intended outcomes.

It does not perform engineering work.

It determines **what work should be requested**.

---

## 2. Scope

This chapter defines:

- Execution Engine responsibilities
- execution planning
- command generation
- dependency evaluation
- execution coordination
- runtime orchestration

This chapter does not define:

- engineering behaviour
- participant implementations
- scheduling algorithms
- governance policies

---

## 3. Architectural Position

```
Engineering Events

↓

Execution Engine

↓

Dependency Evaluation

↓

Transition Definition Evaluation

↓

Capability Fulfilment

↓

Command Generation

↓

Participants
```

The Execution Engine is the central coordinator of engineering execution.

---

## 4. Definition

The Execution Engine is the runtime service responsible for determining the next valid engineering actions based upon the current engineering state.

The Execution Engine shall:

- observe engineering Events
- evaluate engineering readiness
- determine executable transitions
- request capability fulfilment
- generate Commands

It shall not execute engineering activities directly.

---

## 5. Architectural Principles

### EE-001

Execution is state-driven.

### EE-002

Execution is event-driven.

### EE-003

Execution shall remain deterministic.

### EE-004

Execution shall remain behaviour-independent.

### EE-005

Execution shall remain stateless wherever practical.

### EE-006

Execution shall never bypass governance.

---

## 6. Functional Requirements

### FR-31.1

The Execution Engine shall subscribe to engineering Events.
 
### FR-31.2

The Execution Engine shall continuously evaluate executable engineering transitions.
 
### FR-31.3

The Execution Engine shall respect Transition Definitions.
 
### FR-31.4

The Execution Engine shall request Capability Fulfilment when required.
 
### FR-31.5

The Execution Engine shall generate Commands.
 
### FR-31.6

The Execution Engine shall preserve complete execution traceability.
 
### FR-31.7

Execution decisions shall be reproducible.

---

## 7. Execution Inputs

The Execution Engine evaluates:

- Deliverable state
- Dependency Graph
- Transition Definitions
- active Policies
- active Obligations
- Review outcomes
- Quality Gates
- Engineering Behavior Model
- incoming Events

---

## 8. Execution Outputs

The Execution Engine may produce:

- Commands
- capability requests
- execution plans
- dependency re-evaluations
- notification requests
- escalation requests

Outputs are requests for action.

They are not engineering outcomes.

---

## 9. Execution Cycle

The Execution Engine continuously repeats the following cycle.

```
Observe Events

↓

Evaluate Engineering State

↓

Identify Eligible Transitions

↓

Evaluate Governance

↓

Request Capabilities

↓

Generate Commands

↓

Wait for Events
```

Execution is reactive rather than sequential.

---

## 10. Command Generation

Commands represent requests for engineering action.

Illustrative Commands include:

- Produce Architecture
- Review Design
- Execute Tests
- Publish Knowledge
- Resolve Obligation
- Generate Evidence

Commands are generated only when all prerequisite conditions have been satisfied.

---

## 11. Dependency Integration

The Execution Engine shall collaborate with the Dependency Engine.

Dependency evaluation determines:

- blocked Deliverables
- newly executable Deliverables
- dependency completion
- cascading execution opportunities

The Execution Engine shall not duplicate dependency logic.

---

## 12. Capability Integration

Where engineering work is required, the Execution Engine shall request Capability Fulfilment.

Capability Fulfilment determines the required capabilities and the pool of eligible Participants for each.

The Dispatch Engine subsequently selects the executing Participant from that pool and applies the dispatch strategy.

The Execution Engine remains independent of Participant implementations.

---

## 13. Engineering Parallelism

The Execution Engine shall maximise safe engineering concurrency.

Independent Deliverables may execute simultaneously provided:

- dependencies are satisfied
- governance permits execution
- required capabilities are available

Concurrency shall never violate engineering correctness.

---

## 14. Execution History

Every execution decision shall preserve:

- triggering Event
- evaluated Transition Definition
- applicable Governance outcome
- generated Commands
- timestamp
- engineering rationale

Execution history is immutable.

---

## 15. Events

The Execution Engine shall publish:

- ExecutionEvaluationStarted
- ExecutionEvaluationCompleted
- CommandGenerated
- CapabilityRequested
- ExecutionDeferred
- ExecutionBlocked

---

## 16. Non-Functional Requirements

The Execution Engine shall:

- support concurrent execution
- remain deterministic
- minimise unnecessary evaluations
- support horizontal scaling
- remain independent of Participant technologies

---

## 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Engineering execution is event-driven.

✓ Commands are generated only after successful evaluation.

✓ Dependency evaluation remains independent.

✓ Capability fulfilment remains independent.

✓ Execution history is preserved.

✓ Execution decisions are reproducible.

---

## 18. Deliverables

Implementation of this chapter shall produce:

- Execution Engine
- Command generation service
- Execution evaluation service
- Execution history service
- Execution APIs
- Execution events
- Runtime integration interfaces

## 19. Implementation Specifics

*Recorded 2026-09-15, ahead of CR-107 design. This section documents how the Execution Engine is realised in the current build. It does not change the requirements above (EE-001–006, §§4–14); it records what is built, what is partial, and what is still open — the same convention as Chapter 5 §19. Status markers: ✅ built · ⚠️ partial · 🚩 not built.*

### 19.1 ⚠️ `executionEngine.ts` is a downstream Command/Work-Item generator, not the reactive cycle of §9

The chapter's own header comment on `executionEngine.ts` states its own scope directly: governance (Dependency Engine + Transition Engine) "is evaluated by the caller before this runs." `executionEngine.execute` (`domain/engine/executionEngine.ts`) is called only from inside `transitionDeliverable` (`routes/seu/core/deliverables.ts`), after dependency readiness, Quality Gate, Policy, and Authority have all already passed for that Deliverable's own hop. Its own body does three things, in order: creates a `commandsDB` row (Command Generation, §10), publishes `CommandGenerated`, and calls `workItemGenerator.generate` then `dispatchEngine.dispatch` — i.e. it owns Command → Work Item → Dispatch (§8's Outputs), not Observe Events → Evaluate Engineering State → Identify Eligible Transitions → Evaluate Governance (§9's first four steps).

### 19.2 🚩 §9's Execution Cycle steps 1–4 (Observe Events, Evaluate Engineering State, Identify Eligible Transitions, Evaluate Governance) have no component

Nothing in the codebase observes Deliverable/SEU state and decides, on its own, that a transition is now eligible to attempt. The only two call sites of `transitionDeliverable` are a web route (`web/seus.ts`) and an API route (`api/deliverables.ts`) — both direct, human/API-triggered calls. There is no subscriber or poller that watches Events (e.g. a dependency becoming satisfied, an Obligation resolving) and itself decides "this Deliverable is now eligible, generate a Command for it." Eligibility today is discovered by whoever calls `transitionDeliverable`, not by the Engine.

### 19.3 🚩 Active Obligations are not an Execution Input anywhere (§7)

§7 names "active Obligations" as an Execution Input explicitly. Grepped confirmed: no code path reads open/blocking Obligations before generating a Command or before allowing a Deliverable transition to be attempted. `transitionDeliverable`'s own governance block (dependency readiness → Quality Gate → Policy → Authority) has no Obligation check. CR-106 raises a real Obligation when a *Policy* blocks the SEU's own `Activated -> Operational` hop, but that Obligation's existence has no effect on any Deliverable — confirmed live (CR-107's own finding): a blocked SEU's head-of-chain Deliverable still reached `In Progress`.

### 19.4 ⚠️ Dependency readiness is Deliverable-scoped, never reads the owning SEU's lifecycle_state

`dependencyDefinitionEngine.isTargetReady` (§11 Dependency Integration) gates a Deliverable's own target state against `dependency_definitions` rows keyed by `(name, targetState)` across the SEU's composed Template/Packs/Profile. It has no notion of the owning SEU's own `lifecycle_state` or of any Obligation raised against the SEU as a whole — a head-of-chain Deliverable (no incoming dependency row) always resolves ready trivially, regardless of what state the SEU itself is blocked at.

### 19.5 ✅ Command Generation and Execution History (§10, §14)

Command Generation is real: `commandsDB.create` persists `entityType`/`entityId`/`fromState`/`toState`/`correlationId`, `CommandGenerated` is published, and status is tracked through `Dispatched` / `Deferred` / (elsewhere) `Completed`. This gives Execution History (§14) a real, queryable trail per Command, even though nothing yet feeds a *decision not to generate one* (§19.2/§19.3) into that same history.

### 19.6 ⚠️ Deferred dispatch exists, but only for "no eligible Participant," not for a governance/Obligation block

`dispatchEngine.dispatch` can return `deferredReason: "no_eligible_participant"`, at which point `executionEngine.execute` marks the Command `Deferred` rather than `Dispatched`. This is the only real "hold, do not proceed" outcome the Engine has today, and it is a Capability-fulfilment concern (Ch.33), not a governance one — it fires after Authority/Policy/Quality-Gate have already passed. There is no equivalent "Deferred pending Obligation resolution" outcome.

### 19.7 ✅ Resolution-triggered retry exists, one hop wide (CR-106 Option C)

`obligationResolvedHandler` (`domain/engine/obligationResolved.ts`, registered in `HANDLER_REGISTRY`) subscribes to an Obligation's own transition event and, when it reaches a resolved status and carries a recorded `blocked_from_state`/`blocked_to_state`, retries the original blocked transition — today scoped to exactly one case, `SEU`'s commence-work hop (`retrySeuCommenceWork`), by the handler's own explicit design note. This is a real subscriber under the platform's cross-entity-type rule (Obligation's own resolution causing a different entity, SEU, to re-attempt a transition), but it is a targeted retry of a known blocked hop, not the general "Evaluate Governance including active Obligations" step §9 describes, and it does not extend to Deliverable.

### 19.8 🚩 Chapter 33's own disclaimer is upheld in code, but the responsibility it points back to is not built

Chapter 33 §1 states the Dispatch Engine "does not determine what should be executed. That responsibility belongs to the Execution Engine." `dispatchEngine.ts` in code is consistent with this — it only ever receives an already-generated Work Item and decides *who* fulfils it. But the responsibility it defers to (deciding a Deliverable is eligible to start, evaluating active Obligations as part of that decision) is not implemented in `executionEngine.ts` either — it currently exists nowhere, per §19.2/§19.3 above. This is CR-107's own gap.