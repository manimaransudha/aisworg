# Chapter 8 – SEU Commissioning


[Sudha: 
> **Chapter 8 – SEU Commissioning**

That chapter will specify the end-to-end process by which a user requests an SEU, the platform validates the Template and Profile, composes the EBM, allocates runtime resources and commissions the SEU. It is the first chapter that describes an end-to-end platform workflow rather than a static architectural concept, making it the natural transition from the commissioning model to the operational lifecycle.


-------------------

While writing this chapter, one concept became very clear.

We originally described participant assignment as **recruitment**, borrowing terminology from human organisations. I now think that word should be interpreted more broadly.

An SEU doesn't "hire" participants. It **acquires capabilities**. Recruitment is simply one mechanism for satisfying those capability requirements.

For example:

- An AI participant may be instantiated on demand.
- A human participant may be assigned from a resource pool.
- An external service may be bound through an Integration Pack.
- A specialised capability may be discovered and attached dynamically.

This suggests that, internally, the platform should think in terms of **Capability Fulfilment** rather than recruitment. The user-facing terminology can remain familiar ("assign participants" or "staff the SEU"), but the architecture should remain capability-centric.

I would therefore propose an additional ADR:

> **ADR – Capability-First Commissioning**

**Decision:** During commissioning, the platform shall determine the capabilities required by the Template and fulfil those capabilities through appropriate Participants. Participants are an implementation of capability fulfilment, not the primary objective.

I believe this keeps the architecture aligned with one of our core principles: **Capabilities are stable; participants are replaceable.** It also positions the platform for future evolution where a capability might be fulfilled by a swarm of AI agents, a single human expert, or an external autonomous service without changing the commissioning model.
]

---

# 1. Purpose

SEU Commissioning is the process by which the platform creates a new Software Engineering Unit (SEU) from a defined Template and Profile.

Commissioning transforms static engineering definitions into an executable engineering environment by:

- validating the commissioning request;
- composing the Engineering Behavior Model (EBM);
- allocating runtime resources;
- establishing governance;
- creating the initial engineering state.

Commissioning is the only mechanism by which an SEU may be created.

---

# 2. Scope

This chapter defines:

- commissioning workflow;
- commissioning validation;
- engineering composition;
- runtime allocation;
- participant recruitment;
- initialisation;
- activation.

This chapter does not define:

- Pack internals;
- runtime execution;
- participant implementation;
- engineering workflows.

---

# 3. Architectural Position

```
User

↓

Commissioning Request

↓

Template

+

Profile

↓

Composition Engine

↓

Engineering Behavior Model

↓

SEU Runtime Allocation

↓

Commissioned SEU
```

Commissioning represents the transition from design-time to runtime.

---

# 4. Commissioning Objectives

Commissioning shall ensure that:

- every SEU begins from a valid engineering foundation;
- engineering behaviour is completely defined before execution;
- governance is established before work begins;
- runtime state is consistent;
- knowledge repositories are initialised;
- traceability begins at SEU creation.

---

# 5. Inputs

A commissioning request shall contain:

- Template
- Profile
- Commissioning Parameters
- Engineering Objectives
- Project Metadata
- Authorised Requestor

Optional inputs include:

- Existing Knowledge Repository
- Existing Deliverables
- Legacy Code Base
- Existing Ontology
- Existing Engineering Assets

---

# 6. Outputs

Commissioning shall produce:

- Commissioned SEU
- Engineering Behavior Model
- Initial Deliverable Catalogue
- Capability Catalogue
- Participant Requirements
- Knowledge Repository
- Dependency Graph
- Obligation Register
- Traceability Repository

---

# 7. Functional Requirements

### FR-8.1

Only authorised users may commission an SEU.

---

### FR-8.2

Every commissioning request shall reference one Template.

---

### FR-8.3

Every commissioning request shall reference one Profile.

---

### FR-8.4

The platform shall validate all mandatory Packs before composition.

---

### FR-8.5

The Composition Engine shall produce exactly one Engineering Behavior Model.

---

### FR-8.6

Commissioning shall fail if behavioural conflicts remain unresolved.

---

### FR-8.7

The platform shall allocate runtime resources only after successful composition.

---

### FR-8.8

The platform shall initialise the Knowledge Repository.

---

### FR-8.9

The platform shall initialise the Dependency Graph.

---

### FR-8.10

The platform shall initialise the Obligation Register.

---

### FR-8.11

Commissioning shall establish complete traceability before execution begins.

---

### FR-8.12

No engineering work shall begin until commissioning completes successfully.

---

