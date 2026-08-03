
# Chapter 13 – Participant Model


[Sudha: I think we're now at one of the most important chapters in the entire book.

Interestingly, this chapter is **not** about AI.

It is about **identity**.

One thing has become clear over the last few chapters:

- Roles are design-time concepts.
- Capabilities are engineering concepts.
- Behaviour comes from the EBM.
- Participants are runtime entities.

That means a Participant is not simply an "AI Agent". It is the **runtime identity** that fulfils capabilities within an SEU.

I also think we should avoid calling them "Agents" throughout the platform. "Agent" is an implementation. "Participant" is an architectural concept.

---------------


While writing this chapter, I think we've identified another architectural distinction that is worth preserving.

The platform currently has three concepts that are often conflated in existing AI systems:

|Concept|Responsibility|
|---|---|
|**Capability**|Defines _what engineering competency is required_.|
|**Participant Type**|Defines the kind of entity capable of fulfilling competencies (AI, Human, External).|
|**Participant Instance**|Represents the runtime entity commissioned within an SEU.|

This separation gives the platform remarkable flexibility. For example, the **Development Capability** could be fulfilled today by an AI coding participant, tomorrow by a human engineer, and later by a coordinated swarm of specialised AI participants—all without changing the Capability Model or the Engineering Behavior Model.

One refinement I'd suggest before we continue is to think about whether a Participant Instance should expose **services** to other Participants, or whether all inter-participant interaction should occur through Deliverables, Knowledge, Events and the Runtime Kernel. My inclination is the latter, because it avoids creating tightly coupled participant-to-participant dependencies and keeps the architecture centred on engineering artefacts rather than conversational interactions. That question will naturally lead us into the next chapter on collaboration and execution.
]

---

# 1. Purpose

A **Participant** is the runtime entity that fulfils one or more engineering Capabilities within a commissioned Software Engineering Unit (SEU).

Participants execute engineering work under the governance of the Engineering Behavior Model (EBM).

Participants may represent artificial intelligence systems, human engineers or external autonomous services.

The platform treats all Participants as equal architectural entities irrespective of their implementation.

---

# 2. Scope

This chapter defines:

- Participant abstraction;
- Participant identity;
- Participant lifecycle;
- Participant assignment;
- Participant replacement;
- Participant collaboration;
- Participant state.

This chapter does not define:

- AI implementation;
- human resource management;
- engineering behaviour;
- capability definitions.

---

# 3. Architectural Position

```
Capability

↓

Capability Fulfilment

↓

Participant

↓

Work Item Execution

↓

Deliverable
```

Participants execute engineering work.

They do not define engineering behaviour.

---

# 4. Definition

A Participant is a runtime instance capable of fulfilling one or more Capabilities.

Every Participant possesses:

- identity;
- lifecycle;
- runtime state;
- assigned Capabilities;
- engineering history.

Participants are transient.

Knowledge remains permanent.

---

# 5. Architectural Principles

## PM-001

Participants are replaceable.

---

## PM-002

Participants possess identity.

---

## PM-003

Participants shall not own engineering knowledge.

---

## PM-004

Participants execute behaviour.

They do not define behaviour.

---

## PM-005

Participants fulfil Capabilities.

They do not own Capabilities.

---

## PM-006

Participants shall remain independent of AI technologies.

---

# 6. Functional Requirements

### FR-13.1

Every Participant shall possess a globally unique identifier.

---

### FR-13.2

Every Participant shall belong to exactly one active SEU.

---

### FR-13.3

Participants may fulfil multiple Capabilities.

---

### FR-13.4

Multiple Participants may jointly fulfil one Capability.

---

### FR-13.5

Participants shall support replacement.

---

### FR-13.6

Replacement shall preserve engineering continuity.

---

### FR-13.7

Participant activities shall remain fully traceable.

---

# 7. Participant Types

The platform recognises three Participant Types.

## AI Participant

Represents an autonomous software engineering entity.

Examples:

- Requirements Analyst
- Solution Architect
- Developer
- Tester
- Technical Writer

The implementation technology is outside the scope of this specification.

---

