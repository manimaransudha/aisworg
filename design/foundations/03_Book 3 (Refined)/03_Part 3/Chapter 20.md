# Chapter 20 – Traceability Model
[Sudha: The **Knowledge section is almost complete**.

We have defined:

- Knowledge
- Evidence
- Ontology
- Decisions

There is one remaining concept that Book 1 repeatedly emphasised and that underpins the entire platform:

> **Traceability**

Originally, I thought Traceability was a reporting feature.

I now think it's much more fundamental.

Traceability is the **thread that connects every persistent object** in the platform.

Without it:

- the Trust Pipeline breaks,
- explainability disappears,
- governance becomes impossible,
- knowledge reuse becomes unreliable.

I would therefore make Traceability the final chapter of the Knowledge section.

----------------

While writing this chapter, I realised that we've actually defined something much richer than traditional traceability.

Traditional Application Lifecycle Management (ALM) tools treat traceability as **links**:

- Requirement → Design → Code → Test.

Your platform treats traceability as an **engineering graph**.

Every persistent object we've introduced—

- Templates,
- Profiles,
- Packs,
- Engineering Behavior Models,
- Deliverables,
- Knowledge,
- Evidence,
- Decisions,
- Ontology Concepts,
- Obligations—

becomes a node in that graph.

Relationships themselves become governed engineering objects with identity, provenance and lifecycle.

I think this has a profound implication.

The platform's primary datastore should probably not be thought of as "documents" or "records". Conceptually, it is an **Engineering Knowledge Graph**.

That doesn't mean we must implement it using a graph database such as Neo4j. That's an implementation decision. But architecturally, every persistent object and every relationship forms part of a single connected engineering graph.

I would therefore propose one final ADR for the Knowledge architecture:

> **ADR – Engineering Knowledge Graph**

**Decision:** The platform shall treat all persistent engineering objects and their relationships as a single logical Engineering Knowledge Graph.

**Rationale:** This enables deterministic traceability, explainability, impact analysis, organisational learning and historical reconstruction without coupling the architecture to a specific persistence technology.

Personally, I think this ADR completes the Knowledge architecture. Once accepted, we have a coherent model:

**Information → Evidence → Knowledge → Decision → Deliverable**, all connected through an **Engineering Knowledge Graph**. That gives the platform a remarkably strong and consistent intellectual foundation before we move into the Governance section.
]
---

# 1. Purpose

The Traceability Model defines how relationships between engineering artefacts are established, preserved and queried throughout the lifecycle of a Software Engineering Unit (SEU).

Traceability enables the platform to explain how engineering outcomes were produced, what knowledge supported them, which decisions influenced them and what evidence justified them.

Traceability is a permanent engineering asset.

It shall survive the lifecycle of individual Participants and SEUs.

---

# 2. Scope

This chapter defines:

- traceability abstraction;
- traceability relationships;
- traceability lifecycle;
- provenance;
- impact analysis;
- explainability.

This chapter does not define:

- reporting tools;
- graph database implementation;
- visualisation technologies;
- search implementation.

---

# 3. Architectural Position

```
Deliverables

Knowledge

Evidence

Decisions

Obligations

Participants

Engineering Behavior Model

↓

Traceability Model

↓

Engineering Explainability
```

Traceability spans every persistent architectural concept.

---

# 4. Definition

Traceability is the explicit recording of relationships between engineering artefacts.

Every significant engineering object shall participate in the Traceability Model.

Traceability shall be established automatically wherever practical.

Manual traceability shall remain supported where automation is not possible.

---

# 5. Architectural Principles

## TM-001

Traceability is intrinsic.

It shall not depend upon manual documentation.

---

## TM-002

Relationships are first-class engineering objects.

---

## TM-003

Traceability shall be preserved throughout the engineering lifecycle.

---

## TM-004

Every significant engineering decision shall be explainable.

---

## TM-005

Historical traceability shall never be lost.

---

## TM-006

Traceability shall remain independent of implementation technologies.

---

# 6. Functional Requirements

