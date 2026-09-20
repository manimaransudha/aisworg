
# Chapter 17 – Evidence Model

[Sudha: In the architecture we've developed, we repeatedly state:

> **Knowledge must be supported by Evidence.**

But we've never formally defined what Evidence is.

In fact, I now think Evidence is the **currency of trust** within the entire platform.

Nothing should become Knowledge.

Nothing should become Accepted.

Nothing should move a Deliverable to Approved.

Nothing should close an Obligation.

...without Evidence.

That makes Evidence one of the core architectural concepts.



---------------

While writing this chapter, I realised we've identified a chain that runs through almost every architectural concept we've created:

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

This isn't just a sequence—it is the **trust pipeline** of the platform.

Every stage increases confidence:

- **Information** is raw and unvalidated.
- **Evidence** is validated and attributable.
- **Knowledge** is accepted and reusable.
- **Decisions** apply Knowledge to a specific context.
- **Deliverable State Transitions** occur only after sufficient evidence and approved decisions.

I think this trust pipeline deserves to become an explicit architectural principle because it governs how the platform establishes confidence. It also gives the platform a powerful explainability model: every significant engineering outcome can be traced back through the decisions made, the knowledge applied, the evidence supporting that knowledge, and ultimately the original information from which the evidence was derived.

I'd recommend capturing this as an ADR:

> **ADR – Trust Pipeline**

**Decision:** Significant engineering state transitions shall be justified through a trust pipeline of Information → Evidence → Knowledge → Decision → Deliverable State Transition.

**Rationale:** This provides deterministic explainability, auditability and traceability for all engineering outcomes, while ensuring that confidence is built progressively rather than assumed. It also gives future AI reasoning services a principled basis for explaining _why_ a recommendation or state transition occurred.
]

---

# 1. Purpose

The Evidence Model defines how engineering evidence is captured, validated, linked and preserved within the AI Software Organisation Platform.

Evidence is the foundation upon which engineering confidence is established.

It supports Deliverables, Knowledge, Decisions, Obligations and Governance.

The platform shall treat Evidence as a first-class engineering asset rather than as supplementary documentation.

---

# 2. Scope

This chapter defines:

- Evidence abstraction;
- Evidence lifecycle;
- Evidence relationships;
- Evidence validation;
- Evidence provenance;
- Evidence reuse.

This chapter does not define:

- evidence storage technologies;
- AI reasoning;
- document management implementation;
- external repositories.

---

# 3. Architectural Position

```
Engineering Activity

↓

Evidence

↓

Knowledge

↓

Decision

↓

Deliverable State Transition
```

Evidence provides the objective basis for engineering confidence.

---

# 4. Definition

Evidence is verifiable information that supports an engineering assertion.

Evidence is immutable once accepted.

Evidence may support multiple engineering objects simultaneously.

Evidence is independent of Participants.

---

# 5. Architectural Principles

## EM-001

Evidence precedes trust.

---

## EM-002

Evidence is immutable after acceptance.

---

## EM-003

Evidence is independently identifiable.

---

## EM-004

Evidence may support multiple engineering artefacts.

---

## EM-005

Evidence shall preserve provenance.

---

## EM-006

Evidence shall remain independently reusable.

---

# 6. Functional Requirements

### FR-17.1

Every Evidence Item shall possess a globally unique identifier.

---

### FR-17.2

Every Evidence Item shall possess provenance.

---

### FR-17.3

Evidence shall support versioning.

---

### FR-17.4

Evidence shall support multiple relationships.

---

### FR-17.5

Evidence shall remain immutable after acceptance.

---

### FR-17.6

Evidence shall remain fully traceable.

---

### FR-17.7

Evidence shall be reusable across multiple engineering objects.

---

# 7. Evidence Categories

Illustrative categories include:

## Analytical Evidence

- Architecture analysis
- Performance analysis
- Security analysis
- Cost analysis

---

## Validation Evidence

- Test results
- Static analysis reports
- Code quality reports
- Benchmark results

---

## Operational Evidence

- Monitoring data
- Deployment records
- Incident reports
- Runtime metrics

---

## Review Evidence

