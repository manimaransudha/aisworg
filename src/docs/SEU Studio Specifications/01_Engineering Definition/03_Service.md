# Chapter 3 – Service

## 1. Purpose

A **Service** is the declared, contracted output through which a Capability exposes what it delivers to other Capabilities, Participants or external consumers, without exposing how that delivery is performed.

Where a Capability is an enduring ability, a Service is what that ability actually produces on terms other Capabilities can depend upon.

Services are declared by Capability Packs. They are not declared by Participants, and they do not themselves select who fulfils them.

---

## 2. Scope

This chapter defines:

- Service abstraction
- Service contract structure
- Service Level declaration
- Service lifecycle
- Service composition
- Service traceability

This chapter does not define:

- Capability definitions  
- Participant selection or dispatch  
- Engineering Telemetry computation  
- Evidence, Knowledge or Decision exchange, which remain separate, independent coordination channels  

---

## 3. Architectural Position

```
Capability Pack

↓

Capability  +  Service (declared together)

↓

Dependency Engine (Capability Dependency references a specific Service)

↓

Capability Fulfilment / Dispatch Engine (fulfil the Service)

↓

Engineering Telemetry (derives from Service events and declared Service Level)
```

A Service is what is contracted. Capability Fulfilment and the Dispatch Engine determine who delivers it. Engineering Telemetry determines how well it was delivered. Service performs none of these roles itself.

---

## 4. Definition

A Service is a declared, versioned contract specifying what a Capability delivers, consumable by other Capabilities, Participants or external interactions, without exposing internal implementation.

A Service declares a Service Level: the target turnaround, quality bar or other measurable expectation against which its delivery is assessed.

A Service does not select, assign or evaluate Participants. That remains the responsibility of Capability Fulfilment and the Dispatch Engine.

A Service does not compute or store its own observed performance. That remains the responsibility of Engineering Telemetry .

---

## 5. Architectural Principles

##### SVC-001

Services are declared by Capability Packs, not by Participants.
 
##### SVC-002

A Service exposes what a Capability delivers. It never exposes how.
 
##### SVC-003

Service is one of four coequal coordination channels between Capabilities — Service, Evidence, Knowledge and Decision. Service shall not subsume the other three.
 
##### SVC-004

Every Service shall declare a Service Level.
 
##### SVC-005

Service definitions are versioned and immutable once published.
 
##### SVC-006

Observed Service performance is derived by Engineering Telemetry. It shall never be written back onto the Service definition itself.

---

## 6. Functional Requirements

##### FR-3.1

Every Service shall possess a globally unique identifier and version.
 
##### FR-3.2

Every Service shall be declared by exactly one Capability, through a Capability Pack.
 
##### FR-3.3

Every Service shall declare a Service Level.
 
##### FR-3.4

The Dependency Engine shall reference specific Services, not Capabilities in the abstract, when evaluating a Capability Dependency.
 
##### FR-3.5

Every Service shall publish lifecycle and delivery events consumable by Engineering Telemetry.
 
##### FR-3.6

A Service shall support consumption by multiple Capabilities or external interactions concurrently.
 
##### FR-3.7

Service contracts shall remain independent of Participant implementation.

---

## 7. Service Structure

Every Service shall define:

- Identifier
- Name
- Providing Capability
- Contract Description (what is delivered)
- Declared Service Level
- Consuming Capabilities (where known)
- Version
- Originating Pack

The internal contract/interface representation is implementation-defined.

---

## 8. Service Level

A Service Level is the measurable expectation a Service declares for its own delivery.

A Service Level may specify:

- target turnaround time
- quality bar or acceptance criteria
- availability expectation
- applicable exceptions or waivers

A Service Level is part of the Service's own versioned definition, contributed by the same Capability Pack that declares the Service.

A Service Level declares what "meeting expectations" means for this Service. It does not itself measure whether that expectation was met — see Engineering Telemetry, §11 below.

---

## 9. Service and the Dependency Engine

The Dependency Engine's Capability Dependency type evaluates whether a required Capability is available.

Where a Deliverable depends on a Capability for a specific contracted output, the dependency shall reference the specific Service that Capability exposes, not the Capability in the abstract.

For example, a Deliverable does not depend on "the Architecture Capability." It depends on the **Approved Solution Architecture** Service that the Architecture Capability exposes.

This sharpens dependency evaluation from "is this Capability generally available" to "has this specific contracted output been delivered" — a precise, evaluable condition.

---

## 10. Service and Fulfilment

A Service does not determine who fulfils it.

Capability Fulfilment determines which Participants are eligible to provide the Capability that exposes a given Service.

The Dispatch Engine selects, from that eligible pool, which Participant delivers the Service for a specific Work Item.

Service remains the stable contract throughout; the Participant delivering it may change without altering the Service definition.

---

## 11. Service and Engineering Telemetry

Every Service publishes delivery events (§14) that Engineering Telemetry derives metrics from, alongside its other existing sources.

Engineering Telemetry compares observed delivery against a Service's declared Service Level to determine whether it was met or breached.

Service itself performs no measurement. It only declares the target and emits the events; Telemetry does the deriving, consistent with Telemetry's own passive, derived-only principles.

This applies most directly to Flow, Governance, Collaboration and Quality telemetry, since each of these is fundamentally a measurement of Service delivery. Knowledge Telemetry remains independent, consistent with Book 1's own treatment of Knowledge as a separate coordination channel from Service.

---

## 12. Service Composition

Multiple Organisation, Domain or Customer Packs may each contribute Services for the same Capability.

Example:

```
Platform Capability Pack (Architecture)

+

Organisation Capability Pack (Architecture)

+

Customer Capability Pack (Architecture)

↓

Effective set of Services exposed by the Architecture Capability
```

Composition shall be deterministic. Conflicting Service declarations for the same contracted output shall be resolved through the same composition rules the Composition Engine applies elsewhere.

---

## 13. Service Lifecycle

Every Service shall progress through the following lifecycle.

```
Defined

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

Deprecation shall identify a replacement Service where one exists. Historical Service versions remain available for reconstructing past dependency evaluations.

---

## 14. Events

The Service subsystem shall publish:

- ServiceDefined
- ServicePublished
- ServiceActivated
- ServiceRequested
- ServiceDelivered
- ServiceLevelMet
- ServiceLevelBreached
- ServiceDeprecated
- ServiceRetired

---

## 15. Non-Functional Requirements

The Service Model shall:

- support composition from multiple Packs
- preserve complete traceability from Service to providing Capability and originating Pack
- support deterministic resolution of conflicting declarations
- remain independent of Participant implementations
- publish events sufficient for Engineering Telemetry without requiring duplicate instrumentation

---

## 16. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Every Service is declared by exactly one Capability, through a Capability Pack.

✓ Every Service declares a Service Level.

✓ Capability Dependency evaluation references specific Services, not Capabilities in the abstract.

✓ Service definitions remain independent of Participant implementation.

✓ Observed Service performance is derived by Engineering Telemetry, never stored on the Service definition.

✓ Multiple Packs can contribute Services for the same Capability deterministically.

---

## 17. Deliverables

Implementation of this chapter shall produce:

- Service domain model
- Service registry
- Service contract validation service
- Service Level declaration framework
- Service composition service
- Service APIs
- Service events

---