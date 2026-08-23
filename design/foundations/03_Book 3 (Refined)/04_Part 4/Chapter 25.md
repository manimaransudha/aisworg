
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

---

# 19. Implementation Status & Gaps

Code-verified audit (2026-08-22), not from memory — every claim below carries a file:line citation, cross-checked against a live query against the running Postgres instance (`aisworg` DB). Core files: `src/dblayer/reviewsDB.ts`, `src/dblayer/findingsDB.ts`, `src/routes/seu/core/reviews.ts`, `src/routes/seu/core/findings.ts`, `src/routes/seu/api/reviews.ts`, `ReviewRow`/`FindingRow` (`src/dblayer/seuTypes.ts:619-650`).

Finding is the standout of this chapter — a genuinely real, separate first-class entity with its own lifecycle, table, and API, not a text field embedded in Review, matching the chapter's own explicit design intent. The lifecycle and outcome mechanisms for Review itself are also solid. What's missing is the layer the chapter frames as central: Review is not actually an *evaluation* — `outcome` is a value the API caller supplies directly, and the `criteria` field, while real and structured, is written once and never read back or interpreted by anything. Most relevant to the Pack-contribution question that prompted this audit round: Review Category is the one categorized entity in the whole codebase that is genuinely **not** Ontology-backed — `core/reviews.ts` is the sole core module among all categorized entities that never calls `assertCanonicalCategory`. And FR-25.7's Pack composition is the cleanest "shovel-ready but disconnected" gap found in any chapter this session: `PackContributions.reviewGates` is defined in the type, seeded with real content in ~20 Pack JSON files, and parsed by the SDK authoring tool — but `core/packs.ts`'s `seedContributions` never actually reads it, unlike the sibling fields (`policies`, `qualityGates`, `authorityRules`) that all get processed identically.

## 19.1 ✅ Definition (§4)

"Does not modify the reviewed object" holds cleanly: no `UPDATE` to `deliverablesDB` or any other reviewed-object table exists anywhere in `core/reviews.ts`/`core/findings.ts` — the only `UPDATE` statements in either module target `reviews`/`findings` themselves.

## 19.2 ⚠️ Architectural Principles (RM-001–006) (§5)

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| RM-001 | Evaluations only, no side effects | ✅ | Same as 19.1. |
| RM-002 | Independent of Participants | ⚠️ | `reviewer` is free text, not a Participant FK; no authority rule gates the lifecycle at all (`required_authority_rule_id NULL` on all 5 transitions) — independence by omission, not an enforced boundary. |
| RM-003 | Repeatable | ✅ | No uniqueness constraint on `related_object_type`/`related_object_id` — multiple Reviews per object are structurally allowed. |
| RM-004 | Composable | ❌ | No multi-Pack composition mechanism exists — see 19.10. |
| RM-005 | Complete traceability | ⚠️ | 4 of 8 fields real — see 19.11. |
| RM-006 | Outcomes reproducible | ❌ | `outcome` is supplied directly by the API caller at the Completed transition; nothing derives it from `criteria`. A Review is a record of a submitted verdict, not a computed, reproducible evaluation. |

## 19.3 ⚠️ Functional Requirements (FR-25.1–7) (§6)

| FR | Verdict | Note |
|---|---|---|
| FR-25.1 unique id | ✅ | `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`. |
| FR-25.2 multiple engineering object types | ✅ (real polymorphism, unexercised) | `related_object_type`/`related_object_id`, typed as `TransitionEntityType`; `qualityGateEngine.ts:136` consumes it generically. Live data, however, is 100% `Deliverable` (66/66 rows) — polymorphic in code, single-type in practice. |
| FR-25.3 criteria declarative | ⚠️ | Structured storage (`criteria JSONB`) exists, but nothing declares a schema for it and nothing interprets it — declarative storage without a declarative engine (19.7). |
| FR-25.4 mandatory or optional | ❌ | No `mandatory`/`is_optional` column anywhere on `reviews`. |
| FR-25.5 outcomes immutable | ✅ | `core/reviews.ts:116` rejects any transition once `outcome` is already set; `completeWithOutcome` is the only write path. |
| FR-25.6 complete provenance | ⚠️ | `reviewer`/timestamps/`version` captured; no actor-ID chain on the Review row itself (only on the transition *event*). |
| FR-25.7 composition from multiple Packs | ❌ | No `originating_pack_id` on `reviews`/`findings` (confirmed live, 0 rows). `PackContributions.reviewGates` is defined, seeded in ~20 Pack JSON files, and parsed by the SDK authoring tool — but `core/packs.ts`'s `seedContributions` never processes it, unlike `capabilities`/`services`/`authorityRules`/`policies`/`qualityGates`, all of which are. Declared, seeded, unwired — same pattern already found for Decision/Authority. |