- Architecture reviews
- Peer reviews
- Security assessments
- Compliance reviews

---

## Decision Evidence

- Alternatives evaluated
- Trade-off analysis
- Risk assessment
- Supporting rationale

---

## External Evidence

- Regulatory guidance
- Industry standards
- Vendor documentation
- Research publications

Additional categories may be introduced through Packs.

---

# 8. Evidence Structure

Every Evidence Item shall define:

- Identifier
- Title
- Category
- Description
- Status
- Source
- Collection Method
- Confidence Level
- Timestamp
- Related Deliverables
- Related Knowledge
- Related Decisions
- Related Obligations
- Provenance

---

# 9. Evidence Lifecycle

Evidence shall progress through the following lifecycle.

```
Collected

↓

Validated

↓

Accepted

↓

Referenced

↓

Archived
```

Rejected evidence shall remain preserved for audit purposes.

---

# 10. Evidence Relationships

Evidence may support:

- Deliverables
- Knowledge
- Decisions
- Obligations
- Quality Gates
- Reviews
- Policies

One Evidence Item may support many engineering artefacts.

---

# 11. Evidence Validation

Evidence shall be validated before acceptance.

Validation may include:

- authenticity;
- completeness;
- consistency;
- source credibility;
- engineering relevance.

Validation rules are governed by the Engineering Behavior Model.

---

# 12. Evidence Provenance

Every Evidence Item shall preserve:

- originating SEU;
- originating Deliverable;
- originating Participant;
- originating Capability;
- originating Decision;
- originating engineering activity.

Provenance shall never be discarded.

---

# 13. Evidence Confidence

Every Evidence Item shall include a confidence assessment.

Confidence may be influenced by:

- source reliability;
- validation outcome;
- corroborating evidence;
- engineering review.

Confidence shall not replace engineering judgement.

---

# 14. Evidence Reuse

Evidence may be reused where appropriate.

Reuse shall preserve:

- provenance;
- original context;
- validation history;
- source references.

Consumers shall be able to determine whether reused evidence remains applicable to the current context.

---

# 15. Evidence Immutability

Accepted Evidence shall not be modified.

Corrections shall create new Evidence Items linked to previous versions.

Historical Evidence shall remain accessible.

---

# 16. Events

The Evidence subsystem shall publish:

- EvidenceCollected
- EvidenceValidated
- EvidenceAccepted
- EvidenceRejected
- EvidenceReferenced
- EvidenceArchived

---

# 17. Non-Functional Requirements

The Evidence Model shall:

- preserve provenance;
- maintain immutability;
- support traceability;
- support independent reuse;
- remain independent of Participant implementations.

---

# 18. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Evidence possesses unique identity.

✓ Accepted Evidence is immutable.

✓ Evidence supports multiple engineering artefacts.

✓ Provenance is preserved.

✓ Confidence assessments are available.

✓ Historical Evidence remains accessible.

---

# 19. Deliverables

Implementation of this chapter shall produce:

- Evidence domain model.
- Evidence repository interfaces.
- Evidence lifecycle service.
- Provenance service.
- Confidence assessment model.
- Evidence APIs.
- Evidence events.

---

# 20. Implementation Status & Gaps

Code-verified audit (2026-09-18), superseding all prior dated passes below in full — this session rebuilt the Evidence model end to end (migration 232, not yet applied to the live DB at the time of writing; verified against migration SQL and the rewritten TypeScript, not a live query). Core files: `src/dblayer/evidenceDB.ts`, `src/routes/seu/core/evidence.ts`, `src/routes/seu/api/evidence.ts`, `src/routes/seu/web/seus.ts`, `evidence_relationships` (migration 086, extended this session), `030_ontology.sql`/`085`/`223`/`232`, `transitionDefinitions.json`, `qualityGateEngine.ts`, `core/compliance.ts`, `core/traceability.ts`, `core/participantHome.ts`. Organised around the two-part split established in an earlier pass: Part A (definition — what needs Evidence, entirely declarative/Pack-contributed) is generic and closed; Part B (wiring — how a specific Evidence row links to what it supports) is where this session's changes land.

## 20.1 ✅ Part A — the definition of what needs Evidence is generic, not a gap