## Human Participant

Represents a human engineering contributor.

Examples:

- Product Owner
- Domain Expert
- Enterprise Architect
- Security Reviewer

The platform models engineering participation only.

Human resource management remains outside the scope of the platform.

---

## External Participant

Represents an external autonomous service.

Examples:

- Static Analysis Platform
- CI/CD Pipeline
- Security Scanner
- Cloud Deployment Service

---

# 8. Participant Identity

Every Participant shall maintain:

- Participant Identifier
- Participant Type
- Display Name
- Assigned Capabilities
- Current State
- SEU Identifier
- Engineering History
- Authority Context
- Behaviour Context

Identity shall remain stable throughout the Participant lifecycle.

---

# 9. Participant Lifecycle

Every Participant shall transition through the following lifecycle.

```
Created

↓

Available

↓

Assigned

↓

Executing

↓

Idle

↓

Released

↓

Archived
```

Participants may transition repeatedly between **Assigned**, **Executing** and **Idle**.

---

# 10. Participant Assignment

A Participant becomes eligible for a Capability only through Capability Fulfilment (Chapter 12).

A Participant is assigned to a specific Deliverable or Work Item only through the Dispatch Engine (Chapter 33), which selects among Participants that Capability Fulfilment has already established as eligible.

Assignment establishes runtime relationships between:

- Participant;
- Capability;
- Deliverable;
- Engineering Behavior Model.

Assignment shall not modify the Participant definition.

---

# 11. Participant Collaboration

Participants may collaborate when multiple Capabilities contribute to a Deliverable.

The collaboration mechanism is implementation-defined.

The platform shall preserve:

- collaboration history;
- engineering decisions;
- evidence;
- traceability.

---

# 12. Participant State

Participants shall maintain runtime state including:

- availability;
- assigned Deliverables;
- current Work Items;
- execution history;
- pending decisions;
- outstanding obligations.

Runtime state shall not contain permanent engineering knowledge.

---

# 13. Participant Replacement

The platform shall permit replacement of any Participant.

Replacement shall preserve:

- Deliverable state;
- Knowledge;
- Decisions;
- Evidence;
- Traceability;
- Outstanding Obligations.

Replacement shall not require recommissioning of the SEU.

---

# 14. Participant Context

Participants operate within several contexts simultaneously.

## Engineering Context

The Deliverables currently being progressed.

---

## Behaviour Context

The Engineering Behavior Model governing execution.

---

## Capability Context

The Capabilities currently being fulfilled.

---

## Authority Context

The decision rights applicable at the current stage of execution.

---

## Knowledge Context

The engineering knowledge available to the Participant.

---

## Obligation Context

Outstanding obligations affecting assigned Deliverables.

These contexts define the operating environment of the Participant without embedding permanent engineering knowledge within the Participant itself.

---

# 15. Participant Memory

Participants may maintain transient working memory to support execution.

Participant memory shall be considered ephemeral.

Authoritative engineering knowledge shall be stored only in the Knowledge Repository.

If a Participant is replaced, its transient memory may be discarded without loss of engineering continuity.

---

# 16. Events

The platform shall publish events including:

- ParticipantCreated
- ParticipantAssigned
- ParticipantReleased
- ParticipantActivated
- ParticipantIdle
- ParticipantReplaced
- ParticipantArchived
- ParticipantUnavailable

---

# 17. Non-Functional Requirements

The Participant subsystem shall:

- support concurrent Participants;
- support heterogeneous Participant implementations;
- support dynamic replacement;
- preserve engineering continuity;
- maintain complete traceability.

---

# 18. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Participants possess unique identities.

✓ Participants can fulfil multiple Capabilities.

✓ Multiple Participants can collaborate on a Deliverable.

✓ Participants can be replaced without affecting engineering continuity.

✓ Participant history remains traceable.

✓ Participant memory remains transient.

---

# 19. Deliverables

Implementation of this chapter shall produce:

- Participant domain model.
- Participant lifecycle service.
- Participant registry.
- Participant assignment interfaces.
- Participant context model.
- Participant state management.
- Participant APIs.
- Participant events.