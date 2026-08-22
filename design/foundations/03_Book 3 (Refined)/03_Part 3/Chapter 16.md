
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

---

# 20. Implementation Status & Gaps

Code-verified audit (2026-08-22), not from memory — every claim below carries a file:line citation, cross-checked against a live query against the running Postgres instance (`aisworg` DB). Core files: `src/dblayer/knowledgeItemsDB.ts`, `src/routes/seu/core/knowledge.ts`, `src/routes/seu/api/knowledge.ts`, `KnowledgeItemRow`/`EngineeringCapitalRow` (`src/dblayer/seuTypes.ts:838-864`).

Acquisition Scope (§12) is this chapter's standout — states, transitions, default inheritance from the producing Deliverable, governed promotion, and the Organisational Learning Obligation feedback loop into Chapter 23 are all real and live-verified (103 real `Organisational Learning` obligations exist in the DB today). Everything downstream of the base record, though — semantic relationships, versioning, multi-valued provenance, most of §8's structure — is thin or absent. Most relevant to the Pack-contribution question that prompted this audit: the Knowledge category vocabulary **is** genuinely Ontology-backed (`category:knowledge`, enforced via `assertCanonicalCategory`), but Pack-to-Ontology contribution itself is a platform-wide gap, not a Knowledge-specific one — `ontology_concepts.contributed_by_pack` has zero non-null rows anywhere in the database, and the code that would consume it self-documents the gap: `core/ontology.ts:15`, "null = platform default; set when a Pack contributes a concept (**step 5, deferred**)."

## 20.1 ✅ Definition (§4)

"Independent of Participants/AI providers/runtime execution/individual projects" holds structurally — `knowledge_items` has no `participant_id` or any comparable coupling column at all (live schema); only `seu_id`/`deliverable_id`/`evidence_id` FKs exist.

## 20.2 ⚠️ Architectural Principles (KM-001–006) (§5)

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| KM-001 | Permanent | ✅ (by omission) | No delete method anywhere in `knowledgeItemsDB.ts`/`api/knowledge.ts`. |
| KM-002 | Independently identifiable | ✅ | `id UUID PK`. |
| KM-003 | Possesses supporting evidence | ⚠️ | `evidence_id` is a real FK but nullable, not enforced. |
| KM-004 | Reusable across SEUs | ⚠️ | Real Acquisition Scope + Published-gate mechanism (20.9), but "reuse" is a discoverability filter, not an actual copy-into-another-SEU operation. |
| KM-005 | Never depends on a Participant | ✅ | No `participant_id` column exists at all. |
| KM-006 | Traceable to origin | ✅ | `seu_id`/`deliverable_id` both `NOT NULL`. |

## 20.3 ⚠️ Functional Requirements (FR-16.1–8) (§6)

| FR | Verdict | Note |
|---|---|---|
| FR-16.1 unique id | ✅ | `id uuid PK DEFAULT gen_random_uuid()`. |
| FR-16.2 supporting Evidence | ⚠️ | Nullable FK, not enforced — same gap as KM-003. |
| FR-16.3 references originating Deliverables | ⚠️ singular | `deliverable_id NOT NULL` — one producing Deliverable, not the plural the chapter implies. |
| FR-16.4 supports versioning | ❌ | No `version` column, no version table anywhere (20.12). |
| FR-16.5 supports semantic relationships | ❌ | No Knowledge-to-Knowledge relationship/edge table exists anywhere in the schema (20.7). |
| FR-16.6 reusable | ⚠️ | Same as KM-004. |
| FR-16.7 fully traceable | ✅ | `seu_id`/`deliverable_id` FKs enforced. |
| FR-16.8 Acquisition Scope w/ inheritance + governed promotion | ✅ | Real `CHECK`-constrained `acquisition_scope`, default-inherited from the producing Deliverable, governed via a dedicated `KnowledgeScope` transition track — see 20.9. |

## 20.4 ⚠️ Knowledge Categories — real Ontology mechanism, wrong seed data, zero Pack contribution (§7)