## 19.4 ❌ Review Categories — the one categorized entity with no Ontology backing at all (§7)

`reviews.category` is `TEXT NOT NULL`, genuinely free text — the migration's own comment says so directly ("Pack-extensible free text"). `core/reviews.ts` never calls `assertCanonicalCategory`, unlike every other categorized entity in the codebase (Deliverable, Obligation, Knowledge, Decision, Evidence all do) — still true, confirmed live: no such call exists in `core/reviews.ts` today. Live `ontology_concepts` has **no `category:review` concept type at all** — the only "review"-adjacent Ontology rows are unrelated labels on `category:evidence`/`category:obligation` that happen to mention "review." Of the chapter's 8 named categories, only 4 have any live usage (Security/Code/Architecture/Design — all as free-text values, not validated concepts); Requirements/Test/Deployment/Operational are entirely absent from the data. "Additional review categories may be introduced through Packs" is aspirational — no Pack writes a Review category anywhere. `src/views/seu/reviews/index.ejs`'s "Plan a Review" form still hardcodes the chapter's 8 category names in a plain `<select>`, no referential/Ontology wiring.

**Settled as by-design, not an open gap (CR-059, 2026-08-22):** this was not fixed by giving `category` an Ontology type. The one place `category` needed disambiguating power — a Quality Gate's `requires_accepted_review` criteria narrowing down *which* review satisfies it — was rebuilt to key off `deliverableName` (Ontology-backed via the existing `deliverable-name` concept type, through `review_gates.code`) instead of `category` at all; see §19.10. `reviews.category` itself carries no `deliverable-name` values and was not migrated — it remains exactly the free-text field described above, now simply orthogonal to gate matching rather than a validation gap blocking it.

## 19.5 ❌ Review Structure — 5 of 13 fields fully absent (§8)

| Chapter field | Real column? |
|---|---|
| Identifier | ✅ `id` |
| Name | ✅ `name` |
| Category | ✅ `category` (free text, 19.4) |
| Reviewed Object | ✅ `related_object_type`/`related_object_id` |
| Review Criteria | ✅ `criteria` JSONB (stored, unevaluated — 19.7) |
| Review Scope | ❌ no column |
| Required Evidence | ❌ no column |
| Required Participants | ❌ no column |
| Findings | ⚠️ not a column — real reverse FK via `findings.review_id` (19.9) |
| Recommendations | ❌ no free-text field (only the outcome enum value "Passed with Recommendations") |
| Outcome | ✅ `outcome` |
| Version | ⚠️ column exists (`version`, default 1) but is never incremented anywhere — inert |
| Provenance | ⚠️ partial — `reviewer`, `created_at`, `updated_at` only |

## 19.6 ✅ Review Lifecycle — matches the chapter exactly (§9)

Live `transition_definitions WHERE entity_type='Review'` returns exactly the chapter's 6-state chain: `Planned→Prepared→In Progress→Completed→Accepted→Archived`, all 5 rows with `required_authority_rule_id = NULL` and `required_policy_ids = '{}'` (matching 19.2 RM-002's finding — governance consumes the *outcome*, not who walked the lifecycle). No delete path exists in `reviewsDB.ts`, so "historical Reviews remain permanently available" holds by omission.

## 19.7 ⚠️ Review Criteria — real storage, no interpretation (§10)

`criteria JSONB` accepts arbitrary structure on create, but no schema is enforced for it, and no code anywhere reads it back to interpret it (confirmed by grep — the only occurrences are the write on create and a pass-through parameter). "Criteria are interpreted by the Review service" is false as written — the *interpretation* that exists lives one layer up, in `qualityGateEngine.ts`'s `requires_accepted_review` criteria type, which consumes a Review's *outcome*, not a Review's own `criteria` field.

## 19.8 ✅ Review Outcomes — all 6 supported, real constraint, genuinely consumed by Governance (§11)

`CHECK (outcome IS NULL OR outcome IN ('Passed', 'Passed with Recommendations', 'Rework Required', 'Failed', 'Not Applicable', 'Deferred'))` — matches the chapter's 6 outcomes exactly. Live data exercises 3 of 6 (`Failed`/`Passed with Recommendations`/`Passed`) plus NULL; the other 3 are supported by the schema but unexercised. "Governance consumes the Review outcome when evaluating a state transition" is real and wired: `qualityGateEngine.ts:129-144`'s `requires_accepted_review` criteria type blocks a transition unless an `Accepted` Review with a qualifying outcome exists.

