# Chapter 19 – Decision Model

## 1. Purpose

The Decision Model defines how engineering decisions are represented, evaluated, approved, preserved and reused within the AI Software Organisation Platform.

Engineering decisions are first-class knowledge objects.

They record the application of engineering judgement to a specific context using available Knowledge and Evidence.

The platform shall preserve decisions to ensure engineering explainability, traceability and organisational learning.

---

## 2. Scope

This chapter defines:

- Decision abstraction
- Decision lifecycle
- Decision relationships
- Decision rationale
- Decision traceability
- Decision reuse

This chapter does not define:

- approval authorities
- governance policies
- workflow execution
- AI reasoning algorithms

These are defined in later chapters.

---

## 3. Architectural Position

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

## 4. Definition

A Decision is an engineering conclusion reached within a specific context by evaluating available Knowledge and Evidence.

A Decision records:

- the engineering question
- the alternatives considered
- the supporting rationale
- the selected outcome

A Decision is independent of the Participant that created it.

---

## 5. Architectural Principles

### DM-001

Every significant engineering decision shall be explicitly recorded.
 
### DM-002

Every decision shall possess supporting Evidence.
 
### DM-003

Every decision shall reference applicable Knowledge.
 
### DM-004

Every decision shall preserve engineering context.
 
### DM-005

Decisions shall remain independently identifiable.
 
### DM-006

Historical decisions shall never be lost.

---

## 6. Functional Requirements

### FR-19.1

Every Decision shall possess a globally unique identifier.
 
### FR-19.2

Every Decision shall reference supporting Evidence.
   
### FR-19.3

Every Decision shall reference applicable Knowledge.
 
### FR-19.4

Every Decision shall record alternatives considered.
 
### FR-19.5

Every Decision shall maintain a complete decision history.
 
### FR-19.6

Decisions shall support supersession.
 
### FR-19.7

Decision provenance shall remain permanently available.

---

## 7. Decision Categories

Illustrative categories include:

### Architecture Decisions

Examples:

- Architectural pattern selection
- Integration strategy
- Technology selection
 
### Design Decisions

Examples:

- API design
- Database design
- Security design
 
### Engineering Decisions

Examples:

- Build strategy
- Branching strategy
- Testing strategy
 
### Operational Decisions

Examples:

- Deployment strategy
- Monitoring configuration
- Rollback strategy
 
### Governance Decisions

Examples:

- Risk acceptance
- Exception approval
- Waiver approval

Additional categories may be introduced through Packs.

---

## 8. Decision Structure

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

## 9. Decision Lifecycle

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

## 10. Decision Relationships

A Decision may reference:

- Deliverables
- Knowledge
- Evidence
- Obligations
- Risks
- other Decisions
- Ontology concepts

Relationships shall remain fully traceable.

---

## 11. Decision Context

Every Decision shall preserve the context in which it was made.

Context includes:

- Engineering Behavior Model version
- SEU identifier
- applicable Ontology
- relevant Deliverables
- applicable Constraints
- active Obligations
- engineering assumptions

A Decision shall never be interpreted outside its recorded context.

---

## 12. Decision Rationale

Every significant Decision shall include engineering rationale.

The rationale shall explain:

- why alternatives were considered
- why the selected alternative was preferred
- why rejected alternatives were not selected
- expected consequences

Rationale is a permanent engineering asset.

---

## 13. Decision Reuse

Historical Decisions may inform future SEUs.

Reuse shall consider:

- current engineering context
- applicable Ontology
- current Engineering Behavior Model
- differences in assumptions
- differences in Constraints

Historical Decisions shall guide, not dictate, future engineering work.

---

## 14. Decision Provenance

Every Decision shall preserve:

- originating SEU
- originating Deliverable
- contributing Participants
- supporting Knowledge
- supporting Evidence
- approval history

Decision provenance shall remain immutable.

---

## 15. Decision Versioning

A Decision may evolve.

Modifications shall create new versions.

Superseded Decisions shall remain permanently available.

Historical Deliverables shall continue to reference the Decision version in effect at the time.

---

## 16. Events

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

## 17. Non-Functional Requirements

The Decision Model shall:

- preserve complete rationale
- support versioning
- maintain provenance
- remain independent of Participants
- support explainability
- support long-term reuse

---

## 18. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Decisions possess unique identities.

✓ Decisions reference supporting Knowledge and Evidence.

✓ Alternatives are preserved.

✓ Decision rationale is permanently recorded.

✓ Decision provenance is maintained.

✓ Historical Decisions remain reusable.

