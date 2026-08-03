
# Chapter 32 – Work Item Model

[Sudha: Originally, we thought **Work Items** were fundamental.

Then we realised Deliverables are fundamental.

Then we realised Commands are fundamental.

Now I think Work Items occupy a very different place in the architecture.

## I no longer think Work Items are engineering objects.

I think they are **execution artefacts**.

That's a profound difference.

A Deliverable exists because the business needs it.

A Command exists because the Runtime Kernel wants something done.

A Work Item exists only because a particular Participant needs instructions for carrying out that Command.

After execution completes, the Work Item has served its purpose.

It is ephemeral.

This also means that **different Participants may receive different Work Items for the same Command.**

That is something no existing ALM tool really models.

----------------

I think we've just completed one of the platform's most important conceptual shifts.

Traditional ALM systems treat **Work Items** as the primary object:

- Jira Issues
- Azure DevOps Work Items
- GitHub Issues
- Rally Stories

Everything revolves around them.

In this architecture, Work Items become almost disposable.

The real engineering assets are:

- Deliverables
- Knowledge
- Evidence
- Decisions
- Obligations

Work Items merely help Participants contribute to those assets.

## I think we can now distinguish four different runtime concepts

|Concept|Purpose|Lifetime|
|---|---|---|
|**Command**|Expresses engineering intent.|Transient|
|**Work Item**|Expresses participant-specific execution instructions.|Transient|
|**Event**|Records that something happened.|Permanent|
|**State Transition**|Changes authoritative engineering state.|Permanent|

That separation is much cleaner than what most workflow systems provide.

---

## One refinement I'd propose before proceeding

The next chapter was originally **Scheduling**.

I now think it should be **Dispatching** instead.

Scheduling answers:

> _"When should something run?"_

Dispatching answers:

> _"Which available Participant should receive this Work Item now?"_

In a human organisation, scheduling dominates because people are scarce and time is the primary constraint.

In an AI-first SEU, scheduling is often trivial—many AI Participants can execute immediately and in parallel. The more interesting runtime decision is **dispatching**: selecting the most appropriate Participant (or Participants), considering capabilities, cost, latency, specialisation, confidence, workload, locality, or organisational policy.

That is a fundamentally different optimisation problem, and I think it deserves its own first-class architectural chapter before we discuss time-based scheduling. It also aligns perfectly with your earlier observation that **dependencies, not elapsed time, drive engineering execution**.
]
---

# 1. Purpose

The Work Item Model defines how execution instructions are generated, presented and managed for Participants within a Software Engineering Unit (SEU).

Work Items are transient execution artefacts derived from engineering Commands.

They provide Participant-specific execution guidance while preserving the separation between engineering intent and execution strategy.

Work Items are not persistent engineering objects.

They are runtime artefacts.

---

# 2. Scope

This chapter defines:

- Work Item abstraction;
- Work Item lifecycle;
- Work Item generation;
- Work Item execution;
- Work Item completion;
- Work Item traceability.

This chapter does not define:

- engineering behaviour;
- governance;
- participant implementation;
- command generation.

---

# 3. Architectural Position

```
Engineering State

↓

Execution Engine

↓

Command

↓

Work Item Generator

↓

Participant

↓

Execution

↓

Engineering State Transition
```

Work Items translate engineering intent into executable instructions.

---

# 4. Definition

A Work Item is a transient execution artefact that instructs a Participant how to fulfil an engineering Command within the current engineering context.

A Work Item exists only for the duration of execution.

Engineering truth remains in:

- Deliverables;
- Decisions;
- Knowledge;
- Evidence;
- Obligations.

---

# 5. Architectural Principles

## WI-001

Work Items are transient.

---

## WI-002

Work Items are derived from Commands.

---

## WI-003

Work Items shall never become the system of record.

---

## WI-004

Work Items are participant-specific.

---

## WI-005

Completion of a Work Item does not imply completion of engineering work.

Only a successful state transition establishes engineering completion.