Declarative, authoring-time, Pack-contributed — not a property of any Evidence row itself. A `quality_gates` row declares its own `(entity_type, from_state, to_state, criteria)` — e.g. `entity_type: "Deliverable", from_state: "Approved", to_state: "Baselined", criteria: {type: "requires_accepted_evidence_or_approved_decision"}`, `originating_pack_id` tying it to the contributing Pack. `core/knowledge.ts`, `core/decisions.ts`, `core/obligations.ts`, and Evidence's own `core/evidence.ts` all call `qualityGateEngine.evaluate` with their own `entityType` — one mechanism gates Deliverable, Knowledge, Decision, Obligation, and Evidence's own transitions alike. `compliance.ts`'s `requires_accepted_evidence` criterion is a second, independent instance of the same shape. "Review Gate is just a Quality Gate whose criteria happens to be 'requires an accepted Review'" holds at the engine level — `requires_accepted_review` is a real criteria type, same code path.

Two wrinkles, deliberately deferred rather than gaps: `PackContributions.reviewGates` is populated with real content in every seeded Pack but nothing reads it (only `qualityGates` is materialised); and `VerifiableItemFields.externalEvidence?: boolean` exists and is form-rendered but enforces nothing at runtime — "defined in the pack using the external evidence required flag," out of platform scope by design. Both deferred until after Part B's structures settle, on the owner's own sequencing call.

## 20.2 ✅ Part B — multi-relationship, provenance, versioning, events, access: all real, provenance mechanism rebuilt this session

The runtime/schema mechanism connecting an *already-created* Evidence row to what it backs.

- **Multi-relationship (all of it, including SEU membership and provenance)** — `evidence_relationships` (migration 086, extended by migration 232) is now the *one* mechanism for every relationship Evidence has. This session folded `seu_id` and all five `originating_*` provenance columns into it: SEU membership is a `related_object_type: 'SEU'` row, and Deliverable/Participant/Capability/Decision provenance are `evidence_relationships` rows of those types — the same mechanism, not a bespoke column per relationship kind. `originating_activity` (free text, not an entity reference) is dropped with no replacement. **This is a mechanism change, not a requirement reversal** — owner: "it is not reversing anything. The implementation is changing." §12's provenance guarantee still holds; it's expressed uniformly now instead of through five separate FK columns plus a privileged `seu_id` column.
- **Cross-SEU sharing** — unchanged: `findByRelatedObject`/`findBySeuId` were never ownership-filtered beyond existence checks (`assertRelatedObjectExists`), so Evidence shared across SEUs still works the same way.
- **Access is badge-governed, not participant-governed** — confirmed this session, resolving §17's "remain independent of Participant implementations" precisely: authority to act on an Evidence record comes from holding the right badge (`requireBadge.ts`/`badgeAuthorityEngine`, the same mechanism every governed entity uses), never from matching a `participant_id` against the record. This is *why* Evidence carries no participant-attribution column at all now — it doesn't need one to gate access, and it doesn't need one for provenance either (previous paragraph).
- **Versioning** — `supersedes_evidence_id` unchanged: a self-referential FK, a supersession chain, not a Template-style catalog identity. Newly reconciled with the platform's Version Feature Plan.md mechanism this session: `Collected→Validated` is the one real `version_event` (`VersionCreated`) among Evidence's 6 `transition_definitions` rows — `Validated→Accepted→Referenced→Archived` all continue that same version (no further version_event; the row is shared, not re-versioned, at each of those hops), and Supersede itself (not a state transition — a new row, created via `supersedes_evidence_id`) is the `VersionSuperseded`-equivalent act, tagged directly since it has no `transition_definitions` row of its own to carry it.
- **Events** — unchanged and real: `EvidenceCollected` plus five named lifecycle events, now sourced from `transition_definitions.event_type` (migration 232) instead of a hardcoded map in `core/evidence.ts`, same mechanism as every other entity's own Version Feature Plan pass.

