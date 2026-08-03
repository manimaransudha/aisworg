
# Chapter 11 – Service

[Sudha:
This chapter fills the largest actual gap the Book 1 comparison turned up. Book 1 gives Service full peer status alongside Objective and Capability — its own narrative chapter, its own formal chapter, and a central role in the Capability Reasoning Network as one of four things Capabilities exchange with one another (Service, Evidence, Knowledge, Decision). Book 3 had nothing. Not a chapter, not an entity, not a line in the Canonical Information Model.

The placement question resolved itself once I looked at where Capability (Chapter 10) and Capability Packs (Chapter 5) already sit. Book 1 says it precisely: "a capability is an enduring ability; a service is what that ability actually delivers." A Capability Pack that declares a Capability without also declaring what that Capability contracts to deliver is only telling half the story. So Service is declared alongside Capability, by the same Pack, as the natural second half of a Capability's declaration — not a separate concern bolted on afterward.

I want to be careful about scope here, because it would be easy to let Service become too much. Two guardrails:

First, Service is not the sole coordination mechanism between Capabilities. Book 1's own Capability Reasoning Network chapter is explicit that Evidence, Knowledge and Decision propagate independently of Service, and warns directly against "treating every interaction as a service call." Service gets exactly one job here: it's the concrete, contracted unit that sharpens what the Dependency Engine's existing "Capability Dependency" type (Chapter 9) actually means — not "Architecture Capability is available" in the abstract, but "the Approved Solution Architecture service has been delivered," specifically.

Second, Service is not a metrics database. It declares a Service Level — a target, part of its own versioned definition — but the *observed* performance against that target is Engineering Telemetry's job (Chapter 35), derived from Service's own events, never written back onto the Service object itself. That keeps faith with Telemetry's own stated principles: passive, derived, no duplicate data entry. Service defines what's measurable about it; it doesn't measure itself.
]

---

# 1. Purpose

A **Service** is the declared, contracted output through which a Capability exposes what it delivers to other Capabilities, Participants or external consumers, without exposing how that delivery is performed.

Where a Capability is an enduring ability, a Service is what that ability actually produces on terms other Capabilities can depend upon.

Services are declared by Capability Packs. They are not declared by Participants, and they do not themselves select who fulfils them.

---

# 2. Scope

This chapter defines:

- Service abstraction;
- Service contract structure;
- Service Level declaration;
- Service lifecycle;
- Service composition;
- Service traceability.

This chapter does not define:

- Capability definitions (Chapter 10);
- Participant selection or dispatch (Chapter 12, Chapter 33);
- Engineering Telemetry computation (Chapter 35);
- Evidence, Knowledge or Decision exchange, which remain separate, independent coordination channels (Chapters 17, 16, 19).

---

# 3. Architectural Position

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

# 4. Definition

A Service is a declared, versioned contract specifying what a Capability delivers, consumable by other Capabilities, Participants or external interactions, without exposing internal implementation.

A Service declares a Service Level: the target turnaround, quality bar or other measurable expectation against which its delivery is assessed.

A Service does not select, assign or evaluate Participants. That remains the responsibility of Capability Fulfilment (Chapter 12) and the Dispatch Engine (Chapter 33).

A Service does not compute or store its own observed performance. That remains the responsibility of Engineering Telemetry (Chapter 35).

---

# 5. Architectural Principles

## SVC-001

Services are declared by Capability Packs, not by Participants.

---

## SVC-002

A Service exposes what a Capability delivers. It never exposes how.

---

## SVC-003

Service is one of four coequal coordination channels between Capabilities — Service, Evidence, Knowledge and Decision. Service shall not subsume the other three.

---

## SVC-004

Every Service shall declare a Service Level.

---

## SVC-005

Service definitions are versioned and immutable once published.

---

## SVC-006

Observed Service performance is derived by Engineering Telemetry. It shall never be written back onto the Service definition itself.

---

# 6. Functional Requirements

### FR-11.1

