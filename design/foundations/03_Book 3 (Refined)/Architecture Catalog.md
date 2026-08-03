# Architecture Catalogue

**Version 1.0 (Baseline)**

---

# 1. Purpose

The Architecture Catalogue defines the stable architectural concepts, principles and constraints governing the AI Software Organisation Platform.

It serves as the constitutional document for the platform.

All implementation decisions, runtime components, Pack definitions and Software Engineering Units (SEUs) shall conform to the architecture defined herein.

Changes to this catalogue shall occur only through approved Architecture Decision Records (ADRs).

---

# 2. Scope

The catalogue defines:

- Architectural Principles
- Runtime Architecture
- Stable Architectural Concepts
- Composition Model
- Extension Model
- Pack Taxonomy
- Execution Model
- Knowledge Model
- Governance Model
- Dependency Model
- Architectural Constraints

The catalogue intentionally excludes:

- Implementation technologies
- Programming languages
- Database products
- Infrastructure choices
- UI design
- Deployment topology

These belong to Book 3.

---

# 3. Architectural Vision

The platform is an execution environment for commissioning and operating autonomous **Software Engineering Units (SEUs)**.

Unlike traditional project management systems or AI orchestration frameworks, the platform does not manage people, schedules or tasks as primary concepts.

Instead, it commissions SEUs by composing engineering knowledge, governance and practices into an executable engineering model and executes software delivery through dependency-driven orchestration while preserving knowledge, governance and traceability.

---

# 4. First Principles

The architecture is founded upon the following principles.

---

## AP-001

**The Runtime Kernel shall remain domain independent.**

---

## AP-002

**Engineering behaviour shall be composed rather than hard-coded.**

---

## AP-003

**Everything that evolves over time shall be represented as a Pack wherever practical.**

---

## AP-004

**Dependencies govern execution.**

Time influences execution but does not determine it.

---

## AP-005

**Knowledge is the permanent organisational asset.**

Participants are temporary.

SEUs are temporary.

Knowledge persists.

---

## AP-006

**Governance is explicit.**

All significant decisions shall be traceable.

---

## AP-007

**Every architectural concept shall possess a single responsibility.**

---

## AP-008

**The Platform Core shall never require modification to introduce engineering behaviour.**

## AP-009

**Deliverables are primary.**

The purpose of every SEU is to produce engineering deliverables.

All runtime activities shall ultimately contribute towards one or more deliverables.

Work Items exist solely to create, modify or validate deliverables.


> **ADR – Packs are Declarative**

**Decision:** Packs shall declare engineering contributions rather than embedding execution logic.

**Rationale:** Declarative Packs maximise composability, traceability, auditability and long-term maintainability while keeping the Runtime Kernel stable.

> **ADR – Capability-First Commissioning**

Decision:  During commissioning, the platform shall determine the capabilities required by the Template and fulfil those capabilities through appropriate Participants. Participants are an implementation of capability fulfilment, not the primary objective.
---

> **ADR – Trust Pipeline**

**Decision:** Significant engineering state transitions shall be justified through a trust pipeline of Information → Evidence → Knowledge → Decision → Deliverable State Transition.

>**ADR – Engineering Knowledge Graph**

**Decision:** The platform shall treat all persistent engineering objects and their relationships as a single logical Engineering Knowledge Graph.

**Rationale:** This enables deterministic traceability, explainability, impact analysis, organisational learning and historical reconstruction without coupling the architecture to a specific persistence technology.

> **ADR – Governance by Composition**

**Decision:** Governance capabilities shall be composed from declarative primitives (Policies, Authority, Reviews, Quality Gates, Obligations and Evidence) contributed through Packs. New governance frameworks shall be implemented by composition rather than by introducing new governance mechanisms into the Runtime Kernel.

This ADR reinforces one of the platform's most important architectural principles: **extend behaviour through composition, not modification**.

> **ADR – Microkernel Runtime Architecture**

**Decision:** The platform shall adopt a microkernel architecture in which the Runtime Kernel provides only generic runtime services. Engineering behaviour, governance, knowledge, domain logic and organisation-specific functionality shall be implemented through declarative models and Packs rather than within the kernel.

**Rationale:** This keeps the kernel stable, simplifies testing, enables independent evolution of runtime services and ensures that new engineering methodologies, domains and governance models can be introduced without modifying the platform core.

> **ADR – Transition Definitions**

**Decision:** Every governed lifecycle state transition shall be defined by a declarative Transition Definition. Transition Definitions shall specify the source state, target state and all prerequisites for the transition, including authority, policies, quality gates, reviews, evidence and obligations.

