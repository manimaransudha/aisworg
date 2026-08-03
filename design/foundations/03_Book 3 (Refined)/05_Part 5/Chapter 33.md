
# Chapter 33 – Dispatch Engine

[Sudha: 
In fact, I think we've just discovered something that makes the platform even more AI-native.

In traditional software delivery, there are three questions:

- **What should be done?** (Planning)
- **Who should do it?** (Assignment)
- **When should it be done?** (Scheduling)

In the SEU architecture, those become:

- **Execution Engine** → _What should happen next?_
- **Dispatcher** → _Who is the best Participant right now?_
- **Dependency Engine** → _When can it happen?_

Notice what's happened.

**Time has almost disappeared.**

As you pointed out much earlier, dependencies are the primary constraint. Time is only a consequence.

I therefore think "Dispatching" is a much stronger architectural concept than "Scheduling."

-----------------

think we've now reached a point where the runtime architecture has become remarkably elegant.

The runtime decision-making responsibilities are now clearly separated:

|Runtime Service|Question Answered|
|---|---|
|**Execution Engine**|_What engineering action should happen next?_|
|**Work Item Generator**|_How should this Command be expressed for a specific type of Participant?_|
|**Dispatch Engine**|_Who should execute this Work Item now?_|
|**Participant**|_How do I actually perform this engineering activity?_|
|**Runtime Kernel**|_How is execution managed, observed and recorded?_|

This separation gives us a very clean pipeline:

```
Engineering State
        │
        ▼
Execution Engine
        │
     Command
        │
        ▼
Work Item Generator
        │
    Work Item
        │
        ▼
Dispatch Engine
        │
 Participant Assignment
        │
        ▼
Participant Execution
        │
        ▼
State Transition
        │
        ▼
Event
```

## One architectural refinement

When I first drafted this chapter, I considered folding **Capability Fulfilment** (Chapter 12) into the Dispatch Engine as a single merged service, on the theory that both are ultimately about connecting Capabilities to Participants.

On review, I don't think that merge holds up, and I want to record why rather than leave the two chapters quietly contradicting each other.

Capability Fulfilment and Dispatch answer two different questions, at two different speeds:

- **Capability Fulfilment** answers: _which Participants are eligible to provide this Capability at all?_ This is a comparatively slow-moving, structural concern. It changes when a Participant is onboarded, retired, upgraded or reassigned, not on every unit of work.
- **Dispatch** answers: _given that eligible pool, who should execute this specific Work Item right now?_ This is a fast, per-Work-Item runtime decision, sensitive to load, availability, cost and context.

Collapsing both into one service would force a single component to do slow-changing eligibility bookkeeping and fast-changing per-item selection at the same time, which is exactly the kind of mixed responsibility this architecture has consistently avoided elsewhere (compare Governance vs Authority, or Review vs Quality Gate).

So the resolution is composition, not merger:

- **Capability Fulfilment (Ch. 12)** remains the service of record for **which Participants are eligible** to fulfil a given Capability, and for maintaining that eligibility as Participants change.
- **Dispatch Engine (this chapter)** consumes Capability Fulfilment's eligible-Participant output as one of its dispatch inputs (see §7) and performs the final, per-Work-Item selection among eligible Participants using dispatch strategies (cost, load, locality, and so on).

Capability Fulfilment is therefore upstream of Dispatch, not a duplicate of it. I'm recording this as the resolution rather than the earlier merge proposal, since Chapters 9, 10, 13, 14, 15, 16 and 21 already treat Capability Fulfilment as an independent, addressable service, and that treatment turns out to be correct.
]

---

# 1. Purpose

The Dispatch Engine is responsible for assigning executable Work Items to suitable Participants within a commissioned Software Engineering Unit (SEU).

The Dispatch Engine determines **who should perform the requested engineering activity**, based on the current engineering context, available Participants and applicable governance constraints.

The Dispatch Engine does not determine **what** should be executed.

That responsibility belongs to the Execution Engine.

---

# 2. Scope

This chapter defines:

- Dispatch abstraction;
- participant selection;
- dispatch policies;
- dispatch strategies;
- dispatch lifecycle;
- dispatch traceability.

This chapter does not define:

- engineering behaviour;
- command generation;
- work item generation;
- participant implementation.

---

# 3. Architectural Position

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

Capability Fulfilment (Chapter 12) determines **which Participants are eligible** to provide a required Capability. The Dispatch Engine consumes that eligible pool and determines **which eligible Participant executes a specific Work Item now**. The two responsibilities are complementary, not overlapping.

---

# 4. Definition

Dispatch is the runtime process of assigning one or more Work Items to one or more suitable Participants.