`category TEXT NOT NULL`, validated via `assertCanonicalCategory("category:knowledge", input.category)` (`knowledge.ts:28`, `core/ontology.ts:45-51`) — a genuinely real, enforced Ontology write-path, not aspirational. But the live seed doesn't match the chapter at all: `ontology_concepts WHERE concept_type='category:knowledge'` returns exactly 4 rows — `Domain Knowledge`, `Technical`, `Technical Knowledge`, `Test` — none of the chapter's 6 (Architectural/Domain/Technical/Operational/Governance/Process); the migration's own comment (`030_ontology.sql:32-34`) admits these are "the de-facto vocabulary currently in use," grandfathered in, not a deliberate seeding of this chapter's taxonomy. Creating a Knowledge Item with `category: "Architectural"` today would be **rejected**.

"Additional categories may be introduced through Packs" is unbuilt, and this is the platform-wide finding this audit round was specifically checking for: live `ontology_concepts WHERE contributed_by_pack IS NOT NULL` returns **0 rows across every concept type on the platform**, not just Knowledge's. `core/ontology.ts:43-44`'s own comment confirms none of the 5 `category:*` concept types has ever had a Pack-contributed row. The `contributed_by_pack` FK column exists and is schema-ready; nothing writes to it anywhere in the codebase.

## 20.5 ❌ Knowledge Structure — few of 13 fields are clean, real columns (§8)

| Chapter field | Real column? |
|---|---|
| Identifier | ✅ `id` |
| Title | ✅ `title` |
| Category | ✅ `category` |
| Description | ✅ `description` (nullable) |
| Status | ✅ `status` |
| Acquisition Scope | ✅ `acquisition_scope` |
| Evidence References | ⚠️ singular, nullable `evidence_id` |
| Deliverable References | ⚠️ singular `deliverable_id` |
| Decision References | ⚠️ inverted — `decisions.knowledge_id` exists (the reverse FK), live 0 rows in use |
| Related Knowledge | ❌ no table (20.7) |
| Version | ❌ no column (20.12) |
| Provenance | ⚠️ implicit only via FKs, no dedicated field/table (20.11) |
| Confidence Level | ❌ no column — contrast: `evidence.confidence_level` exists for Evidence, the analogous field was never added for Knowledge |

## 20.6 ✅ Knowledge Lifecycle — states and transitions match the chapter exactly; reuse gate is narrower than stated (§9)

Live `transition_definitions WHERE entity_type='Knowledge'` returns exactly the chapter's 7-state chain: `Observed→Proposed→Validated→Accepted→Published→Deprecated→Archived`, each gated by badge `authority-transition-knowledge`, run through the same `transitionEngine.evaluate()`/`qualityGateEngine.evaluate()` pair every governed entity uses (`knowledge.ts:86-133`).

"Only Published Knowledge may be reused across SEUs by default" is enforced in exactly one place — `promoteKnowledgeItemScope()` (`knowledge.ts:158-160`) rejects promotion unless `status === "Published"` — but nowhere else: `listKnowledgeItemsBySeu`/`findEngineeringCapital` apply no status filter at all. What the code actually gates is scope-*widening*, not general read/reuse access.

## 20.7 ❌ Knowledge Relationships — wholly unimplemented (§10)

No relationship/edge table for Knowledge exists anywhere in the schema (`evidence_relationships` is Evidence-scoped, unrelated). None of the 7 named types (derives from/supports/contradicts/supersedes/refines/references/depends upon) appear in `knowledge.ts`/`knowledgeItemsDB.ts`.

## 20.8 ⚠️ Knowledge Validation — the hook is real, the content is empty (§11)

`qualityGateEngine.evaluate({entityType:"Knowledge",...})` runs on every lifecycle transition — the mechanism is real, not skipped. But live `transition_definitions.required_quality_gate_ids` for `entity_type='Knowledge'` has **zero rows with any gate attached**, and `quality_gate_evaluations WHERE entity_type='Knowledge'` is **0 rows** — no Quality Gate is actually wired to any Knowledge transition today. "Governed by the Engineering Behavior Model" doesn't hold either: `ebms` carries no reference to `knowledge_items` anywhere. The gate exists structurally; it's currently empty.