### FR-20.1

Every persistent engineering object shall possess traceable identity.

---

### FR-20.2

Relationships shall possess unique identifiers.

---

### FR-20.3

Traceability shall support forward navigation.

---

### FR-20.4

Traceability shall support backward navigation.

---

### FR-20.5

The platform shall support impact analysis.

---

### FR-20.6

The platform shall preserve historical relationships.

---

### FR-20.7

Relationship provenance shall remain permanently available.

---

# 7. Traceability Objects

The following objects shall participate in traceability.

- Deliverables
- Knowledge
- Evidence
- Decisions
- Obligations
- Engineering Behavior Models
- Packs
- Templates
- Profiles
- Ontology Concepts
- Participants
- Capabilities

Future architectural objects shall participate by default.

---

# 8. Relationship Types

Illustrative relationships include:

## Produces

Capability → Deliverable

---

## Supports

Evidence → Knowledge

Knowledge → Decision

Decision → Deliverable

---

## References

Deliverable → Knowledge

Deliverable → Evidence

Decision → Ontology Concept

---

## Depends Upon

Deliverable → Deliverable

Obligation → Deliverable

Knowledge → Evidence

---

## Governs

Engineering Behavior Model → Deliverable

Pack → Behaviour

Policy → Decision

---

## Supersedes

Version relationships.

Additional relationship types may be introduced through Packs.

---

# 9. Traceability Lifecycle

Relationships shall transition through:

```
Created

↓

Validated

↓

Active

↓

Superseded

↓

Archived
```

Relationship history shall remain permanently available.

---

# 10. Provenance

Every relationship shall preserve provenance.

Provenance includes:

- originating SEU;
- originating Deliverable;
- originating Participant;
- timestamp;
- originating Decision;
- Engineering Behavior Model version.

Traceability shall support complete engineering reconstruction.

---

# 11. Explainability

The platform shall explain any significant engineering outcome.

Examples include:

- Why was this Deliverable approved?
- Why was this technology selected?
- Why was this obligation closed?
- Why did this dependency become satisfied?
- Why was this capability fulfilled by a particular Participant?

Explainability shall be generated from traceability rather than reconstructed from logs.

---

# 12. Impact Analysis

The platform shall support impact analysis.

Examples include:

- Which Deliverables depend upon this Decision?
- Which Knowledge Items use this Evidence?
- Which SEUs reuse this Knowledge?
- Which Decisions become invalid if this Evidence changes?

Impact analysis shall operate across the complete engineering graph.

---

# 13. Historical Reconstruction

The platform shall support reconstruction of engineering state at any point in time.

Historical reconstruction shall include:

- Deliverable state;
- Engineering Behavior Model version;
- Ontology version;
- Knowledge version;
- Decision version;
- Evidence version;
- active Obligations.

This capability is essential for audits, incident analysis and organisational learning.

---

# 14. Traceability Queries

The platform shall support queries including:

- Explain this Deliverable.
- Show the decisions supporting this architecture.
- Show evidence supporting this knowledge.
- Show all downstream impacts.
- Show engineering lineage.
- Show Pack contributions.

The query mechanism is implementation-defined.

---

# 15. Events

The Traceability subsystem shall publish:

- RelationshipCreated
- RelationshipValidated
- RelationshipUpdated
- RelationshipSuperseded
- RelationshipArchived
- TraceabilityQueryExecuted

---

# 16. Non-Functional Requirements

The Traceability Model shall:

- support large engineering graphs;
- preserve historical relationships;
- support deterministic explainability;
- support efficient impact analysis;
- remain independent of storage technologies.

---

# 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Every persistent engineering object participates in traceability.

✓ Relationships possess independent identity.

✓ Historical reconstruction is possible.

✓ Explainability is derived from traceability.

✓ Impact analysis operates across the engineering graph.

✓ Relationship provenance is preserved.

---

# 18. Deliverables

Implementation of this chapter shall produce:

