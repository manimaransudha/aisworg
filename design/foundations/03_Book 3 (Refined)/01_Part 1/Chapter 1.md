# Chapter 1 – Objective

## 1. Purpose

An **Objective** is a persistent, versioned statement of engineering intent that justifies the commissioning of a Software Engineering Unit (SEU) and declares or allows derivation of the Capabilities required to achieve it.

Objective is the root of the engineering layer. Every Capability requirement, Template selection and Pack composition decision shall be traceable to at least one Objective.

An Objective does not specify how it will be achieved. It specifies why the SEU exists and what ability its achievement requires.

## 2. Scope

This chapter defines:

- Objective abstraction
- Objective tiers
- Objective structure
- Objective decomposition
- Objective-to-Capability derivation
- Objective lifecycle
- Objective traceability

This chapter does not define:

- Template selection or validation logic  
- Capability definitions  
- Pack composition mechanics  
- Commissioning workflow  
 

## 3. Architectural Position

```
Objective

↓

Required Capabilities

↓

Template Model

↓

Composition Engine

↓

Engineering Behavior Model

↓

Software Engineering Unit
```

Objective determines what capability an SEU requires. It does not determine how that capability is composed or fulfilled.
 

## 4. Definition

An Objective is a persistent engineering-intent object that:

- justifies the existence of an SEU
- declares, or allows derivation of, the Capabilities required to achieve it
- exists independently of any Template, Pack or Participant

An Objective is not a Goal. A Goal is the measurable target that makes an Objective concrete at a point in time.

An Objective is not a Requirement. A Requirement is a system property the Objective motivates.

An Objective is not a Strategy. A Strategy is the approach chosen to pursue the Objective.

An Objective does not specify implementation. Implementation is determined by Template selection, Pack composition and Participant fulfilment, all downstream of it.
 
## 5. Architectural Principles

### OBJ-001

Every SEU shall be commissioned in service of at least one Objective.


### OBJ-002

Objectives are persistent and independently traceable.


### OBJ-003

Every Objective shall declare, or allow derivation of, the Capabilities required to achieve it.


### OBJ-004

Objectives are hierarchical: Strategic Objectives decompose into Operational Objectives, which decompose into Engineering Objectives.

### OBJ-005

Objectives remain independent of Template, Pack and Participant selection.

### OBJ-006

Objectives may be reviewed, reaffirmed or superseded without invalidating the historical Deliverables, Decisions or Capabilities that trace back to them.

## 6. Functional Requirements

### FR-1.1

Every Objective shall possess a globally unique identifier.

### FR-1.2

Every Objective shall declare its tier: Strategic, Operational or Engineering.

### FR-1.3

Every Objective shall declare, or support automated derivation of, one or more required Capabilities.

### FR-1.4

Objectives shall support hierarchical decomposition from Strategic through Operational to Engineering tiers.

### FR-1.5

Every SEU commissioning request shall reference at least one Objective. 

### FR-1.6

Objective state changes shall be governed and fully traceable.


### FR-1.7

An Objective referenced by an active Deliverable shall remain immutable except through governed supersession.


## 7. Objective Tiers

Every Objective shall belong to one of the following tiers.

### Strategic Objective

Organisational-level intent, typically spanning multiple SEUs or an extended time horizon.

Example: "Establish a claims-processing capability compliant with regional insurance regulation."
 
### Operational Objective

Intent scoped to a specific programme or initiative, typically realised by one SEU.

Example: "Deliver an automated claims-adjudication service for the retail claims line of business."
 
### Engineering Objective

Intent scoped to a specific, boundable engineering outcome within an SEU.

Example: "Provide a fraud-detection capability integrated into the claims-adjudication workflow."

A Strategic Objective may decompose into several Operational Objectives; an Operational Objective may decompose into several Engineering Objectives. An SEU is typically commissioned against one Operational Objective and executes against its decomposed Engineering Objectives.
*[Remarks: We have refined this to commission SEU against any leaf]*
 
## 8. Objective Structure

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

## 9. Objective Decomposition

A Strategic Objective may decompose into one or more Operational Objectives.

An Operational Objective may decompose into one or more Engineering Objectives.

Decomposition shall preserve traceability to the parent Objective.

Decomposition does not create new intent. It refines existing intent into a more specific, boundable form.

*[Broader scope: Decomposition permits tier-skipping. Strategic objectives can have Engineering objectives skipping the Operational tier]*

## 10. Deriving Required Capabilities

Before an SEU may be commissioned against it, every Objective shall carry a set of required Capabilities.

Required Capabilities may be:

- declared explicitly, as part of the Objective's own authored content; or
- derived by Capability Packs (Chapter 5), contributed by the platform, an Organisation, a Domain or a Customer, acting on the Objective's content.

This determination acts on the Objective's content. It is not something the Objective itself performs. The Objective holds the resulting list. It does not derive, select or compose anything.

The Composition Engine (Chapter 4) shall not compose Packs until required Capabilities have been determined.

Required Capabilities are the sole input Objective contributes to commissioning.


## 11. Objective and Template Selection

Template Model (Chapter 6) shall validate or select a Template against an Objective's required Capabilities.

A Template is suitable for an Objective only if it supports every Capability the Objective requires.

Where no existing Template supports an Objective's required Capabilities, commissioning shall not proceed until a suitable Template is defined or composed.

Objective does not evaluate Template suitability itself. It supplies the required-Capability list that Template Model evaluates against.

## 12. Objective Lifecycle

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

An Objective can be returned to the Proposed state before entering the Active state for rework. 

## 13. Objective Traceability

Every Objective shall preserve:

- originating sponsor or Authority
- decomposition history (parent and child Objectives)
- derived or declared required Capabilities
- referencing SEUs
- referencing Deliverables and Decisions
- supersession history

Every Deliverable, Decision and Capability requirement shall be traceable to at least one Objective. This is the root of the Engineering Knowledge Graph (Architecture Catalogue ADR – Engineering Knowledge Graph): every other persistent object's traceability chain terminates at an Objective.

## 14. Events

The Objective subsystem shall publish:

- ObjectiveProposed
- ObjectiveActivated
- ObjectiveRejected
~~- ObjectiveDecomposed~~
~~- ObjectiveCapabilitiesResolved~~
- ObjectiveAchieved
- ObjectiveSuperseded
- ObjectiveRetired
- ObjectiveArchived

*[Remarks: An event should align with the life cycle. The ones removed are all part of Proposed stage in the life cycle]*

## 15. Non-Functional Requirements

The Objective Model shall:

- preserve complete historical traceability
- support hierarchical decomposition without depth limits
- remain independent of Template, Pack and Participant implementations
- support composition of required Capabilities from multiple Packs
- remain reproducible: given the same Objective and Pack set, the same required Capabilities shall always be derived
 

## 16. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Every SEU is commissioned against at least one Objective.

✓ Objectives declare or derive their required Capabilities before commissioning proceeds.

✓ Objective decomposition preserves traceability to its parent.

✓ Objectives remain independent of Template and Pack selection.

✓ Every Deliverable and Decision traces back to an Objective.

✓ Objective supersession preserves historical traceability without invalidating past Deliverables.
 

## 17. Deliverables

Implementation of this chapter shall produce:

- Objective domain model
- Objective registry
- Objective decomposition service
- Objective-to-Capability derivation service
- Objective traceability service
- Objective APIs
- Objective events

---
