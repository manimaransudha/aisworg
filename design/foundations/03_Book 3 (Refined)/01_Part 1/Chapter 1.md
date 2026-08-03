
# Chapter 1 – Objective

[Sudha:
Going back through Book 1 alongside what we'd already built here, one gap stood out immediately: Objective is the root of everything in Book 1 — every other entity "must ultimately trace back to one or more" Objectives — but Book 3 never actually defined it. We *used* the word constantly. The SEU chapter says an SEU is "commissioned to achieve one or more software engineering objectives." Templates imply a set of required Capabilities. Profiles configure a commissioning. But nothing says where that initial list of required Capabilities actually comes from. It was just assumed to already exist by the time Template Model picks up the story.

That's not just a completeness gap against Book 1. It's a functional one. Somewhere, something has to decide *why* this SEU is being commissioned and *what it must be able to do* before Template Model can validate anything or the Composition Engine can compose anything. Objective is that something.

So I don't think Objective belongs later in the book, folded into SEU or Template Model as a section. I think it belongs first — Chapter 1, ahead of SEU itself — because everything downstream of it (which Template fits, which Capabilities get composed, which Packs get pulled in) is answerable *from* an Objective. Template Model shouldn't be the starting point of commissioning. Objective should be.

One thing I want to be careful about: Book 1 draws a precise distinction between an Objective, a Goal, a Requirement and a Strategy — an Objective is *why*, not *how much by when* (that's a Goal), not *what property the system must have* (a Requirement), and not *the approach chosen to pursue it* (a Strategy). That distinction is worth preserving exactly, because it's what stops Objective from becoming a dumping ground for everything upstream of engineering work. An Objective says why an SEU exists. It does not say how the SEU will get there — that's Template, Profile and Pack composition's job, downstream.

I'd also flag one thing not to over-build here: Objective should declare or allow derivation of required Capabilities, but it should not itself pick a Template or compose Packs. That stays a separate, later step (Chapter 6, Chapter 4). Objective's job ends at "here is what must be achieved, and here is what ability that requires" — it hands off from there.
]

---

# 1. Purpose

An **Objective** is a persistent, versioned statement of engineering intent that justifies the commissioning of a Software Engineering Unit (SEU), or a specific stream of Deliverables within one, and declares or allows derivation of the Capabilities required to achieve it.

Objective is the root of the Engineering Layer. Every Capability requirement, Template selection and Pack composition decision shall be traceable to at least one Objective.

An Objective does not specify how it will be achieved. It specifies why the SEU exists and what ability its achievement requires.

---

# 2. Scope

This chapter defines:

- Objective abstraction;
- Objective tiers;
- Objective structure;
- Objective decomposition;
- Objective-to-Capability derivation;
- Objective lifecycle;
- Objective traceability.

This chapter does not define:

- Template selection or validation logic (Chapter 6);
- Capability definitions (Chapter 10);
- Pack composition mechanics (Chapter 4);
- commissioning workflow (Chapter 8).

---

# 3. Architectural Position

```
Objective

↓

Required Capabilities

↓

Template Model

↓

Composition Engine

↓

Effective Engineering Configuration

↓

Software Engineering Unit
```

Objective determines what capability an SEU requires. It does not determine how that capability is composed or fulfilled.

---

# 4. Definition

An Objective is a persistent engineering-intent object that:

- justifies the existence of an SEU, or a bounded stream of Deliverables within one;
- declares, or allows derivation of, the Capabilities required to achieve it;
- exists independently of any Template, Pack or Participant.

An Objective is not a Goal. A Goal is the measurable target that makes an Objective concrete at a point in time.

An Objective is not a Requirement. A Requirement is a system property the Objective motivates.

An Objective is not a Strategy. A Strategy is the approach chosen to pursue the Objective.

An Objective does not specify implementation. Implementation is determined by Template selection, Pack composition and Participant fulfilment, all downstream of it.

---

# 5. Architectural Principles

## OBJ-001

Every SEU shall be commissioned in service of at least one Objective.

---

## OBJ-002

Objectives are persistent and independently traceable.

---

## OBJ-003

Every Objective shall declare, or allow derivation of, the Capabilities required to achieve it.

---

## OBJ-004

Objectives are hierarchical: Strategic Objectives decompose into Operational Objectives, which decompose into Engineering Objectives.

---

## OBJ-005

Objectives remain independent of Template, Pack and Participant selection.

---

## OBJ-006

Objectives may be reviewed, reaffirmed or superseded without invalidating the historical Deliverables, Decisions or Capabilities that trace back to them.

---

# 6. Functional Requirements

### FR-1.1

Every Objective shall possess a globally unique identifier.

---

### FR-1.2

Every Objective shall declare its tier: Strategic, Operational or Engineering.

---

### FR-1.3

Every Objective shall declare, or support automated derivation of, one or more required Capabilities.

---

### FR-1.4

Objectives shall support hierarchical decomposition from Strategic through Operational to Engineering tiers.

---

### FR-1.5

Every SEU commissioning request shall reference at least one Objective.

---

### FR-1.6

Objective state changes shall be governed and fully traceable.

---

### FR-1.7

An Objective referenced by an active Deliverable shall remain immutable except through governed supersession.

---

# 7. Objective Tiers

Every Objective shall belong to one of the following tiers.

## Strategic Objective

Organisational-level intent, typically spanning multiple SEUs or an extended time horizon.

Example: "Establish a claims-processing capability compliant with regional insurance regulation."

---

## Operational Objective

Intent scoped to a specific programme or initiative, typically realised by one SEU.

Example: "Deliver an automated claims-adjudication service for the retail claims line of business."

---

## Engineering Objective

Intent scoped to a specific, boundable engineering outcome within an SEU.

Example: "Provide a fraud-detection capability integrated into the claims-adjudication workflow."

A Strategic Objective may decompose into several Operational Objectives; an Operational Objective may decompose into several Engineering Objectives. An SEU is typically commissioned against one Operational Objective and executes against its decomposed Engineering Objectives.

---

# 8. Objective Structure

Every Objective shall define:

- Identifier
- Statement
- Tier
- Parent Objective (if decomposed)
- Required Capabilities (declared or derived)
- Sponsoring Authority
- Status
- Version
- Traceability References

The internal representation of the Objective statement is implementation-defined.

---

# 9. Objective Decomposition

A Strategic Objective may decompose into one or more Operational Objectives.

An Operational Objective may decompose into one or more Engineering Objectives.

Decomposition shall preserve traceability to the parent Objective.

Decomposition does not create new intent. It refines existing intent into a more specific, boundable form.

---

# 10. Deriving Required Capabilities

Every Objective shall resolve to a set of required Capabilities before an SEU may be commissioned against it.

Required Capabilities may be:

- explicitly declared within the Objective; or
- derived automatically from Objective content, using Capability Packs (Chapter 5) contributed by the platform, an Organisation, a Domain or a Customer.

The Composition Engine (Chapter 4) shall not compose Packs until required Capabilities have been resolved.

Required Capabilities are the sole input Objective contributes to commissioning. Objective does not itself select a Template or compose a Pack.

---

# 11. Objective and Template Selection

Template Model (Chapter 6) shall validate or select a Template against an Objective's required Capabilities.

A Template is suitable for an Objective only if it supports every Capability the Objective requires.

Where no existing Template supports an Objective's required Capabilities, commissioning shall not proceed until a suitable Template is defined or composed.

Objective does not evaluate Template suitability itself. It supplies the required-Capability list that Template Model evaluates against.

---

# 12. Objective Lifecycle

Every Objective shall progress through the following lifecycle.

```
Proposed

↓

Active

↓

Achieved

↓

Archived
```

An Active Objective may instead transition to **Superseded** (replaced by a revised Objective) or **Retired** (abandoned without replacement), both of which preserve full historical traceability.

---

# 13. Objective Traceability

Every Objective shall preserve:

- originating sponsor or Authority;
- decomposition history (parent and child Objectives);
- derived or declared required Capabilities;
- referencing SEUs;
- referencing Deliverables and Decisions;
- supersession history.

Every Deliverable, Decision and Capability requirement shall be traceable to at least one Objective. This is the root of the Engineering Knowledge Graph (Architecture Catalogue ADR – Engineering Knowledge Graph): every other persistent object's traceability chain terminates at an Objective.

---

# 14. Events

The Objective subsystem shall publish:

- ObjectiveProposed
- ObjectiveActivated
- ObjectiveDecomposed
- ObjectiveCapabilitiesResolved
- ObjectiveAchieved
- ObjectiveSuperseded
- ObjectiveRetired
- ObjectiveArchived

---

# 15. Non-Functional Requirements

The Objective Model shall:

- preserve complete historical traceability;
- support hierarchical decomposition without depth limits;
- remain independent of Template, Pack and Participant implementations;
- support composition of required Capabilities from multiple Packs;
- remain reproducible: given the same Objective and Pack set, the same required Capabilities shall always be derived.

---

# 16. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Every SEU is commissioned against at least one Objective.

✓ Objectives declare or derive their required Capabilities before commissioning proceeds.

✓ Objective decomposition preserves traceability to its parent.

✓ Objectives remain independent of Template and Pack selection.

✓ Every Deliverable and Decision traces back to an Objective.

✓ Objective supersession preserves historical traceability without invalidating past Deliverables.

---

# 17. Deliverables

Implementation of this chapter shall produce:

- Objective domain model.
- Objective registry.
- Objective decomposition service.
- Objective-to-Capability derivation service.
- Objective traceability service.
- Objective APIs.
- Objective events.
