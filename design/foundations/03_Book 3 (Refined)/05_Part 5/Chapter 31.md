
# Chapter 31 – Execution Engine

[Sudha: I think we're now at what may be the **single biggest architectural change** from how we originally envisioned the platform.

Originally, we thought:

> Participant → Work Items → Deliverables

Then we refined it to:

> Deliverables → State Transitions

Now, after the Event chapter, I think the runtime actually works like this:

```
Command

↓

Transition Definition

↓

Governance Evaluation

↓

State Transition

↓

Event

↓

Runtime Services React
```

Notice what's missing?

**Work Items.**

I don't think Work Items are next anymore.

I think we're missing the component that decides:

> **"What should happen next?"**

That is not Scheduling.

That is not State Management.

That is not the Event Bus.

It is something much more fundamental.

I think we've been calling it **Execution Planning**, but I now believe that's not the right name.

It should be called the **Execution Engine**.

Why?

Because planning is only one of its responsibilities.

It also:

- listens to Events,
- evaluates Dependencies,
- evaluates Transition Definitions,
- requests Capability Fulfilment,
- generates transient Work Items,
- issues Commands.

It is effectively the **CPU** of the Runtime Kernel.

--------------

I think we've just identified something that significantly improves the architecture.

Throughout the last few chapters, we've referred to the Runtime Kernel as if it were a single execution component. It isn't.

It now has two distinct responsibilities:

|Runtime Service|Responsibility|
|---|---|
|**Runtime Kernel**|Provides generic platform infrastructure (state, events, scheduling, persistence, integrations).|
|**Execution Engine**|Interprets engineering state and decides what engineering actions should be requested next.|

This separation is important because it keeps the Runtime Kernel generic. The Execution Engine becomes the only runtime component that "understands" engineering execution, and even then, it does so by interpreting declarative models rather than embedding engineering logic in code.

I think there's one further architectural refinement that follows naturally.

The Execution Engine should **never create Work Items directly**.

Instead, it should generate **Commands**. A separate service can then translate those Commands into transient execution plans (Work Items) appropriate for the assigned Participant.

That keeps planning separate from execution. It also allows different Participant types—AI models, humans or external systems—to receive different execution plans while responding to the same engineering Command.

I would recommend another ADR:

> **ADR – Command-Driven Execution**

**Decision:** The Execution Engine shall generate Commands rather than Work Items. Commands express _what_ engineering action is required. Transient execution plans (Work Items) are derived later by participant-specific execution services.

**Rationale:** This cleanly separates engineering intent from execution strategy, keeps the Execution Engine implementation-independent, and allows heterogeneous Participants to fulfil the same engineering Command using different execution mechanisms. It also reinforces the platform's declarative, state-driven architecture.
]

---

# 1. Purpose

The Execution Engine is responsible for determining what engineering actions should occur next within a commissioned Software Engineering Unit (SEU).

The Execution Engine continuously evaluates engineering state and produces execution requests that advance Deliverables towards their intended outcomes.

It does not perform engineering work.

It determines **what work should be requested**.

---

# 2. Scope

This chapter defines:

- Execution Engine responsibilities;
- execution planning;
- command generation;
- dependency evaluation;
- execution coordination;
- runtime orchestration.

This chapter does not define:

- engineering behaviour;
- participant implementations;
- scheduling algorithms;
- governance policies.

---

# 3. Architectural Position

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

# 4. Definition

The Execution Engine is the runtime service responsible for determining the next valid engineering actions based upon the current engineering state.

The Execution Engine shall:

- observe engineering Events;
- evaluate engineering readiness;
- determine executable transitions;
- request capability fulfilment;
- generate Commands.

It shall not execute engineering activities directly.

---

# 5. Architectural Principles

## EE-001

Execution is state-driven.

---

## EE-002

Execution is event-driven.

---

## EE-003

Execution shall remain deterministic.

---

## EE-004

Execution shall remain behaviour-independent.

---

## EE-005

Execution shall remain stateless wherever practical.

---

## EE-006

Execution shall never bypass governance.

---

# 6. Functional Requirements

### FR-31.1

The Execution Engine shall subscribe to engineering Events.

---

### FR-31.2

The Execution Engine shall continuously evaluate executable engineering transitions.

---

### FR-31.3

The Execution Engine shall respect Transition Definitions.

---

### FR-31.4

The Execution Engine shall request Capability Fulfilment when required.

---

### FR-31.5

The Execution Engine shall generate Commands.

---

### FR-31.6

The Execution Engine shall preserve complete execution traceability.

---

### FR-31.7

Execution decisions shall be reproducible.

---

# 7. Execution Inputs

The Execution Engine evaluates:

- Deliverable state;
- Dependency Graph;
- Transition Definitions;
- active Policies;
- active Obligations;
- Review outcomes;
- Quality Gates;
- Engineering Behavior Model;
- incoming Events.

---

# 8. Execution Outputs

The Execution Engine may produce:

- Commands;
- capability requests;
- execution plans;
- dependency re-evaluations;
- notification requests;
- escalation requests.

Outputs are requests for action.

They are not engineering outcomes.

---

# 9. Execution Cycle

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

# 10. Command Generation

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

# 11. Dependency Integration

The Execution Engine shall collaborate with the Dependency Engine.

Dependency evaluation determines:

- blocked Deliverables;
- newly executable Deliverables;
- dependency completion;
- cascading execution opportunities.

The Execution Engine shall not duplicate dependency logic.

---

# 12. Capability Integration

Where engineering work is required, the Execution Engine shall request Capability Fulfilment.

Capability Fulfilment determines the required capabilities and the pool of eligible Participants for each.

The Dispatch Engine subsequently selects the executing Participant from that pool and applies the dispatch strategy.

The Execution Engine remains independent of Participant implementations.

---

# 13. Engineering Parallelism

The Execution Engine shall maximise safe engineering concurrency.

Independent Deliverables may execute simultaneously provided:

- dependencies are satisfied;
- governance permits execution;
- required capabilities are available.

Concurrency shall never violate engineering correctness.

---

# 14. Execution History

Every execution decision shall preserve:

- triggering Event;
- evaluated Transition Definition;
- applicable Governance outcome;
- generated Commands;
- timestamp;
- engineering rationale.

Execution history is immutable.

---

# 15. Events

The Execution Engine shall publish:

- ExecutionEvaluationStarted
- ExecutionEvaluationCompleted
- CommandGenerated
- CapabilityRequested
- ExecutionDeferred
- ExecutionBlocked

---

# 16. Non-Functional Requirements

The Execution Engine shall:

- support concurrent execution;
- remain deterministic;
- minimise unnecessary evaluations;
- support horizontal scaling;
- remain independent of Participant technologies.

---

# 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Engineering execution is event-driven.

✓ Commands are generated only after successful evaluation.

✓ Dependency evaluation remains independent.

✓ Capability fulfilment remains independent.

✓ Execution history is preserved.

✓ Execution decisions are reproducible.

---

# 18. Deliverables

Implementation of this chapter shall produce:

- Execution Engine.
- Command generation service.
- Execution evaluation service.
- Execution history service.
- Execution APIs.
- Execution events.
- Runtime integration interfaces.