---

## 19. Deliverables

Implementation of this chapter shall produce:

- Decision domain model
- Decision repository
- Decision lifecycle service
- Decision versioning service
- Decision relationship model
- Decision APIs
- Decision events

---

## 20. Implementation Status & Gaps

Code-verified audit (2026-09-18), superseding the 2026-08-22 pass below in full — this session rebuilt the Decision model end to end (migrations 230/231, not yet applied to the live DB at the time of writing; verified against migration SQL and the rewritten TypeScript, not a live query). Core files: `src/dblayer/decisionsDB.ts`, `src/routes/seu/core/decisions.ts`, `src/routes/seu/api/decisions.ts`, `src/routes/seu/web/seus.ts`, `DecisionRow` (`src/dblayer/seuTypes.ts`). `decisions` schema post-231: `id, seu_id, originating_type, originating_id, related_objects, related_seu, knowledge_ids, evidence_ids, alternatives, participant_id, authority_badge, category, title, engineering_question, status, created_at, updated_at` — 17 columns, `related_objects`/`related_seu`/`alternatives` JSONB, `knowledge_ids`/`evidence_ids` `UUID[]`.

Every record-level gap the 2026-08-22 pass flagged as the chapter's biggest shortfall — alternatives structure, plural Knowledge/Evidence, provenance, versioning, per-state events, Decision Context — is now closed or substantially closed, largely through `related_objects[]` doing double duty as both "what this Decision applies to" and "the context it was reasoned against" (Ontology/Obligation/Policy references). What remains open is narrower: no supersession *link*, no literal per-version row, Decision Reuse (§13) still unbuilt.

### 20.1 ✅ Definition (§4) — corrected, not just implemented

"Independent of the Participant that created it" was previously true only by omission (participant attribution didn't exist at all). Corrected this session: independence means the Participant *executing* a Decision is replaceable, not that attribution is absent from the record. `participant_id` (the per-SEU `participants.id` engagement, resolved from the acting user) is captured at creation and updated on every governed transition; `authority_badge` is null at creation (creation is ungoverned — no `transition_definitions` row produces "Identified," same as every other entity's own row-1) and real from the first governed transition onward.

### 20.2 ✅ Architectural Principles (DM-001–006) (§5)

| ## | Claim | Verdict | Evidence |
|---|---|---|---|
| DM-001 | Explicitly recorded | ✅ | `createDecision` (`core/decisions.ts`) is the only write path. |
| DM-002 | Possesses supporting Evidence | ⚠️ | `evidence_ids UUID[]` — now plural, matching the chapter, but still not enforced non-empty. |
| DM-003 | References applicable Knowledge | ⚠️ | Same shape/caveat as DM-002, `knowledge_ids`. |
| DM-004 | Preserves engineering context | ✅ | `seu_id` (which also pins EBM, since EBM is tied to the SEU); applicable Ontology, active Obligations and applicable Constraints (Policy) via `related_objects[]`; engineering assumptions via `alternatives[].assumptions`. All 7 of §11's context fields real, see 20.8. |
| DM-005 | Independently identifiable | ✅ | Unchanged. |
| DM-006 | Historical decisions never lost | ✅ | Unchanged — no delete path added. |

### 20.3 ✅ Functional Requirements (FR-19.1–7) (§6)

| FR | Verdict | Evidence |
|---|---|---|
| FR-19.1 unique identifier | ✅ | Unchanged. |
| FR-19.2 references Evidence | ⚠️ | `evidence_ids[]`, plural now, still not enforced non-empty. |
| FR-19.3 references Knowledge | ⚠️ | `knowledge_ids[]`, same caveat. |
| FR-19.4 records alternatives considered | ✅ | `alternatives JSONB` — array of `{statement, assumptions[], consequences[], status, rationale}`, `status` a new Ontology concept type (`decision-alternative-status`: Candidate/Evaluating/Investigating/Deferred/Rejected/Approved). The *set* of alternatives is real; the winning one is whichever entry carries `status: "Approved"`. |
| FR-19.5 maintains complete decision history | ✅ | Each transition publishes a distinct literal event (`DecisionAnalysed`/`Proposed`/`Reviewed`/`Approved`/`Applied`/`Superseded`/`Archived`, migration 231), not one generic `DecisionTransitioned` — a complete history via `events`, the same read-path mechanism Version Feature Plan.md establishes platform-wide (20.11). |
| FR-19.6 supports supersession | ❌ | Unchanged — `Superseded` is a real state; still no `supersedes`/`superseded_by` column. `related_objects` can now express "this Decision relates to that Decision," but that is a general relationship, not a dedicated supersession link. |
| FR-19.7 provenance permanently available | ✅ | `participant_id`/`authority_badge` real (20.1); `originating_type`/`originating_id` real (20.8); `related_objects`/`related_seu` broaden §14's provenance fields well beyond the old single scalar pair. |

