
# Chapter 36 – External Interaction Model

[Sudha: 
I think we've now reached the last major runtime service.

Originally we planned an "Integration Framework."

I now think that's too implementation-oriented.

Let's step back.

The Runtime Kernel already has:

- State Management
- Event Model
- Execution Engine
- Dispatch Engine
- Attention Management
- Engineering Telemetry

The remaining question is:

> **How does an SEU interact with the outside world?**

That's much broader than integrations.

The platform doesn't integrate with GitHub because GitHub is special.

It integrates with **external capabilities**.

Today that's GitHub.

Tomorrow it might be another source control system, an ERP, a regulatory database, another SEU, or another AI platform.

So I think the correct abstraction is not **Integration Framework**.

It is the **External Interaction Model**.

This chapter defines how the Runtime Kernel communicates beyond its own boundary.

---------------

I think we've now reached another architectural simplification.

Originally, we envisioned "integrations" as connectors to tools such as GitHub, Azure DevOps or Jira.

I now think those are merely **adapter implementations**.

The architectural abstraction is much broader:

> **The Runtime Kernel communicates only through External Interactions.**

This has two significant consequences.

First, it decouples the platform from today's tooling landscape. Replacing GitHub with another source control platform should involve changing an adapter, not changing the Runtime Kernel or the Engineering Behavior Model.

Second, it naturally supports **SEU-to-SEU collaboration**, which I believe will become increasingly important. One SEU may depend on a Deliverable produced by another SEU, request a specialised Capability from another SEU, or consume Knowledge published by another SEU. From the perspective of the Runtime Kernel, these are simply external interactions governed by the same architectural principles as any other interaction.

## One architectural refinement

I think we should introduce a distinction between:

- **Interaction** – the architectural concept.
- **Adapter** – the implementation of that interaction for a specific external technology.
- **Connector** – the deployable software component that hosts one or more adapters.

That gives us a clean three-layer model:

```
External Interaction
        │
        ▼
Interaction Adapter
        │
        ▼
Connector
        │
        ▼
External Technology
```

I'd recommend capturing this as an ADR:

> **ADR – Interaction Adapter Architecture**

**Decision:** The Runtime Kernel shall communicate with external systems exclusively through External Interactions implemented by Interaction Adapters hosted within Connectors.

**Rationale:** This separates architectural intent from implementation technology, preserves semantic consistency through the Ontology, enables independent evolution of connectors, and allows the platform to integrate with new technologies without modifying the Runtime Kernel. It also provides a uniform mechanism for interactions with external tools, enterprise systems and other SEUs.
]
---

# 1. Purpose

The External Interaction Model defines how a Software Engineering Unit (SEU) exchanges information and invokes capabilities outside the Runtime Kernel.

External interactions enable an SEU to collaborate with external platforms, engineering tools, enterprise systems, cloud services, regulatory systems and other SEUs.

The Runtime Kernel remains the authoritative source of engineering state.

External systems neither own nor directly modify engineering state.

---

# 2. Scope

This chapter defines:

- External Interaction abstraction;
- interaction boundaries;
- interaction lifecycle;
- interaction governance;
- interaction traceability;
- interaction extensibility.

This chapter does not define:

- communication protocols;
- API technologies;
- messaging technologies;
- authentication mechanisms.

These are implementation concerns.

---

# 3. Architectural Position

```
Runtime Kernel

↓

External Interaction Model

↓

Interaction Adapters

↓

External Systems
```

External interactions occur only through controlled interaction points.

---

# 4. Definition

An External Interaction is a controlled exchange of information or capability between an SEU and an external entity.

Interactions may:

- request information;
- publish information;
- invoke capabilities;
- receive notifications;
- synchronise state.

External systems never directly participate in engineering state transitions.

---

# 5. Architectural Principles

## EI-001

External interactions are isolated.

---

## EI-002

The Runtime Kernel owns engineering state.

---

## EI-003

External interactions are adapter-based.

---

## EI-004

Interactions are traceable.

---

## EI-005

External interactions are asynchronous wherever practical.

---

## EI-006

External interactions are technology-independent.

---