- Traceability domain model.
- Relationship registry.
- Provenance service.
- Impact analysis service.
- Historical reconstruction service.
- Traceability APIs.
- Traceability events.

---

# 19. Implementation Status & Gaps

Code-verified audit (2026-08-22), not from memory — every claim below carries a file:line citation, cross-checked against a live query against the running Postgres instance (`aisworg` DB).

**Headline finding: there is no dedicated Traceability subsystem.** No `traceabilityDB.ts` module, no relationship-registry table, no relationship-lifecycle engine. What exists instead: a real but narrow query surface (`src/routes/seu/core/traceability.ts`'s `explainDeliverable`/`impactOfDeliverable`, exposed at `GET /deliverables/:id/traceability`, tested in `tests/traceability.test.ts`) scoped **only to Deliverables**; and everywhere else, "traceability" is whatever plain FK columns each entity's own module happened to add (`decisions.knowledge_id`, `obligations.related_object_id`, `knowledge_items.evidence_id`, etc.). One real junction table with its own row identity exists (`evidence_relationships`), but it carries no type/state/provenance beyond a timestamp. This is the largest gap between chapter-claim and dedicated code of any chapter audited this session — the sections below document what real, narrower mechanisms substitute for the chapter's design, not a parallel dedicated subsystem.

Most relevant to the redesign question that prompted this round of audits: **§8's Relationship Types have no vocabulary at all**, Ontology-backed or otherwise — not degraded, not partial, genuinely absent. The one real Pack-attribution precedent on the platform, `ontology_concepts.contributed_by_pack`, already backs 8 other `category:*` concept types (decision/evidence/knowledge/obligation/pack/policy/deliverable/event-types) but has never been extended to relationship types — building this would mean adding a new concept type to an existing, working mechanism, not inventing new plumbing.

## 19.1 ⚠️ Definition (§4)

"Every significant object shall participate" holds only informally — every entity table carries FK/related-object columns, but nothing enforces that a *new* object type must participate. "Established automatically wherever practical" holds only in the narrow sense that each entity's own `create()` bundles its relationship insert in the same transaction (e.g. `evidenceDB.create()`, `src/dblayer/evidenceDB.ts:33-61`, inserts both the `evidence` row and its `evidence_relationships` row together) — there is no generic, reflective, or trigger-driven linking engine; each entity module hand-codes its own linking.

## 19.2 ❌ Architectural Principles (TM-001–006) (§5)

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| TM-001 | Intrinsic, not manual docs | ⚠️ | True for FK-based linking (code-enforced), but bespoke per-entity code, not a platform-enforced intrinsic mechanism. |
| TM-002 | Relationships are first-class objects | ❌ (mostly) | Only `evidence_relationships` rows have independent identity; every other relationship (`decisions.knowledge_id`, `.related_object_id`, `obligations.related_object_id`, `knowledge_items.evidence_id`/`.deliverable_id`) is a plain FK column, not a separate relationship row. |
| TM-003 | Preserved throughout lifecycle | ⚠️ | FKs persist as long as the row exists; no explicit guarantee beyond ordinary persistence. |
| TM-004 | Every significant decision explainable | ⚠️ | Real only for Deliverables (`explainDeliverable`); no counterpart for Decisions/Evidence/Knowledge/Obligations. |
| TM-005 | Historical traceability never lost | ❌ | No history/version/audit/snapshot table exists anywhere in the schema — confirmed via a direct `\dt` sweep. |
| TM-006 | Independent of implementation technology | — | Architectural framing, not a code-testable claim. |

## 19.3 ⚠️ Functional Requirements (FR-20.1–7) (§6)

| FR | Verdict | Evidence |
|---|---|---|
| FR-20.1 traceable identity | ✅ (trivially) | Every table uses `id uuid DEFAULT gen_random_uuid()` across `evidence`/`decisions`/`obligations`/`knowledge_items`/`ebms`/`attestations`. |
| FR-20.2 relationships possess unique identifiers | ❌ (mostly) | `evidence_relationships.id` and `dependency_definitions.id` are real relationship IDs; but the far more common case — `decisions.knowledge_id`, `obligations.related_object_id`, `knowledge_items.evidence_id`, `evidence.originating_decision_id` — is a bare FK column with no relationship-row identity of its own. |
| FR-20.3 forward navigation | ✅ (Deliverable-only) | `impactOfDeliverable` (`traceability.ts:201-252`) walks `dependency_definitions` forward via `findBySourceName`. |
| FR-20.4 backward navigation | ✅ (Deliverable-only) | `explainDeliverable` (`traceability.ts:110-196`) resolves `dependsOn` via `findByTargetName` plus a provenance timeline. |
| FR-20.5 impact analysis | ✅ (Deliverable-only) | Same `impactOfDeliverable`, transitive BFS with a visited-set cycle guard. |
| FR-20.6 preserve historical relationships | ❌ | No relationship history anywhere — `dependency_definitions`/`evidence_relationships` hold only current state. |
| FR-20.7 relationship provenance permanently available | ❌ at relationship level | `evidence_relationships` has only `created_at`. Real provenance exists, but at the entity/state-transition level (`attestations`, `deliverable_references`), not per relationship. |

## 19.4 ⚠️ Traceability Objects — all 12 participate informally, only Deliverables have a real query surface (§7)

Every one of the chapter's 12 named objects has *some* real FK connecting it to others (Deliverables ✅ full query surface; Knowledge/Evidence/Decisions/Obligations/EBM/Packs/Templates/Profiles/Ontology Concepts/Participants/Capabilities — all ⚠️, reachable only as read-only fields nested inside `explainDeliverable`'s output, never as an independent traceable subject in their own right). None of the 12 is fully disconnected, but 11 of 12 have no dedicated trace/explain/impact function of their own.

