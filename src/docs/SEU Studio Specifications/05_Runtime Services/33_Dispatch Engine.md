# Chapter 33 – Dispatch Engine

## 1. Purpose

The Dispatch Engine is responsible for assigning executable Work Items to suitable Participants within a commissioned Software Engineering Unit (SEU).

The Dispatch Engine determines **who should perform the requested engineering activity**, based on the current engineering context, available Participants and applicable governance constraints.

The Dispatch Engine does not determine **what** should be executed.

That responsibility belongs to the Execution Engine.

---

## 2. Scope

This chapter defines:

- Dispatch abstraction
- participant selection
- dispatch policies
- dispatch strategies
- dispatch lifecycle
- dispatch traceability

This chapter does not define:

- engineering behaviour
- command generation
- work item generation
- participant implementation

---

## 3. Architectural Position

```
Execution Engine

↓

Command

↓

Work Item Generator

↓

Dispatch Engine ←── eligible Participants ── Capability Fulfilment

↓

Participant

↓

Execution
```

The Dispatch Engine determines the most appropriate execution destination.

Capability Fulfilment determines **which Participants are eligible** to provide a required Capability. The Dispatch Engine consumes that eligible pool and determines **which eligible Participant executes a specific Work Item now**. The two responsibilities are complementary, not overlapping.

---

## 4. Definition

Dispatch is the runtime process of assigning one or more Work Items to one or more suitable Participants.

Dispatch decisions are contextual.

They consider engineering requirements rather than organisational hierarchy.

Dispatch does not imply execution.

It merely initiates execution.

---

## 5. Architectural Principles

##### DE-001

Dispatch is capability-driven.

Participants are selected because they fulfil required Capabilities.

##### DE-002

Dispatch is context-sensitive.

Selection depends upon the current engineering state.

##### DE-003

Dispatch is dynamic.

Assignments may differ even for identical Commands.

##### DE-004

Dispatch is replaceable.

Participant failure shall trigger redispatch where appropriate.

##### DE-005

Dispatch is traceable.

Every dispatch decision shall preserve rationale.

##### DE-006

Dispatch shall remain independent of Participant implementation technologies.

---

## 6. Functional Requirements

##### FR-33.1

Every Work Item shall be dispatched only after successful generation.

##### FR-33.2

Dispatch shall evaluate all eligible Participants.

##### FR-33.3

Dispatch shall support one-to-one, one-to-many and many-to-one assignment strategies.

##### FR-33.4

Dispatch decisions shall preserve engineering traceability.

##### FR-33.5

Dispatch shall support redispatch.

##### FR-33.6

Dispatch shall respect Authority and Governance constraints.

##### FR-33.7

Dispatch decisions shall be reproducible.

---

## 7. Dispatch Inputs

The Dispatch Engine evaluates:

- the eligible-Participant pool produced by Capability Fulfilment for each required Capability
- Participant availability
- Participant type
- applicable Authority
- Engineering Behavior Model
- active Policies
- active Obligations
- organisational constraints

Future Packs may introduce additional dispatch criteria.

---

## 8. Dispatch Outputs

The Dispatch Engine may produce:

- Participant Assignment
- Parallel Assignment
- Deferred Assignment
- Redispatch Request
- Escalation Request

Dispatch outputs are runtime decisions.

They do not modify engineering state.

---

## 9. Dispatch Strategies

Illustrative strategies include:

##### Capability Match

Select the Participant best matching the required Capability.

##### Specialist Preference

Prefer specialist Participants when available.

##### Cost Optimisation

Select the lowest-cost Participant satisfying engineering constraints.

##### Confidence Optimisation

Prefer Participants with the highest demonstrated engineering confidence for similar work.

##### Load Balancing

Distribute work evenly across Participants.

##### Locality Preference

Prefer Participants possessing relevant contextual knowledge.

##### Organisation Preference

Prefer Participants belonging to a specified Organisation Pack where required.

Strategies are contributed through Packs.

---

## 10. Parallel Dispatch

Where engineering dependencies permit, the Dispatch Engine may assign Work Items concurrently.

Parallel dispatch shall preserve:

- dependency correctness
- governance constraints
- engineering consistency

Concurrency shall never compromise engineering correctness.

---

## 11. Redispatch

Redispatch may occur when:

- a Participant becomes unavailable
- execution fails
- governance changes
- capability availability changes
- engineering priorities change

Redispatch shall preserve engineering continuity.

---

## 12. Dispatch Context

Every dispatch decision shall consider:

- current Deliverable state
- current engineering stage
- active Knowledge
- active Decisions
- active Obligations
- current Participant state
- Transition Definitions

Dispatch shall never operate using incomplete engineering context.

---

## 13. Dispatch Traceability

Every dispatch decision shall preserve:

- originating Command
- generated Work Item
- selected Participant
- dispatch strategy
- evaluation criteria
- rationale
- timestamp

Dispatch history shall remain immutable.

---

## 14. Events

The Dispatch subsystem shall publish:

- WorkItemDispatched
- DispatchDeferred
- DispatchRejected
- ParticipantSelected
- ParticipantUnavailable
- RedispatchRequested
- RedispatchCompleted

---

## 15. Non-Functional Requirements

The Dispatch Engine shall:

- support large numbers of Participants
- support dynamic participant availability
- support deterministic selection when required
- support pluggable dispatch strategies
- remain independent of AI implementation technologies

---

## 16. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Work Items are dispatched only after generation.

✓ Dispatch decisions are capability-driven.

✓ Parallel dispatch is supported.

✓ Redispatch preserves engineering continuity.

✓ Dispatch decisions remain traceable.

✓ Dispatch strategies are extensible through Packs.

---

## 17. Deliverables

Implementation of this chapter shall produce:

- Dispatch Engine
- Participant selection service
- Dispatch strategy framework
- Redispatch service
- Dispatch registry
- Dispatch APIs
- Dispatch events

---