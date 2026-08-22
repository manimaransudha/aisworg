
# Chapter 19 – Decision Model
[Sudha: I think we're now at the chapter that completes the **Trust Pipeline**.

We have defined:

- Information (implicitly)
- Evidence
- Knowledge
- Ontology

The next persistent concept is **Decision**.

Originally, I thought Decisions belonged in Governance.

I now think that's incorrect.

A Decision is first and foremost a **knowledge object**.

Governance determines **who may approve a decision**.

The Decision Model defines **what a decision is**.

That's a much cleaner separation.

-------------------

While writing this chapter, I realised we've completed something much larger than a Decision Model.

We've actually defined the **engineering reasoning model** of the platform.

Every significant engineering outcome now follows a consistent progression:

```
Observation

↓

Information

↓

Evidence

↓

Knowledge

↓

Decision

↓

Deliverable State Transition
```

This has an important implication.

A Decision should never simply record **what** was decided.

It should record **why the platform was justified in deciding it**.

That means the Decision Model becomes the platform's primary explainability mechanism. When an auditor, engineer or future SEU asks:

> "Why was this architecture chosen?"

the answer is not merely the approved Decision. It is the entire chain:

- the observations that triggered the question;
- the information gathered;
- the evidence validated;
- the knowledge applied;
- the alternatives considered;
- the engineering context at that point in time.

In other words, **the Decision becomes the explainable conclusion of the Trust Pipeline**.

I think this is one of the strongest architectural ideas in the platform because it transforms explainability from a feature of AI models into a property of the engineering process itself. That distinction will make the platform resilient to future changes in AI technologies while preserving engineering accountability.
]
---

# 1. Purpose

The Decision Model defines how engineering decisions are represented, evaluated, approved, preserved and reused within the AI Software Organisation Platform.

Engineering decisions are first-class knowledge objects.

They record the application of engineering judgement to a specific context using available Knowledge and Evidence.

The platform shall preserve decisions to ensure engineering explainability, traceability and organisational learning.

---

# 2. Scope

This chapter defines:

- Decision abstraction;
- Decision lifecycle;
- Decision relationships;
- Decision rationale;
- Decision traceability;
- Decision reuse.

This chapter does not define:

- approval authorities;
- governance policies;
- workflow execution;
- AI reasoning algorithms.

These are defined in later chapters.

---

# 3. Architectural Position

```
Information

↓

Evidence

↓

Knowledge

↓

Decision

↓

Deliverable State Transition
```

Decisions form the bridge between reusable Knowledge and engineering execution.

---

# 4. Definition

A Decision is an engineering conclusion reached within a specific context by evaluating available Knowledge and Evidence.

A Decision records:

- the engineering question;
- the alternatives considered;
- the supporting rationale;
- the selected outcome.

A Decision is independent of the Participant that created it.

---

# 5. Architectural Principles

## DM-001

Every significant engineering decision shall be explicitly recorded.

---

## DM-002

Every decision shall possess supporting Evidence.

---

## DM-003

Every decision shall reference applicable Knowledge.

---

## DM-004

Every decision shall preserve engineering context.

---

## DM-005

Decisions shall remain independently identifiable.

---

## DM-006

Historical decisions shall never be lost.

---

# 6. Functional Requirements

### FR-19.1

Every Decision shall possess a globally unique identifier.

---

### FR-19.2

Every Decision shall reference supporting Evidence.

---

### FR-19.3

Every Decision shall reference applicable Knowledge.

---

### FR-19.4

Every Decision shall record alternatives considered.

---

### FR-19.5

Every Decision shall maintain a complete decision history.

---

### FR-19.6

Decisions shall support supersession.

---

### FR-19.7

Decision provenance shall remain permanently available.

---

# 7. Decision Categories

Illustrative categories include:

## Architecture Decisions

Examples:

- Architectural pattern selection
- Integration strategy
- Technology selection

---

## Design Decisions

Examples:

- API design
- Database design
- Security design

---

## Engineering Decisions

Examples:

- Build strategy
- Branching strategy
- Testing strategy

---

## Operational Decisions

Examples:

- Deployment strategy
- Monitoring configuration
- Rollback strategy

---

## Governance Decisions

Examples:

- Risk acceptance
- Exception approval
- Waiver approval

Additional categories may be introduced through Packs.

---

# 8. Decision Structure

Every Decision shall define:

- Identifier
- Title
- Category
- Engineering Question
- Context
- Alternatives Considered
- Selected Alternative
- Supporting Knowledge
- Supporting Evidence
- Assumptions
- Consequences
- Status
- Provenance
- Version

---

# 9. Decision Lifecycle

Every Decision shall transition through the following lifecycle.

```
Identified

↓

Analysed

↓

Proposed

↓

Reviewed

↓

Approved

↓

Applied

↓

Superseded

↓

Archived
```

Only Approved Decisions may influence Deliverable state transitions unless explicitly authorised by governance.

---

# 10. Decision Relationships

A Decision may reference:

- Deliverables;
- Knowledge;
- Evidence;
- Obligations;
- Risks;
- other Decisions;
- Ontology concepts.

Relationships shall remain fully traceable.

---

# 11. Decision Context

Every Decision shall preserve the context in which it was made.

Context includes:

- Engineering Behavior Model version;
- SEU identifier;
- applicable Ontology;
- relevant Deliverables;
- applicable Constraints;
- active Obligations;
- engineering assumptions.

A Decision shall never be interpreted outside its recorded context.

---

# 12. Decision Rationale

Every significant Decision shall include engineering rationale.

The rationale shall explain:

- why alternatives were considered;
- why the selected alternative was preferred;
- why rejected alternatives were not selected;
- expected consequences.

Rationale is a permanent engineering asset.

---

# 13. Decision Reuse

Historical Decisions may inform future SEUs.

Reuse shall consider:

- current engineering context;
- applicable Ontology;
- current Engineering Behavior Model;
- differences in assumptions;
- differences in Constraints.

Historical Decisions shall guide, not dictate, future engineering work.

---

# 14. Decision Provenance

Every Decision shall preserve:

- originating SEU;
- originating Deliverable;
- contributing Participants;
- supporting Knowledge;
- supporting Evidence;
- approval history.

Decision provenance shall remain immutable.

---

# 15. Decision Versioning

A Decision may evolve.

Modifications shall create new versions.

Superseded Decisions shall remain permanently available.

Historical Deliverables shall continue to reference the Decision version in effect at the time.

---

# 16. Events

The Decision subsystem shall publish:

- DecisionIdentified
- DecisionAnalysed
- DecisionProposed
- DecisionReviewed
- DecisionApproved
- DecisionApplied
- DecisionSuperseded
- DecisionArchived

---

# 17. Non-Functional Requirements

The Decision Model shall:

- preserve complete rationale;
- support versioning;
- maintain provenance;
- remain independent of Participants;
- support explainability;
- support long-term reuse.

---

# 18. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Decisions possess unique identities.

✓ Decisions reference supporting Knowledge and Evidence.

✓ Alternatives are preserved.

✓ Decision rationale is permanently recorded.

✓ Decision provenance is maintained.

✓ Historical Decisions remain reusable.

---

# 19. Deliverables

Implementation of this chapter shall produce:

- Decision domain model.
- Decision repository.
- Decision lifecycle service.
- Decision versioning service.
- Decision relationship model.
- Decision APIs.
- Decision events.

---

# 20. Implementation Status & Gaps

Code-verified audit (2026-08-22), not from memory — every claim below carries a file:line citation, cross-checked against a live query against the running Postgres instance (`aisworg` DB: 39 rows in `decisions`, 99 rows in `events` matching `event_type ILIKE '%decision%'`). Core files: `src/dblayer/decisionsDB.ts`, `src/routes/seu/core/decisions.ts`, `src/routes/seu/api/decisions.ts`, `DecisionRow` (`src/dblayer/seuTypes.ts:867-882`). Live `decisions` schema: `id, seu_id, knowledge_id, evidence_id, category, title, engineering_question, selected_alternative, rationale, status, created_at, updated_at, related_object_type, related_object_id` — 14 columns.

Decision's lifecycle mechanism is the one section that matches the chapter exactly — all 8 states and 7 transitions are live-verified in `transition_definitions`, wired through the same badge-authority (`transitionEngine.evaluate()`, CR-006 noun_verb) and Ontology-backed category mechanisms (`category:decision`) established elsewhere on this platform. Nearly everything the chapter asks of the Decision *record itself*, though — alternatives considered, structured context, structured provenance, versioning, supersession linkage — doesn't exist as real columns.

## 20.1 ⚠️ Definition (§4)

