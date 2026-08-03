# Chapter 3 – Engineering Behavior Model (EBM)

[Sudha: I think this chapter is a solid first version, but while writing it I noticed one concept that I deliberately did **not** define because I think it deserves its own chapter.

We keep referring to **Behavioural Rules**, but we haven't answered:

> **What is a Behaviour?**

That may sound philosophical, but I think it's actually a modelling question.

For example, is:

- "Every merge requires two reviewers."

a Behaviour?

Or is it a **Constraint**?

Is:

- "Use GitFlow."

a Behaviour?

Or is it a **Workflow**?

Is:

- "Validate all inputs."

a Behaviour?

Or is it a **Policy**?

I don't think we should answer that in this chapter because it would make it too broad. Instead, I think Book 3 should later introduce a **Behaviour Model** chapter that defines the taxonomy of behavioural rules contributed by Packs. That taxonomy will make the Composition Engine much more rigorous and will give every Pack a common language for contributing behaviour. I don't think it's a blocker for continuing, but I do think it's an important piece of the implementation model that deserves explicit treatment rather than being left implicit.
]


---

# 1. Purpose

The **Engineering Behavior Model (EBM)** defines the behavioural contract governing the operation of a Software Engineering Unit (SEU).

Every commissioned SEU shall execute against exactly one Engineering Behavior Model.

The EBM defines **how** software engineering shall be performed within an SEU. It governs engineering behaviour but does not define engineering competence.

Engineering competence resides with Participants.

Engineering behaviour resides with the EBM.

---

# 2. Scope

This chapter defines:

- the Engineering Behavior Model;
- behavioural composition;
- behavioural categories;
- behavioural inheritance;
- behavioural constraints;
- runtime interaction with the SEU.

This chapter does not define:

- Pack composition algorithms;
- Pack lifecycle;
- individual Pack implementations;
- participant capabilities.

These are defined in later chapters.

---

# 3. Architectural Position

The Engineering Behavior Model occupies the boundary between the Composition Engine and the commissioned SEU.

```
Packs
    │
    ▼
Composition Engine
    │
    ▼
Engineering Behavior Model
    │
    ▼
Software Engineering Unit
    │
    ▼
Participants
```

The SEU consumes an EBM but never modifies it directly.

---

# 4. Definition

The Engineering Behavior Model is the complete behavioural specification governing a commissioned Software Engineering Unit.

It is produced by composing behavioural contributions from one or more Packs.

The EBM is authoritative for the lifetime of the commissioned SEU unless superseded through a governed recomposition process.

---

# 5. Architectural Responsibilities

The EBM shall:

- define engineering behaviour;
- define governance behaviour;
- define decision behaviour;
- define quality behaviour;
- define compliance behaviour;
- define collaboration behaviour;
- define lifecycle behaviour;
- define authority behaviour;
- define engineering terminology;
- define engineering constraints.

The EBM shall not:

- contain executable work;
- schedule execution;
- manage participants;
- preserve knowledge;
- execute workflows.

---

# 6. Functional Requirements

### FR-3.1

Every commissioned SEU shall reference exactly one active Engineering Behavior Model.

---

### FR-3.2

Every Engineering Behavior Model shall possess a globally unique identifier.

---

### FR-3.3

Every Engineering Behavior Model shall be versioned.

---

### FR-3.4

Every behavioural contribution shall be traceable to its originating Pack.

---

### FR-3.5

Every behavioural rule shall define its composition strategy.

---

### FR-3.6

Behavioural conflicts shall be detected before an SEU is commissioned.

---

### FR-3.7

Behavioural conflicts requiring human judgement shall prevent commissioning until resolved.

---

### FR-3.8

An Engineering Behavior Model shall be immutable during normal execution.

---

### FR-3.9

Modification of an Engineering Behavior Model shall occur only through recomposition.

---

### FR-3.10

All recompositions shall be versioned and fully traceable.

---

# 7. Behaviour Categories

An Engineering Behavior Model may contain behavioural contributions in the following categories.

## Engineering Practices

Examples:

- Coding standards
- Documentation standards
- Branching strategy
- Review practices