## 20.9 ✅ Knowledge Ownership and Acquisition Scope — the most-built section of this chapter (§12)

| Claim | Verdict | Evidence |
|---|---|---|
| 4 scopes (SEU/Capability/Enterprise/Platform) | ✅ | `CHECK` constraint on `acquisition_scope` |
| Default inherited from producing Deliverable | ✅ | `knowledge.ts:40` |
| Governed promotion, same Authority mechanism as any transition | ✅ | Dedicated `entityType: 'KnowledgeScope'` track — live rows `SEU→Capability`/`Capability→Enterprise`/`Enterprise→Platform`, each its own badge |
| Promotion only after Published | ✅ | `knowledge.ts:158-160` |
| No silent demotion | ✅ (structurally) | Only 3 forward transitions are seeded; any other pair returns `no_transition_definition` — no demotion code path exists to write |
| "Deprecates instead" of demoting | ⚠️ | `Published→Deprecated` exists generically, but no code path automatically deprecates a broader-scope item on an attempted demotion — the chapter's specific behavior is inferred-unreachable, not actively implemented |
| Promotion preserves prior-scope history | ⚠️ | In-place `UPDATE` (`knowledgeItemsDB.ts:72-83`) — no history table; only the `KnowledgeScopePromoted` event payload captures the transition, replayable but not queryably indexed |

## 20.10 ⚠️ Knowledge Reuse and Engineering Capital — the query is real, scope-based discovery enforcement isn't (§13)

Engineering Capital is a real, live-queryable concept, not aspirational: `knowledgeItemsDB.findEngineeringCapital()` (`knowledgeItemsDB.ts:90-110`, `WHERE acquisition_scope != 'SEU'`), exposed via `GET /knowledge/capital` and a real view (`views/seu/knowledge/capital.ejs`) — 70 live rows currently qualify. The Organisational Learning Obligation loop is real and used: `promoteKnowledgeItemScope` calls `createObligation({category:"Organisational Learning",...})` (`knowledge.ts:200-208`) — 103 such Obligations exist live.

What's not enforced: Tenant/Capability-scoped discoverability. `knowledge_items` has **no `tenant_id` column at all**, so the chapter's "Capability-scoped item is discoverable only to SEUs fulfilling that Capability within the same Tenant" cannot currently be enforced in the database — `findEngineeringCapital` has no Tenant or Capability filter.

## 20.11 ❌ Knowledge Provenance — 2 of 6 fields real, one inverted (§14)

| Provenance field | Real? |
|---|---|
| originating SEU | ✅ `seu_id` |
| originating Deliverable | ✅ `deliverable_id` |
| originating Participant | ❌ no column |
| supporting Evidence | ⚠️ singular, nullable `evidence_id` |
| supporting Decisions | ❌ inverted — only `decisions.knowledge_id` (reverse FK), live 0 rows in use |
| validation history | ❌ no dedicated table; only inferable from `events` (`KnowledgeUpdated` payload) |

## 20.12 ❌ Knowledge Versioning — not built (§15)

No `version` column, no version table, no version-pinning mechanism anywhere in the schema. "Historical Deliverables reference the version in effect at the time" is unimplementable today — consistent with the platform-wide finding elsewhere this session (Ch.29 §20.2 FR-29.2): none of the six core entities have a real versioning concept.

## 20.13 ⚠️ Events — 3 of 9 named events real (§16)

Live query confirms exactly 3 distinct event types: `KnowledgeObserved`, `KnowledgeScopePromoted`, `KnowledgeUpdated` (`knowledge.ts:45,122,184`). The other 6 (`KnowledgeProposed`/`Validated`/`Accepted`/`Published`/`Deprecated`/`Archived`) don't exist — every ordinary lifecycle transition (including Accepted→Published, Published→Deprecated, Deprecated→Archived) emits the single generic `KnowledgeUpdated` with a `{fromState,toState}` payload. `event_registry` has zero rows matching Knowledge either — none of these types are formally registered in the event catalogue. Same collapse-to-generic pattern found for Ch.15/19/29/30.