## 19.9 ✅ Findings — real, separate first-class entity, matching the chapter's explicit intent (§12)

Dedicated table, dedicated `findingsDB.ts`/`core/findings.ts`, dedicated `FindingRow` type, own `TransitionEntityType` and lifecycle (`Open→Resolved`, `Open→Waived`, live-verified) driven through the same generic `transitionEngine.evaluate()`. Findings→Obligations is a real, human-triggered code path (`convertFindingToObligation`, `findings.ts:113-130`, idempotency-guarded) — matching the chapter's own explicit design note that conversion is not automatic. Findings→Attention Items is real and automatic for High/Critical severity. Findings→**Evidence requests, Decisions, follow-up Reviews** — the other 2 of the chapter's 4 named Finding outcomes — have no code path at all. The chapter's narrated richer lifecycle ("discussed, challenged, accepted, ... reopened") is considerably simpler in the real 2-transition state machine.

## 19.10 ✅ Review Composition — built (CR-059, 2026-08-22) (§13)

`core/packs.ts`'s `seedContributions` now processes `seed.contributions.reviewGates` (previously the gap this section documented: "fully defined and seeded... never gets read"). Each Pack's declared `reviewGates[]` is upserted into a real `review_gates` table (`reviewGatesDB.ts`) with `originatingPackId: pack.id` — the same `originating_pack_id` pattern `qualityGates`/`policies` already use in the same function, confirmed live at `packs.ts`'s `reviewGateIdByCode` loop (runs immediately before the `qualityGates` loop, since a `requires_accepted_review` criteria resolves its target Review Gate id from this same map). `review_gates` carries its own `originating_pack_id UUID REFERENCES packs(id)` column (migration `097_review_gate_table.sql`) — so "no `originating_pack_id` on reviews" no longer describes the real gap: composition attribution lives on `review_gates`, not on `reviews` itself, mirroring where `quality_gates`/`policies` carry theirs rather than the entities they gate.

Composition here means something narrower than a generic multi-Pack merge, though: a Review Gate's identity is `(entity_type, from_state, to_state, code)` where `code` is a `deliverable-name` value — two Packs declaring a Review Gate for the same deliverable type at the same transition collide on the same active-slot unique index `review_gates` shares with `quality_gates`' own scheme (last upsert wins, same "later-overrides-earlier" discipline Ch.5 §19.7/§19.8 already documents for Pack composition generally). There is still no *union* mechanism merging two Packs' Review Gates for the same slot into one — only the same override-on-collision behavior every other Pack-contributed, code-scoped row already has. "Composition shall be deterministic" (§13) now has something real to test against: `reviewGatesDB.upsert`'s deactivate-then-insert transaction.

## 19.11 ❌ Review Traceability — 4 of 8 fields real (§14)

| Field | Captured? |
|---|---|
| reviewed object | ✅ `related_object_type`/`related_object_id` |
| review criteria | ✅ `criteria` (stored, not interpreted — 19.7) |
| supporting Evidence | ❌ no FK/link between `reviews` and `evidence` |
| generated Findings | ✅ `findings.review_id` reverse FK |
| related Decisions | ❌ no FK/link between `reviews`/`findings` and `decisions` |
| reviewing Participants | ❌ only free-text `reviewer` |
| timestamp | ✅ `created_at`/`updated_at` |
| Engineering Behavior Model version | ❌ no column |

**Addition beyond the chapter's own 8 named fields (CR-059, 2026-08-22):** `reviews.review_gate_id` (nullable FK to `review_gates.id`, migration `097_review_gate_table.sql`) traces a Review back to the specific Review Gate declaration it was produced against — which Pack, which deliverable type, which governed transition. Confirmed live in `seuTypes.ts`'s `ReviewRow` and consumed by `qualityGateEngine.ts`'s `requires_accepted_review` branch as a strict join, not a string match. Not one of the chapter's originally named traceability fields, so not counted in the "4 of 8" above, but a real, additional provenance link the chapter didn't anticipate.

## 19.12 ✅ Events — all 8 named events exist in code, 7 of 8 live-exercised (§15)