---

## Governance

Examples:

- Decision rules
- Approval rules
- Escalation rules
- Delegation rules

---

## Quality

Examples:

- Definition of Ready
- Definition of Done
- Quality gates
- Acceptance criteria

---

## Compliance

Examples:

- HIPAA
- PCI-DSS
- SOX
- ISO 27001

---

## Domain

Examples:

- Domain terminology
- Domain ontology
- Business rules
- Domain-specific validation

---

## Technology

Examples:

- Java conventions
- Node.js conventions
- Kubernetes deployment rules

---

## Integration

Examples:

- GitHub workflow
- Jira integration
- Azure DevOps integration

---

## Decision Governance

Examples:

- Required approvers
- Evidence requirements
- Review boards
- Exception policies

---

## Obligations

Examples:

- Risk handling
- Audit findings
- Customer observations
- Security findings

---

# 8. Behavioural Rule

Every behavioural rule shall contain at least:

- Identifier
- Name
- Description
- Behaviour Category
- Originating Pack
- Version
- Composition Strategy
- Applicability Conditions
- Enforcement Level
- Traceability Reference

The internal representation shall be implementation-defined.

---

# 9. Composition Principles

The EBM is produced by composing behavioural contributions.

Supported composition strategies include:

- Override
- Merge
- Supplement
- Union
- Intersection
- Alias
- Conflict Detection

Additional strategies may be introduced through the Extension Framework.

---

# 10. Behavioural Inheritance

Behaviour shall be inherited from multiple Pack categories.

A typical Engineering Behavior Model may inherit behaviour from:

```
Platform Packs
        │
Organisation Packs
        │
Domain Packs
        │
Compliance Packs
        │
Technology Packs
        │
Integration Packs
        │
        ▼
Engineering Behavior Model
```

No assumptions shall be made regarding the number of contributing Packs.

---

# 11. Behaviour Resolution

When multiple Packs contribute behaviour affecting the same engineering concern, the Composition Engine shall resolve the behaviour according to declared composition strategies.

The Composition Engine shall produce a single, internally consistent Engineering Behavior Model.

Resolution shall be deterministic and repeatable.

---

# 12. Behaviour Enforcement

The Engineering Behavior Model defines expected behaviour.

Enforcement of behaviour is the responsibility of runtime services.

Examples include:

- Governance Runtime
- Dependency Engine
- Knowledge Runtime
- Obligation Runtime

The EBM itself performs no execution.

---

# 13. Runtime Interaction

During execution:

- Participants consult the EBM.
- Runtime services enforce the EBM.
- Deliverables are validated against the EBM.
- Decisions are evaluated against the EBM.
- Obligations are assessed against the EBM.

The EBM remains read-only.

---

# 14. Versioning

Every Engineering Behavior Model shall maintain:

- Version identifier
- Parent version
- Composition history
- Source Pack versions
- Change history
- Approval history

Historical versions shall remain reproducible.

---

# 15. Events

The platform shall publish at least the following domain events:

- EBMCreated
- EBMValidated
- EBMVersioned
- EBMActivated
- EBMRetired
- BehaviourConflictDetected
- BehaviourConflictResolved

---

# 16. Non-Functional Requirements

The Engineering Behavior Model shall:

- be deterministic;
- be reproducible;
- be immutable during execution;
- be fully traceable;
- support incremental evolution;
- support concurrent versions;
- remain independent of implementation technologies.

---

# 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Behaviour from multiple Packs is successfully composed.

✓ Behavioural conflicts are detected.

✓ Behavioural conflicts are resolved before commissioning.

✓ The resulting Engineering Behavior Model is versioned.

✓ Runtime services correctly consume the Engineering Behavior Model.

✓ The Engineering Behavior Model remains immutable during execution.

---

# 18. Deliverables

Implementation of this chapter shall produce:

- Engineering Behavior Model domain object.
- Behaviour catalogue.
- Behavioural rule model.
- Versioning model.
- Behaviour validation services.
- Behaviour query services.
- Behaviour composition interfaces.
- Initial Engineering Behavior Model API.