#  Chapter 13 – Participant Model

##  1. Purpose

A **Participant** is the runtime entity that fulfils one or more engineering Capabilities within a commissioned Software Engineering Unit (SEU).

Participants execute engineering work under the governance of the Engineering Behavior Model (EBM).

Participants may represent artificial intelligence systems, human engineers or external autonomous services.

The platform treats all Participants as equal architectural entities irrespective of their implementation.

---

##  2. Scope

This chapter defines:

- Participant abstraction
- Participant identity
- Participant lifecycle
- Participant assignment
- Participant replacement
- Participant collaboration
- Participant state

This chapter does not define:

- AI implementation
- human resource management
- engineering behaviour
- capability definitions

---

##  3. Architectural Position

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

##  4. Definition

A Participant is a runtime instance capable of fulfilling one or more Capabilities.

Every Participant possesses:

- identity
- lifecycle
- runtime state
- assigned Capabilities
- engineering history

Participants are transient. Knowledge remains permanent.

---

##  5. Architectural Principles

### PM-001

Participants are replaceable.

### PM-002

Participants possess identity.

### PM-003

Participants shall not own engineering knowledge.

### PM-004

Participants execute behaviour. They do not define behaviour.


### PM-005

Participants fulfil Capabilities. They do not own Capabilities.


### PM-006

Participants shall remain independent of AI technologies.

---

##  6. Functional Requirements

### FR-13.1

Every Participant shall possess a globally unique identifier.

### FR-13.2

Every Participant shall belong to exactly one active SEU.

### FR-13.3

Participants may fulfil multiple Capabilities.

### FR-13.4

Multiple Participants may jointly fulfil one Capability.

### FR-13.5

Participants shall support replacement.

### FR-13.6

Replacement shall preserve engineering continuity.

### FR-13.7

Participant activities shall remain fully traceable.

---

##  7. Participant Types

The platform recognises four Participant Types.

### AI Participant

Represents an autonomous software engineering entity.

Examples:

- Requirements Analyst
- Solution Architect
- Developer
- Tester
- Technical Writer

The implementation technology is outside the scope of this specification.

---

### Human Participant

Represents a human engineering contributor.

Examples:

- Product Owner
- Domain Expert
- Enterprise Architect
- Security Reviewer

The platform models engineering participation only. Human resource management remains outside the scope of the platform.

---

### External Participant

Represents outside oversight/authority parties

Examples: 

- Auditors
- Certifying Authorities


### Automated Participant

Represents internal deterministic tooling/systems

Examples:

- Static Analysis Platform
- CI/CD Pipeline
- Security Scanner
- Cloud Deployment Service

---

##  8. Participant Identity

Every Participant shall maintain:

- Participant Identifier
- Participant Type
- Display Name
- Assigned Capabilities/Capability Context
- Current State
- SEU Identifier
- Engineering Context
- Authority Context
- Behaviour Context

Identity shall remain stable throughout the Participant lifecycle.

---

##  9. Participant Lifecycle

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

##  10. Participant Assignment

A Participant becomes eligible for a Capability only through Capability Fulfilment (Chapter 12).

A Participant is assigned to a specific Deliverable or Work Item only through the Dispatch Engine (Chapter 33), which selects among Participants that Capability Fulfilment has already established as eligible.

Assignment establishes runtime relationships between:

- Participant
- Capability
- Deliverable
- Engineering Behavior Model

Assignment shall not modify the Participant definition.

---

##  11. Participant Collaboration

Participants may collaborate when multiple Capabilities contribute to a Deliverable.

The collaboration mechanism is implementation-defined.

The platform shall preserve:

- collaboration history
- engineering decisions
- evidence
- traceability

---

##  12. Participant State

Participants shall maintain runtime state including:

- availability
- assigned Deliverables
- current Work Items
- execution history
- pending decisions
- outstanding obligations

Runtime state shall not contain permanent engineering knowledge.

---

##  13. Participant Replacement

The platform shall permit replacement of any Participant.

Replacement shall preserve:

- Deliverable state
- Knowledge
- Decisions
- Evidence
- Traceability
- Outstanding Obligations

Replacement shall not require recommissioning of the SEU.

---

##  14. Participant Context

Participants operate within several contexts simultaneously.

### Engineering Context

The Deliverables currently being progressed.
 
### Behaviour Context

The Engineering Behavior Model governing execution.
 
### Capability Context

The Capabilities currently being fulfilled.
 
### Authority Context

The decision rights applicable at the current stage of execution.
 
### Knowledge Context

The engineering knowledge available to the Participant.
 
### Obligation Context

Outstanding obligations affecting assigned Deliverables.

These contexts define the operating environment of the Participant without embedding permanent engineering knowledge within the Participant itself.

---

##  15. Participant Memory

Participants may maintain transient working memory to support execution.

Participant memory shall be considered ephemeral.

Authoritative engineering knowledge shall be stored only in the Knowledge Repository.

If a Participant is replaced, its transient memory may be discarded without loss of engineering continuity.

---

##  16. Events

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

##  17. Non-Functional Requirements

The Participant subsystem shall:

- support concurrent Participants
- support heterogeneous Participant implementations
- support dynamic replacement
- preserve engineering continuity
- maintain complete traceability

---

##  18. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Participants possess unique identities.

✓ Participants can fulfil multiple Capabilities.

✓ Multiple Participants can collaborate on a Deliverable.

✓ Participants can be replaced without affecting engineering continuity.

✓ Participant history remains traceable.

✓ Participant memory remains transient.

---

##  19. Deliverables

Implementation of this chapter shall produce:

- Participant domain model
- Participant lifecycle service
- Participant registry
- Participant assignment interfaces
- Participant context model
- Participant state management
- Participant APIs
- Participant events