# Chapter 25 – Review Model

## 1. Purpose

The Review Model defines how engineering evaluations are represented, executed and recorded within a Software Engineering Unit (SEU).

A Review evaluates whether an engineering object satisfies the criteria required to progress to its next lifecycle state.

Reviews provide assurance.

They do not perform engineering work.

They do not authorise engineering work.

They produce review outcomes that are consumed by the Governance Model.

---

## 2. Scope

This chapter defines:

- Review abstraction
- Review lifecycle
- Review execution
- Review outcomes
- Review composition
- Review traceability

This chapter does not define:

- authority decisions
- policy definitions
- engineering behaviour
- quality gate definitions

---

## 3. Architectural Position

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

## 4. Definition

A Review is a governed engineering evaluation performed against one or more engineering objects.

A Review determines whether specified review criteria have been satisfied.

A Review produces findings and recommendations.

A Review does not modify the reviewed object.

---

## 5. Architectural Principles

##### RM-001

Reviews are evaluations.

##### RM-002

Reviews are independent of Participants.

##### RM-003

Reviews are repeatable.

##### RM-004

Reviews are composable.

##### RM-005

Reviews shall preserve complete traceability.

##### RM-006

Review outcomes shall be reproducible.

---

## 6. Functional Requirements

##### FR-25.1

Every Review shall possess a globally unique identifier.
 
##### FR-25.2

Reviews shall support multiple engineering object types.
 
##### FR-25.3

Review criteria shall be declarative.
 
##### FR-25.4

Reviews may be mandatory or optional.
 
##### FR-25.5

Review outcomes shall remain immutable.
 
##### FR-25.6

Reviews shall preserve complete provenance.
 
##### FR-25.7

Reviews shall support composition from multiple Packs.

---

## 7. Review Categories

Illustrative review categories include:

##### Requirements Review

Evaluates completeness, consistency and traceability of requirements.
 
##### Architecture Review

Evaluates architectural suitability and alignment with engineering principles.
 
##### Design Review

Evaluates design quality and implementation readiness.
 
##### Code Review

Evaluates implementation quality and maintainability.
 
##### Security Review

Evaluates security posture and compliance.
 
##### Test Review

Evaluates test completeness, coverage and effectiveness.
 
##### Deployment Review

Evaluates operational readiness for deployment.
 
##### Operational Review

Evaluates production readiness and operational resilience.

Additional review categories may be introduced through Packs.

---

## 8. Review Structure

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

9. Review Gate and Checklist

A Review Gate is a Pack-contributed declaration naming the governed transition for which a Review is required. A Review Gate may reference zero or more Checklists by identity, scoped to Checklists contributed by a Pack sharing the Review Gate's own Pack code.

A Checklist is a Pack-contributed, ordered set of verification statements that an assigned Participant executes against a Deliverable or other governed artefact. Executing a Checklist produces an Evidence record; the Checklist itself is never referenced by Governance evaluation directly, only the Evidence it produces. A Checklist possesses no independent version or lifecycle; both are inherited from its originating Pack.

A Review Gate's checklistIds names the Checklists required for that gate: every listed Checklist must complete (AND). Its recommendedChecklistIds names advisory Checklists whose completion is tracked but never blocks the gate. A Checklist referenced by more than one Review Gate or Quality Gate executes once; that single execution satisfies every referencing gate.

---

## 10. Review Lifecycle

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

## 11. Review Criteria

Review criteria shall be declarative.

Examples include:

- required Deliverables
- mandatory Evidence
- applicable Policies
- engineering standards
- architectural principles
- compliance obligations

Criteria are interpreted by the Review service.

---

## 12. Review Outcomes

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

## 13. Findings

Reviews may generate Findings.

A Finding represents an observation identified during a Review.

Findings may lead to:

- new Obligations
- additional Evidence requests
- engineering Decisions
- follow-up Reviews

Findings are independent engineering objects with complete traceability.

---

## 14. Review Composition

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

## 15. Review Traceability

Every Review shall preserve:

- reviewed object
- review criteria
- supporting Evidence
- generated Findings
- related Decisions
- reviewing Participants
- timestamp
- Engineering Behavior Model version

Review history shall be immutable.

---

## 16. Events

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

## 17. Non-Functional Requirements

The Review Model shall:

- support deterministic execution
- support multiple review types
- preserve complete traceability
- support concurrent Reviews
- remain independent of Participant implementations

---

## 18. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Reviews evaluate engineering objects without modifying them.

✓ Review criteria are declarative.

✓ Review outcomes are immutable.

✓ Findings are traceable.

✓ Multiple Review Packs can be composed.

✓ Review history remains permanently available.

---

## 19. Deliverables

Implementation of this chapter shall produce:

- Review domain model
- Review execution service
- Review criteria engine
- Finding management service
- Review registry
- Review APIs
- Review events

---