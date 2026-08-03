
# Chapter 27 – Compliance Model

[Sudha: I think the Governance section should end with **Compliance**.

Not because compliance is the most important governance concept, but because it is the **composition** of everything we've already defined.

Think about what a compliance requirement actually is.

Take HIPAA.

It is **not** simply a checklist.

It is actually a Pack that contributes:

- Policies
- Authority rules
- Quality Gates
- Reviews
- Obligations
- Evidence requirements
- Terminology
- Traceability requirements

Likewise, SOX, ISO 27001, PCI-DSS and CMMI.

This means Compliance isn't another independent governance object.

It is a **governance profile** composed from the governance primitives we've already defined.

I think this is a significant architectural insight.

------------

While writing this chapter, I realised we've completed what I think is a very elegant governance architecture.

Notice that Compliance introduced **almost no new primitives**.

Instead, it composes the primitives we've already defined.

That is a sign of a mature architecture.

If we step back, the Governance layer now looks like this:

```
Governance
     │
     ├── Authority
     ├── Policies
     ├── Reviews
     ├── Findings
     ├── Obligations
     ├── Quality Gates
     └── Compliance
```

Every one of these concepts has a single responsibility, and together they answer the fundamental governance question:

> **"May this engineering state transition occur?"**

I think we've now completed the governance architecture without introducing unnecessary overlap.
]


---

# 1. Purpose

The Compliance Model defines how regulatory, contractual, organisational and industry-specific compliance requirements are represented, composed, evaluated and demonstrated within a Software Engineering Unit (SEU).

Compliance is achieved through the coordinated application of governance primitives, including Policies, Authority, Reviews, Quality Gates, Obligations and Evidence.

Compliance is therefore an emergent capability of the platform rather than an isolated subsystem.

---

# 2. Scope

This chapter defines:

- Compliance abstraction;
- Compliance composition;
- Compliance evaluation;
- Compliance evidence;
- Compliance reporting;
- Compliance traceability.

This chapter does not define:

- individual regulatory frameworks;
- legal interpretations;
- external audit methodologies;
- organisation-specific governance rules.

These are contributed through Packs.

---

# 3. Architectural Position

```
Compliance Packs
        │
        ▼
Engineering Behavior Model
        │
──────────────
        │
Policies
Authority
Reviews
Quality Gates
Obligations
Evidence
        │
──────────────
        ▼
Compliance Evaluation
        │
        ▼
Compliance Status
```

Compliance is evaluated from the combined governance model.

---

# 4. Definition

Compliance is the demonstrable satisfaction of applicable governance requirements within an SEU.

Compliance is not represented by a single object.

It is the evaluated outcome of multiple governance components operating together.

---

# 5. Architectural Principles

## CM-001

Compliance is declarative.

---

## CM-002

Compliance is composable.

---

## CM-003

Compliance is evidence-based.

---

## CM-004

Compliance is continuously evaluated.

---

## CM-005

Compliance shall remain fully traceable.

---

## CM-006

Compliance shall remain independent of specific regulatory frameworks.

---

# 6. Functional Requirements

### FR-27.1

Compliance requirements shall be contributed through Packs.

---

### FR-27.2

The platform shall support multiple compliance frameworks simultaneously.

---

### FR-27.3

Compliance evaluation shall be deterministic.

---

### FR-27.4

Compliance shall be evaluated continuously throughout the SEU lifecycle.

---

### FR-27.5

Compliance evidence shall remain traceable.

---

### FR-27.6

Compliance status shall be reproducible for any historical point in time.

---

### FR-27.7

Compliance conflicts shall be detected and reported.

---

# 7. Compliance Sources

Compliance requirements may originate from:

- Regulatory Packs
- Customer Packs
- Organisation Packs
- Industry Standard Packs
- Internal Governance Packs

Multiple compliance sources may coexist within a single SEU.

---

# 8. Compliance Components

Compliance Packs may contribute:

- Policies
- Authority Rules
- Review Requirements
- Quality Gates
- Obligations
- Evidence Requirements
- Traceability Requirements
- Ontology Concepts
- Reporting Requirements

Compliance therefore composes existing architectural concepts rather than introducing new ones.

---

# 9. Compliance Evaluation

Compliance evaluation shall determine:

- applicable requirements;
- satisfied requirements;
- outstanding obligations;
- missing evidence;
- failed reviews;
- applicable waivers;
- residual compliance risks.

Evaluation shall not directly modify engineering state.

---

# 10. Compliance Status

The platform shall determine one of the following compliance states:

- Compliant
- Compliant with Exceptions
- Partially Compliant
- Non-Compliant
- Compliance Unknown

Status shall include supporting rationale.

---

# 11. Compliance Evidence

Compliance evidence shall reference:

- Reviews;
- Deliverables;
- Decisions;
- Policies;
- Quality Gates;
- Obligations;
- Evidence Items;
- Traceability records.

Evidence shall support external verification.

---

# 12. Compliance Reporting

The platform shall support generation of compliance reports.

Reports may include:

- applicable compliance frameworks;
- satisfied requirements;
- outstanding findings;
- unresolved obligations;
- waivers;
- supporting evidence;
- audit trail.

Reports are derived from engineering state rather than maintained separately.

---

# 13. Compliance Traceability

Every compliance determination shall preserve:

- applicable framework;
- contributing Packs;
- supporting Policies;
- supporting Reviews;
- supporting Evidence;
- related Deliverables;
- applicable Authority;
- timestamp.

Compliance history shall remain immutable.

---

# 14. Compliance Lifecycle

Compliance requirements shall progress through:

```
Defined

↓

Composed

↓

Evaluated

↓

Satisfied

↓

Superseded

↓

Archived
```

Historical compliance evaluations shall remain reproducible.

---

# 15. Events

The Compliance subsystem shall publish:

- ComplianceEvaluated
- ComplianceSatisfied
- ComplianceViolationDetected
- ComplianceWaiverGranted
- ComplianceStatusChanged
- ComplianceReportGenerated

---

# 16. Non-Functional Requirements

The Compliance Model shall:

- support simultaneous compliance frameworks;
- preserve deterministic evaluation;
- support historical reconstruction;
- maintain complete traceability;
- remain independent of regulatory implementation details.

---

# 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Multiple compliance frameworks can coexist.

✓ Compliance is continuously evaluated.

✓ Compliance is supported by traceable evidence.

✓ Compliance reports are generated from engineering state.

✓ Historical compliance status can be reconstructed.

✓ Compliance remains independent of Participant implementations.

---

# 18. Deliverables

Implementation of this chapter shall produce:

- Compliance domain model.
- Compliance evaluation service.
- Compliance reporting service.
- Compliance status registry.
- Compliance APIs.
- Compliance events.
- Compliance traceability services.
- 


[Sudha: 
## Before moving to Part V

I would, however, propose one additional ADR that has emerged implicitly across the Governance chapters:

> **ADR – Governance by Composition**

**Decision:** Governance capabilities shall be composed from declarative primitives (Policies, Authority, Reviews, Quality Gates, Obligations and Evidence) contributed through Packs. New governance frameworks shall be implemented by composition rather than by introducing new governance mechanisms into the Runtime Kernel.

This ADR reinforces one of the platform's most important architectural principles: **extend behaviour through composition, not modification**.

With this chapter complete, I believe the entire Governance architecture is internally consistent and stable. The next major section can now shift from **"How the SEU is governed"** to **"How the SEU is operated"**—covering runtime services such as state management, eventing, execution planning, observability, notifications, integrations and operational management. That will effectively describe the Runtime Kernel itself.
]