**Rationale:** This provides a single, reusable mechanism for governing lifecycle transitions across all engineering objects, eliminates duplicated transition logic and reinforces the platform's declarative architecture.

> **ADR – Command-Driven Execution**

**Decision:** The Execution Engine shall generate Commands rather than Work Items. Commands express _what_ engineering action is required. Transient execution plans (Work Items) are derived later by participant-specific execution services.

**Rationale:** This cleanly separates engineering intent from execution strategy, keeps the Execution Engine implementation-independent, and allows heterogeneous Participants to fulfil the same engineering Command using different execution mechanisms. It also reinforces the platform's declarative, state-driven architecture.

> **ADR – Engineering Flow Optimisation**

**Decision:** The Runtime Kernel shall optimise engineering flow rather than resource utilisation or schedule adherence. The primary optimisation objective shall be the continuous advancement of Deliverables through governed state transitions while respecting dependencies and constraints.

**Rationale:** In an AI-native SEU, elapsed time and individual utilisation are secondary effects. The primary objective is maintaining uninterrupted engineering flow through the dependency graph. This aligns the platform with systems thinking and the Theory of Constraints, making bottlenecks explicit and optimisable without relying on traditional project management metrics.

> **ADR – Interaction Adapter Architecture**

**Decision:** The Runtime Kernel shall communicate with external systems exclusively through External Interactions implemented by Interaction Adapters hosted within Connectors.

**Rationale:** This separates architectural intent from implementation technology, preserves semantic consistency through the Ontology, enables independent evolution of connectors, and allows the platform to integrate with new technologies without modifying the Runtime Kernel. It also provides a uniform mechanism for interactions with external tools, enterprise systems and other SEUs.

> **ADR – Effective Engineering Configuration**

**Decision:** Before an SEU is activated, all applicable Packs shall be composed into a single immutable Effective Engineering Configuration (EEC). Runtime services shall consume the EEC rather than individual Packs.

**Rationale:** This isolates runtime execution from Pack management, improves determinism, simplifies runtime logic and provides a reproducible snapshot of the engineering environment for every SEU lifecycle stage. I believe the EEC will become the runtime equivalent of a compiled executable: Packs are the source, the EEC is the executable configuration consumed by the platform.

> **ADR – Pack Capability Declaration**

**Decision:** Every Pack shall declare both its primary Pack Type and the set of architectural capabilities it contributes (for example, Policies, Profiles, Templates, Authority Rules, Quality Gates, Ontology concepts, Reviews or Evidence Models). The Composition Engine shall use capability declarations, rather than Pack Type alone, when composing the Effective Engineering Configuration.

**Rationale:** This separates the identity of a Pack from its functional contributions, enabling richer composition, better tooling support and greater extensibility as the platform evolves.

> **ADR – Dual Authority Model**

**Decision:** The platform shall distinguish between **Platform Authority** and **Engineering Authority**. Platform Authority governs access to platform capabilities and runtime services. Engineering Authority governs permission to perform engineering state transitions. These models shall be evaluated independently and composed only where required.

**Rationale:** Separating operational security from engineering governance prevents privilege confusion, supports least-privilege design, simplifies implementation and allows engineering decision-making to evolve independently of platform administration. This reinforces the principle that access to the platform does not automatically confer authority over engineering outcomes.

> **ADR – Ownership Separation**

**Decision:** The platform shall distinguish Administrative Ownership, Engineering Ownership and Business Ownership. Runtime services shall use Administrative Ownership for platform administration, the Engineering Model shall use Engineering Ownership for execution and governance, and Business Ownership shall remain an external business concern that may be referenced but shall not influence Runtime Kernel behaviour.

> **ADR – Engineering Checkpoints**

**Decision:** The platform shall create logical Engineering Checkpoints representing consistent snapshots of engineering execution. Checkpoints shall reference the Effective Engineering Configuration, active artefact versions and the corresponding position in the engineering event stream. Recovery shall restore from an Engineering Checkpoint and, where necessary, replay subsequent Events to reconstruct the exact engineering state.

**Rationale:** Engineering continuity depends on restoring engineering semantics, not infrastructure state. Engineering Checkpoints provide a deployment-independent mechanism for deterministic recovery, reproducibility and historical reconstruction while preserving the platform's declarative architecture.

> **ADR – Revision and Version Separation**

**Decision:** Mutable authoring shall occur through Revisions. Only published Versions are immutable, may participate in an Effective Engineering Configuration, and may be consumed by the Runtime Kernel.

