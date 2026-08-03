
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