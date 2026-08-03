# Chapter 6 – Template Model


[Sudha: 

I also think we've now finished the **architectural backbone**.

From this point onwards, we're specifying the objects that an SEU is composed of.

The next chapter should **not** be Templates.

I changed my mind after thinking about the last four chapters.

The sequence should be:

```
Architecture Catalogue

↓

SEU

↓

Engineering Behavior Model

↓

Composition Engine

↓

Pack Model

↓

Template Model

↓

Commissioning
```

Why?

Because **Templates** are the missing abstraction between Packs and a commissioned SEU.

A Pack contributes behaviour.

A Template defines **what kind of SEU you want to create**.

For example,

```
Enterprise Web Application

↓

Template

↓

Composition Engine

↓

EBM

↓

SEU
```

Without Templates, the Composition Engine doesn't know **what** it is composing for.

--------------------


While writing this chapter, I realised we need to be careful not to overload the Template concept.

At the moment, the Template is carrying three responsibilities:

1. **Structural blueprint** (SEU shape).
2. **Initial engineering artefacts** (deliverables, capabilities, lifecycle).
3. **Commissioning defaults** (mandatory/recommended packs, parameters).

I think (1) and (2) unquestionably belong in a Template. I'm less certain about (3).

There is another concept we discussed earlier but haven't formally introduced: the **Profile**.

I now think we should redefine Profiles.

Instead of using Profiles for engineering behaviour (which the EBM now covers), Profiles should become **commissioning configurations**.

For example:

```
Template
    +
Profile
    ↓
Composition Engine
    ↓
Engineering Behavior Model
    ↓
Commission SEU
```

A Template would answer:

> **"What kind of SEU is this?"**

A Profile would answer:

> **"How do you want to commission it today?"**

Examples:

- Startup Profile
- Enterprise Profile
- Healthcare Profile
- Production Profile
- Prototype Profile

The Profile would provide the variable inputs—organisation packs, technology choices, compliance selections, deployment targets—while the Template remains a stable structural blueprint.

I think this separation would keep Templates clean and make commissioning far more flexible. It also aligns with one of our recurring architectural principles: **separate stable structure from variable configuration**. Before we write the Commissioning chapter, I'd like us to decide whether we adopt this refined interpretation of Profiles, because it will influence the commissioning workflow substantially.

]
---

# 1. Purpose

A **Template** defines the blueprint for commissioning a Software Engineering Unit (SEU).

Templates describe **what an SEU is intended to achieve**, the engineering structure required to achieve those objectives, and the default engineering assets that should be available when the SEU is commissioned.

A Template does not prescribe engineering behaviour. Behaviour is supplied through the Engineering Behavior Model (EBM).

A Template defines **structure**.

The EBM defines **behaviour**.

---

# 2. Scope

This chapter defines:

- the Template abstraction;
- Template responsibilities;
- Template composition;
- Template inheritance;
- Template lifecycle;
- Template versioning.

This chapter does not define:

- Pack internals;
- Engineering behaviour;
- participant implementations;
- runtime execution.

---

# 3. Architectural Position

```
Template

        │

        ▼

Composition Engine

        │

        ▼

Engineering Behavior Model

        │

        ▼

Software Engineering Unit
```

Templates provide the structural definition used during commissioning.

---

# 4. Definition

A Template is a reusable specification describing the structural characteristics of an SEU.

Templates shall contain no runtime state.

Templates are reusable across multiple SEUs.

---

# 5. Responsibilities

A Template defines:

- SEU purpose;
- engineering objectives;
- default capabilities;
- default roles;
- default deliverable catalogue;
- default lifecycle;
- default workflows;
- recommended Packs;
- mandatory Packs;
- commissioning parameters.

Templates shall not define engineering behaviour.

---

# 6. Functional Requirements

### FR-6.1

Every commissioned SEU shall originate from exactly one Template.

---

### FR-6.2

Templates shall be independently versioned.

---

### FR-6.3

Templates shall be reusable across multiple SEUs.

---

### FR-6.4

Templates shall support inheritance.

---

### FR-6.5

Templates shall declare mandatory and recommended Packs.

---

### FR-6.6

Templates shall define default deliverables.

---

### FR-6.7

Templates shall define the initial capability catalogue.

---

### FR-6.8

Templates shall remain immutable after publication.

---

# 7. Template Structure

Every Template shall define:

- Identifier
- Name
- Description
- Version
- Purpose
- Objectives
- Lifecycle
- Default Roles
- Default Capabilities
- Deliverable Catalogue
- Recommended Packs
- Mandatory Packs
- Default Workflows
- Commissioning Parameters

---

# 8. Template Categories

Examples include:

### Enterprise Web Application

---

### Mobile Application

---

### API Platform

---

### Legacy Modernisation

---

### Data Platform

---

### AI Platform

---

### Embedded Software

---

### SaaS Product

---

### Package Implementation

Additional categories may be introduced through Packs.

---

# 9. Template Inheritance

Templates may inherit from other Templates.

Example:

```
Enterprise Web Application

↓

Healthcare Web Application

↓

Healthcare Claims Platform
```

Derived Templates may:

- add capabilities;
- add deliverables;
- modify structure;
- declare additional mandatory Packs.

Derived Templates shall not modify parent Templates.

---

# 10. Deliverable Catalogue

Every Template defines a default catalogue of engineering deliverables.

Typical deliverables include:

- Requirements Specification
- Solution Architecture
- API Specification
- Source Code
- Test Suite
- Deployment Package
- Operational Documentation

The catalogue may be extended during commissioning.

---

# 11. Capability Catalogue

Templates define the capabilities expected within an SEU.

Examples:

- Requirements Analysis
- Architecture
- Development
- Testing
- Security
- Documentation
- Deployment
- Knowledge Management

Capabilities are placeholders.

Participants providing those capabilities are assigned during commissioning.

---

# 12. Workflow Definitions

Templates may define reference workflows.

Examples:

- Requirements Flow
- Development Flow
- Testing Flow
- Release Flow

These are structural workflow definitions.

Their behaviour is governed by the Engineering Behavior Model.

---

# 13. Commissioning Parameters

Templates may expose configurable parameters.

Examples:

- Development methodology
- Technology stack
- Target environment
- Domain selection
- Compliance requirements
- Organisation Packs

These parameters are supplied during commissioning.

---

# 14. Versioning

Templates shall be independently versioned.

Historical Templates shall remain available.

SEUs shall permanently reference the Template version from which they were commissioned.

---

# 15. Lifecycle

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

# 16. Events

The Template subsystem shall publish:

- TemplateCreated
- TemplateValidated
- TemplatePublished
- TemplateActivated
- TemplateDeprecated
- TemplateRetired

---

# 17. Non-Functional Requirements

Templates shall:

- be reusable;
- remain immutable after publication;
- support inheritance;
- support independent versioning;
- remain independent of runtime execution.

---

# 18. Acceptance Criteria

✓ Templates can be created.

✓ Templates can inherit from other Templates.

✓ Templates define structural characteristics.

✓ Templates declare mandatory Packs.

✓ Templates define deliverable catalogues.

✓ Templates support independent versioning.

---

# 19. Deliverables

Implementation of this chapter shall produce:

- Template domain model.
- Template registry.
- Template versioning service.
- Template inheritance model.
- Deliverable catalogue model.
- Capability catalogue model.
- Template APIs.
- Template lifecycle services.