"Independent of the Participant that created it" holds, but only because participant attribution isn't captured anywhere — `decisions` has no `created_by`/`participant_id`/`author_id` column at all (live schema). This also breaks §14's "contributing Participants" provenance requirement (20.11). Engineering question and rationale are real fields; "alternatives considered" is a single `selected_alternative` text field, not the plural structure the chapter implies (20.5).

**Planned (scoped, not yet built):** a `created_by` (actor id) + `authority_badge` column pair on `decisions`, mirroring CR-014's identical `events.actor_id`/`authority_badge` treatment — closes the "independent of Participant" ambiguity by making the creating actor and the badge they acted under real, queryable fields rather than an absence.

## 20.2 ⚠️ Architectural Principles (DM-001–006) (§5)

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| DM-001 | Explicitly recorded | ✅ | `createDecision` (`decisions.ts:15-58`) is the only write path — every Decision is an explicit `INSERT`. |
| DM-002 | Possesses supporting Evidence | ⚠️ | `evidence_id` is a real FK but nullable, not enforced — the migration's own comment admits this: `006_governance_depth.sql:75-78`, "MVP doesn't enforce that as a NOT NULL constraint." |
| DM-003 | References applicable Knowledge | ⚠️ | Same nullable `knowledge_id`, same comment. |
| DM-004 | Preserves engineering context | ❌ | No `context` field exists at all — see 20.8. |
| DM-005 | Independently identifiable | ✅ | UUID `id` PK, `decisionsDB.findById` (`decisionsDB.ts:43-51`). |
| DM-006 | Historical decisions never lost | ✅ | `grep -rn "DELETE FROM decisions\|decisionsDB.*delete\|purge" src/` → zero hits — no deletion path exists anywhere. |

## 20.3 ⚠️ Functional Requirements (FR-19.1–7) (§6)

| FR | Verdict | Evidence |
|---|---|---|
| FR-19.1 unique identifier | ✅ | `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`. |
| FR-19.2 references Evidence | ⚠️ | Real FK (`decisions_evidence_id_fkey`), nullable — not enforced. |
| FR-19.3 references Knowledge | ⚠️ | Real FK (`decisions_knowledge_id_fkey`), same caveat. |
| FR-19.4 records alternatives considered | ❌ (planned) | Only `selected_alternative TEXT` — the *chosen* option, single value. No column or join table for the *set* of alternatives considered anywhere in `decisionsDB.ts` or migrations. **Planned:** `selected_alternative` is replaced by an `alternatives JSONB` column — an array of `{text, selected}` entries, authored as a repeatable text list with a checkbox per entry — closing this and the Selected Alternative row of 20.5 in one field. |
| FR-19.5 maintains complete decision history | ❌ | No dedicated history table. Reconstructable only via `events` (`DecisionIdentified`/`DecisionTransitioned`), and even those carry only `fromState`/`toState` in `payload` (`decisions.ts:127`), not field-level history. |
| FR-19.6 supports supersession | ⚠️ | `Superseded` is a real lifecycle **state**, but there is no `supersedes`/`superseded_by` column anywhere (`grep -n "supersede" src/dblayer/migrations/*.sql` → zero column hits) — nothing structurally links a superseding Decision to the one it replaces. |
| FR-19.7 provenance permanently available | ⚠️ (partially planned) | Only `seu_id`/`related_object_type`/`related_object_id` are immutable and permanent; most of §14's provenance fields don't exist (20.11). `created_by`/`authority_badge` (20.1) close 2 more once built. |

## 20.4 ⚠️ Decision Categories — real, Ontology-backed mechanism; only 2 of 5 categories seeded (§7)

`category TEXT NOT NULL`, validated against Ontology via `assertCanonicalCategory("category:decision", input.category)` (`decisions.ts:27`, `core/ontology.ts:45-51`) — the same `category:*` pattern as Evidence/Deliverable/Obligation/Event Registry. But the live seed (`030_ontology.sql:42-43`) registers only **2** `category:decision` concepts — `Engineering Decisions`, `Design Decisions` — not the chapter's 5 (Architecture/Design/Engineering/Operational/Governance). "Additional categories introduced through Packs" is aspirational: `grep -n "category:decision" src/dblayer/seed/data/*.pack.json` → zero hits; no Pack contributes a `category:decision` concept, though the `ontology_concepts.contributed_by_pack` column exists structurally for exactly this purpose.