Dispatch decisions are contextual.

They consider engineering requirements rather than organisational hierarchy.

Dispatch does not imply execution.

It merely initiates execution.

---

# 5. Architectural Principles

## DE-001

Dispatch is capability-driven.

Participants are selected because they fulfil required Capabilities.

---

## DE-002

Dispatch is context-sensitive.

Selection depends upon the current engineering state.

---

## DE-003

Dispatch is dynamic.

Assignments may differ even for identical Commands.

---

## DE-004

Dispatch is replaceable.

Participant failure shall trigger redispatch where appropriate.

---

## DE-005

Dispatch is traceable.

Every dispatch decision shall preserve rationale.

---

## DE-006

Dispatch shall remain independent of Participant implementation technologies.

---

# 6. Functional Requirements

### FR-33.1

Every Work Item shall be dispatched only after successful generation.

---

### FR-33.2

Dispatch shall evaluate all eligible Participants.

---

### FR-33.3

Dispatch shall support one-to-one, one-to-many and many-to-one assignment strategies.

---

### FR-33.4

Dispatch decisions shall preserve engineering traceability.

---

### FR-33.5

Dispatch shall support redispatch.

---

### FR-33.6

Dispatch shall respect Authority and Governance constraints.

---

### FR-33.7

Dispatch decisions shall be reproducible.

---

# 7. Dispatch Inputs

The Dispatch Engine evaluates:

- the eligible-Participant pool produced by Capability Fulfilment (Chapter 12) for each required Capability;
- Participant availability;
- Participant type;
- applicable Authority;
- Engineering Behavior Model;
- active Policies;
- active Obligations;
- organisational constraints.

Future Packs may introduce additional dispatch criteria.

---

# 8. Dispatch Outputs

The Dispatch Engine may produce:

- Participant Assignment;
- Parallel Assignment;
- Deferred Assignment;
- Redispatch Request;
- Escalation Request.

Dispatch outputs are runtime decisions.

They do not modify engineering state.

---

# 9. Dispatch Strategies

Illustrative strategies include:

## Capability Match

Select the Participant best matching the required Capability.

---

## Specialist Preference

Prefer specialist Participants when available.

---

## Cost Optimisation

Select the lowest-cost Participant satisfying engineering constraints.

---

## Confidence Optimisation

Prefer Participants with the highest demonstrated engineering confidence for similar work.

---

## Load Balancing

Distribute work evenly across Participants.

---

## Locality Preference

Prefer Participants possessing relevant contextual knowledge.

---

## Organisation Preference

Prefer Participants belonging to a specified Organisation Pack where required.

Strategies are contributed through Packs.

---

# 10. Parallel Dispatch

Where engineering dependencies permit, the Dispatch Engine may assign Work Items concurrently.

Parallel dispatch shall preserve:

- dependency correctness;
- governance constraints;
- engineering consistency.

Concurrency shall never compromise engineering correctness.

---

# 11. Redispatch

Redispatch may occur when:

- a Participant becomes unavailable;
- execution fails;
- governance changes;
- capability availability changes;
- engineering priorities change.

Redispatch shall preserve engineering continuity.

---

# 12. Dispatch Context

Every dispatch decision shall consider:

- current Deliverable state;
- current engineering stage;
- active Knowledge;
- active Decisions;
- active Obligations;
- current Participant state;
- Transition Definitions.

Dispatch shall never operate using incomplete engineering context.

---

# 13. Dispatch Traceability

Every dispatch decision shall preserve:

- originating Command;
- generated Work Item;
- selected Participant;
- dispatch strategy;
- evaluation criteria;
- rationale;
- timestamp.

Dispatch history shall remain immutable.

---

# 14. Events

The Dispatch subsystem shall publish:

- WorkItemDispatched
- DispatchDeferred
- DispatchRejected
- ParticipantSelected
- ParticipantUnavailable
- RedispatchRequested
- RedispatchCompleted

---

# 15. Non-Functional Requirements

The Dispatch Engine shall:

- support large numbers of Participants;
- support dynamic participant availability;
- support deterministic selection when required;
- support pluggable dispatch strategies;
- remain independent of AI implementation technologies.

---

# 16. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Work Items are dispatched only after generation.

✓ Dispatch decisions are capability-driven.

✓ Parallel dispatch is supported.

✓ Redispatch preserves engineering continuity.

✓ Dispatch decisions remain traceable.

✓ Dispatch strategies are extensible through Packs.

---

# 17. Deliverables

Implementation of this chapter shall produce:

- Dispatch Engine.
- Participant selection service.
- Dispatch strategy framework.
- Redispatch service.
- Dispatch registry.
- Dispatch APIs.
- Dispatch events.