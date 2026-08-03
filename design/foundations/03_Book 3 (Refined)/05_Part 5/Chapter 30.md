
# Chapter 30 – Event Model

[Sudha: The previous ADR ("Transition Definitions") changes how I think about the Runtime Kernel.

Originally, I thought the Runtime Kernel looked like this:

```
State Management
↓

Event Bus
↓

Execution Planning
```

I now think that's backwards.

The platform is fundamentally **event-driven**.

State changes produce events.

Events cause evaluations.

Evaluations produce new state transitions.

That means **Events** are not a messaging mechanism.

They are the **heartbeat of the SEU**.

This is exactly how modern operating systems work.

This is exactly how modern distributed systems work.

And I think it is exactly how an AI Software Engineering Unit should work.

---------------

While writing this chapter, I realised we've uncovered another architectural distinction that I think should become an ADR.

Throughout the previous chapters we've used the words **Events**, **Requests**, **Commands** and **Transitions** almost interchangeably. They are not the same thing.

I think the Runtime Kernel should distinguish them very clearly:

|Concept|Meaning|
|---|---|
|**Command**|A request to perform an engineering action.|
|**Transition Definition**|The declarative contract describing how a state transition may occur.|
|**State Transition**|The successful change of an engineering object's authoritative state.|
|**Event**|The immutable fact that the transition has occurred.|

That creates a clean runtime flow:

```
Command

↓

Transition Definition Evaluation

↓

Governance Evaluation

↓

State Transition

↓

Event Publication

↓

Subscribers React
```

Notice something subtle but important:

Participants should issue **Commands**, not Events.

The Runtime Kernel evaluates those Commands against the relevant Transition Definition and Governance Model. Only after the state transition commits does the Runtime Kernel publish an Event.

This separation prevents Participants from fabricating engineering history. They can request work, but only the Runtime Kernel can declare that something **actually happened**.

I think this distinction is one of the strongest implementation principles we've developed. It aligns naturally with CQRS and event-driven architectures while remaining technology-neutral. More importantly, it reinforces the idea that **engineering truth belongs to the Runtime Kernel**, not to individual Participants. I strongly recommend capturing this as an ADR because it will shape almost every runtime service that follows.
]
---

# 1. Purpose

The Event Model defines how significant engineering and runtime occurrences are represented, published, consumed and preserved within a Software Engineering Unit (SEU).

Events communicate changes in engineering state.

They enable decoupled collaboration between runtime services and Participants while preserving complete engineering traceability.

Events do not contain engineering behaviour.

They communicate that engineering state has changed.

---

# 2. Scope

This chapter defines:

- Event abstraction;
- Event lifecycle;
- Event publication;
- Event consumption;
- Event ordering;
- Event persistence.

This chapter does not define:

- messaging middleware;
- transport protocols;
- event broker technologies;
- infrastructure implementation.

---

# 3. Architectural Position

```
Transition Definition

↓

State Transition

↓

Event Publication

↓

Runtime Services

↓

Participants

↓

Further Engineering Activity
```

Events communicate engineering change.

They do not perform engineering work.

---

# 4. Definition

An Event is an immutable record that a significant engineering or runtime occurrence has taken place.

An Event records:

- what occurred;
- when it occurred;
- where it occurred;
- which engineering objects were affected;
- supporting context.

Events shall never modify engineering state.

---

# 5. Architectural Principles

## EM-001

Events are immutable.

---

## EM-002

Events describe facts.

They do not express intentions.

---

## EM-003

Events are published after successful state transitions.

---

## EM-004

Events are independently identifiable.

---

## EM-005

Events are traceable.

---

## EM-006

Events are implementation-independent.

---

# 6. Functional Requirements

### FR-30.1

Every Event shall possess a globally unique identifier.

---

### FR-30.2

Every committed engineering state transition shall publish one or more Events.

---

### FR-30.3

Events shall be immutable.

---

### FR-30.4