## 19.5 ❌ Relationship Types — no vocabulary exists, Ontology-backed or otherwise (§8)

Live `SELECT DISTINCT concept_type FROM ontology_concepts` returns 15 concept types (`category:decision`, `category:evidence`, `category:knowledge`, `category:obligation`, `category:pack`, `category:policy`, `category:deliverable`, `category:event-types`, and others) — **no `category:relationship` or equivalent exists at all.** The chapter's own taxonomy (Produces/Supports/References/Depends Upon/Governs/Supersedes) is not represented in any form, structured or otherwise.

The only relationship-*type*-like field anywhere is `dependency_definitions.relationship_kind`, a hardcoded `CHECK` (`dependency`/`derivation`/`implementation`/`decomposition`) — a different vocabulary than the chapter's, scoped only to Template/Pack/Profile dependency rows, not Ontology-backed, and with no `contributed_by_pack` column of its own.

Checked against real code: Evidence→Knowledge is real but **inverted** (`knowledge_items.evidence_id`, Knowledge references Evidence, not the reverse); Knowledge→Decision (`decisions.knowledge_id`) and Decision→Deliverable (`decisions.related_object_type/id`) are real; Capability→Deliverable (Produces) is real (`deliverables.producing_capability_id`); Deliverable→Deliverable (Depends Upon) is real (`dependency_definitions`). EBM→Deliverable and Pack→Behaviour and Policy→Decision ("Governs") have **no stored edge of any kind**. "Supersedes" exists only as two isolated, unrelated instances (`evidence.supersedes_evidence_id`, `ebms.status='Superseded'`), not a general mechanism.

**"Additional relationship types may be introduced through Packs" is zero-hit aspirational** — same pattern already found for Decision/Event categories elsewhere this session. This is the section most directly relevant to the Pack-model redesign: there is currently no substrate at all for Packs to contribute relationship types. The natural fix is not new plumbing — it's a new `concept_type` (e.g. `category:relationship-type`) on the existing `ontology_concepts` mechanism, which already has Pack-attribution support (`contributed_by_pack`) sitting unused for this purpose.

## 19.6 ❌ Traceability Lifecycle — not built (§9)