# 8. Commissioning Workflow

Every commissioning request shall progress through the following lifecycle.

```
Commission Request

↓

Validate Request

↓

Resolve Template

↓

Resolve Profile

↓

Resolve Packs

↓

Compose EBM

↓

Validate Engineering Model

↓

Allocate Runtime

↓

Create Engineering Assets

↓

Recruit Participants

↓

Activate SEU

↓

Ready for Execution
```

Failure at any stage shall terminate commissioning.

---

# 9. Request Validation

The platform shall validate:

- Template existence;
- Profile existence;
- user authorisation;
- Pack availability;
- version compatibility;
- commissioning parameters;
- mandatory configuration.

Validation failures shall produce diagnostic reports.

---

# 10. Engineering Composition

The platform shall invoke the Composition Engine.

The Composition Engine shall:

- discover Packs;
- resolve dependencies;
- compose behaviour;
- validate behaviour;
- produce the Engineering Behavior Model.

No runtime resources shall be allocated before successful composition.

---

# 11. Runtime Allocation

Following successful composition, the Runtime Kernel shall allocate:

- SEU identifier;
- runtime services;
- event channels;
- configuration;
- persistence;
- security context;
- observability context.

The Runtime Kernel remains independent of engineering behaviour.

---

# 12. Engineering Asset Initialisation

Commissioning shall initialise:

- Deliverable Catalogue;
- Capability Catalogue;
- Role Catalogue;
- Knowledge Repository;
- Dependency Graph;
- Obligation Register;
- Traceability Repository.

No runtime execution shall occur during initialisation.

---

# 13. Participant Recruitment

Participant recruitment establishes the initial execution capability of the SEU.

Recruitment determines which Participants shall provide the capabilities defined by the Template.

Participants may be:

- AI;
- Human;
- External Systems.

Recruitment may occur:

- automatically;
- manually;
- through hybrid assignment.

Participant recruitment shall not modify the Engineering Behavior Model.

---

# 14. Initial Deliverable State

Every Deliverable shall begin in a defined lifecycle state.

Typical initial states include:

- Planned
- Awaiting Dependency Resolution
- Awaiting Human Input
- Awaiting External Asset
- Ready

The Dependency Engine determines subsequent state transitions.

---

# 15. Initial Knowledge State

The Knowledge Repository shall contain:

- commissioning metadata;
- Template reference;
- Profile reference;
- Engineering Behavior Model reference;
- Pack references;
- composition report;
- commissioning decisions.

This establishes the first knowledge baseline.

---

# 16. Initial Obligation State

Commissioning shall create obligations arising from:

- mandatory compliance;
- mandatory governance;
- mandatory engineering reviews;
- required approvals;
- unresolved recommendations.

Obligations shall become part of the Dependency Graph where appropriate.

---

# 17. Commissioning Report

Every commissioning operation shall produce a permanent Commissioning Report.

The report shall contain:

### Identity

- SEU Identifier
- Template
- Profile
- Engineering Behavior Model Version

---

### Composition

- Packs used
- Pack versions
- Composition summary
- Behaviour summary

---

### Validation

- Warnings
- Errors
- Manual resolutions
- Outstanding recommendations

---

### Runtime

- Participants recruited
- Runtime services allocated
- Initial Deliverables
- Initial Obligations

---

### Traceability

- Commissioning decisions
- Composition traceability
- Behaviour provenance

The Commissioning Report becomes part of the permanent engineering record.

---

# 18. Events

The platform shall publish events including:

- CommissionRequested
- CommissionValidated
- CompositionStarted
- CompositionCompleted
- RuntimeAllocated
- KnowledgeInitialised
- ParticipantsRecruited
- SEUActivated
- CommissionCompleted
- CommissionFailed

---

# 19. Non-Functional Requirements

Commissioning shall:

- be deterministic;
- be repeatable;
- be fully auditable;
- preserve complete traceability;
- support concurrent commissioning;
- support rollback upon failure.

---

# 20. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ An authorised user can commission an SEU.

✓ The Engineering Behavior Model is successfully composed.

✓ Runtime resources are allocated only after successful composition.

✓ Initial engineering assets are created.

✓ Participants are recruited.

✓ The Commissioning Report is generated.

✓ The SEU enters the **Ready for Execution** state.

---

# 21. Deliverables

Implementation of this chapter shall produce:

- Commissioning Service.
- Commissioning Workflow.
- Commissioning Validation Service.
- Runtime Allocation Service.
- Participant Recruitment Service.
- Commissioning Report Generator.
- Commissioning APIs.
- Commissioning Events.