**Split into two separate items.** Seeding the 3 missing baseline categories (Architecture, Operational, Governance) is a same-shape, zero-ambiguity data addition (identical treatment to `capability-name`/`deliverable-name`, CR-020) — **planned**, not a design gap. Pack-contributed categories are a genuinely open design question (write path, timing, scope, conflict handling) — filed as **[CR-056](../../../change-requests/CR-056-decision-category-pack-contribution.md)**.

## 20.5 ❌ Decision Structure — 6 of 14 fields are real columns (§8)

| Chapter field | Real column? |
|---|---|
| Identifier | ✅ `id` |
| Title | ✅ `title` |
| Category | ✅ `category` |
| Engineering Question | ✅ `engineering_question` |
| Context | ❌ (planned, partial) — `originating_type`/`originating_id`/`originating_seu_id`, see 20.8 |
| Alternatives Considered | ❌ (planned) — merges into `alternatives` JSONB, see 20.3 FR-19.4 |
| Selected Alternative | ✅ (restructured) — folded into `alternatives`' per-entry `selected` flag rather than a standalone field |
| Supporting Knowledge | ⚠️ single `knowledge_id` FK, not a list |
| Supporting Evidence | ⚠️ single `evidence_id` FK, not a list |
| Assumptions | ❌ none |
| Consequences | ❌ none |
| Status | ✅ `status` |
| Provenance | ❌ (planned, partial) — `created_by`/`authority_badge` close part of it, see 20.1/20.11 |
| Version | ❌ none |

**Planned, not yet built:** `alternatives JSONB` (replacing `selected_alternative`), `originating_type`/`originating_id`/`originating_seu_id`, and `created_by`/`authority_badge` together close 4 of the 8 currently-missing/partial rows above. Assumptions, Consequences, and Version remain unaddressed by any current plan.

## 20.6 ✅ Decision Lifecycle — states and transitions match the chapter exactly (§9)

Live query (`transition_definitions WHERE entity_type='Decision'`) returns exactly 7 rows / 8 states, matching the chapter's chain verbatim: `Identified→Analysed→Proposed→Reviewed→Approved→Applied→Superseded→Archived`. Each row carries a `verb` (`analyse/propose/review/approve/apply/supersede/archive`), a badge-authority requirement, and `required_policy_ids = {policy-decision-transition-baseline}` — that policy is `{"type": "always_true"}` (`core-engineering.pack.json:117-122`), a placeholder, not a real business rule. `required_quality_gate_ids = {}` on every row — no Quality Gate blocks Decision's own progression.

"Only Approved Decisions may influence Deliverable state transitions" is genuinely enforced, and more broadly than stated: `qualityGateEngine.ts:106-126`'s `requires_accepted_evidence_or_approved_decision` criteria type (`QUALIFYING_DECISION_STATUSES = {"Approved", "Applied"}`, line 31) is consumed generically by `dependencyDefinitionEngine.ts:101-104` and `compliance.ts:82-87` — it gates readiness for **any** governed entity type via the polymorphic `related_object_type`, not "Deliverable state transitions" specifically as the chapter frames it.

## 20.7 ⚠️ Decision Relationships — 4 of 7 real (§10)

| Relationship | Real? | Evidence |
|---|---|---|
| Deliverables | ✅ | `related_object_type`/`related_object_id` polymorphic pair, validated in `createDecision` (`decisions.ts:28-32`); reverse direction also real via `evidence.originating_decision_id`. |
| Knowledge | ✅ | `knowledge_id` FK to `knowledge_items`. |
| Evidence | ✅ | `evidence_id` FK to `evidence`, plus reverse `evidence.originating_decision_id`. |
| Obligations | ⚠️ reverse only | No `obligation_id` on `decisions`; an Obligation can attach to a Decision as its `related_object` (`obligationsDB.findByRelatedObject`), but not the other way round. |
| Risks | ❌ | No "Risk" entity exists anywhere: `grep -rniE "RiskRow|'Risk'"` returns zero hits. |
| other Decisions | ❌ (partially planned) | No self-referential column — no `parent_decision_id`, no supersession link (20.3 FR-19.6). The planned `originating_type`/`originating_id` pair (20.8) can point at another Decision when `originating_type='Decision'`, which narrows this gap for the "originated from another Decision" case, but does not add a dedicated supersession link. |
| Ontology concepts | ⚠️ | Only via the single `category` field — no general relationship to arbitrary Ontology concepts. |

