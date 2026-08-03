# Chapter 10 – Capability Model


[Sudha: this chapter captures one of the most significant departures from traditional software engineering platforms.

While writing it, I realised we've arrived at what I believe is one of the platform's defining architectural separations:

|Concept|Responsibility|
|---|---|
|**Engineering Behavior Model (EBM)**|Defines **how** engineering should be performed.|
|**Capability**|Defines **what engineering competency** is required.|
|**Participant**|Provides the competency.|
|**Work Item**|Applies the competency to advance a Deliverable.|

These four concepts are orthogonal. They should never be collapsed into one another.

For example, a **Developer Participant** doesn't "own" the Development Capability. It merely fulfils it for a period of time. Tomorrow, another AI model, a human engineer, or an external autonomous service could fulfil exactly the same Capability without changing the SEU.

I think that's a stronger and more durable abstraction than today's agent frameworks, which often equate an "agent" with a fixed role and a fixed set of skills. Here, **Capabilities are permanent, Participants are transient**, and the platform composes them dynamically to satisfy engineering objectives. That separation will make the platform significantly more adaptable over time.
]

---

# 1. Purpose

Capabilities represent the engineering competencies required to deliver software within a Software Engineering Unit (SEU).

A Capability defines **what engineering function must be performed**, independent of who or what performs it.

Capabilities are fulfilled by Participants, which may be AI systems, humans or external services.

The Capability Model separates engineering competence from engineering execution, enabling the platform to evolve independently of participant implementations.

---

# 2. Scope

This chapter defines:

- Capability abstraction;
- Capability lifecycle;
- Capability fulfilment;
- Capability relationships;
- Capability discovery;
- Capability composition.

This chapter does not define:

- Participant implementations;
- engineering behaviour;
- work item execution;
- AI reasoning.

---

# 3. Architectural Position

```
Deliverable

↓

Dependency Engine

↓

Required Capabilities

↓

Capability Fulfilment

↓

Participants

↓

Work Item Execution
```

The Capability Model determines **what competencies are required**.

Participants determine **who provides those competencies**.

---

# 4. Definition

A Capability is a reusable engineering competency that may be requested by the platform to achieve one or more Deliverables.

Capabilities are platform concepts.

They are independent of:

- Participants;
- Organisations;
- Technologies;
- AI providers.

---

# 5. Architectural Principles

## CM-001

Capabilities are stable.

---

## CM-002

Participants are replaceable.

---

## CM-003

Multiple Participants may fulfil the same Capability.

---

## CM-004

One Participant may fulfil multiple Capabilities.

---

## CM-005

Capabilities shall not contain runtime state.

---

## CM-006

Capabilities shall remain independent of engineering behaviour.

Behaviour is supplied by the Engineering Behavior Model.

---

# 6. Functional Requirements

### FR-10.1

The platform shall maintain a Capability Catalogue.

---

### FR-10.2

Every Work Item shall require one or more Capabilities.

---

### FR-10.3

Every Capability shall possess a globally unique identifier.

---

### FR-10.4

Capabilities shall support versioning.

---

### FR-10.5

Capabilities shall be independently extensible.

---

### FR-10.6

Capabilities shall support fulfilment by multiple Participant types.

---

### FR-10.7

Capability fulfilment shall remain traceable.

---

# 7. Capability Categories

Illustrative categories include:

## Requirements Engineering

- Requirements Elicitation
- Requirements Analysis
- Requirements Validation

---

## Architecture

- Solution Architecture
- Integration Architecture
- Data Architecture
- Security Architecture

---

## Development

- Code Generation
- Refactoring
- Debugging
- Code Review

---

## Testing

- Test Design
- Test Automation
- Performance Testing
- Security Testing

---

## Documentation

- Technical Documentation
- User Documentation
- API Documentation

---

## Deployment

- Release Engineering
- Environment Configuration
- Deployment Automation

---

## Knowledge

- Knowledge Acquisition
- Ontology Management
- Traceability Analysis

---

## Governance

- Architecture Review
- Compliance Assessment
- Decision Validation

Additional capabilities may be introduced through Packs.

---

# 8. Capability Structure

Every Capability shall define:

- Identifier
- Name
- Description
- Category
- Inputs
- Outputs
- Required Knowledge
- Expected Deliverables
- Success Criteria
- Supported Participant Types

The implementation of a Capability is deliberately outside the scope of this chapter.

---

# 9. Capability Relationships

Capabilities may:

- depend upon other Capabilities;
- specialise existing Capabilities;
- compose multiple Capabilities;
- extend Capabilities introduced through Packs.

Capability relationships shall not create circular dependencies.

---

# 10. Capability Fulfilment

Capability fulfilment is the process of assigning one or more Participants to provide a required Capability.

Fulfilment may occur through:

- AI Participants;
- Human Participants;
- External Services;
- Hybrid teams.

The platform shall permit fulfilment strategies to evolve without changing the Capability Model.

---

# 11. Capability Discovery

The platform shall support discovery of Capabilities by:

- identifier;
- category;
- engineering objective;
- Deliverable;
- Pack contribution;
- supported Participant type.

Discovery mechanisms are implementation-defined.

---

# 12. Capability Selection

When a Deliverable becomes Ready, the platform shall:

1. identify the required Capabilities;
2. determine fulfilment requirements;
3. invoke the Capability Fulfilment service;
4. assign appropriate Participants;
5. authorise execution.

Capability selection shall remain independent of the Engineering Behavior Model.

The Engineering Behavior Model governs **how** a Capability behaves once it has been selected.

---

# 13. Capability Evolution

Capabilities may evolve through:

- new versions;
- Pack contributions;
- specialisations;
- deprecation;
- resolution of an Organisational Learning Obligation (Chapter 23 §7), raised by Engineering Telemetry (Chapter 35 §11) upon detecting a sustained pattern indicating this Capability should be improved.

The last of these is what makes Continuous Organisational Learning an active process rather than passive measurement: accumulated telemetry does not merely describe a Capability's performance, it can obligate a revision to it.

Evolution shall preserve backward compatibility wherever practical.

---

# 14. Events

The Capability subsystem shall publish:

- CapabilityRegistered
- CapabilityUpdated
- CapabilityDeprecated
- CapabilityRequested
- CapabilityFulfilled
- CapabilityUnavailable
- CapabilityReleased

---

# 15. Non-Functional Requirements

The Capability Model shall:

- remain independent of Participant implementation;
- support concurrent fulfilment;
- support multiple fulfilment strategies;
- remain fully traceable;
- support extension through Packs.

---

# 16. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ A Capability Catalogue exists.

✓ Multiple Participants can fulfil the same Capability.

✓ A Participant can fulfil multiple Capabilities.

✓ Capability fulfilment is traceable.

✓ New Capabilities can be introduced through Packs.

✓ Capability evolution does not require Runtime Kernel modification.

---

# 17. Deliverables

Implementation of this chapter shall produce:

- Capability domain model.
- Capability catalogue.
- Capability registry.
- Capability discovery service.
- Capability fulfilment interfaces.
- Capability APIs.
- Capability events.