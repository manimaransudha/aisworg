
# Chapter 24 – Policy Model

[Sudha: While writing this chapter, I realised there is a clean separation between the governance concepts we've defined:

|Concept|Responsibility|
|---|---|
|**Engineering Behavior Model**|Defines how engineering is performed.|
|**Policy**|Defines what constraints apply.|
|**Authority**|Defines who may authorise governed actions.|
|**Obligation**|Defines outstanding engineering commitments.|
|**Governance**|Evaluates whether a requested state transition is permissible.|

Each concept answers a different question:

- **EBM:** _How should this be done?_
- **Policy:** _What constraints must be respected?_
- **Authority:** _Who may approve or perform this action?_
- **Obligation:** _What commitments remain outstanding?_
- **Governance:** _May this state transition occur now?_

I think this is one of the strongest aspects of the architecture because each concept has a single responsibility and they compose cleanly. It also reinforces another pattern that has emerged repeatedly: the platform is overwhelmingly **declarative**. Packs declare behaviour, policies declare constraints, authority declares permissions, obligations declare commitments, and the Runtime Kernel interprets those declarations. This declarative-first architecture should make the platform significantly easier to extend and customise without modifying its core.

-------------------

One addition, prompted by checking this chapter against Book 1's Governance entity directly. Book 1 splits Governance into two components: **Policy** (a mandatory constraint) and **Standard** (a preferred convention, not mandatory). I considered giving Standard its own chapter, but on inspection it would duplicate this one almost field for field — same Category, Applicability, Conditions, Required Evidence, Exception Rules, Version, Originating Pack, evaluated the same way, composed from Packs the same way. The only real difference is enforcement strength, which is exactly the kind of thing this platform already handles with an attribute rather than a second entity elsewhere (Quality Gate unifies four traditionally-separate gate concepts the same way; Obligation unifies four traditionally-separate commitment concepts the same way).

So Policy absorbs Standard as a **Constraint Type**: a Policy declares itself as Constraint Type "Policy" (mandatory — violation blocks the governed transition) or Constraint Type "Standard" (preferred — deviation does not block, but remains visible and traceable). This is deliberately a different axis from **Severity**, which this chapter already defines: Severity says how much a violation matters: Constraint Type says whether a violation blocks anything at all. A Standard can be high-severity (worth surfacing prominently) without ever blocking a transition; a low-severity Policy still blocks. Collapsing the two would lose a real distinction, so both fields stay.
]

---

# 1. Purpose

The Policy Model defines how engineering constraints, organisational rules and governance directives are represented, composed and evaluated within a Software Engineering Unit (SEU).

Policies express **what conditions must be satisfied** before governed engineering actions may proceed.

A Policy's Constraint Type determines whether it behaves as a mandatory constraint or a preferred convention (§8, §11). Both are represented as Policies; only their enforcement differs.

Policies do not execute engineering work.

Policies do not grant authority.

Policies do not perform reviews.

Policies declare engineering constraints that are interpreted by the Governance Model.

---

# 2. Scope

This chapter defines:

- Policy abstraction;
- Policy lifecycle;
- Policy composition;
- Policy evaluation;
- Policy relationships;
- Policy applicability.

This chapter does not define:

- authority assignments;
- review execution;
- compliance frameworks;
- engineering behaviour.

---

# 3. Architectural Position

```
Engineering Behavior Model
            │
            ▼
       Policy Model
            │
            ▼
 Governance Evaluation
            │
            ▼
Engineering State Transition
```

Policies influence governance decisions.

They do not perform governance.

---

# 4. Definition

A Policy is a declarative statement describing engineering constraints that govern engineering activities within an SEU.

Policies specify:

- conditions;
- applicability;
- expected outcomes;
- permitted exceptions;
- Constraint Type.

Every Policy declares a Constraint Type of either **Policy** (mandatory: violation blocks the governed transition) or **Standard** (preferred: deviation does not block, but remains traceable and may still be surfaced through Engineering Telemetry).

Policies never directly modify engineering state.

---

# 5. Architectural Principles

## PM-001

Policies are declarative.

---

## PM-002

Policies are composable.

---

## PM-003

Policies are independently versioned.

---

## PM-004

Policies are traceable.

---

## PM-005

Policies are context-sensitive.

---

## PM-006

Policies remain independent of Participant implementations.

---

## PM-007

Every Policy shall declare a Constraint Type. Constraint Type is independent of Severity: one determines whether a violation blocks a transition, the other determines how much it matters.

---

# 6. Functional Requirements

### FR-24.1

Every Policy shall possess a globally unique identifier.

---

### FR-24.2

Policies shall be contributed through Packs.

---

### FR-24.3

Policies shall support composition from multiple organisations.

---

### FR-24.4

Policies shall be evaluated during governance evaluation.

---

### FR-24.5

Policy evaluations shall remain fully traceable.

---

### FR-24.6

