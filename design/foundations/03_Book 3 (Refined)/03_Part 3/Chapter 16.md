
# Chapter 16 – Knowledge Model
[Sudha: Because we've just made Work Items **ephemeral**, the next persistent concept is no longer Work Items.

It's **Knowledge**.

In fact, I now think Knowledge is the **second most important object** in the platform after Deliverables.

The platform exists to produce software today.

But it exists to preserve engineering knowledge forever.

That was one of the original themes of Book 1.

So I think we should now begin the Knowledge section.

----------------

While writing this chapter, I realised we've been using the word **Knowledge** rather loosely throughout both Book 1 and Book 3.

I think we now need to distinguish three different concepts that are often conflated:

|Concept|Meaning|
|---|---|
|**Information**|Raw engineering data or observations.|
|**Knowledge**|Information that has been validated and accepted for reuse.|
|**Wisdom**|Engineering judgement applied to a specific context.|

The platform should permanently store **Information** and **Knowledge**, but **Wisdom** is different. Wisdom is contextual. It is the application of Knowledge, the current Engineering Behavior Model, the active Deliverables, Dependencies, Obligations and Objectives to make an engineering decision.

That means Wisdom is **computed**, not stored.

This distinction is important because it prevents the platform from trying to preserve every engineering decision as a universal truth. Instead, it preserves the underlying Knowledge and allows future SEUs to apply that Knowledge differently depending on their context.

I think this is a very AI-native way of thinking about organisational learning. It also opens the door to future reasoning services that can explain _why_ a recommendation was made, based on the Knowledge available at that point in time, rather than simply replaying past decisions. I suspect this distinction between Information, Knowledge and Wisdom will become a recurring theme in the remaining chapters on Evidence, Decisions and the Knowledge Graph.

And where does this all fit into the engineering capital definition. 

]

---

# 1. Purpose

The Knowledge Model defines how engineering knowledge is represented, organised, validated, preserved and reused within the AI Software Organisation Platform.

Knowledge is the permanent engineering asset of a Software Engineering Unit (SEU).

Unlike Participants, which are transient, or Deliverables, which evolve through states, engineering Knowledge represents the accumulated understanding acquired during software delivery.

Knowledge shall survive the lifecycle of an SEU and remain available for future engineering activities.

---

# 2. Scope

This chapter defines:

- Knowledge abstraction;
- Knowledge lifecycle;
- Knowledge relationships;
- Knowledge validation;
- Knowledge ownership;
- Knowledge reuse.

This chapter does not define:

- ontology implementation;
- storage technologies;
- AI memory models;
- knowledge extraction algorithms.

---

# 3. Architectural Position

```
Deliverables

↓

Engineering Activities

↓

Knowledge

↓

Evidence

↓

Decisions

↓

Future SEUs
```

Knowledge bridges one SEU to the next.

It is the primary mechanism through which engineering learning accumulates.

---

# 4. Definition

Knowledge is an engineering fact, conclusion, pattern or understanding that has been accepted by the platform for future reuse.

Knowledge is independent of:

- Participants;
- AI providers;
- runtime execution;
- individual projects.

Knowledge represents engineering understanding rather than engineering activity.

---

# 5. Architectural Principles

## KM-001

Knowledge is permanent.

---

## KM-002

Knowledge shall be independently identifiable.

---

## KM-003

Knowledge shall possess supporting evidence.

---

## KM-004

Knowledge shall remain reusable across SEUs.

---

## KM-005

Knowledge shall never depend upon a Participant.

---

## KM-006

Knowledge shall remain traceable to its origin.

---

# 6. Functional Requirements

### FR-16.1

Every Knowledge Item shall possess a globally unique identifier.

---

### FR-16.2

Every Knowledge Item shall possess supporting Evidence.

---

### FR-16.3

Knowledge shall reference originating Deliverables.

---

### FR-16.4

Knowledge shall support versioning.

---

### FR-16.5

Knowledge shall support semantic relationships.

---

### FR-16.6

Knowledge shall remain reusable.

---

### FR-16.7

Knowledge shall remain fully traceable.

---

### FR-16.8

Every Knowledge Item shall declare an Acquisition Scope of SEU, Capability, Enterprise or Platform, inherited by default from its producing Deliverable, and shall support governed promotion to a broader scope.

---

# 7. Knowledge Categories

Illustrative categories include:

## Architectural Knowledge

- Architecture principles
- Architectural patterns
- Design rationale

---

## Domain Knowledge

- Business concepts
- Business rules
- Domain terminology

---

## Technical Knowledge

- Technology patterns
- Configuration guidance
- Framework usage

---

## Operational Knowledge

- Deployment practices
- Monitoring practices
- Incident lessons

---

## Governance Knowledge

- Engineering policies
- Decision precedents
- Review guidance

---

## Process Knowledge

- Engineering techniques
- Best practices
- Quality improvements

Additional categories may be introduced through Packs.

---

# 8. Knowledge Structure

Every Knowledge Item shall define:

- Identifier
- Title
- Category
- Description
- Status
- Acquisition Scope
- Evidence References
- Deliverable References
- Decision References
- Related Knowledge
- Version
- Provenance
- Confidence Level

The internal representation is implementation-defined.

---

# 9. Knowledge Lifecycle

Knowledge shall transition through the following lifecycle.