Unusually complete for this session's audits: `ReviewPlanned`/`ReviewStarted`/`ReviewCompleted`/`ReviewPassed`/`ReviewFailed`/`ReviewDeferred`/`FindingCreated`/`FindingResolved` are all real, distinct literals in code (`reviews.ts:43,121-123,129`, `findings.ts:39,94`). Live query confirms 7 of the 8 have actually fired (`ReviewDeferred` is code-real but unexercised — no Review has completed with that outcome yet). Two extra events not named in the chapter also exist: generic `ReviewTransitioned` (for Prepared/Accepted/Archived hops) and `FindingTransitioned` (for `Waived`, unexercised). `event_registry` has zero rows for either — but that catalog table is nearly empty platform-wide, not a Review-specific gap.

## 19.13 ⚠️ Non-Functional Requirements (§16)

| NFR | Verdict | Basis |
|---|---|---|
| deterministic execution | ❌ | No execution logic exists to be deterministic — outcome is caller-supplied (19.2 RM-006) |
| multiple review types | ⚠️ | 4 of 8 categories used, free text, not Ontology-governed (19.4) |
| complete traceability | ⚠️ | 4 of 8 fields (19.11) |
| concurrent Reviews | ✅ | No uniqueness constraint blocks multiple Reviews per object |
| independent of Participant implementations | ✅ | `reviewer` is free text, no Participant coupling |

## 19.14 ⚠️ Acceptance Criteria (§17)

| Criterion | Verdict |
|---|---|
| Reviews evaluate without modifying reviewed object | ✅ (19.1) |
| Review criteria are declarative | ⚠️ stored declaratively, not interpreted (19.7) |
| Review outcomes are immutable | ✅ (19.3 FR-25.5) |
| Findings are traceable | ⚠️ Finding has its own id/status/severity/timestamps, but no criteria/EBM-version/Participant trace |
| Multiple Review Packs can be composed | ✅ override-on-collision, same discipline as Quality Gate/Pack composition generally — no distinct union-merge (19.10) |
| Review history remains permanently available | ✅ no delete path exists |

## 19.15 ⚠️ Deliverables — 4 of 7 real, 3 partial or missing (§18)

| Named Deliverable | Real artifact | Verdict |
|---|---|---|
| Review domain model | `ReviewRow`/`ReviewOutcome` (`seuTypes.ts:619-633`) | ✅ |
| Review execution service | `core/reviews.ts` | ⚠️ lifecycle/transition service is real; no actual *execution* of criteria (no engine) |
| Review criteria engine | — | ❌ no module interprets `criteria`; only stored (19.7) |
| Finding management service | `core/findings.ts`, `findingsDB.ts` | ✅ |
| Review registry | `reviewsDB.findBySeuId`/`findByRelatedObject` | ⚠️ acts as a query registry; no dedicated registry concept beyond the table |
| Review APIs | `src/routes/seu/api/reviews.ts` (7 endpoints) | ✅ |
| Review events | 8 named events, all real in code | ✅ |

## Summary — ranked

1. **[Ontology / Pack-contribution]** Review Category is the one categorized entity anywhere in the codebase that is genuinely *not* Ontology-backed — `core/reviews.ts` never calls `assertCanonicalCategory`, and no `category:review` concept type exists at all. **Settled as by-design, not a gap to close**: CR-059 (2026-08-22) rebuilt Quality Gate's `requires_accepted_review` matching to key off `deliverableName`/`review_gates.code` (Ontology-backed via the existing `deliverable-name` concept type) instead of `category` — the one place `category` needed disambiguating power no longer uses it, so it was left as free text deliberately, not overlooked (19.4).
2. **[Code, closed CR-059, 2026-08-22]** FR-25.7's Pack composition — previously the cleanest shovel-ready gap found this session: the type field was defined, ~20 Pack JSON files seeded real content into it, the SDK authoring tool parsed it, but `core/packs.ts`'s `seedContributions` never read it. Now processed, materialising into a real `review_gates` table with `originating_pack_id` attribution (19.3, 19.10).
3. **[Architecture]** Review isn't actually an evaluation as the chapter frames it — `outcome` is caller-supplied, not derived from `criteria`, and `criteria` itself is written once and never interpreted by anything (19.2 RM-006, 19.7).
4. **[Code, genuine positive]** Finding is a real, separate, first-class entity with its own lifecycle and table, exactly matching the chapter's explicit architectural intent — one of the strongest single findings across this session's audits (19.9).
5. **[Events, genuine positive]** All 8 named events exist in code and 7 of 8 are live-exercised — the most complete event-naming match found in any chapter audited this session (19.12).
6. **[Data model]** 5 of 13 §8 structure fields are entirely absent (Scope, Required Evidence, Required Participants, Recommendations), and Version exists but is never incremented (19.5).