### 20.4 ✅ Decision Categories — real, Ontology-backed; all 5 chapter categories now seeded (§7)

Mechanism unchanged (`category TEXT NOT NULL`, `assertCanonicalCategory("category:decision", ...)`). Migration 230 adds the 3 previously-missing baseline categories (Architecture, Operational, Governance) alongside the existing Engineering/Design — all 5 named in §7 are now real Ontology concepts. Pack-contributed categories remain unbuilt, still tracked as **[CR-056](../../../change-requests/CR-056-decision-category-pack-contribution.md)**.

### 20.5 ✅ Decision Structure — 13 of 14 fields real (§8)

| Chapter field | Real column? |
|---|---|
| Identifier | ✅ `id` |
| Title | ✅ `title` |
| Category | ✅ `category` |
| Engineering Question | ✅ `engineering_question` |
| Context | ✅ `seu_id` (EBM included), `originating_type`/`originating_id`, `related_objects[]` (Ontology/Obligation/Policy), `alternatives[].assumptions` — all 7 of §11's own fields real, see 20.8 |
| Alternatives Considered | ✅ `alternatives[]` |
| Selected Alternative | ✅ (restructured) — the `alternatives[]` entry with `status: "Approved"` |
| Supporting Knowledge | ✅ `knowledge_ids[]` — plural, not enforced non-empty |
| Supporting Evidence | ✅ `evidence_ids[]` — plural, not enforced non-empty |
| Assumptions | ✅ per-alternative `assumptions[]` — not a Decision-level field, but real and structured |
| Consequences | ✅ per-alternative `consequences[]` |
| Status | ✅ `status` |
| Provenance | ✅ `participant_id`/`authority_badge`/`originating_type`/`originating_id` — see 20.11 |
| Version | ⚠️ real *mechanism* (`transition_definitions.event_type`/`.version_event`, Version Feature Plan.md), no literal `version` column or per-version row on `decisions` itself — see 20.12 |

One genuine remaining gap: a literal version-row mechanism (the built mechanism is read-time event filtering, not a mint-new-row-per-version write path). Context (§11) is now fully closed — see 20.8.

### 20.6 ✅ Decision Lifecycle — states/transitions unchanged; event_type/version_event now real (§9)

Same 7 rows / 8 states as before, unchanged (`Identified→Analysed→Proposed→Reviewed→Approved→Applied→Superseded→Archived`). New this session: every row carries a real `event_type` (matching §16's named events exactly) and, from `Analysed→Proposed` onward, a `version_event` (Ch.41 §15 vocabulary: `VersionCreated→VersionValidated→VersionPublished→VersionActivated→VersionSuperseded→VersionArchived`, in that order, confirmed with the owner) — `Identified→Analysed` alone stays a pure Revision. `transitionDecision` now reads `gate.eventType` off the resolved Transition Definition instead of publishing a hardcoded literal, and now passes `entityId` to `transitionEngine.evaluate()` (a latent gap every other entity's own Version Feature Plan pass found and fixed).

"Only Approved Decisions may influence Deliverable state transitions," generalized beyond Deliverable via the polymorphic gate, is unchanged and still real (`qualityGateEngine.ts`, `dependencyDefinitionEngine.ts`, `compliance.ts`).

### 20.7 ✅ Decision Relationships — 5 of 7 real (§10)