No relationship/edge has its own lifecycle state — verified directly against every relationship-shaped table's schema (`evidence_relationships`, `dependency_definitions`); neither has a `status`/`state` column. The only Created→...→Archived-shaped state machines that exist belong to *entities* (`ontology_concepts.is_active`, `ebms.status`), never to a relationship row. The dead `dependency_edges.readiness_state` table (0 live rows, superseded by `dependency_definitions`) is the closest historical attempt, and it's unused.

## 19.7 ❌ Provenance — not built at the relationship level (§10)

The chapter's 6 required fields (originating SEU/Deliverable/Participant, timestamp, originating Decision, EBM version) are never captured together on a relationship row — `evidence_relationships` has only `created_at`. Real provenance exists, but one layer up: at the entity level (`evidence.originating_deliverable_id`/`.participant_id`/`.capability_id`/`.decision_id`) and at the state-transition level (`attestations`, `deliverable_references`, consumed by `explainDeliverable`'s provenance timeline) — never at the relationship/edge level the chapter specifies.

## 19.8 ⚠️ Explainability — real but narrow (§11)

`explainDeliverable` genuinely walks the graph programmatically from stored records (producing capability, dependency edges, supporting evidence/decisions/knowledge/obligations, reviews/findings, a provenance timeline) — matches the chapter's "generated from traceability, not reconstructed from logs" intent. But it answers exactly one of the chapter's 5 example questions ("why was this Deliverable approved"). "Why was this technology selected," "why was this obligation closed," "why did this dependency become satisfied," "why was this capability fulfilled by a particular Participant" have no dedicated function — only fragments reachable via generic FK lookups, not a purpose-built API.

## 19.9 ⚠️ Impact Analysis — real but narrow (§12)

`impactOfDeliverable` is a real, tested transitive-closure impact query (`tests/traceability.test.ts:75-100`) — but scoped to exactly one relationship type: "which Deliverables depend on this Deliverable." The chapter's other examples ("which Decisions become invalid if this Evidence changes," "which SEUs reuse this Knowledge," "which Knowledge Items use this Evidence") have no implementation — they'd require ad hoc SQL today, not an API call.

## 19.10 ❌ Historical Reconstruction — not built (§13)

No history/version/audit/snapshot table exists anywhere in the schema — confirmed by a direct sweep, zero matches. Consistent with the platform-wide finding elsewhere this session (Ch.29 §20.2): most entities carry no versioning at all. The only quasi-versioning found is `ebms.version` (incremented in place, no prior row retained) and `evidence.supersedes_evidence_id` (a pointer chain, not a queryable as-of reconstruction). Nothing can answer "what was the full engineering state as of date X" across Deliverable/EBM/Ontology/Knowledge/Decision/Evidence/Obligations jointly, as the chapter requires.

## 19.11 ❌ Traceability Queries — 2 of 6 real (§14)

| Named query | Verdict |
|---|---|
| Explain this Deliverable | ✅ `explainDeliverable`, `GET /deliverables/:id/traceability` |
| Show decisions supporting this architecture | ⚠️ only as a field (`supportingDecisions`) inside `explainDeliverable`'s output, not a standalone query; no "architecture" object exists to query against |
| Show evidence supporting this knowledge | ❌ no Knowledge-centric query exists |
| Show all downstream impacts | ✅ `impactOfDeliverable` |
| Show engineering lineage | ❌ — `grep -rn lineage src/` hits are unrelated Template/Pack parent-lineage comments, not a traceability query |
| Show Pack contributions | ❌ zero implementation |

## 19.12 ❌ Events — 1 of 6 named events real (§15)

Live query `SELECT DISTINCT event_type FROM events WHERE event_type ILIKE '%relationship%' OR event_type ILIKE '%traceab%'` returns exactly one type: `TraceabilityQueryExecuted` (55 live rows), published from `explainDeliverable`/`impactOfDeliverable` (`traceability.ts:175-182`, `239-246`). `RelationshipCreated`/`Validated`/`Updated`/`Superseded`/`Archived` — zero hits, both live and via source grep. 5 of the 6 named events are entirely unbuilt — a sharper collapse than the "generic transition event" pattern found elsewhere this session, since here there's no relationship-lifecycle mechanism to even generate a generic substitute from (19.6).