## 20.8 ❌ Decision Context — 1 of 7 fields real (§11)

| Context field | Real? |
|---|---|
| Engineering Behavior Model version | ❌ — zero hits for `ebm`/`EngineeringBehaviorModel` in `decisionsDB.ts`/`decisions.ts` |
| SEU identifier | ✅ `seu_id` (NOT NULL FK) |
| applicable Ontology | ❌ only `category` (single value) |
| relevant Deliverables | ⚠️ (planned, broadened) — only the single `related_object_id` today, not a set; see planned `originating_type`/`originating_id` below |
| applicable Constraints | ❌ none |
| active Obligations | ❌ not captured at creation time (only queryable later via `obligationsDB.findByRelatedObject`) |
| engineering assumptions | ❌ none |

**Planned (scoped, not yet built):** `originating_type`/`originating_id` — a polymorphic pointer to whatever entity gave rise to the Decision (Objective, Deliverable, Evidence, another Decision, etc.), distinct from and broader than the existing `related_object_type`/`related_object_id` (which stays as the general "this Decision relates to X" link). Paired with a nullable `originating_seu_id`, since the originating entity may belong to a different SEU than the Decision itself, or (e.g. an Objective) may structurally have no `seu_id` of its own at all — the same reasoning already established for `events.seu_id` (CR-051). This closes "relevant Deliverables" (broadened to any relevant entity) and part of §14's "originating Deliverable" (20.11); EBM version, applicable Ontology, Constraints, active Obligations, and assumptions remain unaddressed by any current plan.

## 20.9 ⚠️ Decision Rationale — real but unstructured (§12)

`rationale TEXT` is a real, captured column (`decisionsDB.ts:16`, `decisions.ts:44`) — but a single free-text field. Nothing structurally distinguishes "why alternatives were considered" / "why selected" / "why rejected" / "expected consequences," the four-part structure the chapter specifies; all four collapse into one prose blob if the caller chooses to write it.

## 20.10 ❌ Decision Reuse — wholly unimplemented (§13)

`grep -rniE "reuse|recommend|copy.?forward|similar.*decision" src/routes/seu/core/decisions.ts src/dblayer/decisionsDB.ts` → no relevant hits. No search/recommendation endpoint, no "copy Decision into new SEU" operation, no similarity lookup. Purely aspirational.

## 20.11 ❌ Decision Provenance — 2 of 6 fields real (§14)

| Provenance field | Real? |
|---|---|
| originating SEU | ✅ `seu_id` |
| originating Deliverable | ⚠️ (planned, broadened) — only when `related_object_type='Deliverable'` today; the planned `originating_type`/`originating_id` (20.8) gives this a dedicated field, generalized beyond Deliverable |
| contributing Participants | ❌ (planned) — no column at all today; closed by the planned `created_by` (20.1). Still single-valued (one creating actor), not a full multi-contributor list |
| supporting Knowledge | ✅ `knowledge_id` |
| supporting Evidence | ✅ `evidence_id` |
| approval history | ❌ no dedicated structure; reconstructable only from `events` (`DecisionTransitioned` carries `fromState`/`toState`/`actorId`/`authorityBadge`), not a first-class field on the Decision itself |

Immutability holds, but by omission rather than design: `decisionsDB.ts` exposes only `create`/`findById`/`findByRelatedObject`/`findBySeuId`/`updateStatus`; `updateStatus` touches only `status`/`updated_at` (`decisionsDB.ts:76-87`) — there's no update path for *any* content field, not a deliberate provenance-immutability guarantee specifically.

## 20.12 ❌ Decision Versioning — not built (§15)

No `version` column exists (`DecisionRow`, live schema). The only mutation path, `updateStatus`, does an in-place `UPDATE ... RETURNING *` (`decisionsDB.ts:76-87`) — never an `INSERT` of a new version row. "Historical Deliverables continue to reference the Decision version in effect at the time" is structurally impossible today: both `evidence.originating_decision_id` and the polymorphic `related_object_id` are live FKs to the single current `decisions` row, with no version-pinning mechanism. Consistent with the platform-wide finding elsewhere this session (Ch.29 §20.2 FR-29.2): none of the six core entities have a real versioning concept.

## 20.13 ⚠️ Events — 2 of 8 named events real (§16)

