
# Chapter 12 – Capability Fulfilment

I think the next chapter should **not** be Participants.

There's an important concept between Capabilities and Participants that we've referred to several times but never formally defined.

That concept is **Capability Fulfilment**.

Remember the ADR we created:

> **The platform commissions capabilities, not participants.**

That ADR deserves its own chapter because it fundamentally changes how software teams are assembled.

In traditional software engineering:

> Recruit people → assign work.

In an SEU:

> Identify required capabilities → fulfil them → assign execution.

That's a major architectural shift.

-----------------

While writing this chapter, I realised we've established a layered execution chain that is quite different from traditional project management systems:

```
Objective

↓

Deliverables

↓

Dependencies

↓

Capabilities

↓

Capability Fulfilment

↓

Participants

↓

Work Items

↓

Execution
```

Notice what is **absent** from this chain:

- Tasks
- Resource allocation
- Project schedules
- Team staffing

Those concepts have been replaced by more fundamental abstractions.

One refinement I'd suggest before we move on is that we should reserve the term **Participant** for _runtime instances_ only.

For example:

- "AI Architect" is not a Participant.
- It is a **Participant Type**.

When an SEU commissions an actual AI Architect, it creates a **Participant Instance** with its own identity, lifecycle, memory bindings, capabilities and execution history.

The same applies to humans:

- "Senior Developer" is a Participant Type.
- "Priya assigned to SEU-042" is a Participant Instance.

Making that distinction will give us a much cleaner Participant Model in the next chapter, because we'll be modelling runtime entities rather than abstract roles or job titles. I think that's consistent with the rest of the architecture, where Templates define structure, the EBM defines behaviour, Capabilities define competencies, and runtime instances execute within the commissioned SEU.


---

# 1. Purpose

Capability Fulfilment is the process by which a Software Engineering Unit (SEU) satisfies the engineering capabilities required to achieve its Deliverables.

The purpose of Capability Fulfilment is not to recruit Participants, but to ensure that every required engineering capability is available when needed.

Participants are one mechanism for fulfilling capabilities.

Capability Fulfilment remains independent of the implementation of those Participants.

---

# 2. Scope

This chapter defines:

- capability fulfilment;
- fulfilment strategies;
- participant assignment;
- fulfilment lifecycle;
- reassignment;
- capability availability.

This chapter does not define:

- participant implementations;
- AI reasoning;
- engineering behaviour;
- work item execution;
- per-Work-Item participant selection (see Chapter 33, Dispatch Engine).

Capability Fulfilment determines **which Participants are eligible** to provide a Capability. It does not determine which eligible Participant executes a specific Work Item at a specific moment; that runtime decision belongs to the Dispatch Engine, which consumes the eligible-Participant pool this chapter produces.

---

# 3. Architectural Position

```
Deliverable

↓

Dependency Engine

↓

Required Capabilities

↓

Capability Fulfilment

↓

Participants

↓

Execution
```

Capability Fulfilment forms the bridge between engineering intent and engineering execution.

---

# 4. Definition

Capability Fulfilment is the runtime process that identifies suitable Participants capable of providing the competencies required by the SEU.

Capability Fulfilment is dynamic.

Participants may change throughout the lifetime of the SEU without affecting the Engineering Behavior Model or the Capability Model.

---

# 5. Architectural Principles

### CF-001

Capabilities are permanent.

Participants are replaceable.

---

### CF-002

Capability Fulfilment shall remain independent of Participant implementation.

---

### CF-003

Capability Fulfilment shall support AI, human and external Participants equally.

---

### CF-004

Capability Fulfilment shall preserve engineering continuity when Participants change.

---

### CF-005

Capability Fulfilment shall remain fully traceable.

---

# 6. Functional Requirements

### FR-12.1

The platform shall determine the capabilities required to progress a Deliverable.

---

### FR-12.2

Capability Fulfilment shall identify one or more suitable Participants.

---

### FR-12.3

Multiple Participants may jointly fulfil a Capability.

---