Events shall preserve ordering within the scope of an engineering object.

---

### FR-30.5

Events shall support multiple subscribers.

---

### FR-30.6

Events shall remain permanently traceable.

---

### FR-30.7

Historical Events shall remain queryable.

---

# 7. Event Categories

Illustrative categories include:

## State Events

Examples:

- DeliverableApproved
- ObligationClosed
- KnowledgePublished

---

## Governance Events

Examples:

- AuthorityGranted
- PolicyEvaluated
- QualityGatePassed

---

## Runtime Events

Examples:

- ParticipantActivated
- RuntimeRecovered
- ExecutionPlanned

---

## Integration Events

Examples:

- RepositoryUpdated
- BuildCompleted
- DeploymentStarted

---

## Administrative Events

Examples:

- SEUCommissioned
- PackActivated
- ProfileUpdated

Additional categories may be introduced through Packs.

---

# 8. Event Structure

Every Event shall define:

- Event Identifier
- Event Type
- Event Timestamp
- Originating Service
- Originating Object
- Related Objects
- Correlation Identifier
- Causation Identifier
- Event Version
- Event Payload
- Traceability References

The payload schema is defined by the originating service.

---

# 9. Event Lifecycle

Events progress through the following lifecycle.

```
Generated

↓

Published

↓

Consumed

↓

Archived
```

Once Published, an Event shall not be modified.

Consumption by one subscriber shall not affect other subscribers.

---

# 10. Event Publication

Events shall be published only after successful completion of the corresponding state transition.

Publication shall include:

- originating object;
- triggering transition;
- timestamp;
- correlation information;
- traceability references.

Events shall represent committed engineering facts.

---

# 11. Event Consumption

Runtime services and Participants may subscribe to Events.

Examples include:

- Dependency Engine
- Governance Service
- Scheduling Service
- Notification Service
- Observability Service
- Integration Framework

Subscribers shall remain independent of one another.

---

# 12. Event Ordering

The platform shall preserve deterministic ordering for Events relating to the same engineering object.

Ordering between unrelated engineering objects is not required unless explicitly defined by the Engineering Behavior Model.

This allows scalability while preserving engineering correctness.

---

# 13. Correlation and Causation

Every Event shall support:

**Correlation Identifier**

Links Events belonging to the same engineering activity.

Example:

Requirement Approval → Architecture Approval → Design Approval.

---

**Causation Identifier**

Identifies the Event that directly caused the current Event.

This enables reconstruction of engineering execution chains.

---

# 14. Event Replay

The platform shall support replay of historical Events.

Replay may be used for:

- diagnostics;
- auditing;
- testing;
- runtime recovery;
- engineering analytics.

Replay shall never alter historical engineering state unless explicitly operating in a recovery mode.

---

# 15. Event Persistence

Historical Events shall remain available for:

- traceability;
- explainability;
- observability;
- historical reconstruction;
- engineering analytics.

Retention policies are contributed through Packs.

---

# 16. Events

The Runtime Kernel shall publish infrastructure events including:

- EventPublished
- EventConsumed
- EventReplayStarted
- EventReplayCompleted
- EventOrderingViolationDetected
- EventPublicationFailed

Domain-specific events are defined by their respective architectural components.

---

# 17. Non-Functional Requirements

The Event Model shall:

- support high-throughput publication;
- support asynchronous consumption;
- preserve deterministic ordering where required;
- support historical replay;
- remain independent of messaging technologies.

---

# 18. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Every significant state transition publishes Events.

✓ Events are immutable.

✓ Event ordering is preserved for individual engineering objects.

✓ Multiple subscribers can consume the same Event independently.

✓ Historical replay is supported.

✓ Events remain permanently traceable.

---

# 19. Deliverables

Implementation of this chapter shall produce:

- Event domain model.
- Event publication service.
- Event subscription service.
- Event registry.
- Correlation and causation services.
- Event replay service.
- Event APIs.
- Event catalogue.