Static grep confirms exactly two literal event types: `DecisionIdentified` (`decisions.ts:49`, published once at creation) and `DecisionTransitioned` (`decisions.ts:122`, published on every lifecycle transition, generic `fromState`/`toState` payload). `grep -rn "DecisionAnalysed\|DecisionProposed\|DecisionReviewed\|DecisionApproved\|DecisionApplied\|DecisionSuperseded\|DecisionArchived" src/` → zero matches. Live query confirms the same two types, 99 total rows. Same pattern already found for Ch.15 §17, Ch.29 §20.12, Ch.30 §7: illustrative per-state event names were never built verbatim — one generic transition event does the work of the other 6.

## 20.14 ⚠️ Non-Functional Requirements (§17)

| NFR | Verdict | Basis |
|---|---|---|
| preserve complete rationale | ⚠️ | Real field, no structural completeness guarantee (20.9) |
| support versioning | ❌ | 20.12 — no concept at all |
| maintain provenance | ⚠️ | 2/6 fields real (20.11) |
| remain independent of Participants | ✅ (by omission) | No participant coupling exists (20.1), though this also breaks the provenance NFR above |
| support explainability | ⚠️ | `rationale`/`engineering_question`/`selected_alternative` exist; the Evidence/Knowledge chain is real but shallow (single FK each) |
| support long-term reuse | ❌ | 20.10 — zero mechanism |

## 20.15 ⚠️ Acceptance Criteria (§18)

| Criterion | Verdict |
|---|---|
| Decisions possess unique identities | ✅ |
| Decisions reference supporting Knowledge and Evidence | ⚠️ real FKs, nullable/single-valued, not enforced |
| Alternatives are preserved | ❌ only `selected_alternative` (20.3 FR-19.4) |
| Decision rationale is permanently recorded | ⚠️ single free-text field, permanent by omission, not structured (20.9) |
| Decision provenance is maintained | ❌ 2/6 fields real (20.11) |
| Historical Decisions remain reusable | ❌ zero mechanism (20.10) |

## 20.16 ⚠️ Deliverables — 4 of 7 real artifacts (§19)

| Named Deliverable | Real artifact | Verdict |
|---|---|---|
| Decision domain model | `DecisionRow` (`seuTypes.ts:867-882`) | ✅ |
| Decision repository | `decisionsDB` (`decisionsDB.ts`) | ✅ |
| Decision lifecycle service | `createDecision`/`transitionDecision` (`core/decisions.ts`) | ✅ |
| Decision versioning service | — | ❌ doesn't exist (20.12) |
| Decision relationship model | — | ⚠️ only `knowledge_id`/`evidence_id`/`related_object_type+id` FKs, no dedicated relationship model or join tables (20.7) |
| Decision APIs | `src/routes/seu/api/decisions.ts` | ✅ |
| Decision events | `DecisionIdentified`, `DecisionTransitioned` | ⚠️ real but only 2 of 8 named events (20.13) |

## Summary — ranked

1. **[Data model, largest gap]** No versioning (20.12), no supersession link (20.3 FR-19.6), no alternatives-considered structure (20.3 FR-19.4), no structured provenance (20.11) — 4 of the chapter's most emphasized record-level capabilities don't exist as columns anywhere.
2. **[Code]** Decision Reuse (§13) is entirely aspirational — zero search/recommend/copy-forward code of any kind (20.10).
3. **[Governance, real and stronger than specified]** Approved-Decision gating of other entities' transitions is genuinely implemented and generalized (`requires_accepted_evidence_or_approved_decision`), working for any governed entity type via polymorphic `related_object_type` — broader than the chapter's narrower "Deliverable state transitions only" framing (20.6).
4. **[Ontology]** Category is real and Ontology-backed (`category:decision`), but only 2 of the chapter's 5 categories are seeded, and Pack-contribution of new categories is unbuilt — zero Packs seed a `category:decision` concept (20.4).
5. **[Events]** Same platform-wide pattern found for Ch.15/Ch.29/Ch.30: 8 illustrative per-state event names collapse to 2 real events (`DecisionIdentified` + generic `DecisionTransitioned`), live-confirmed at 99 events (20.13).
6. **[Lifecycle, the one section that matches exactly]** All 8 states and 7 transitions are live-verified against the chapter's own chain, with no drift, additions, or omissions — wired through the same badge-authority mechanism as every other governed entity (20.6).