### FR-12.4

One Participant may fulfil multiple Capabilities.

---

### FR-12.5

Capability Fulfilment shall support dynamic reassignment.

---

### FR-12.6

Capability reassignment shall preserve engineering continuity.

---

### FR-12.7

Capability Fulfilment decisions shall remain traceable.

---

# 7. Fulfilment Strategies

Capability Fulfilment may be achieved through:

## AI Participant

Example:

Architecture Capability fulfilled by an AI Architect.

---

## Human Participant

Example:

Security Review Capability fulfilled by a Security Architect.

---

## External Service

Example:

Static Analysis Capability fulfilled by an external scanning service.

---

## Hybrid

Example:

Architecture Capability jointly fulfilled by an AI Architect and a Human Architect.

---

## Composite

A Capability fulfilled by multiple coordinated Participants providing complementary expertise.

---

# 8. Fulfilment Criteria

Capability Fulfilment shall evaluate:

- capability compatibility;
- behavioural compatibility with the EBM;
- required knowledge;
- required authority;
- availability;
- engineering constraints;
- Pack-specific requirements.

Selection algorithms are implementation-defined.

---

# 9. Eligibility Registration

Capability Fulfilment registers eligibility, not final assignment.

Registering a Participant as eligible for a Capability shall create a runtime relationship between:

- Capability;
- Participant;
- Engineering Behavior Model.

This relationship makes the Participant a candidate for dispatch. It does not bind the Participant to any specific Deliverable or Work Item; that per-Work-Item binding is produced by the Dispatch Engine (Chapter 33) when it selects among eligible Participants.

Eligibility registration shall not modify the Capability definition.

---

# 10. Dynamic Reassignment

Participants may be replaced during SEU execution.

Examples include:

- AI model upgrade.
- Human participant unavailable.
- External service unavailable.
- Improved specialist capability discovered.

Reassignment shall preserve:

- Deliverable state;
- Knowledge;
- Traceability;
- Outstanding Obligations;
- Engineering history.

---

# 11. Capability Availability

Capability Fulfilment shall continuously monitor:

- available Participants;
- unavailable Participants;
- degraded Participants;
- newly available Participants.

Changes in availability may trigger re-evaluation by the Dependency Engine.

---

# 12. Capability Continuity

The platform shall ensure that capability continuity is maintained despite Participant changes.

Engineering continuity shall be preserved through:

- Knowledge Repository;
- Deliverable state;
- Traceability;
- Engineering Behavior Model;
- Decision history.

Participants shall not become the primary repository of engineering knowledge.

---

# 13. Fulfilment Failure

Capability Fulfilment shall detect situations where:

- no suitable Participant exists;
- required authority cannot be satisfied;
- Pack constraints cannot be met;
- mandatory capabilities are unavailable.

Failures shall generate engineering obligations.

Commissioning or execution may be suspended depending on the affected Deliverables.

---

# 14. Events

The subsystem shall publish:

- CapabilityRequested
- CapabilityFulfilmentStarted
- CapabilityFulfilled
- CapabilityUnavailable
- ParticipantAssigned
- ParticipantReleased
- ParticipantReassigned
- CapabilityContinuityMaintained
- CapabilityFulfilmentFailed

---

# 15. Non-Functional Requirements

Capability Fulfilment shall:

- support dynamic reassignment;
- support concurrent fulfilment;
- remain independent of AI providers;
- preserve engineering continuity;
- maintain complete traceability.

---

# 16. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Required Capabilities are identified.

✓ Appropriate Participants are assigned.

✓ Participants can be replaced without affecting Deliverables.

✓ Capability Fulfilment remains traceable.

✓ AI, human and external Participants are equally supported.

✓ Capability continuity is preserved during reassignment.

---

# 17. Deliverables

Implementation of this chapter shall produce:

- Capability Fulfilment service.
- Participant assignment service.
- Capability continuity service.
- Fulfilment registry.
- Assignment APIs.
- Capability Fulfilment events.
- Runtime monitoring services.