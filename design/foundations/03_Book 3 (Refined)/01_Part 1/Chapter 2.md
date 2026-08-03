## Chapter 2 – Software Engineering Unit (SEU)

[Sudha: One refinement I'd like us to consider in this chapter is the relationship between **Deliverables** and **Work Items**. I deliberately made Deliverables the primary concept and Work Items subordinate to them because it aligns with the dependency-driven execution model. However, I'd like us to challenge that assumption before freezing it.

The key question is:

> **Should Deliverables be the fundamental unit of execution, or should they simply be outcomes produced by Work Items?**

My current inclination is that **Deliverables should remain primary**. Software engineering ultimately exists to produce engineering artefacts and outcomes. Work Items are transient execution steps, whereas Deliverables become part of the enduring engineering knowledge of the SEU. If we accept that, then the Dependency Engine naturally operates on Deliverables, and Work Items become implementation mechanics rather than the centre of the execution model. I think that is more consistent with the knowledge-first philosophy we've established, but it's worth scrutinising because it will influence much of the platform design going forward.
]

---

# 1. Purpose

The **Software Engineering Unit (SEU)** is the primary execution entity of the AI Software Organisation Platform.

An SEU is a temporary engineering construct commissioned to achieve one or more software engineering Objectives (Chapter 1). Every SEU's required Capabilities derive from the Objective(s) it is commissioned to achieve.

Unlike a traditional software team, an SEU is an executable runtime entity whose behaviour is determined by a composed **Engineering Behavior Model (EBM)** and whose participants may be AI, human, or external systems.

The SEU is responsible for executing software engineering work while preserving knowledge, governance, traceability and engineering practices independently of individual participants.

---

# 2. Scope

This chapter defines:

- the SEU lifecycle;
- the SEU runtime model;
- the SEU composition model;
- responsibilities of an SEU;
- interaction with the Runtime Kernel, Composition Engine and Packs;
- commissioning and archival.

This chapter does **not** define:

- individual capabilities;
- participant implementations;
- engineering practices;
- workflows;
- knowledge internals.

These are specified in subsequent chapters.

---

# 3. Architectural Position

Within the platform architecture, the SEU occupies the execution layer.

```
                 User/API
                     │
                     ▼
            Commission SEU
                     │
                     ▼
              SEU Runtime
                     │
        ┌────────────┼────────────┐
        │            │            │
   Work Items   Knowledge   Governance
        │            │            │
        └────────────┼────────────┘
                     │
                     ▼
         Engineering Behavior Model
                     │
                     ▼
            Composition Engine
                     │
                     ▼
          Extension Framework
                     │
                     ▼
              Runtime Kernel
```

The SEU shall not interact directly with Packs.

All engineering behaviour shall be inherited through the Engineering Behavior Model.

---

# 4. Responsibilities

The SEU is responsible for:

- executing software engineering work;
- maintaining engineering governance;
- coordinating participants;
- maintaining dependency graphs;
- managing engineering obligations;
- preserving knowledge;
- maintaining traceability;
- reporting engineering state.

The SEU is **not** responsible for:

- composing engineering practices;
- loading Packs;
- authenticating users;
- infrastructure management.

---

# 5. Functional Requirements

### FR-2.1

The platform shall permit authorised users to commission an SEU.

---

### FR-2.2

Every SEU shall execute against exactly one Engineering Behavior Model.

---

### FR-2.3

An Engineering Behavior Model shall exist before an SEU is commissioned.

---

### FR-2.4

Every runtime object shall belong to exactly one active SEU.

---

### FR-2.5

An SEU shall support human, AI and external-system participants.

---

### FR-2.6

An SEU shall maintain complete engineering traceability.

---

### FR-2.7

An SEU shall preserve organisational knowledge independently of participant lifecycle.

---

### FR-2.8

An SEU shall expose runtime state through published services.

---

### FR-2.9

An SEU shall maintain dependency relationships between deliverables.

---

### FR-2.10

Execution shall occur only when dependency conditions are satisfied.

---

### FR-2.11

An SEU shall manage engineering obligations.

---

### FR-2.12

An SEU shall preserve a complete audit history.

---

# 6. SEU Lifecycle

Every SEU shall transition through the following lifecycle.

```
Requested

↓

Engineering Behavior Composition

↓

Commissioned

↓

Executing

↓

Monitoring

↓

Completing

↓

Knowledge Preservation

↓

Archived
```

### Requested

The project objective has been defined.

No runtime resources exist.

---

### Engineering Behavior Composition

The Composition Engine constructs the Engineering Behavior Model.