**Rationale:** This separates the concerns of authoring and execution. Developers need the flexibility to iterate on drafts, while the Runtime Kernel requires stable, immutable artefacts for deterministic execution and historical reproducibility.

> **ADR – Universal Lifecycle Pattern**

**Decision:** Configurable architectural artefacts within the SEU Platform shall follow a common lifecycle of Define → Validate → Compose → Activate → Execute → Observe → Evolve. Runtime components shall implement this lifecycle consistently unless a specific architectural exception is documented.

**Rationale:** A universal lifecycle reduces conceptual complexity, promotes consistent tooling, simplifies automation and creates a uniform experience for developers, administrators and platform services. It also reinforces the platform's declarative philosophy by making evolution a managed, traceable process rather than an ad hoc implementation detail. This pattern is the one nearly every other ADR in this catalogue independently converges on: Pack lifecycle (Ch. 38), Version lifecycle (Ch. 41), Quality Gate lifecycle (Ch. 26), and SEU lifecycle (Ch. 37) are all instances of it.

> **ADR – Telemetry-Driven Organisational Learning**

**Decision:** Where Engineering Telemetry (Ch. 35) detects a sustained pattern indicating that a Capability, Service or Policy should be improved, or where Knowledge (Ch. 16) is promoted to Capability, Enterprise or Platform Acquisition Scope, the platform shall raise an Organisational Learning Obligation (Ch. 23) rather than only recording the signal. Resolution of that Obligation shall produce a revised Capability, Service or Policy Pack version, composed by the Composition Engine into a new Effective Engineering Configuration.

**Rationale:** Continuous Organisational Learning is only real if accumulated measurement and accumulated understanding change future engineering behaviour, not merely describe past behaviour. Routing both sustained telemetry patterns and Engineering Capital promotion through the existing Obligation and Pack-versioning machinery makes learning an active, traceable, governed process using mechanisms the platform already has, rather than requiring a new persistent object or a bespoke feedback subsystem. Telemetry still decides only that a pattern is sustained, and Knowledge promotion only that understanding generalises further than its origin; what the improvement should be remains an engineering judgement in both cases, preserving Telemetry's own passive, derive-only principle.

> **ADR – Engineering Capital via Acquisition Scope**

**Decision:** Every Deliverable (Ch. 15) shall declare an Acquisition Scope of SEU, Capability, Enterprise or Platform, inherited by the Knowledge, Evidence and Decisions it produces, and independently promotable on Knowledge thereafter. Engineering Capital is defined as the aggregate of Knowledge Items whose Acquisition Scope is Capability, Enterprise or Platform — every Knowledge Item that outlives the SEU that produced it.

**Rationale:** This gives Engineering Capital a precise, queryable definition instead of an implicit one, without introducing a new persistent object: Capital is a filter over the existing Knowledge Model, groupable by Capability and by Tenant. Acquisition Scope mirrors the platform's existing tenancy and Pack hierarchy (SEU within Workspace within Tenant; Platform Packs above Organisation/Customer Packs) rather than inventing a parallel one, and Platform-scoped Knowledge remains a codification candidate rather than an automatic cross-Tenant exposure, preserving the Tenant isolation principles established for Multi-Tenancy (Ch. 42).

# 5. Stable Architectural Concepts

The following concepts constitute the architectural vocabulary of the platform.

## Runtime

- Runtime Kernel
- Extension Framework
- Composition Engine
- Event Bus

---

## Execution

- Objective
- Software Engineering Unit (SEU)
- Capability
- Role
- Participant
- Service
- Work Item

---

## Knowledge

- Knowledge
- Acquisition Scope
- Engineering Capital
- Evidence
- Observation
- Decision
- Ontology

---

## Governance

- Policy
- Decision Governance
- RACI
- Quality Gates
- Review Gates

---

## Flow

- Dependency
- Deliverable
- Execution Stage
- Readiness

---

## Assurance

- Obligation
- Audit Finding
- Risk
- Compliance Requirement

---

## Composition

- Pack
- Template
- Engineering Behavior Model

---

# 6. Runtime Architecture