| Relationship | Real? | Evidence |
|---|---|---|
| Deliverables | ✅ | Generalized — `related_objects[]` groups, one group per entity type, multiple ids per group; no longer Deliverable-specific. |
| Knowledge | ✅ | `knowledge_ids[]`. |
| Evidence | ✅ | `evidence_ids[]`. |
| Obligations | ⚠️ reverse only | Unchanged. |
| Risks | ❌ | Unchanged — no Risk entity exists anywhere. |
| other Decisions | ✅ | A `related_objects` group with `related_object_type: "Decision"` is a real, general link now; `originating_type`/`originating_id` can also point at another Decision (what gave rise to this one). Still no *dedicated* supersession link (FR-19.6 remains ❌). |
| Ontology concepts | ✅ | `category`/`alternatives[].status` remain narrow classification links, but `related_objects[]` with `related_object_type: "Ontology"` is a real, general relationship to any Ontology concept now (also closes §11's "applicable Ontology" context field, 20.8). |

### 20.8 ✅ Decision Context — 7 of 7 fields real (§11)

| Context field | Real? |
|---|---|
| Engineering Behavior Model version | ✅ — EBM is tied to the SEU (`seu.active_ebm_id`), so `seu_id` already pins it; no separate field needed. Consistent with Ch.9 §19's own finding that EBM recomposition/versioning isn't a built concept anywhere on the platform yet — nothing exists for a separate field to point at. |
| SEU identifier | ✅ `seu_id` |
| applicable Ontology | ✅ — `related_objects[]` with `related_object_type: "Ontology"` names the specific concept(s) this Decision was reasoned against, same general mechanism as "relevant Deliverables" below; `category`/`alternatives[].status` remain separate, narrower classification links, not this field |
| relevant Deliverables | ✅ closed — `related_objects[]` is now a real, multi-entity, multi-id set |
| applicable Constraints | ✅ — a Constraint is a Policy (Ch.24); a `related_objects[]` group with `related_object_type: "Policy"` names the applicable ones, same mechanism as Ontology/Obligation above |
| active Obligations | ✅ — a `related_objects[]` group with `related_object_type: "Obligation"` names which Obligations were active/relevant when this Decision was made, same mechanism as applicable Ontology above |
| engineering assumptions | ✅ `alternatives[].assumptions` — assumptions belong to the alternative they apply to; the alternatives ARE the decision-making, so there is no separate Decision-level assumptions snapshot to build on top of this |

`originating_type`/`originating_id` (new this session) also lands here conceptually — "what gave rise to this Decision" (e.g. an AttentionItem) — though the chapter doesn't name it as a §11 field explicitly; it's closer to §14 Provenance in the chapter's own framing (20.11). No `originating_seu_id` was added — `related_seu` (20.11) covers cross-SEU propagation instead, a different need (outbound reuse, not inbound origin).

### 20.9 ✅ Decision Rationale — real, now per-alternative (§12)

`rationale` moved from one Decision-level free-text field to one per `alternatives[]` entry — closer to the chapter's four-part ask (why considered / why selected / why rejected / consequences) than before, since each alternative now independently carries its own `rationale` alongside its own `assumptions[]`/`consequences[]`/`status`, rather than every alternative's reasoning collapsing into one shared blob. Still free text within each entry, not further decomposed into the four named parts.

### 20.10 ⚠️ Decision Reuse — still unimplemented; propagation scaffolding added (§13)

No search/recommend/copy-forward code exists, unchanged. New this session: `related_seu[]` — a real, structured pointer to other SEUs/Packs this Decision's outcome should propagate to — gives Decision Reuse a real field to eventually consume, but nothing reads or acts on it yet. Still purely aspirational as a mechanism.

### 20.11 ✅ Decision Provenance — 6 of 6 fields real (§14)

| Provenance field | Real? |
|---|---|
| originating SEU | ✅ `seu_id` |
| originating Deliverable | ✅ broadened — `related_objects[]`, any entity type, plus `originating_type`/`originating_id` for "what gave rise to this Decision" specifically |
| contributing Participants | ✅ `participant_id` — single-valued (most recent actor), not a full multi-contributor list; full history stays in `events` |
| supporting Knowledge | ✅ `knowledge_ids[]` |
| supporting Evidence | ✅ `evidence_ids[]` |
| approval history | ✅ — `events` carries the full history: 8 distinct `event_type`s (not one generic transition event), each with `actorId`/`authorityBadge`/`fromState`/`toState` (20.6/20.13). Same platform-wide mechanism Version Feature Plan.md establishes for every entity — a read over `events`, not a first-class field on the row itself, by design. |

Immutability still holds by omission — `decisionsDB.updateStatus` touches only `status`/`participant_id`/`authority_badge`/`updated_at`, no content-field update path exists.

### 20.12 ⚠️ Decision Versioning — event mechanism real; no version-row mechanism (§15)

`transition_definitions.event_type`/`.version_event` are now populated for all 7 rows (20.6), and `transitionDecision` publishes accordingly — this is the platform's standard Version Feature Plan mechanism (same as Objective/Pack/Template/Profile/Service Definition/Policy Definition), where "version history" is a read over `events` filtered to non-null `version_event` rows, not a write path. What the chapter literally asks for — "Modifications shall create new versions," "Historical Deliverables shall continue to reference the Decision version in effect at the time" — still doesn't exist: there is no `version` column on `decisions`, no `supersedes`/`superseded_by` link (FR-19.6, unchanged), and both `related_objects` and the reverse `evidence.originating_decision_id` still point at the single current row with no version-pinning. Consistent with the platform-wide pattern (no core entity has a literal version-row mechanism) — not a Decision-specific shortfall, but the chapter's own §15 text describes something closer to per-version rows than what any entity on this platform currently builds.

### 20.13 ✅ Events — 8 of 8 named events real (§16)

All 8 chapter-named events are now real, distinct `event_type` literals wired through `transition_definitions` (migration 231): `DecisionIdentified` (creation, unchanged), `DecisionAnalysed`, `DecisionProposed`, `DecisionReviewed`, `DecisionApproved`, `DecisionApplied`, `DecisionSuperseded`, `DecisionArchived`. The generic `DecisionTransitioned` fallback in `transitionDecision` is now dead code in practice — every real row resolves its own literal `event_type`.

### 20.14 ✅ Non-Functional Requirements (§17)

| NFR | Verdict | Basis |
|---|---|---|
| preserve complete rationale | ⚠️ | Real, per-alternative now, still unstructured free text within each entry (20.9) |
| support versioning | ⚠️ | Event mechanism real, no version-row mechanism (20.12) |
| maintain provenance | ✅ | 6/6 fields real (20.11) |
| remain independent of Participants | ✅ | Correctly real now — captured, not absent; independence means the Participant is replaceable (20.1) |
| support explainability | ✅ | Structured `alternatives[]` (statement/assumptions/consequences/status/rationale each), plural Knowledge/Evidence, real per-state events |
| support long-term reuse | ❌ | Still no mechanism; `related_seu` is scaffolding only (20.10) |

### 20.15 ✅ Acceptance Criteria (§18)

| Criterion | Verdict |
|---|---|
| Decisions possess unique identities | ✅ |
| Decisions reference supporting Knowledge and Evidence | ⚠️ real, plural, still not enforced non-empty |
| Alternatives are preserved | ✅ `alternatives[]` (20.3 FR-19.4) |
| Decision rationale is permanently recorded | ⚠️ per-alternative now, still unstructured within each entry (20.9) |
| Decision provenance is maintained | ✅ 6/6 fields real (20.11) |
| Historical Decisions remain reusable | ❌ zero mechanism (20.10) |

### 20.16 ✅ Deliverables — 6 of 7 real artifacts (§19)

| Named Deliverable | Real artifact | Verdict |
|---|---|---|
| Decision domain model | `DecisionRow` (`seuTypes.ts`) | ✅ |
| Decision repository | `decisionsDB` (`decisionsDB.ts`) | ✅ |
| Decision lifecycle service | `createDecision`/`transitionDecision` (`core/decisions.ts`) | ✅ |
| Decision versioning service | — | ⚠️ event-tag read-path real (20.12), no dedicated write-path service |
| Decision relationship model | — | ✅ `related_objects`/`related_seu`/`knowledge_ids`/`evidence_ids`/`originating_type`+`id` — genuinely richer than a single scalar FK pair, still no dedicated join tables |
| Decision APIs | `src/routes/seu/api/decisions.ts` | ✅ |
| Decision events | 8 named events | ✅ 8 of 8 (20.13) |

### Summary — ranked

1. **[Data model, closed]** Alternatives structure, plural Knowledge/Evidence, structured provenance, per-state events, and correct participant independence semantics are all real now — the four largest gaps the 2026-08-22 pass flagged are closed or substantially closed.
2. **[Data model, still open]** No supersession link (FR-19.6) and no literal version-row mechanism (20.12) — the platform-wide event-tag Version mechanism is real, but the chapter's own "new version row, historical references pin to the version in effect at the time" text describes something no entity on this platform currently builds.
3. **[Code, still open]** Decision Reuse (§13) remains entirely aspirational; `related_seu` is new scaffolding with nothing consuming it yet (20.10).
4. **[Context, closed]** §11 Decision Context is 7 of 7 real, up from 1 of 7 — `seu_id` (EBM included, since EBM is tied to the SEU), `related_objects[]` (Ontology/Obligation/Policy), and `alternatives[].assumptions` between them cover every field (20.8).
5. **[Governance, unchanged, still stronger than specified]** Approved-Decision gating generalizes to any governed entity type via `related_objects`, not "Deliverable state transitions only" (20.6).
6. **[Ontology, closed]** All 5 chapter categories now seeded (20.4); Pack-contribution remains CR-056.