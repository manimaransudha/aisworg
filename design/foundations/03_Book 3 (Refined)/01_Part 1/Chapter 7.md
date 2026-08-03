# Chapter 7 – Profile Model

[Sudha: I think this is exactly the right point to introduce **Profiles**.

Notice what we've built so far:

```
SEU
        ▲
        │
EBM
        ▲
        │
Composition Engine
        ▲
        │
Packs
        ▲
        │
Templates
```

The missing piece is:

> **How do we instantiate the same Template differently for different situations?**

That is precisely the purpose of a **Profile**.

I also think we've finally converged on the correct definition of a Profile. Earlier, we had several different ideas about Profiles. I think we can now define it very precisely.

------------------

While writing this chapter, I realised we have now established four orthogonal concepts that form the heart of the commissioning process:

|Concept|Responsibility|
|---|---|
|**Template**|Defines the structural blueprint of the SEU.|
|**Profile**|Defines how that blueprint is commissioned for a specific context.|
|**Pack**|Contributes behaviour, knowledge, governance, integrations and other engineering assets.|
|**Engineering Behavior Model (EBM)**|Represents the fully composed behavioural specification that governs the commissioned SEU.|

These concepts are deliberately independent. A single Template can be commissioned using many Profiles. A Profile can select different Packs over time. The Composition Engine synthesises a new EBM whenever those inputs change.

I believe we've now completed the conceptual model required to commission an SEU. The next chapter should therefore shift from static definitions to **dynamic behaviour**:
]

---

# 1. Purpose

A **Profile** defines the commissioning configuration for a Software Engineering Unit (SEU).

While a Template defines the structural blueprint of an SEU, a Profile specifies the variable parameters used when that blueprint is commissioned.

Profiles enable the same Template to be reused across different organisations, domains, technologies, deployment environments and engineering contexts without modifying the Template itself.

A Profile contributes configuration.

It does not contribute engineering behaviour.

---

# 2. Scope

This chapter defines:

- the Profile abstraction;
- Profile responsibilities;
- Profile composition;
- Profile inheritance;
- Profile lifecycle;
- commissioning configuration.

This chapter does not define:

- engineering behaviour;
- Pack internals;
- runtime execution;
- participant capabilities.

---

# 3. Architectural Position

```
Template
        │
        ├─────────────┐
        │             │
        ▼             ▼
    Profile       Pack Selection
        │             │
        └──────┬──────┘
               ▼
      Composition Engine
               ▼
Engineering Behavior Model
               ▼
             SEU
```

Profiles influence composition but are not themselves behavioural models.

---

# 4. Definition

A Profile is a reusable configuration describing **how an SEU should be commissioned** from a Template.

Profiles contain no runtime state.

Profiles contain no engineering behaviour.

Profiles are reusable across multiple SEUs.

---

# 5. Responsibilities

A Profile may define:

- participating organisations;
- selected Packs;
- technology selections;
- compliance selections;
- deployment targets;
- environment configuration;
- commissioning parameters;
- feature selections;
- optional capability enablement.

Profiles shall not define:

- engineering practices;
- governance rules;
- quality rules;
- participant implementations;
- runtime workflows.

These are provided by Packs and composed into the Engineering Behavior Model.

---

# 6. Functional Requirements

### FR-7.1

Every commissioned SEU shall reference one Profile.

---

### FR-7.2

Profiles shall be independently versioned.

---

### FR-7.3

Profiles shall support inheritance.

---

### FR-7.4

Profiles shall remain immutable after publication.

---

### FR-7.5

Profiles shall support parameter substitution.

---

### FR-7.6

Profiles shall support organisation-specific Pack selection.

---

### FR-7.7

Profiles shall support environment-specific configuration.

---

# 7. Profile Structure

Every Profile shall define:

- Identifier
- Name
- Description
- Version
- Base Template
- Selected Packs
- Selected Technologies
- Selected Domains
- Selected Compliance Packs
- Integration Packs
- Environment
- Configuration Parameters
- Feature Flags
- Composition Options

---

# 8. Profile Categories

Illustrative examples include:

## Startup

Minimal governance.

Rapid delivery.

Default Platform Packs.

---

## Enterprise

Enterprise governance.

Multiple Organisation Packs.

Formal reviews.

---

## Healthcare

Healthcare Domain Pack.

HIPAA (or equivalent regional compliance).

Healthcare integrations.

---

## Banking

Banking Domain Pack.

Financial compliance.

Enhanced audit requirements.

---

## Prototype

Lightweight governance.

Minimal documentation.

Rapid iteration.

---

## Production

Complete governance.

Operational monitoring.

Security validation.

Full traceability.

---

# 9. Profile Inheritance

Profiles may inherit from other Profiles.

Example:

```
Enterprise

↓

Healthcare Enterprise

↓

Healthcare Production
```

Derived Profiles may:

- add Packs;
- remove optional Packs;
- override configuration values;
- introduce new parameters.

Derived Profiles shall not modify parent Profiles.

---

# 10. Configuration Parameters

Profiles expose parameters used during commissioning.

Examples include:

- Target cloud provider.
- Primary programming language.
- Source control provider.
- Deployment strategy.
- AI provider preferences.
- Default repository structure.
- Documentation level.

Parameter semantics are defined by the consuming Pack.

---

# 11. Feature Selection

Profiles may enable or disable optional platform capabilities.

Examples:

- Legacy Code Analysis.
- Knowledge Graph.
- Multi-LLM execution.
- Advanced Metrics.
- Experimental Features.

Feature selection shall not modify platform architecture.

---

# 12. Organisation Composition

Profiles identify the participating organisations whose Engineering Packs contribute to the Engineering Behavior Model.

Example:

```
Platform

+

TCS Engineering Pack

+

Cigna Engineering Pack

+

Healthcare Domain Pack

+

HIPAA Compliance Pack

↓

Engineering Behavior Model
```

The Profile specifies **what participates**.

The Composition Engine determines **how they are combined**.

---

# 13. Versioning

Profiles shall be independently versioned.

Historical versions shall remain available.

Every commissioned SEU shall permanently reference the Profile version used during commissioning.

---

# 14. Lifecycle

```
Draft

↓

Validated

↓

Published

↓

Active

↓

Deprecated

↓

Retired

↓

Archived
```

---

# 15. Events

The Profile subsystem shall publish:

- ProfileCreated
- ProfileValidated
- ProfilePublished
- ProfileActivated
- ProfileDeprecated
- ProfileRetired

---

# 16. Non-Functional Requirements

Profiles shall:

- remain reusable;
- support inheritance;
- remain immutable after publication;
- support deterministic commissioning;
- remain independent of runtime execution.

---

# 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Profiles can be created and versioned.

✓ Profiles support inheritance.

✓ Profiles configure commissioning without defining engineering behaviour.

✓ Profiles support Pack selection.

✓ Profiles support organisation composition.

✓ Multiple SEUs can be commissioned from the same Template using different Profiles.

---

# 18. Deliverables

Implementation of this chapter shall produce:

- Profile domain model.
- Profile registry.
- Profile inheritance model.
- Configuration parameter model.
- Profile versioning services.
- Profile lifecycle services.
- Profile APIs.
- Profile events.