## 19.13 ❌ Non-Functional Requirements (§16)

| NFR | Verdict | Basis |
|---|---|---|
| support large engineering graphs | — not evaluated | No dedicated graph structure exists to stress-test (headline finding) |
| preserve historical relationships | ❌ | 19.6/19.7 — no relationship history anywhere |
| support deterministic explainability | ⚠️ | Real for Deliverables only (19.8) |
| support efficient impact analysis | ⚠️ | Real but single-relationship-type only (19.9) |
| remain independent of storage technologies | — | Architectural framing, not code-testable |

## 19.14 ❌ Acceptance Criteria (§17)

| Criterion | Verdict |
|---|---|
| Every persistent object participates in traceability | ⚠️ only via ad hoc FKs, reachable solely through a Deliverable-rooted query |
| Relationships possess independent identity | ❌ mostly false (19.3 FR-20.2) |
| Historical reconstruction is possible | ❌ 19.10 |
| Explainability is derived from traceability | ⚠️ real for Deliverables only (19.8) |
| Impact analysis operates across the engineering graph | ⚠️ real, but one relationship type only (19.9) |
| Relationship provenance is preserved | ❌ 19.7 — entity/transition-level provenance is real, relationship-level is not |

## 19.15 ❌ Deliverables — none exist as dedicated artifacts (§18)

| Named Deliverable | Real artifact? |
|---|---|
| Traceability domain model | ❌ does not exist — the "model" is the union of each entity's own FK columns |
| Relationship registry | ❌ does not exist — closest analog, `ontology_concepts`, doesn't cover relationship types (19.5) |
| Provenance service | ❌ does not exist as a service — provenance is composed inline inside `explainDeliverable` from `attestationsDB` + `deliverableReferencesDB` |
| Impact analysis service | ⚠️ exists narrowly — one function (`impactOfDeliverable`), one entity type |
| Historical reconstruction service | ❌ does not exist |
| Traceability APIs | ⚠️ exists narrowly — one endpoint, `GET /deliverables/:id/traceability` |
| Traceability events | ⚠️ exists narrowly — one event type (`TraceabilityQueryExecuted`), the other 5 named events don't exist |

## Summary — ranked

1. **[Architecture, most consequential]** No dedicated Traceability subsystem exists at all — what the chapter frames as an "Engineering Knowledge Graph" is, in practice, a Deliverable-scoped query function (`explainDeliverable`/`impactOfDeliverable`) plus scattered FK columns each entity module hand-coded independently. Every other section's gaps flow from this one fact.
2. **[Ontology / Pack-contribution — most relevant to the current redesign question]** §8's Relationship Types have zero vocabulary of any kind, Ontology-backed or otherwise — the one real Pack-attribution mechanism on the platform (`ontology_concepts.contributed_by_pack`) already backs 8 other category types but has never been extended to relationship types (19.5).
3. **[Data model]** Relationships are almost never first-class rows with their own identity — `evidence_relationships` is the one exception; everywhere else, a "relationship" is a bare FK column on the child entity, so it can't carry its own type, state, or provenance (19.2 TM-002, 19.3 FR-20.2).
4. **[Code]** No historical reconstruction mechanism exists anywhere — consistent with the platform-wide absence of versioning found elsewhere this session, but total here rather than partial (19.10).
5. **[Events]** Sharper than the usual "generic-event-instead-of-named-events" pattern found elsewhere this session: only 1 of 6 named events exists, because there's no relationship-lifecycle mechanism to generate even a generic substitute from (19.12).
6. **[Real and worth preserving]** `explainDeliverable`/`impactOfDeliverable` are genuinely well-built for their scope — tested, live-verified, generated from stored records rather than logs — and are the strongest available template for what a generalized version (covering Knowledge/Decision/Evidence/Obligation as subjects, not just Deliverable) would look like (19.8/19.9).