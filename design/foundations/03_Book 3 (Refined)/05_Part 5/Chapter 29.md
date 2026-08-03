
# Chapter 29 – State Management Model

[Sudha: I think this is the chapter where the platform's runtime philosophy becomes completely different from existing workflow engines.

Traditionally, workflow engines focus on **process state**.

Your platform focuses on **engineering state**.

That's a profound distinction.

We are **not** trying to manage workflows.

We are managing the state of an engineering system.

This chapter therefore becomes much broader than simply "state management."

It becomes the **authoritative runtime state model**.

-------------------

While writing this chapter, I realised we've introduced a concept that deserves much greater prominence than the brief mention it received in the previous chapter:

> **Transition Definitions**

I actually think **Transition Definitions** are one of the platform's core architectural objects.

Every lifecycle transition in the platform—whether for a Deliverable, Decision, Knowledge Item, Obligation, Participant or even an SEU—is governed by a Transition Definition.

That means a Transition Definition becomes the **runtime contract** for changing engineering state.

For example:

```
Deliverable

Under Review
        │
        ▼
Approved

Transition Definition

Requires:
    • Authority
    • Architecture Review
    • Security Review
    • Evidence
    • No blocking Obligations
    • Quality Gate "Architecture Approval"
```

Notice what we've achieved.

Instead of scattering transition logic across code, governance rules and workflow definitions, we've centralised it into a single declarative object.

I actually think we should elevate **Transition Definition** to a first-class architectural concept alongside Deliverables, Decisions, Obligations and Policies.

My recommendation is to create an ADR:

> **ADR – Transition Definitions**

**Decision:** Every governed lifecycle state transition shall be defined by a declarative Transition Definition. Transition Definitions shall specify the source state, target state and all prerequisites for the transition, including authority, policies, quality gates, reviews, evidence and obligations.

**Rationale:** This provides a single, reusable mechanism for governing lifecycle transitions across all engineering objects, eliminates duplicated transition logic and reinforces the platform's declarative architecture.

I believe this ADR will become one of the key implementation guides for the Runtime Kernel because it establishes that **state transitions are data, not code**. That philosophy is entirely consistent with the declarative approach we've taken throughout the platform.
]
---

# 1. Purpose

The State Management Model defines how runtime state is represented, maintained, transitioned and recovered within a commissioned Software Engineering Unit (SEU).

State Management provides the authoritative runtime view of every persistent engineering object.

The Runtime Kernel shall maintain engineering state independently of Participants, execution strategies and implementation technologies.

State is a platform concern.

Engineering meaning is provided by the Engineering Behavior Model (EBM).

---

# 2. Scope

This chapter defines:

- runtime state;
- state ownership;
- state transitions;
- state consistency;
- state persistence;
- state recovery.

This chapter does not define:

- engineering behaviour;
- governance policies;
- workflow definitions;
- storage technologies.

---

# 3. Architectural Position

```
Persistent Engineering Objects

Deliverables
Knowledge
Evidence
Decisions
Obligations
Participants
SEUs

↓

State Management

↓

Runtime Kernel

↓

Event Model
```

The State Management service is the authoritative source of runtime state.

---

# 4. Definition

State is the current authoritative condition of an engineering object at a particular point in time.

State consists of:

- lifecycle state;
- engineering attributes;
- runtime attributes;
- relationships;
- version references.

State shall always be explicit.

---

# 5. Architectural Principles

## SM-001

Every persistent engineering object shall possess explicit state.

---

## SM-002

State shall have exactly one authoritative owner.

---

## SM-003

State transitions shall be deterministic.

---

## SM-004

State transitions shall be atomic.

---

## SM-005

State history shall never be lost.

---

## SM-006

State shall be recoverable.

---

# 6. Functional Requirements

### FR-29.1

Every persistent engineering object shall maintain lifecycle state.

---

### FR-29.2

State transitions shall preserve historical versions.

---