No participants are active.

---

### Commissioned

Runtime resources are allocated.

Capabilities become available.

Participants may be recruited.

---

### Executing

The SEU performs engineering work.

The Dependency Engine continuously evaluates execution readiness.

---

### Monitoring

The SEU continuously evaluates:

- dependency health;
- engineering obligations;
- governance;
- knowledge completeness;
- execution flow.

---

### Completing

Outstanding work reaches a terminal state.

Knowledge is consolidated.

---

### Knowledge Preservation

Knowledge, evidence and traceability are finalised for long-term reuse.

---

### Archived

The SEU becomes read-only.

Runtime execution ceases.

Knowledge remains accessible.

---

# 7. SEU Composition

An SEU is composed of the following runtime components.

```
Software Engineering Unit

├── Objectives
├── Participants
├── Capabilities
├── Services
├── Roles
├── Deliverables
├── Work Items
├── Dependency Graph
├── Knowledge
├── Evidence
├── Governance
├── Obligations
├── Traceability
├── Metrics
└── Runtime State
```

Each component is elaborated in later chapters.

---

# 8. Execution Model

Execution within an SEU is dependency-driven.

The platform shall determine execution readiness by evaluating dependency satisfaction rather than elapsed time.

Dependencies may arise from:

- engineering deliverables;
- decisions;
- approvals;
- evidence;
- obligations;
- external systems;
- human input.

The Runtime Kernel shall execute only work items declared ready by the Dependency Engine.

---

# 9. Engineering Behavior Model

The SEU inherits all engineering behaviour from its Engineering Behavior Model.

The Engineering Behavior Model defines:

- engineering standards;
- governance;
- decision rules;
- quality gates;
- review gates;
- authority rules;
- engineering terminology;
- engineering practices.

The SEU shall not modify the Engineering Behavior Model directly.

Changes require recomposition by the Composition Engine.

---

# 10. Participants

Participants execute capabilities within assigned roles.

Participants may be:

- AI;
- Human;
- External Systems.

Participants are replaceable.

Replacement shall not invalidate knowledge, traceability or completed work.

---

# 11. Deliverables

A Deliverable represents a measurable engineering outcome.

Examples include:

- Approved Requirements Specification
- Architecture Document
- Source Code
- Test Suite
- Deployment Package
- User Documentation

Every Deliverable shall define:

- dependencies;
- producing capabilities;
- required evidence;
- acceptance criteria;
- completion status.

---

# 12. Work Items

A Work Item represents an executable unit of engineering activity.

Work Items exist solely to produce or modify Deliverables.

Every Work Item shall reference one or more Deliverables.

Work Items shall not exist independently of Deliverables.

---

# 13. Dependency Graph

The SEU shall maintain a dependency graph describing relationships between:

- Deliverables;
- Decisions;
- Obligations;
- Knowledge;
- Evidence;
- External dependencies.

Execution readiness shall be determined exclusively from this graph.

---

# 14. Engineering Obligations

An SEU shall manage engineering obligations originating from:

- risks;
- audits;
- customer observations;
- compliance;
- security reviews;
- architecture reviews;
- dependency analysis.

Every obligation shall possess:

- owner;
- severity;
- priority;
- required evidence;
- blocking conditions;
- status.

---

# 15. Events

The SEU shall publish domain events.

Examples include:

- SEUCommissioned
- DeliverableReady
- WorkItemStarted
- WorkItemCompleted
- DependencySatisfied
- DependencyBlocked
- ObligationRaised
- ObligationResolved
- KnowledgeAccepted
- KnowledgeArchived
- SEUArchived

---

# 16. Non-Functional Requirements

- Multiple SEUs shall execute concurrently.
- SEU execution shall survive runtime restarts.
- Runtime state shall be recoverable.
- All engineering decisions shall remain traceable.
- All execution shall be externally observable.
- The SEU shall remain independent of specific AI providers.

---

# 17. Acceptance Criteria

The chapter shall be considered implemented when:

- An SEU can be commissioned from an Engineering Behavior Model.
- Participants can be assigned and replaced.
- Deliverables drive execution.
- Work Items execute only when dependencies are satisfied.
- Engineering obligations influence execution.
- Knowledge survives SEU archival.
- Traceability remains complete.

---

# 18. Deliverables

Implementation of this chapter shall produce:

- SEU domain model.
- SEU lifecycle implementation.
- SEU aggregate definition.
- Dependency graph interfaces.
- Deliverable model.
- Work Item model.
- Runtime services.
- Event definitions.
- Initial API specification.