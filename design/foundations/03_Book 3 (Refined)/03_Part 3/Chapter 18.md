# Chapter 18 – Ontology Model


[Sudha: I think we're now approaching what I consider the **intellectual core** of the platform.

The next chapter is **not** Decisions.

It's **Ontology**.

Originally, I thought Ontology was simply another knowledge component.

I no longer believe that.

I now think the Ontology is **the language of the SEU**.

Without it:

- AI Participants use different terminology.
- Organisation Packs introduce conflicting jargon.
- Domain Packs redefine concepts.
- Knowledge becomes ambiguous.
- Evidence becomes difficult to relate.
- Deliverables lose semantic consistency.

The Ontology solves this.

It becomes the semantic foundation of the entire platform.

-------------
While writing this chapter, I realised we've reached another important architectural insight.

Originally, we viewed the Ontology as a **dictionary** for the platform. I now think that's too limited.

The Ontology should instead function as the **semantic operating system** of the SEU.

Every persistent object we've defined—

- Deliverables,
- Knowledge,
- Evidence,
- Decisions,
- Obligations,
- Capabilities,
- even the Engineering Behavior Model—

should reference **concepts**, not free-text terminology.

This has a profound benefit for the multi-organisation scenario we discussed earlier.

Suppose:

- TCS uses "Technical Design".
- IBM uses "Solution Design".
- Cigna uses "Architecture Specification".

Each Organisation Pack contributes its preferred terminology. The Ontology maps all three terms to a single semantic concept. Participants can therefore reason consistently without forcing organisations to abandon their own vocabulary.

I believe this makes the Ontology much more than a glossary. It becomes the **semantic integration layer** of the platform. Just as the Composition Engine integrates behaviour from Packs, the Ontology integrates meaning from Packs. Together, they allow multiple organisations to collaborate within a single SEU while preserving both semantic consistency and organisational identity. I think this will become one of the distinguishing architectural innovations of the platform.
]

---

# 1. Purpose

The Ontology Model defines the shared semantic vocabulary used by a Software Engineering Unit (SEU).

Its purpose is to ensure that all Participants, Deliverables, Knowledge, Evidence, Decisions and Packs operate using a common understanding of engineering concepts.

The Ontology provides the semantic foundation for the platform.

It is not merely a glossary of terms.

It defines concepts, relationships, meanings and contextual interpretations.

---

# 2. Scope

This chapter defines:

- Ontology abstraction;
- semantic concepts;
- relationships;
- terminology management;
- ontology composition;
- ontology evolution.

This chapter does not define:

- knowledge reasoning;
- natural language processing;
- storage implementation;
- graph database technologies.

---

# 3. Architectural Position

```
Platform Packs
       │
Organisation Packs
       │
Domain Packs
       │
Technology Packs
       │
       ▼
Ontology
       │
───────────────────────────
       │
Deliverables
Knowledge
Evidence
Decisions
Participants
Engineering Behavior Model
```

The Ontology provides the shared semantic model for every architectural concept.

---

# 4. Definition

An Ontology is a structured representation of engineering concepts and the relationships between those concepts.

The Ontology establishes the authoritative meaning of terms used within an SEU.

Every engineering artefact references concepts from the Ontology rather than relying upon free-form interpretation.

---

# 5. Architectural Principles

## OM-001

Every engineering concept shall possess a unique semantic identity.

---

## OM-002

Concepts shall be independent of terminology.

---

## OM-003

Multiple terms may represent the same concept.

---

## OM-004

Concept relationships shall be explicit.

---

## OM-005

Ontologies shall be composable.

---

## OM-006

Semantic consistency shall take precedence over linguistic consistency.

---

# 6. Functional Requirements

### FR-18.1

The platform shall maintain an Ontology for every commissioned SEU.

---

### FR-18.2

Concepts shall possess globally unique identifiers.

---

### FR-18.3

Every Knowledge Item shall reference one or more Ontology concepts.

---

### FR-18.4

Every Deliverable category shall reference Ontology concepts.

---

### FR-18.5

Ontology composition shall occur during EBM composition.

---

### FR-18.6

Ontology conflicts shall be detected during commissioning.

---

### FR-18.7

Ontology evolution shall preserve semantic traceability.

---

# 7. Ontology Components

The Ontology shall consist of:

## Concepts

Fundamental engineering ideas.

Examples:

- Requirement
- Service
- Capability
- Decision
- Deliverable

---

## Terms

Human-readable labels.

Examples:

- Requirement
- User Story
- Feature Specification

Different terms may reference the same concept.

---

## Definitions

Authoritative descriptions of concepts.

Definitions establish meaning independently of terminology.

---

## Relationships

Examples include:

- is-a
- part-of
- depends-on
- produces
- validates
- supersedes
- implements

---

## Constraints

Semantic rules governing valid relationships.

---

## Synonyms

Alternative names for the same concept.

Examples:

- Pull Request
- Merge Request

Both may map to the same Ontology concept.

---

## Aliases

Organisation-specific terminology.

Example:

One Organisation Pack may use "Design Review".

Another may use "Architecture Review".

Both can resolve to a common semantic concept.

---

# 8. Ontology Composition

The platform shall construct an effective Ontology by composing contributions from:

- Platform Packs;
- Organisation Packs;
- Domain Packs;
- Technology Packs;
- Compliance Packs.

Composition shall preserve semantic consistency.

---

# 9. Ontology Relationships

Relationships shall possess explicit meaning.

Illustrative relationships include:

- specialises;
- generalises;
- derives;
- validates;
- implements;
- fulfils;
- references;
- governs.

Relationship semantics shall be versioned.

---

# 10. Semantic Resolution

The platform shall resolve terminology differences between Packs.

Example:

```
TCS Pack

"Technical Design"

↓

Ontology

Solution Design Concept

↑

Client Pack

"Solution Architecture"
```

Participants therefore collaborate using concepts rather than organisation-specific vocabulary.

---

# 11. Ontology Evolution

Ontologies evolve independently of SEUs.

Evolution may include:

- new concepts;
- revised definitions;
- new relationships;
- deprecated concepts;
- merged concepts.

Historical semantic interpretations shall remain reproducible.

---

# 12. Ontology Versioning

Every Ontology shall record:

- version;
- contributing Packs;
- semantic changes;
- deprecated concepts;
- compatibility information.

Historical Ontologies shall remain available.

---

# 13. Ontology Governance

Ontology changes shall require governance.

Governance may include:

- semantic review;
- engineering review;
- domain review;
- Pack compatibility validation.

Ontology changes shall never invalidate historical engineering records.

---

# 14. Events

The Ontology subsystem shall publish:

- ConceptCreated
- ConceptUpdated
- ConceptDeprecated
- OntologyComposed
- OntologyValidated
- SemanticConflictDetected
- SemanticConflictResolved

---

# 15. Non-Functional Requirements

The Ontology Model shall:

- support semantic composition;
- support multiple vocabularies;
- preserve semantic traceability;
- remain independent of implementation technologies;
- support incremental evolution.

---

# 16. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Every concept possesses a unique semantic identity.

✓ Multiple terminologies can map to the same concept.

✓ Semantic conflicts are detected during composition.

✓ Ontology evolution preserves historical meaning.

✓ Deliverables, Knowledge and Evidence reference Ontology concepts.

✓ Organisation Packs can contribute terminology without introducing ambiguity.

---

# 17. Deliverables

Implementation of this chapter shall produce:

- Ontology domain model.
- Concept registry.
- Semantic resolution service.
- Ontology composition service.
- Ontology versioning service.
- Ontology APIs.
- Ontology events.