**Resolved this session**: the reverse-pointer duplication flagged in the prior pass (`evidence.originating_decision_id` vs `decisions.evidence_ids[]`) is gone — `originating_decision_id` no longer exists. `decisions.evidence_ids[]` (Ch.19, migration 231) is now the sole source of truth for that relationship, exactly as the owner directed. Knowledge's own scalar `evidence_id` FK is untouched — still a separate, narrower mechanism than Evidence's own outward `evidence_relationships`, not in this session's scope.

A live, unpersisted query at Quality-Gate-evaluation time (`qualityGateEngine.ts` → `evidenceDB.findByRelatedObject`) still records no per-evaluation satisfaction — the join table records relationships, not which Evidence satisfied which specific evaluation. Still open.

Evidence creation stays a deliberate act, not something that materialises automatically from task completion — either directly, or via an Interaction Adapter translating raw tool output (Ch.36). The Event Bus is pure transport (real pub/sub, `eventBus.ts`) — it never decides or applies a transition; almost nothing in production subscribes yet, an accepted, deliberate state, not a gap.

## 20.3 ✅ EM-001–006 Architectural Principles (§4/§5)

- **EM-001 Evidence precedes trust** ✅ — unchanged.
- **EM-002 Immutable after acceptance** ✅ — architecturally: no content-update method exists. `appendValidationAssessment` (20.9/20.11) only ever appends, never overwrites an existing entry.
- **EM-003 Independently identifiable** ✅ — unchanged.
- **EM-004 May support multiple engineering artefacts** ✅ — `evidence_relationships`, genuinely many-to-many, now also carrying what used to be provenance columns (20.2).
- **EM-005 Shall preserve provenance** ✅ — mechanism changed, guarantee unchanged (20.2).
- **EM-006 Shall remain independently reusable** ⚠️ aspirational — see 20.12.

## 20.4 ✅ FR-17.1–7 Functional Requirements (§6)

| FR | Verdict | Note |
|----|---------|------|
| FR-17.1 unique identifier | ✅ | UUID PK |
| FR-17.2 provenance | ✅ | `evidence_relationships` rows, not dedicated columns (20.2) |
| FR-17.3 versioning | ✅ | `supersedes_evidence_id`, now reconciled with `version_event` (20.2) |
| FR-17.4 multiple relationships | ✅ | `evidence_relationships` |
| FR-17.5 immutable after acceptance | ✅ | see EM-002 |
| FR-17.6 fully traceable | ✅ (Deliverable direction) | `traceability.ts`'s `explainDeliverable` |
| FR-17.7 reusable across multiple objects | ✅ | same mechanism as FR-17.4; cross-SEU sharing included |

## 20.5 ✅ Evidence Categories (§7)

Unchanged — all 6 chapter categories are real, canonical `category:evidence` Ontology concepts.

## 20.6 ⚠️ Evidence Structure — Collection Method missing (§8)

Present: Identifier, Title, Category, Description, Status, Source, Confidence Level, Timestamp, Related-objects (plural, now also covering what used to be provenance, 20.2). **Missing**: a distinct Collection Method field — the chapter lists it separately from Source; no such column exists. Not yet tracked in a CR.

## 20.7 ✅ Evidence Lifecycle (§9)

Unchanged — `Collected → Validated → Accepted → Referenced → Archived`, plus a real `Rejected` branch off both `Collected` and `Validated` (terminal).

## 20.8 ✅ Evidence Relationships (§10)

"One Evidence Item may support many engineering artefacts" — real via `evidence_relationships`, now the single mechanism for every relationship Evidence has (20.2). Reviews and Policies still have no Evidence linkage found anywhere.

## 20.9 ✅ Evidence Validation (§11)

The chapter's five validation dimensions (authenticity/completeness/consistency/source credibility/engineering relevance) are now real: `validation_dimensions JSONB` (migration 232), an **append-only** array of `{dimension, status, notes, assessedAt}` entries — `dimension` and `status` are both new Ontology concept types (`evidence-validation-dimension`, `evidence-validation-status`: Not Assessed/Pass/Partial/Fail). Append-only by deliberate design (owner): `Validated→Accepted→Referenced→Archived` share one row with no new version minted at each hop, so every assessment ever made must survive as its own entry, never overwritten when a dimension is re-assessed later. `recordValidationAssessment` (`core/evidence.ts`) is the one write path.