Every Service shall possess a globally unique identifier and version.

---

### FR-11.2

Every Service shall be declared by exactly one Capability, through a Capability Pack.

---

### FR-11.3

Every Service shall declare a Service Level.

---

### FR-11.4

The Dependency Engine shall reference specific Services, not Capabilities in the abstract, when evaluating a Capability Dependency.

---

### FR-11.5

Every Service shall publish lifecycle and delivery events consumable by Engineering Telemetry.

---

### FR-11.6

A Service shall support consumption by multiple Capabilities or external interactions concurrently.

---

### FR-11.7

Service contracts shall remain independent of Participant implementation.

---

# 7. Service Structure

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

# 8. Service Level

A Service Level is the measurable expectation a Service declares for its own delivery.

A Service Level may specify:

- target turnaround time;
- quality bar or acceptance criteria;
- availability expectation;
- applicable exceptions or waivers.

A Service Level is part of the Service's own versioned definition, contributed by the same Capability Pack that declares the Service.

A Service Level declares what "meeting expectations" means for this Service. It does not itself measure whether that expectation was met — see Engineering Telemetry, §11 below.

---

# 9. Service and the Dependency Engine

The Dependency Engine's Capability Dependency type (Chapter 9 §8) evaluates whether a required Capability is available.

Where a Deliverable depends on a Capability for a specific contracted output, the dependency shall reference the specific Service that Capability exposes, not the Capability in the abstract.

For example, a Deliverable does not depend on "the Architecture Capability." It depends on the **Approved Solution Architecture** Service that the Architecture Capability exposes.

This sharpens dependency evaluation from "is this Capability generally available" to "has this specific contracted output been delivered" — a precise, evaluable condition.

---

# 10. Service and Fulfilment

A Service does not determine who fulfils it.

Capability Fulfilment (Chapter 12) determines which Participants are eligible to provide the Capability that exposes a given Service.

The Dispatch Engine (Chapter 33) selects, from that eligible pool, which Participant delivers the Service for a specific Work Item.

Service remains the stable contract throughout; the Participant delivering it may change without altering the Service definition.

---

# 11. Service and Engineering Telemetry

Every Service publishes delivery events (§14) that Engineering Telemetry (Chapter 35) derives metrics from, alongside its other existing sources.

Engineering Telemetry compares observed delivery against a Service's declared Service Level to determine whether it was met or breached.

Service itself performs no measurement. It only declares the target and emits the events; Telemetry does the deriving, consistent with Telemetry's own passive, derived-only principles.

This applies most directly to Flow, Governance, Collaboration and Quality telemetry, since each of these is fundamentally a measurement of Service delivery. Knowledge Telemetry remains independent, consistent with Book 1's own treatment of Knowledge as a separate coordination channel from Service.

---

# 12. Service Composition

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

Composition shall be deterministic. Conflicting Service declarations for the same contracted output shall be resolved through the same composition rules the Composition Engine (Chapter 4) applies elsewhere.

---

# 13. Service Lifecycle

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

# 14. Events

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

# 15. Non-Functional Requirements

The Service Model shall:

- support composition from multiple Packs;
- preserve complete traceability from Service to providing Capability and originating Pack;
- support deterministic resolution of conflicting declarations;
- remain independent of Participant implementations;
- publish events sufficient for Engineering Telemetry without requiring duplicate instrumentation.

---

# 16. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Every Service is declared by exactly one Capability, through a Capability Pack.

✓ Every Service declares a Service Level.

✓ Capability Dependency evaluation references specific Services, not Capabilities in the abstract.

✓ Service definitions remain independent of Participant implementation.

✓ Observed Service performance is derived by Engineering Telemetry, never stored on the Service definition.

✓ Multiple Packs can contribute Services for the same Capability deterministically.

---

# 17. Deliverables

Implementation of this chapter shall produce:

- Service domain model.
- Service registry.
- Service contract validation service.
- Service Level declaration framework.
- Service composition service.
- Service APIs.
- Service events.