# 6. Functional Requirements

### FR-36.1

Every external interaction shall possess a unique identifier.

---

### FR-36.2

Interactions shall occur through Interaction Adapters.

---

### FR-36.3

External systems shall never bypass Governance.

---

### FR-36.4

Interactions shall preserve engineering traceability.

---

### FR-36.5

Interaction failures shall not corrupt engineering state.

---

### FR-36.6

Interaction policies shall be contributed through Packs.

---

### FR-36.7

Interaction behaviour shall support replacement of external systems without Runtime Kernel modification.

---

# 7. External Interaction Categories

Illustrative categories include:

## Engineering Tool Interactions

Examples:

- Source control
- Build systems
- Test platforms
- Artifact repositories

---

## Enterprise Interactions

Examples:

- Identity services
- ERP
- Document management
- Service management

---

## Cloud Interactions

Examples:

- Infrastructure provisioning
- Secrets management
- Storage services

---

## Regulatory Interactions

Examples:

- Compliance reporting
- Regulatory submissions
- Audit evidence exchange

---

## Customer Interactions

Examples:

- Deliverable submission
- Approval requests
- Progress reporting

---

## SEU-to-SEU Interactions

Examples:

- Shared engineering knowledge
- Deliverable dependencies
- Capability requests
- Cross-SEU coordination

Additional interaction categories may be introduced through Packs.

---

# 8. Interaction Structure

Every External Interaction shall define:

- Identifier
- Interaction Type
- Direction
- Target System
- Interaction Purpose
- Triggering Event
- Payload Reference
- Status
- Traceability References
- Version

The payload format is implementation-defined.

---

# 9. Interaction Lifecycle

Every External Interaction shall progress through the following lifecycle.

```
Created

↓

Validated

↓

Dispatched

↓

Acknowledged

↓

Completed

↓

Archived
```

Failed interactions may be retried according to implementation policies.

---

# 10. Interaction Adapters

External systems shall be accessed through Interaction Adapters.

An Interaction Adapter shall:

- translate engineering concepts into external representations;
- translate external responses into engineering concepts;
- isolate technology-specific behaviour;
- preserve engineering semantics.

Adapters shall remain replaceable.

---

# 11. Engineering Semantics

External systems frequently use terminology and data structures different from the SEU.

Interaction Adapters shall preserve engineering meaning by translating between external representations and the platform Ontology.

This ensures that external integrations do not introduce semantic inconsistency into the engineering model.

---

# 12. Interaction Governance

External interactions shall respect:

- Authority;
- Policies;
- Quality Gates;
- Compliance requirements;
- Engineering Behavior Model.

External interactions shall not circumvent governance.

---

# 13. Failure Handling

Interaction failures shall:

- preserve engineering state;
- generate Events;
- generate Attention Items where appropriate;
- support retry;
- remain fully traceable.

Failure recovery strategies are implementation-defined.

---

# 14. Interaction Traceability

Every interaction shall preserve:

- triggering Event;
- originating engineering object;
- external target;
- interaction outcome;
- timestamp;
- governing policies;
- associated Deliverables.

Interaction history shall remain immutable.

---

# 15. Events

The External Interaction subsystem shall publish:

- InteractionCreated
- InteractionValidated
- InteractionDispatched
- InteractionSucceeded
- InteractionFailed
- InteractionRetried
- InteractionCompleted

---

# 16. Non-Functional Requirements

The External Interaction Model shall:

- support heterogeneous external systems;
- isolate implementation technologies;
- support asynchronous communication;
- preserve engineering integrity;
- remain extensible through adapters.

---

# 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ External systems never directly modify engineering state.

✓ All interactions occur through Interaction Adapters.

✓ Engineering semantics are preserved.

✓ Interaction failures do not corrupt engineering state.

✓ Interaction history is fully traceable.

✓ Interaction adapters are independently replaceable.

---

# 18. Deliverables

Implementation of this chapter shall produce:

- External Interaction framework.
- Interaction Adapter framework.
- Interaction registry.
- Interaction lifecycle service.
- External interaction APIs.
- Interaction events.
- Adapter development guidelines.

---