
# Chapter 22 – Authority Model

[Sudha: we've talked about **Authority Packs**    but we've never formally defined **what authority actually is**.

The more we've refined the architecture, the more I think authority has almost nothing to do with "roles".

It has everything to do with **permission to change engineering state**.

That's a much more precise definition.

For example:

- A Participant does **not** have authority because it is an Architect.
- It has authority because the current Governance Model authorises that Participant to approve an Architecture Deliverable **at its current state**.

Tomorrow, another Participant may possess that authority.

This is a very important distinction.

-------------------

While writing this chapter, I realised we've arrived at another architectural refinement.

We've repeatedly used the phrase **"authority to approve."** I think that's too narrow.

Authority should instead be modelled as **permission to perform a governed state transition**.

That includes approvals, but also many other actions:

- transition a Deliverable from **Under Review → Approved**;
- create or close an Obligation;
- waive a Quality Gate;
- supersede a Decision;
- activate a new Engineering Behavior Model;
- commission or decommission an SEU.

In other words, authority should attach to **transitions**, not to objects.

This fits beautifully with the state-centric architecture we've developed:

- Deliverables evolve through states.
- Decisions evolve through states.
- Knowledge evolves through states.
- Obligations evolve through states.
- Governance evaluates state transitions.
- **Authority authorises state transitions.**

I think this is a stronger and more general model than traditional RACI matrices.

In fact, I now see RACI as **one possible implementation** of an Authority Pack rather than as the architectural foundation itself. An Organisation Pack could implement a RACI-based authority model, while another organisation might use a policy-based or risk-based model, and both would fit naturally into the same platform architecture. That flexibility is exactly what we wanted when we introduced composable Authority Packs.
]

---

# 1. Purpose

The Authority Model defines how engineering authority is represented, delegated, evaluated and enforced within a Software Engineering Unit (SEU).

Authority determines **who is permitted to perform a governed engineering action**.

Authority is independent of organisational job titles, participant implementations and engineering capabilities.

Authority is evaluated dynamically according to the Engineering Behavior Model (EBM), active Governance Model and applicable Authority Packs.

---

# 2. Scope

This chapter defines:

- authority abstraction;
- authority assignments;
- authority evaluation;
- delegation;
- authority inheritance;
- authority composition.

This chapter does not define:

- engineering behaviour;
- organisational structures;
- capability fulfilment;
- participant implementations.

---

# 3. Architectural Position

```
Governance Model
        │
Authority Packs
        │
        ▼
Authority Model
        │
        ▼
Governance Evaluation
        │
        ▼
Engineering State Transition
```

Authority determines whether a requested engineering action may be authorised.

---

# 4. Definition

Authority is the permission to perform a governed engineering action within a specific engineering context.

Authority is contextual.

It depends upon:

- the Engineering Behavior Model;
- Deliverable state;
- Governance Model;
- active Policies;
- active Obligations;
- applicable Authority Packs.

Authority is **not** an attribute of a Participant.

It is a runtime relationship between:

- an engineering action;
- a governing context;
- an authorised Participant.

---

# 5. Architectural Principles

## AM-001

Authority governs engineering state transitions.

---

## AM-002

Authority is contextual.

---

## AM-003

Authority is composable.

---

## AM-004

Authority shall remain independently traceable.

---

## AM-005

Authority may be delegated.

---

## AM-006

Authority shall remain independent of organisational titles.

---

# 6. Functional Requirements

### FR-22.1

Every governed engineering action shall require explicit authority.

---

### FR-22.2

Authority shall be evaluated before execution.

---

### FR-22.3

Authority rules shall be contributed through Packs.

---

### FR-22.4

Authority assignments shall remain fully traceable.

---

### FR-22.5

Authority shall support delegation.

---

### FR-22.6

Authority shall support multiple participating organisations.

---

### FR-22.7

Authority conflicts shall be detected during governance evaluation.

---

# 7. Authority Components

The Authority Model consists of:

- Authority Rules;
- Delegation Rules;
- Escalation Rules;
- Approval Rules;
- Exception Rules;
- Separation of Duties Rules.

Each component contributes to determining whether a requested action is authorised.

---

# 8. Authority Sources

Authority may originate from:

- Platform Packs;
- Organisation Packs;
- Domain Packs;
- Compliance Packs;
- Customer Packs.

The Composition Engine shall compose these into a single effective Authority Model.

---

# 9. Authority Evaluation

Authority shall be evaluated whenever a governed action is requested.

Evaluation shall consider:

- requested action;
- current Deliverable state;
- Participant identity;
- fulfilled Capabilities;
- active Governance Model;
- applicable Policies;
- active Obligations;
- current engineering stage.

Evaluation shall produce one deterministic outcome.

---

# 10. Authority Outcomes

Authority evaluation may produce:

- Authorised;
- Authorised with Conditions;
- Not Authorised;
- Escalation Required;
- Delegation Required;
- Waiver Required.

Each outcome shall include supporting rationale.

---

# 11. Delegation

Authority may be delegated according to explicit delegation rules.

Delegation shall define:

- delegating authority;
- receiving authority;
- scope;
- duration;
- conditions.

Delegation shall never occur implicitly.

Delegation shall be traceable.

---

# 12. Authority Composition

Multiple organisations may contribute authority rules.

For example:

```
Platform Authority Pack

        +

TCS Authority Pack

        +

Cigna Authority Pack

        +

HIPAA Authority Rules

        ↓

Effective Authority Model
```

The effective Authority Model shall resolve conflicts deterministically according to composition rules defined by the Governance Model.

---

# 13. Separation of Duties

The Authority Model shall support separation-of-duties constraints.

Examples include:

- the Participant who implements a Deliverable shall not approve it;
- security waivers require independent approval;
- production deployment approval requires a different authority from development approval.

These constraints are declarative and contributed through Packs.

---

# 14. Authority Traceability

Every authority decision shall preserve:

- governing rule;
- originating Pack;
- requesting Participant;
- authorised Participant;
- affected Deliverable;
- applicable Governance Model;
- timestamp;
- rationale.

Authority traceability shall be immutable.

---

# 15. Events

The Authority subsystem shall publish:

- AuthorityRequested
- AuthorityGranted
- AuthorityDenied
- AuthorityDelegated
- AuthorityEscalated
- AuthorityExpired
- AuthorityRevoked

---

# 16. Non-Functional Requirements

The Authority Model shall:

- support deterministic evaluation;
- support composition from multiple organisations;
- preserve complete traceability;
- support dynamic delegation;
- remain independent of Participant implementations.

---

# 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Every governed engineering action requires explicit authority.

✓ Authority is evaluated contextually.

✓ Authority rules from multiple organisations are composed.

✓ Delegation is explicit and traceable.

✓ Separation-of-duties constraints are enforced.

✓ Authority decisions are explainable and reproducible.

---

# 18. Deliverables

Implementation of this chapter shall produce:

- Authority domain model.
- Authority evaluation service.
- Delegation service.
- Authority registry.
- Authority APIs.
- Authority events.
- Authority traceability service.