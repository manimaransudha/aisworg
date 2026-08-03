# Chapter 26 – Quality Gate Model

[Sudha: I think this chapter is where all the governance concepts we've built finally converge.

Let's look at the flow we've created:

- Policies define **constraints**.
- Authority defines **who may authorise**.
- Reviews produce **findings**.
- Findings may create **Obligations**.
- Evidence supports **Knowledge**.
- Knowledge supports **Decisions**.
- Governance evaluates all of these.

But there is still one question left:

> **When is a Deliverable actually allowed to move to the next state?**

That is the responsibility of the **Quality Gate**.

Notice something important.

A Quality Gate is **not** a checklist.

A checklist is merely one possible implementation.

A Quality Gate is actually:

> **A declarative engineering contract that must evaluate to true before a governed state transition may occur.**

That definition is much more powerful.

-------------------

While writing this chapter, I realised we've reached another architectural simplification.

Traditionally, software delivery distinguishes between:

- Definition of Ready
- Definition of Done
- Stage Gates
- Exit Criteria
- Release Gates
- Production Readiness Reviews

Architecturally, I don't think these need to be separate concepts.

They're all instances of the same abstraction:

> **A Quality Gate evaluates whether a specific lifecycle transition is permitted.**

For example:

|Traditional Term|Quality Gate Interpretation|
|---|---|
|Definition of Ready|Entry Quality Gate|
|Definition of Done|Exit Quality Gate|
|Architecture Sign-off|Architecture Quality Gate|
|Release Approval|Release Quality Gate|
|Production Readiness Review|Operational Quality Gate|

This gives the platform a single, consistent mechanism for governing state transitions while allowing Packs to define organisation-specific terminology and criteria.

I think there's one further refinement we should adopt in future chapters.

Every lifecycle transition in the platform—not just Deliverables, but also Decisions, Knowledge Items, Obligations and even SEUs—should reference a **Transition Definition**. A Transition Definition would specify:

- the source state;
- the target state;
- applicable Quality Gates;
- required Authority;
- applicable Policies;
- required Reviews;
- required Evidence;
- required Obligations.

In other words, the transition itself becomes a first-class architectural object. That idea would unify the state models we've created across the platform and eliminate duplicated governance logic. I suspect it will become an important architectural concept when we later define the Runtime Kernel and state management.
]
---

# 1. Purpose

The Quality Gate Model defines how engineering readiness is evaluated before governed state transitions occur within a Software Engineering Unit (SEU).

A Quality Gate determines whether all required engineering conditions have been satisfied before a Deliverable, Decision, Knowledge Item or other governed engineering object may transition to its next lifecycle state.

Quality Gates provide engineering assurance.

They evaluate readiness.

They do not perform engineering work.

They do not authorise engineering work.

---

# 2. Scope

This chapter defines:

- Quality Gate abstraction;
- Quality Gate lifecycle;
- gate evaluation;
- gate composition;
- gate outcomes;
- gate traceability.

This chapter does not define:

- engineering behaviour;
- authority assignments;
- policy definitions;
- review execution.

---

# 3. Architectural Position

```
Policies
     │
Reviews
     │
Evidence
     │
Knowledge
     │
Decisions
     │
Obligations
     │
──────────────
     │
Quality Gate
     │
──────────────
     │
Governance Evaluation
     │
State Transition
```

Quality Gates evaluate engineering readiness.

Governance decides whether the requested state transition may occur.

---

# 4. Definition

A Quality Gate is a declarative engineering contract that specifies the conditions required for a governed engineering state transition.

A Quality Gate evaluates engineering state.

It does not modify engineering state.

---

# 5. Architectural Principles

## QG-001

Quality Gates are declarative.

---

## QG-002

Quality Gates evaluate readiness.

---

## QG-003

Quality Gates are composable.

---

## QG-004

Quality Gates remain independent of Participants.

---

## QG-005

Quality Gate outcomes are traceable.

---

## QG-006

Quality Gates are deterministic.

Given identical engineering state, the same evaluation shall always produce the same outcome.

---

# 6. Functional Requirements

### FR-26.1

Every Quality Gate shall possess a globally unique identifier.

---

### FR-26.2

Quality Gates shall be contributed through Packs.

---

### FR-26.3

Quality Gates shall support composition from multiple organisations.

---

### FR-26.4

Quality Gates shall evaluate one or more engineering objects.

---

### FR-26.5

Quality Gate outcomes shall remain immutable.

---

### FR-26.6

Quality Gate evaluations shall preserve complete traceability.

---

### FR-26.7

