# Chapter 23 – Obligation Model

## 1. Purpose

The Obligation Model defines how commitments, deficiencies, risks, findings, exceptions and required actions are represented, governed and resolved within a Software Engineering Unit (SEU).

An **Obligation** is any engineering commitment that must be satisfied before one or more governed engineering outcomes can be considered complete.

Obligations are first-class engineering objects.

They participate in governance, dependency evaluation and engineering execution.

---

## 2. Scope

This chapter defines:

- Obligation abstraction
- Obligation lifecycle
- Obligation relationships
- Obligation governance
- Obligation ownership
- Obligation resolution

This chapter does not define:

- risk analysis methodologies
- audit frameworks
- compliance regulations
- issue tracking implementations

These are contributed through Packs.

---

## 3. Architectural Position

```
Governance Model

↓

Obligations

↓

Dependency Engine

↓

Deliverable State Transitions
```

Obligations influence engineering readiness and governance decisions.

---

## 4. Definition

An Obligation is a governed engineering commitment requiring satisfaction before one or more engineering objectives may progress.

An Obligation may arise from:

- governance
- compliance
- engineering practice
- customer requirements
- risk management
- operational experience
- engineering decisions
- sustained Engineering Telemetry patterns indicating that a Capability, Service or Policy should be improved
- Knowledge promoted to Capability, Enterprise or Platform Acquisition Scope, indicating engineering capital that should be formally codified

Obligations are persistent engineering objects.

---

## 5. Architectural Principles

##### OM-001

Every significant engineering commitment shall be represented as an Obligation.
 
##### OM-002

Obligations are independent of Participants.
 
##### OM-003

Obligations shall participate in dependency evaluation.
 
##### OM-004

Obligations shall remain fully traceable.
 
##### OM-005

Obligations shall support composition from multiple Packs.
 
##### OM-006

Obligations shall possess explicit lifecycle states.

---

## 6. Functional Requirements

##### FR-23.1

Every Obligation shall possess a globally unique identifier.
 
##### FR-23.2

Obligations shall support dependencies upon Deliverables, Decisions, Evidence and other Obligations.
 
##### FR-23.3

Obligations may block Deliverable state transitions.
 
##### FR-23.4

Every Obligation shall possess measurable completion criteria.
 
##### FR-23.5

Every Obligation shall preserve complete engineering history.
 
##### FR-23.6

Obligation state transitions shall remain fully traceable.
 
##### FR-23.7

Obligations shall support delegation without changing ownership.
 
##### FR-23.8

The platform shall raise an Organisational Learning Obligation when Engineering Telemetry detects a sustained pattern indicating that a Capability, Service or Policy should be improved.

---

## 7. Obligation Categories

Illustrative categories include:

##### Engineering

Examples:

- Architecture review required
- Performance optimisation
- Technical debt
- Documentation completion
 
##### Risk

Examples:

- High operational risk
- Vendor dependency
- Unresolved architectural uncertainty
- Security exposure
 
##### Compliance

Examples:

- HIPAA evidence outstanding
- SOX control validation
- ISO corrective action
 
##### Audit

Examples:

- Internal audit finding
- Customer audit observation
- External certification finding
 
##### Security

Examples:

- Vulnerability remediation
- Penetration testing follow-up
- Secret rotation
- Privilege review
 
##### Operational

Examples:

- Monitoring enhancement
- Capacity planning
- Disaster recovery validation
 
##### Customer

Examples:

- Business clarification
- Acceptance prerequisite
- Outstanding customer decision
 
##### Organisational Learning

Examples:

- Recurring architectural decision indicates a missing or under-specified Capability
- Service chronically missing its declared Service Level 
- Policy repeatedly waived, indicating the constraint or its Constraint Type needs revision
- Rework pattern indicates a Capability Pack should be refined
- Knowledge promoted to Capability, Enterprise or Platform Acquisition Scope indicates the understanding should be formally codified rather than left as a queryable Knowledge Item

Resolution typically requires publishing a revised Capability, Service or Policy definition (see §12) rather than a Deliverable-level fix. This is the category through which Engineering Telemetry and Engineering Capital promotion each turn sustained measurement or accumulated understanding into an actual improvement commitment, rather than a metric or a Knowledge Item nobody acts on.

Additional categories may be introduced through Packs.

---

## 8. Obligation Structure

Every Obligation shall define:

- Identifier 
- Title
- Category
- Description
- Origin
- Priority
- Severity
- Completion Criteria
- Status
- Related Deliverables
- Related Decisions
- Related Evidence
- Related Risks
- Related Policies
- Related Authority Rules
- Traceability References

---

## 9. Obligation Lifecycle

Every Obligation shall transition through the following lifecycle.

```
Identified

↓

Analysed

↓

Assigned

↓

In Progress

↓

Resolved

↓

Verified

↓

Closed

↓

Archived
```

Closure shall require verification.

---

## 10. Obligation Sources

Obligations may originate from:

- Engineering Behavior Model
- Policies
- Authority evaluations
- Reviews
- Quality Gates
- Compliance Packs
- Organisation Packs
- Customer requests
- Participants
- External systems
- Engineering Telemetry and the Knowledge Model for Organisational Learning Obligations

The origin shall remain permanently recorded.

---

## 11. Dependency Integration

Obligations participate directly in the Dependency Graph.

Examples include:

- A Deliverable cannot be approved until an associated security Obligation is verified.
- A production release remains blocked while a compliance Obligation is unresolved.
- A deployment Deliverable becomes ready automatically once all blocking Obligations are resolved.

The Dependency Engine evaluates these relationships continuously.

---

## 12. Resolution

Every Obligation shall define explicit completion criteria.

Resolution may require:

- new Deliverables
- additional Evidence
- engineering Decisions
- governance approval
- successful Reviews
- Quality Gate satisfaction
- a revised Capability, Service or Policy Pack version, composed by the Composition Engine into a new Engineering Behavior Model (for Organisational Learning Obligations)

Resolution alone does not close an Obligation.

Verification is required before closure.

---

## 13. Ownership

An Obligation belongs to the SEU.

Participants may be assigned responsibility for resolving an Obligation, but they do not own it.

Participant reassignment shall not affect the identity or lifecycle of the Obligation.

---

## 14. Escalation

Obligations may define escalation rules.

Escalation conditions may include:

- severity
- prolonged unresolved state
- repeated verification failures
- approaching engineering milestones
- dependency impact

Escalation behaviour is governed through Packs.

---

## 15. Events

The Obligation subsystem shall publish:

- ObligationCreated
- ObligationAssigned
- ObligationUpdated
- ObligationResolved
- ObligationVerified
- ObligationClosed
- ObligationEscalated
- ObligationReopened

---

## 16. Non-Functional Requirements

The Obligation Model shall:

- support deterministic lifecycle transitions
- integrate with the Dependency Engine
- preserve complete traceability
- support composition from multiple governance sources
- remain independent of Participant implementations

---

## 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Every engineering commitment is represented as an Obligation.

✓ Obligations participate in dependency evaluation.

✓ Deliverable transitions can be blocked by unresolved Obligations.

✓ Obligation closure requires verification.

✓ Obligation provenance and history are preserved.

✓ Obligations remain independent of Participant changes.

✓ Sustained Engineering Telemetry patterns raise Organisational Learning Obligations, and resolving them produces a revised Capability, Service or Policy Pack version.

---

## 18. Deliverables

Implementation of this chapter shall produce:

- Obligation domain model
- Obligation registry
- Obligation lifecycle service
- Obligation verification service
- Escalation service
- Dependency integration interfaces
- Obligation APIs
- Obligation events

---