## 20.10 ✅ Evidence Provenance (§12)

Mechanism rebuilt this session — see 20.2. Every field §12 names (originating SEU/Deliverable/Participant/Capability/Decision) is real via `evidence_relationships`; `originating_activity` (free text) has no replacement, dropped as out of scope for a relationship mechanism.

## 20.11 ✅ Evidence Confidence — now a real computed model (§13)

`confidence_level` is no longer author-set free text — it's computed from `validation_dimensions` (20.9) via `computeConfidenceLevel` (`core/evidence.ts`): the worst assessed status across the *entire* history wins (any `Fail` anywhere → Low, else any `Partial` → Medium, else High), recomputed on every new assessment, not just the latest one per dimension. Nullable — no value exists until at least one assessment has been recorded. `confidence_level`'s own value vocabulary is now Ontology-backed (`evidence-confidence-level`: Low/Medium/High). This is exactly the chapter's own "confidence may be influenced by validation outcome" — Validation *is* now the input, not a separate, disconnected field.

## 20.12 ❌ Evidence Reuse — open, aspirational (§14)

Unchanged. No "this Evidence was reused in context X" tracking, no applicability check. Not yet tracked in a CR.

## 20.13 ✅ Evidence Immutability & Versioning (§15)

Both real — see 20.2/20.3 EM-002. Versioning is now reconciled with the platform's standard Version Feature Plan.md mechanism (`transition_definitions.event_type`/`.version_event`), not just the pre-existing `supersedes_evidence_id` chain in isolation.

## 20.14 ✅ Events — full named set, now data-driven (§16)

See 20.2. `event_type` moved from a hardcoded `EVENT_BY_TARGET_STATE` map in `core/evidence.ts` to `transition_definitions.event_type` (migration 232), same mechanism as every other entity's own Version Feature Plan pass this platform has completed.

## 20.15 ✅ Non-Functional Requirements (§17)

Preserve provenance ✅ (20.10, mechanism changed, guarantee intact, no open item remaining), maintain immutability ✅, support traceability ✅ (Deliverable direction only), support independent reuse ⚠️ aspirational (20.12), remain independent of Participant implementations ✅ — resolved precisely this session: access is badge-governed, never participant-governed (20.2), and Evidence carries no participant-attribution column at all.

## 20.16 ✅ Acceptance Criteria (§18)

| Criterion | Verdict |
|---|---|
| Evidence possesses unique identity | ✅ |
| Accepted Evidence is immutable | ✅ |
| Evidence supports multiple engineering artefacts | ✅ (20.8) |
| Provenance is preserved | ✅ (20.10) |
| Confidence assessments are available | ✅ — computed, not flat (20.11) |
| Historical Evidence remains accessible | ✅ |

## 20.17 ✅ Deliverables (§19)

Evidence domain model ✅, repository interfaces ✅, lifecycle service ✅, Provenance service ✅ (relationship-based, 20.2), Confidence assessment model ✅ — a real computed model now, not a flat field (20.11), Evidence APIs ✅, Evidence events ✅ (data-driven, 20.14).

## Summary — what's genuinely open, ranked

Part A (20.1) is generic and closed, two wrinkles deliberately deferred. Part B is now substantially complete: multi-relationship, provenance (rebuilt onto one uniform mechanism), versioning (reconciled with the platform's standard Version mechanism), the full named event set, validation dimensions, and computed confidence are all real.

1. **[Code, small]** Collection Method field (20.6) — not yet tracked in a CR.
2. **[Code, aspirational]** Reuse tracking (20.12) — not yet tracked in a CR.
3. **[Code, small]** Per-evaluation Evidence satisfaction isn't recorded (20.2) — `evidence_relationships` records the relationship, not which Evidence satisfied which specific Quality Gate check.

**Also open, exploratory, tracked separately**: how Evidence gets created (confirmed a deliberate act, not automatic) and whether the Event Bus needs genuine reactive subscribers or stays announcement-only — both folded into **[CR-052](../../../change-requests/CR-052-evidence-accumulation-via-event-bus.md)**.