```
User Experience

        │

        ▼

SEU Runtime

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

Each layer depends only upon lower layers.

---

# 7. Runtime Kernel

The Runtime Kernel provides generic execution services.

Responsibilities include:

- Lifecycle
- Scheduling
- Event Publication
- Identity
- Messaging
- Configuration
- Persistence
- Security
- Logging

The Runtime Kernel contains no Software Engineering knowledge.

---

# 8. Extension Framework

The Extension Framework enables platform evolution.

Responsibilities include:

- Pack discovery
- Dependency resolution
- Version management
- Pack lifecycle
- Registration
- Validation

The Extension Framework shall remain independent of engineering domains.

---

# 9. Composition Engine

The Composition Engine constructs the effective engineering model used by an SEU.

Responsibilities include:

- Loading Packs
- Resolving dependencies
- Applying composition strategies
- Detecting conflicts
- Producing an Engineering Behavior Model

The Composition Engine shall be deterministic and fully traceable.

---

# 10. Pack Taxonomy

The platform recognises the following Pack categories.

## Platform Packs

Provided by the platform.

Examples:

- Core Engineering Practices
- Default Governance
- Default Decision Governance
- Knowledge Management
- Traceability

---

## Organisation Packs

Engineering practices contributed by participating organisations.

Examples:

- TCS Engineering Practices
- IBM Engineering Practices
- Cigna Engineering Practices

---

## Domain Packs

Business-domain knowledge.

Examples:

- Banking
- Healthcare
- Insurance
- Manufacturing

---

## Compliance Packs

Regulatory and standards requirements.

Examples:

- HIPAA
- PCI-DSS
- GDPR
- SOX
- ISO 27001

---

## Technology Packs

Technology-specific practices.

Examples:

- Java
- Node.js
- Kubernetes
- PostgreSQL

---

## Integration Packs

External integrations.

Examples:

- GitHub
- GitLab
- Jira
- Azure DevOps

---

# 11. Pack Composition

Packs contribute engineering behaviour.

They may contribute:

- Policies
- Workflows
- Standards
- Ontology
- Governance
- Decision Rules
- Checklists
- Quality Gates
- Authority Rules
- Templates
- UI Components
- Services

Composition strategies include:

- Override
- Merge
- Supplement
- Union
- Intersection
- Alias
- Conflict Detection

---

# 12. Engineering Behavior Model (EBM)

The Engineering Behavior Model is the effective engineering model produced by composing Packs.

Every commissioned SEU executes against exactly one EBM.

The EBM is immutable unless changed through governed composition.

---

# 13. Execution Model

Execution is dependency-driven.

The unit of execution is the Deliverable.

Work begins when dependencies are satisfied.

Scheduling is subordinate to dependency resolution.

---

# 14. Flow Model

The platform continuously evaluates:

- Ready Deliverables
- Blocked Deliverables
- Dependency Graph
- Active Constraints
- Flow Efficiency

Flow optimisation is achieved by reducing dependency constraints.

---

# 15. Knowledge Model

Knowledge shall exist independently of execution.

Every accepted Knowledge Item shall possess supporting Evidence.

Knowledge shall remain reusable across SEUs.

---

# 16. Governance Model

Governance consists of:

- Policies
- Decision Governance
- RACI
- Approval Rules
- Delegation Rules
- Escalation Rules
- Quality Gates
- Review Gates

Governance behaviour is contributed primarily through Packs.

---

# 17. Obligation Model

An Obligation represents a condition that the SEU must satisfy.

Obligations may originate from:

- Risks
- Audits
- Compliance
- Customer Reviews
- Security Reviews
- Architecture Reviews
- Dependency Analysis

Every Obligation possesses:

- Source
- Owner
- Priority
- Severity
- Status
- Required Evidence
- Blocking Conditions
- Resolution

Obligations participate in dependency resolution.

---

# 18. Architectural Constraints

The following constraints shall govern the platform.

- The Runtime Kernel shall remain domain independent.
- Packs shall remain independently versioned.
- Runtime behaviour shall be externally observable.
- Cross-Pack communication shall occur only through published services or events.
- All significant decisions shall remain traceable.
- Engineering behaviour shall be introduced through Packs wherever practical.
- Every SEU shall execute against a complete Engineering Behavior Model.

---

# 19. Architecture Decision Records

Architectural evolution shall occur exclusively through ADRs.

Each ADR shall contain:

- Context
- Problem
- Decision
- Alternatives Considered
- Consequences
- Impact
- Status

The Architecture Catalogue shall be updated only through accepted ADRs.

---

# 20. Success Criteria

The architecture shall be considered successful when it enables:

- Commissioning of SEUs without modifying the Runtime Kernel.
- Composition of engineering practices from multiple organisations.
- Execution driven by dependencies rather than schedules.
- Preservation of knowledge independent of participants.
- Governance, traceability and obligations as first-class architectural concepts.
- Extension of the platform through Packs without architectural redesign.

---