Quality Gates shall support explicit waivers.

---

# 7. Quality Gate Categories

Illustrative categories include:

## Entry Gates

Determine readiness to begin a lifecycle stage.

Examples:

- Requirements Complete
- Architecture Approved

---

## Exit Gates

Determine readiness to leave a lifecycle stage.

Examples:

- Development Complete
- Testing Complete

---

## Release Gates

Evaluate readiness for deployment.

Examples:

- Security Clearance
- Operational Readiness
- Customer Acceptance

---

## Compliance Gates

Evaluate regulatory readiness.

Examples:

- HIPAA Validation
- SOX Controls
- ISO Verification

---

## Operational Gates

Evaluate production readiness.

Examples:

- Monitoring Configured
- Backup Verified
- Rollback Available

Additional categories may be introduced through Packs.

---

# 8. Quality Gate Structure

Every Quality Gate shall define:

- Identifier
- Name
- Category
- Scope
- Applicable Lifecycle Transition
- Evaluation Criteria
- Required Reviews
- Required Evidence
- Required Decisions
- Required Obligations
- Required Policies
- Waiver Rules
- Version
- Originating Pack

---

# 9. Evaluation Criteria

Quality Gate criteria may reference:

- Deliverable state;
- Review outcomes;
- accepted Evidence;
- approved Decisions;
- active Policies;
- unresolved Obligations;
- compliance requirements;
- engineering metrics.

Where a referenced Policy's Constraint Type is "Standard" rather than "Policy" (Chapter 24 §4), a Quality Gate may still choose to treat adherence as blocking for that specific gate — for example, a Release Quality Gate may require full Standard adherence even though the underlying Policy does not block by default elsewhere. Absent such an explicit gate criterion, Standard deviations remain non-blocking, consistent with Chapter 24.

Criteria are declarative and interpreted by the Governance Model.

---

# 10. Quality Gate Evaluation

Quality Gates shall be evaluated whenever a governed lifecycle transition is requested.

Evaluation shall determine:

- satisfied criteria;
- unsatisfied criteria;
- applicable waivers;
- blocking conditions;
- supporting rationale.

Evaluation shall not modify engineering state.

---

# 11. Quality Gate Outcomes

Quality Gate evaluation shall produce one of the following outcomes:

- Passed
- Passed with Conditions
- Blocked
- Waived
- Deferred
- Not Applicable

The outcome becomes an input to Governance.

Governance determines whether the state transition proceeds.

---

# 12. Quality Gate Composition

Multiple organisations may contribute Quality Gates.

Example:

```
Platform Gate Pack

+

Organisation Gate Pack

+

Customer Gate Pack

+

Compliance Gate Pack

↓

Effective Quality Gates
```

Composition shall preserve deterministic behaviour.

Conflicts shall be resolved through Governance composition rules.

---

# 13. Waivers

Quality Gates may define explicit waiver mechanisms.

Every waiver shall specify:

- justification;
- approving authority;
- applicable scope;
- duration;
- associated risks;
- compensating controls.

Waivers shall remain fully traceable.

A waiver does not remove the Quality Gate.

It modifies its evaluation for a defined context.

---

# 14. Quality Gate Traceability

Every Quality Gate evaluation shall preserve:

- evaluated engineering object;
- applicable Engineering Behavior Model;
- governing Policies;
- supporting Reviews;
- supporting Evidence;
- supporting Decisions;
- active Obligations;
- evaluation outcome;
- timestamp.

Historical evaluations shall remain reproducible.

---

# 15. Events

The Quality Gate subsystem shall publish:

- QualityGateEvaluated
- QualityGatePassed
- QualityGateBlocked
- QualityGateWaived
- QualityGateDeferred
- QualityGateConfigurationChanged

---

# 16. Non-Functional Requirements

The Quality Gate Model shall:

- support deterministic evaluation;
- support composition from multiple Packs;
- preserve complete traceability;
- support historical reconstruction;
- remain independent of Participant implementations.

---

# 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Quality Gates evaluate readiness without changing engineering state.

✓ Evaluation criteria are declarative.

✓ Quality Gates support multi-organisation composition.

✓ Waivers are explicit, governed and traceable.

✓ Evaluation outcomes are reproducible.

✓ Historical Quality Gate evaluations remain available.

---

# 18. Deliverables

Implementation of this chapter shall produce:

- Quality Gate domain model.
- Quality Gate registry.
- Quality Gate evaluation service.
- Waiver management service.
- Quality Gate composition service.
- Quality Gate APIs.
- Quality Gate events.