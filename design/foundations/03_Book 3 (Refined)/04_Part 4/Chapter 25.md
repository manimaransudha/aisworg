
# Chapter 25 – Review Model

[Sudha: I think the next chapter is where we diverge most clearly from existing ALM tools.

When people hear "Review", they immediately think:

- Code Review
- Architecture Review
- Design Review

But I think those are merely **instances** of a much more fundamental concept.

A Review is not about people examining documents.

A Review is:

> **A governed engineering evaluation that determines whether an engineering object is fit to transition to its next state.**

That definition fits perfectly with our state-centric architecture.

A Review is simply another evaluation service.

It neither performs work nor changes state.

It evaluates.

--------------

While writing this chapter, I realised we should make **Findings** a first-class concept instead of treating them as text embedded in a review report.

A Finding has its own lifecycle. It can be:

- discussed,
- challenged,
- accepted,
- converted into an Obligation,
- resolved,
- verified,
- reopened.

That behaviour is much richer than a simple annotation.

I therefore think we should refine the architecture slightly:

- A **Review** is an evaluation activity.
- A **Finding** is an observation produced by that evaluation.
- An **Obligation** is a governed commitment created in response to an accepted Finding (or from another source).
- **Governance** determines whether the existence of Findings or unresolved Obligations prevents a state transition.

This creates a clean engineering chain:

```
Review

↓

Finding

↓

Obligation

↓

Resolution

↓

Verification

↓

Governance Evaluation

↓

State Transition
```

I believe this is a stronger model than simply having "review comments" because it separates observations from commitments. Not every Finding needs to become an Obligation, and not every Obligation originates from a Review. That distinction will make the platform much more expressive while keeping each concept focused on a single responsibility. It also sets us up naturally for the next chapter, where **Quality Gates** will evaluate whether all required Reviews, Findings and Obligations have reached an acceptable state before a Deliverable is permitted to advance.
]

---

# 1. Purpose

The Review Model defines how engineering evaluations are represented, executed and recorded within a Software Engineering Unit (SEU).

A Review evaluates whether an engineering object satisfies the criteria required to progress to its next lifecycle state.

Reviews provide assurance.

They do not perform engineering work.

They do not authorise engineering work.

They produce review outcomes that are consumed by the Governance Model.

---

# 2. Scope

This chapter defines:

- Review abstraction;
- Review lifecycle;
- Review execution;
- Review outcomes;
- Review composition;
- Review traceability.

This chapter does not define:

- authority decisions;
- policy definitions;
- engineering behaviour;
- quality gate definitions.

---

# 3. Architectural Position

```
Deliverable
      │
Knowledge
      │
Decision
      │
Evidence
      │
──────────────
      │
Review Model
      │
──────────────
      │
Review Outcome
      │
Governance Evaluation
      │
State Transition
```

Reviews evaluate engineering readiness.

Governance determines whether state transitions are permitted.

---

# 4. Definition

A Review is a governed engineering evaluation performed against one or more engineering objects.

A Review determines whether specified review criteria have been satisfied.

A Review produces findings and recommendations.

A Review does not modify the reviewed object.

---

# 5. Architectural Principles

## RM-001

Reviews are evaluations.

---

## RM-002

Reviews are independent of Participants.

---

## RM-003

Reviews are repeatable.

---

## RM-004

Reviews are composable.

---

## RM-005

Reviews shall preserve complete traceability.

---

## RM-006

Review outcomes shall be reproducible.

---

# 6. Functional Requirements

### FR-25.1

Every Review shall possess a globally unique identifier.

---

### FR-25.2

Reviews shall support multiple engineering object types.

---

### FR-25.3

Review criteria shall be declarative.

---

### FR-25.4

Reviews may be mandatory or optional.

---

### FR-25.5

Review outcomes shall remain immutable.

---

### FR-25.6

Reviews shall preserve complete provenance.

---

### FR-25.7

Reviews shall support composition from multiple Packs.

---

# 7. Review Categories

Illustrative review categories include:

## Requirements Review

Evaluates completeness, consistency and traceability of requirements.

---

## Architecture Review

Evaluates architectural suitability and alignment with engineering principles.

---

## Design Review

Evaluates design quality and implementation readiness.

---

## Code Review

Evaluates implementation quality and maintainability.

---

## Security Review

Evaluates security posture and compliance.

---

## Test Review

Evaluates test completeness, coverage and effectiveness.

---

## Deployment Review

Evaluates operational readiness for deployment.

---

## Operational Review

Evaluates production readiness and operational resilience.

Additional review categories may be introduced through Packs.

---

# 8. Review Structure

Every Review shall define:

- Identifier
- Name
- Category
- Reviewed Object
- Review Criteria
- Review Scope
- Required Evidence
- Required Participants
- Findings
- Recommendations
- Outcome
- Version
- Provenance

---

# 9. Review Lifecycle

Every Review shall transition through the following lifecycle.

```
Planned

↓

Prepared

↓

In Progress

↓

Completed

↓

Accepted

↓

Archived
```

Historical Reviews shall remain permanently available.

---

# 10. Review Criteria

Review criteria shall be declarative.

Examples include:

- required Deliverables;
- mandatory Evidence;
- applicable Policies;
- engineering standards;
- architectural principles;
- compliance obligations.

Criteria are interpreted by the Review service.

---

# 11. Review Outcomes

A Review may produce one of the following outcomes:

- Passed
- Passed with Recommendations
- Rework Required
- Failed
- Not Applicable
- Deferred

The Review itself does not determine the subsequent engineering state.

Governance consumes the Review outcome when evaluating a state transition.

---

# 12. Findings

Reviews may generate Findings.

A Finding represents an observation identified during a Review.

Findings may lead to:

- new Obligations;
- additional Evidence requests;
- engineering Decisions;
- follow-up Reviews.

Findings are independent engineering objects with complete traceability.

---

# 13. Review Composition

Multiple Review requirements may apply simultaneously.

Example:

```
Platform Review Pack

+

Organisation Review Pack

+

Customer Review Pack

+

Compliance Review Pack

↓

Effective Review Requirements
```

Composition shall be deterministic.

---

# 14. Review Traceability

Every Review shall preserve:

- reviewed object;
- review criteria;
- supporting Evidence;
- generated Findings;
- related Decisions;
- reviewing Participants;
- timestamp;
- Engineering Behavior Model version.

Review history shall be immutable.

---

# 15. Events

The Review subsystem shall publish:

- ReviewPlanned
- ReviewStarted
- ReviewCompleted
- ReviewPassed
- ReviewFailed
- ReviewDeferred
- FindingCreated
- FindingResolved

---

# 16. Non-Functional Requirements

The Review Model shall:

- support deterministic execution;
- support multiple review types;
- preserve complete traceability;
- support concurrent Reviews;
- remain independent of Participant implementations.

---

# 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Reviews evaluate engineering objects without modifying them.

✓ Review criteria are declarative.

✓ Review outcomes are immutable.

✓ Findings are traceable.

✓ Multiple Review Packs can be composed.

✓ Review history remains permanently available.

---

# 18. Deliverables

Implementation of this chapter shall produce:

- Review domain model.
- Review execution service.
- Review criteria engine.
- Finding management service.
- Review registry.
- Review APIs.
- Review events.