Policies shall support explicit exceptions.

---

### FR-24.7

Policy conflicts shall be detected.

---

### FR-24.8

Every Policy shall declare a Constraint Type of either Policy or Standard.

---

### FR-24.9

Governance evaluation shall block a governed transition on violation of a Constraint Type "Policy" and shall not block on deviation from a Constraint Type "Standard."

---

# 7. Policy Categories

Illustrative categories include:

## Engineering Policies

Examples:

- Architecture documentation required.
- Unit test coverage threshold.
- Coding standards.

---

## Security Policies

Examples:

- Encryption required.
- Secrets management.
- Dependency vulnerability thresholds.

---

## Quality Policies

Examples:

- Code review mandatory.
- Static analysis required.
- Performance validation.

---

## Operational Policies

Examples:

- Deployment approval required.
- Backup validation.
- Rollback capability.

---

## Documentation Policies

Examples:

- ADR required.
- API documentation mandatory.
- Operational runbook required.

---

## Customer Policies

Examples:

- Customer sign-off required.
- Business approval required.
- Release notification.

---

## Organisation Policies

Examples:

- Internal review process.
- Change management.
- Engineering standards.

Additional policy categories may be introduced through Packs.

---

# 8. Policy Structure

Every Policy shall define:

- Identifier
- Name
- Description
- Category
- Constraint Type (Policy or Standard)
- Applicability
- Conditions
- Required Evidence
- Related Obligations
- Exception Rules
- Severity
- Version
- Originating Pack

Constraint Type and Severity are independent fields. Constraint Type determines whether a violation blocks a governed transition. Severity determines how significant a violation or deviation is, regardless of whether it blocks anything.

The internal policy language is implementation-defined.

---

# 9. Policy Applicability

Policies may apply according to:

- Deliverable category;
- Deliverable lifecycle state;
- Capability;
- Engineering stage;
- Organisation;
- Domain;
- Technology;
- Environment;
- Compliance requirement.

Applicability shall be evaluated dynamically.

---

# 10. Policy Composition

Policies may originate from multiple Packs.

Example:

```
Platform Policy Pack

        +

TCS Engineering Pack

        +

Customer Engineering Pack

        +

HIPAA Compliance Pack

        ↓

Effective Policy Set
```

Composition shall preserve deterministic behaviour.

Conflicts shall be detected and resolved according to Governance rules.

---

# 11. Policy Evaluation

Policies shall be evaluated whenever a governed engineering action is requested.

Policy evaluation shall determine:

- applicable policies;
- satisfied conditions;
- violated conditions;
- required evidence;
- required obligations;
- applicable exceptions.

Where a violated condition belongs to a Constraint Type "Policy," the governed transition shall be blocked pending resolution or an approved exception.

Where a violated condition belongs to a Constraint Type "Standard," the governed transition shall proceed. The deviation shall remain fully traceable and shall be surfaced through Engineering Telemetry (Chapter 35) rather than blocking execution.

Evaluation shall not itself change engineering state.

---

# 12. Policy Exceptions

Policies may define explicit exception mechanisms.

An exception shall specify:

- justification;
- approving authority;
- duration;
- scope;
- review requirements.

Exceptions apply to Constraint Type "Policy" violations, since only these block a governed transition. A Constraint Type "Standard" deviation does not require a formal exception to proceed, as it was never blocking; it remains traceable through Policy Traceability (§14) regardless.

Exceptions shall remain fully traceable.

---

# 13. Policy Lifecycle

Policies shall progress through the following lifecycle.

```
Draft

↓

Validated

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

Historical Policies shall remain available for engineering reconstruction.

---

# 14. Policy Traceability

Every Policy evaluation shall preserve:

- Policy identifier;
- originating Pack;
- Engineering Behavior Model version;
- applicable Deliverables;
- applicable Decisions;
- evaluation outcome;
- timestamp;
- rationale.

Policy history shall be immutable.

---

# 15. Events

The Policy subsystem shall publish:

- PolicyCreated
- PolicyValidated
- PolicyPublished
- PolicyApplied
- PolicyViolated
- PolicyExceptionRequested
- PolicyExceptionApproved
- PolicyRetired

---

# 16. Non-Functional Requirements

The Policy Model shall:

- support deterministic evaluation;
- support composition;
- preserve traceability;
- support versioning;
- remain independent of implementation technologies.

---

# 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Policies are declarative.

✓ Policies are composable.

✓ Policy evaluations are traceable.

✓ Policy conflicts are detected.

✓ Exceptions are explicitly governed.

✓ Historical Policy versions remain reproducible.

✓ Constraint Type "Policy" violations block the governed transition; Constraint Type "Standard" deviations do not.

---

# 18. Deliverables

Implementation of this chapter shall produce:

- Policy domain model.
- Policy registry.
- Policy evaluation service.
- Policy composition service.
- Exception management service.
- Policy APIs.
- Policy events.