# Chapter 14 – Engineering Collaboration Model

[Sudha: I actually want to make one change before continuing.

The commentary at the end of the previous chapter raised a question:

> Should Participants communicate directly?

I think the answer is **No.**

And I think this is much more important than it first appears.

It affects the entire architecture.

---

## I think we've been subconsciously thinking like humans

Human software teams work like this:

```
Developer

↓

Talks to Architect

↓

Talks to Tester

↓

Talks to DBA

↓

Talks to Product Owner
```

Lots of communication.

Lots of meetings.

Lots of chat.

---

An SEU shouldn't work like that.

It should work much closer to an operating system.

A Participant doesn't ask another Participant:

> "Have you finished?"

Instead it asks the platform:

> "Which Deliverable is ready?"

-----------------

I think this chapter captures a deeper architectural idea than simply "how agents talk."

It says that **the SEU itself is the collaboration medium**.

In traditional software development, much of the team's shared understanding lives in conversations—meetings, chats, emails, and hallway discussions. Those conversations are difficult to audit, hard to reuse, and often disappear when people leave.

The SEU should be different. Its shared understanding should reside in explicit engineering artefacts: deliverables, knowledge, decisions, evidence, obligations and events. Participants interact with those artefacts rather than with each other directly.

I would add one refinement that will influence later chapters:

> **A Participant should not "ask another Participant to do something."**

Instead, it should **publish an engineering intent**.

For example:

- "Architecture Specification Approved."
- "Security Review Required."
- "Performance Evidence Missing."

The Runtime Kernel, together with the Dependency Engine and Capability Fulfilment service, determines what happens next. This keeps Participants decoupled and ensures that engineering flow is governed by the platform rather than by ad hoc interactions between runtime entities.

I believe this is another defining characteristic of the platform. It shifts collaboration from **conversation-driven** to **state-driven**, making the SEU more deterministic, auditable and resilient.
]
---

# 1. Purpose

The Engineering Collaboration Model defines how Participants collaborate within a Software Engineering Unit (SEU).

Unlike traditional software teams, collaboration within an SEU is **artifact-centric rather than conversation-centric**.

Participants collaborate by creating, consuming and evolving engineering artefacts through the Runtime Kernel.

The platform deliberately avoids modelling human-style conversational collaboration as the primary execution mechanism.

---

# 2. Scope

This chapter defines:

- collaboration principles;
- collaboration mechanisms;
- engineering communication;
- collaboration contexts;
- collaboration through engineering artefacts.

This chapter does not define:

- participant implementations;
- work item execution;
- engineering behaviour;
- dependency evaluation.

---

# 3. Architectural Position

```
Participant

↓

Runtime Kernel

↓

Engineering Artefacts

↓

Knowledge Repository

↓

Dependency Engine

↓

Participant
```

Participants collaborate through shared engineering state.

Not through direct interaction.

---

# 4. Fundamental Principle

Participants collaborate through engineering artefacts.

Engineering artefacts include:

- Deliverables
- Knowledge
- Evidence
- Decisions
- Obligations
- Events

These artefacts constitute the shared engineering memory of the SEU.

---

# 5. Architectural Principles

## ECM-001

Engineering artefacts are the primary collaboration mechanism.

---

## ECM-002

Participants shall remain loosely coupled.

---

## ECM-003

Collaboration shall remain fully traceable.

---

## ECM-004

Knowledge shall be shared through the Knowledge Repository.

---

## ECM-005

Runtime events shall communicate engineering state changes.

---

## ECM-006

Direct participant communication shall not be required for normal execution.

---

# 6. Functional Requirements

### FR-14.1

Participants shall collaborate through shared engineering artefacts.

---

### FR-14.2

Participants shall publish engineering state changes.

---

### FR-14.3

Participants shall consume published engineering state.

---

### FR-14.4

Collaboration shall preserve engineering traceability.

---

### FR-14.5

Participants shall remain independently replaceable.

---

### FR-14.6

Engineering decisions shall be visible to authorised Participants.

---

# 7. Collaboration Artefacts

The platform recognises the following collaboration artefacts.

## Deliverables

Represent engineering outcomes.

---

## Knowledge

Represents reusable engineering understanding.

---

## Evidence

Supports engineering decisions.

---

## Decisions

Capture engineering intent.

---

## Obligations

Represent engineering commitments.

---

## Events

Notify changes in engineering state.

---

# 8. Collaboration Flow

Typical collaboration follows this pattern.

```
Participant

↓

Produces Deliverable

↓

Knowledge Updated

↓

Dependency Evaluated

↓

Event Published

↓

Interested Participants Continue
```

Participants need not know who consumes the event.

---

# 9. Event-Driven Collaboration

Participants publish domain events rather than invoking one another directly.

Examples include:

- DeliverableApproved
- DecisionAccepted
- EvidenceSubmitted
- ObligationResolved
- KnowledgeAccepted

Subscribers determine whether action is required.

---

# 10. Knowledge-Centred Collaboration

Participants collaborate through a shared Knowledge Repository.

Participants shall:

- contribute knowledge;
- consume knowledge;
- validate knowledge;
- reference knowledge.

The Knowledge Repository becomes the authoritative engineering memory.

---

# 11. Deliverable-Centred Collaboration

Participants collaborate primarily around Deliverables.

Examples:

- Architecture evolves the Requirements Specification.
- Development evolves the Architecture.
- Testing validates the Source Code.
- Deployment consumes the Release Package.

The collaboration focus is the Deliverable rather than the Participant.

---

# 12. Decision-Centred Collaboration

Engineering decisions shall become shared engineering artefacts.

Participants may:

- propose decisions;
- review decisions;
- approve decisions;
- consume decisions.

Decision ownership shall remain traceable.

---

# 13. Collaboration Independence

Participants shall never assume:

- the identity of another Participant;
- the implementation technology of another Participant;
- the internal reasoning of another Participant.

Participants collaborate through published engineering state.

---

# 14. Failure Isolation

Participant failure shall not invalidate collaboration.

Because engineering state is preserved within the SEU:

- Participants may be restarted;
- Participants may be replaced;
- Participants may execute concurrently.

Engineering continuity shall remain unaffected.

---

# 15. Events

The Collaboration subsystem shall publish:

- CollaborationStarted
- CollaborationCompleted
- KnowledgeShared
- DeliverableShared
- DecisionPublished
- EvidencePublished
- CollaborationFailed

---

# 16. Non-Functional Requirements

The Collaboration Model shall:

- support asynchronous execution;
- support concurrent Participants;
- remain loosely coupled;
- preserve engineering traceability;
- remain implementation independent.

---

# 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Participants collaborate without direct coupling.

✓ Engineering artefacts constitute the primary collaboration mechanism.

✓ Events communicate engineering state changes.

✓ Participants remain independently replaceable.

✓ Engineering knowledge remains centralised.

✓ Collaboration remains fully traceable.

---

# 18. Deliverables

Implementation of this chapter shall produce:

- Collaboration services.
- Event publication framework.
- Collaboration APIs.
- Shared engineering artefact interfaces.
- Collaboration traceability services.
- Event subscriptions.