## 20.14 ⚠️ Non-Functional Requirements (§17)

| NFR | Verdict | Basis |
|---|---|---|
| preserve provenance | ⚠️ | 2/6 fields real (20.11) |
| support semantic relationships | ❌ | 20.7 — not built |
| support reuse across SEUs | ⚠️ | Real mechanism, incomplete enforcement (20.10) |
| remain independent of Participant implementations | ✅ | 20.1/KM-005 |
| support incremental evolution | ❌ | No versioning (20.12) |
| preserve complete traceability | ⚠️ | Strong for SEU/Deliverable, absent for Decisions/Participant/validation history |

## 20.15 ⚠️ Acceptance Criteria (§18)

| Criterion | Verdict |
|---|---|
| Knowledge possesses unique identity | ✅ |
| Every Knowledge Item references supporting Evidence | ⚠️ nullable, singular, not enforced |
| Knowledge is reusable across SEUs | ⚠️ real mechanism, Tenant/Capability discovery unenforced (20.10) |
| Provenance is preserved | ⚠️ 2/6 fields (20.11) |
| Historical versions remain accessible | ❌ no versioning exists (20.12) |
| Knowledge remains independent of Participants | ✅ |
| Acquisition Scope declared, reuse respects it, Engineering Capital is queryable | ✅ (20.9/20.10) — the one criterion fully satisfied as written |

## 20.16 ⚠️ Deliverables — 5 of 7 real artifacts (§19)

| Named Deliverable | Real artifact | Verdict |
|---|---|---|
| Knowledge domain model | `KnowledgeItemRow`/`EngineeringCapitalRow` (`seuTypes.ts:838-864`) | ✅ |
| Knowledge repository interfaces | `knowledgeItemsDB.ts` | ✅ |
| Knowledge lifecycle service | `core/knowledge.ts` (`transitionKnowledgeItem`, `promoteKnowledgeItemScope`) | ✅ |
| Knowledge versioning service | — | ❌ none (20.12) |
| Provenance model | — | ⚠️ implicit FKs only, no dedicated model |
| Knowledge APIs | `src/routes/seu/api/knowledge.ts` | ✅ |
| Knowledge events | `KnowledgeObserved`/`KnowledgeScopePromoted`/`KnowledgeUpdated` | ⚠️ 3 of 9 named events (20.13) |

## Summary — ranked

1. **[Data model, largest gap]** No versioning (20.12), no semantic relationships (20.7), no multi-valued provenance (20.11) — three of the chapter's most emphasized capabilities don't exist as columns/tables anywhere.
2. **[Ontology / Pack-contribution — most relevant to the current redesign question]** The Knowledge category vocabulary is genuinely Ontology-backed and enforced, but doesn't match the chapter's own 6-category taxonomy (4 ad-hoc values seeded instead), and Pack-to-Ontology contribution is entirely unbuilt platform-wide — `contributed_by_pack` has zero non-null rows across every concept type on the platform, self-documented as deferred in `core/ontology.ts:15` (20.4).
3. **[Governance, real and strong]** Acquisition Scope — states, default inheritance, governed promotion, and the live Organisational Learning Obligation feedback loop into Chapter 23 — is the one area of this chapter built essentially as specified (20.9).
4. **[Code]** Quality Gate validation is wired generically but has zero actual gate content for Knowledge — the hook fires, nothing is attached to it (20.8).
5. **[Events]** Same platform-wide pattern already found for Ch.15/19/29/30: 9 illustrative per-state event names collapse to 3 real events, with none formally registered in `event_registry` (20.13).
6. **[Data model]** Tenant scoping is entirely absent from `knowledge_items` — Engineering Capital is queryable, but the chapter's Capability/Tenant-scoped discoverability rules cannot be enforced without it (20.10).