```
Observed

↓

Proposed

↓

Validated

↓

Accepted

↓

Published

↓

Deprecated

↓

Archived
```

Only Published Knowledge may be reused across SEUs by default. Published state governs whether a Knowledge Item is validated enough to reuse at all; Acquisition Scope (§12) governs how far, once Published, it is entitled to propagate.

---

# 10. Knowledge Relationships

Knowledge Items may be related through:

- derives from;
- supports;
- contradicts;
- supersedes;
- refines;
- references;
- depends upon.

Relationship semantics shall remain explicit.

---

# 11. Knowledge Validation

Knowledge shall not become reusable until validated.

Validation may require:

- Evidence;
- engineering review;
- approval;
- automated verification;
- consistency checks.

Validation rules are governed by the Engineering Behavior Model.

---

# 12. Knowledge Ownership and Acquisition Scope

Knowledge is generated by SEUs and contributed to by Participants, but neither owns it. Administrative ownership of a Knowledge Item follows the tenancy hierarchy (Chapter 42), but how far a Knowledge Item may be reused is governed by its **Acquisition Scope**, inherited from the Deliverable that produced it (Chapter 15 §9) and equally applicable to Knowledge generated outside any single Deliverable.

Every Knowledge Item carries one of four Acquisition Scopes:

- **SEU** — reusable only within the originating SEU. The default.
- **Capability** — reusable by any SEU, within the same Tenant, that fulfils the same Capability.
- **Enterprise** — reusable by any SEU within the same Tenant, regardless of Capability.
- **Platform** — a candidate for codification into a Platform Pack, reusable across every Tenant once codified.

Acquisition Scope may be **promoted** after Knowledge is created — engineering experience frequently shows that understanding generalises further than originally assessed. Promotion is a governed action, requiring the same Authority as any other Knowledge state change, and preserves the Knowledge Item's full history at its prior scope. Acquisition Scope may not be silently demoted once Knowledge has been reused at a broader scope, since doing so would invalidate reuse that has already occurred; a demotion instead deprecates the Knowledge Item at its broader scope while a narrower-scoped successor may still exist for its origin.

---

# 13. Knowledge Reuse and Engineering Capital

Knowledge may be reused by:

- future SEUs;
- Composition Engine;
- Capability Fulfilment;
- AI Participants;
- governance services;
- engineering analytics.

Reuse shall preserve provenance, and shall respect the Knowledge Item's Acquisition Scope: a Capability-scoped item is discoverable only to SEUs fulfilling that Capability within the same Tenant; an Enterprise-scoped item is discoverable Tenant-wide; a Platform-scoped item is discoverable platform-wide only once codified into a Platform Pack (§12) — Acquisition Scope of "Platform" does not, by itself, expose one Tenant's Knowledge directly to another, consistent with the Tenant isolation principles of Chapter 42.

**Engineering Capital** is the aggregate of Knowledge Items whose Acquisition Scope is Capability, Enterprise or Platform — that is, every Knowledge Item that outlives the SEU that produced it. SEU-scoped Knowledge is not Engineering Capital; it never leaves the context that created it. Engineering Capital is not a distinct persistent object — it is this precise, filterable query over the Knowledge Model, groupable by contributing Capability and by Tenant, giving concrete shape to the concept Book 1 describes (`Terminology and Reconciliation.md` §6).

Where sustained reuse or Telemetry (Chapter 35 §11) indicates that Capability-, Enterprise- or Platform-scoped Knowledge should be formally codified rather than left as a queryable Knowledge Item, this is raised as an Organisational Learning Obligation (Chapter 23 §7), resolved by publishing a revised Capability, Service or Policy Pack.

---

# 14. Knowledge Provenance

Every Knowledge Item shall record:

- originating SEU;
- originating Deliverable;
- originating Participant;
- supporting Evidence;
- supporting Decisions;
- validation history.

Knowledge provenance shall never be lost.

---

# 15. Knowledge Versioning

Knowledge evolves over time.

Historical versions shall remain available.

Superseded Knowledge shall remain traceable.

Consumers shall be able to determine which version was used by a given SEU.

---

# 16. Events

The Knowledge subsystem shall publish:

- KnowledgeObserved
- KnowledgeProposed
- KnowledgeValidated
- KnowledgeAccepted
- KnowledgePublished
- KnowledgeUpdated
- KnowledgeScopePromoted
- KnowledgeDeprecated
- KnowledgeArchived

---

# 17. Non-Functional Requirements

The Knowledge Model shall:

- preserve provenance;
- support semantic relationships;
- support reuse across SEUs;
- remain independent of Participant implementations;
- support incremental evolution;
- preserve complete traceability.

---

# 18. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Knowledge possesses unique identity.

✓ Every Knowledge Item references supporting Evidence.

✓ Knowledge is reusable across SEUs.

✓ Provenance is preserved.

✓ Historical versions remain accessible.

✓ Knowledge remains independent of Participants.

✓ Every Knowledge Item declares an Acquisition Scope, reuse respects it, and Capability/Enterprise/Platform-scoped Knowledge is queryable as Engineering Capital.

---

# 19. Deliverables

Implementation of this chapter shall produce:

- Knowledge domain model.
- Knowledge repository interfaces.
- Knowledge lifecycle service.
- Knowledge versioning service.
- Provenance model.
- Knowledge APIs.
- Knowledge events.