### FR-29.3

The Runtime Kernel shall validate state transitions before committing them.

---

### FR-29.4

Every committed state transition shall publish runtime events.

---

### FR-29.5

State recovery shall preserve engineering consistency.

---

### FR-29.6

Concurrent state modifications shall be controlled.

---

### FR-29.7

State changes shall remain fully traceable.

---

# 7. Managed Objects

The State Management service manages runtime state for:

- Software Engineering Units
- Deliverables
- Decisions
- Knowledge
- Evidence
- Obligations
- Participants
- Engineering Behavior Models
- Runtime Services

Future engineering objects shall participate by default.

---

# 8. State Structure

Every managed object shall contain:

- Identifier
- Object Type
- Lifecycle State
- Version
- Current Attributes
- Relationship References
- Last Transition
- Transition Timestamp
- Current Owner (logical owner)
- State History Reference

The internal persistence model is implementation-defined.

---

# 9. State Transitions

Every transition shall define:

- source state;
- target state;
- triggering event;
- applicable Transition Definition;
- required Governance evaluation;
- timestamp;
- transition rationale.

A transition shall never occur implicitly.

---

# 10. Transition Definitions

A **Transition Definition** is a declarative object describing a permitted lifecycle transition.

Every Transition Definition shall specify:

- source state;
- target state;
- required Authority;
- required Policies;
- applicable Quality Gates;
- required Reviews;
- mandatory Evidence;
- blocking Obligations;
- applicable Engineering Behavior Model rules.

Transition Definitions are contributed through Packs.

They are interpreted by the Runtime Kernel.

---

# 11. State Consistency

The Runtime Kernel shall ensure that state remains internally consistent.

Consistency includes:

- valid lifecycle transitions;
- valid object relationships;
- version consistency;
- dependency consistency;
- governance consistency.

Invalid transitions shall be rejected.

---

# 12. State Persistence

Runtime state shall survive:

- Participant replacement;
- Runtime service restart;
- Runtime Kernel restart;
- infrastructure migration;
- software upgrades.

Transient execution state may be reconstructed.

Authoritative engineering state shall never be lost.

---

# 13. State Recovery

The Runtime Kernel shall support recovery of engineering state after failures.

Recovery shall restore:

- lifecycle states;
- relationships;
- pending transitions;
- active Obligations;
- active Governance context;
- runtime configuration.

Recovery shall not require recommissioning of the SEU.

---

# 14. Concurrency

Multiple Participants may operate concurrently.

The Runtime Kernel shall prevent conflicting state transitions.

Where conflicts occur, the platform shall:

- detect the conflict;
- preserve engineering integrity;
- reject or defer invalid transitions;
- publish conflict events.

The conflict resolution strategy is implementation-defined.

---

# 15. State History

Every state transition shall preserve:

- previous state;
- new state;
- transition definition;
- initiating event;
- governing authority;
- applicable policies;
- timestamp;
- engineering rationale.

State history is immutable.

---

# 16. Events

The State Management subsystem shall publish:

- StateTransitionRequested
- StateTransitionValidated
- StateTransitionCommitted
- StateTransitionRejected
- StateRecovered
- StateConflictDetected
- StateConflictResolved

---

# 17. Non-Functional Requirements

The State Management service shall:

- support concurrent execution;
- preserve deterministic behaviour;
- support historical reconstruction;
- support efficient querying;
- remain independent of persistence technologies.

---

# 18. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Every persistent engineering object possesses explicit state.

✓ State transitions are governed through Transition Definitions.

✓ Invalid transitions are rejected.

✓ State history is immutable.

✓ Runtime state survives failures.

✓ Concurrent transitions preserve engineering consistency.

---

# 19. Deliverables

Implementation of this chapter shall produce:

- State Management service.
- Transition Definition model.
- State registry.
- State persistence interfaces.
- Recovery service.
- Concurrency management service.
- State APIs.
- State events.