---

## WI-006

Work Items shall remain reproducible.

---

# 6. Functional Requirements

### FR-32.1

Every Work Item shall reference exactly one Command.

---

### FR-32.2

Multiple Work Items may be generated from the same Command.

---

### FR-32.3

Work Items shall reference the current engineering context.

---

### FR-32.4

Work Items shall support Participant-specific execution guidance.

---

### FR-32.5

Completed Work Items shall remain traceable.

---

### FR-32.6

Work Items shall support cancellation.

---

### FR-32.7

Work Items shall never directly modify engineering state.

---

# 7. Work Item Components

Every Work Item shall define:

- Work Item Identifier
- Command Reference
- Assigned Participant
- Execution Context
- Engineering Objective
- Input References
- Expected Outputs
- Constraints
- Priority
- Status

The internal representation is implementation-defined.

---

# 8. Work Item Lifecycle

Every Work Item shall progress through the following lifecycle.

```
Generated

↓

Assigned

↓

Executing

↓

Completed

↓

Disposed
```

Cancelled Work Items transition directly to **Disposed**.

Disposed Work Items remain available for traceability but are no longer active.

---

# 9. Work Item Generation

The Work Item Generator shall derive Work Items from:

- Command;
- Engineering Behavior Model;
- Participant capabilities;
- current engineering context;
- applicable Packs;
- active Deliverables.

Different Participants may receive different Work Items for the same engineering Command.

---

# 10. Participant Adaptation

The platform shall adapt Work Items according to Participant type.

Examples include:

## AI Participant

- structured prompt;
- contextual knowledge;
- execution constraints;
- expected outputs.

---

## Human Participant

- engineering objective;
- background information;
- supporting documents;
- acceptance expectations.

---

## External System

- API invocation;
- payload definition;
- execution parameters;
- expected response.

The engineering intent remains identical.

Only the execution guidance changes.

---

# 11. Execution Context

Every Work Item shall include:

- relevant Deliverables;
- applicable Knowledge;
- supporting Evidence;
- governing Policies;
- applicable Authority;
- active Obligations;
- current Engineering Behavior Model;
- relevant Ontology concepts.

Participants receive everything necessary to perform the requested engineering activity.

---

# 12. Completion

Completion of a Work Item indicates that the assigned Participant has completed the requested execution activity.

Completion does not imply:

- Deliverable approval;
- Decision approval;
- Knowledge publication;
- engineering completion.

Further governance evaluation remains required.

---

# 13. Disposal

After completion or cancellation, a Work Item shall be disposed.

Disposed Work Items shall retain:

- execution history;
- execution duration;
- assigned Participant;
- generated outputs;
- originating Command.

Disposed Work Items shall not participate in future engineering execution.

---

# 14. Traceability

Every Work Item shall preserve:

- originating Command;
- assigned Participant;
- related Deliverables;
- execution timestamps;
- generated outputs;
- resulting Events;
- subsequent state transitions.

This enables complete reconstruction of engineering execution.

---

# 15. Events

The Work Item subsystem shall publish:

- WorkItemGenerated
- WorkItemAssigned
- WorkItemStarted
- WorkItemCompleted
- WorkItemCancelled
- WorkItemDisposed

---

# 16. Non-Functional Requirements

The Work Item Model shall:

- support heterogeneous Participants;
- remain lightweight;
- support rapid generation;
- preserve execution traceability;
- remain independent of Participant implementations.

---

# 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Work Items are transient.

✓ Work Items are derived from Commands.

✓ Different Participants can receive different Work Items for the same Command.

✓ Work Items never become engineering records.

✓ Completion of a Work Item does not itself change engineering state.

✓ Work Item history remains traceable.

---

# 18. Deliverables

Implementation of this chapter shall produce:

- Work Item Generator.
- Work Item domain model.
- Participant adaptation service.
- Work Item lifecycle service.
- Work Item APIs.
- Work Item events.
- Execution traceability service.