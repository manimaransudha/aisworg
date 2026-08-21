
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

# 20. Implementation Specifics (2026-08-21, revised)

Verified directly against the live codebase (migrations, `seuTypes.ts`, `evidenceDB.ts`, `core/evidence.ts`, `api/evidence.ts`, `web/seus.ts`, `views/seu/seus/detail.ejs`, `transitionDefinitions.json`, `authorityVocabulary.json`, `030_ontology.sql`, `qualityGateEngine.ts`, `core/packs.ts`, `eventBus.ts`, CR-042, and the test suite) — not from memory. Format follows Ch.5 §19's own convention: number, claim, status, at the heading level, so the outline itself shows what's done. Organised around the two-part split the owner drew out while reviewing this: Part A (definition — what needs Evidence) turned out not to be a gap at all; every real gap lives in Part B (wiring — how a specific Evidence row links to what it supports).

## 20.1 Part A ✅ — the definition of what needs Evidence is already generic, not a gap

Declarative, authoring-time, Pack-contributed — not a property of any Evidence row itself. A `quality_gates` row declares its own `(entity_type, from_state, to_state, criteria)` — e.g. `entity_type: "Deliverable", from_state: "Approved", to_state: "Baselined", criteria: {type: "requires_accepted_evidence_or_approved_decision"}`, `originating_pack_id` tying it to the contributing Pack. Confirmed live: `core/knowledge.ts`, `core/decisions.ts`, `core/obligations.ts`, and Evidence's own `core/evidence.ts` (`transitionEvidence`) **all** call `qualityGateEngine.evaluate` with their own `entityType` — the same mechanism gates Deliverable, Knowledge, Decision, Obligation, and Evidence's own transitions alike. `compliance.ts`'s `requires_accepted_evidence` criterion is a second, independent instance of the same shape.

This grounds the chapter's own trust-pipeline language, corrected from an earlier misreading of it as a linear relay (Information → Evidence → Knowledge → Decision → Deliverable, each a fixed stage): "Nothing should become Knowledge... nothing should close an Obligation... without Evidence" (opening note) and §10's list both describe *separate, parallel* Part-A instances — independent Quality Gate/Compliance rows — not sequential stops on one chain.

**Confirmed (owner): "Review Gate is just a Quality Gate whose criteria happens to be 'requires an accepted Review.' One underlying mechanism, different criteria types plugged into it"** — true at the engine level: `requires_accepted_review` is a real criteria type in `qualityGateEngine.ts`, evaluated by the exact same code path.

**Two wrinkles noted, not treated as gaps needing action now:**
- `PackContributions` has two separate declared fields matching Ch.5 §9 — `qualityGates` and `reviewGates`. Only `qualityGates` is materialised (`core/packs.ts` calls `qualityGatesDB.upsert` for it); `reviewGates` is populated with real content in every seeded Pack but nothing reads it — declared, inert. No seeded Pack authors `requires_accepted_review` inside `qualityGates` either, so that criteria type is proven only by direct test setup (`tests/review-model.test.ts`), never by a real Pack contribution.
- **External Evidence's own trigger mechanism (owner): "This will be defined in the pack using the external evidence required flag. How that is generated is outside the scope of the platform."** Confirmed: `VerifiableItemFields.externalEvidence?: boolean` already exists (CR-016/§20), with matching help text already in the form generator. Same shape as the `reviewGates` wrinkle: declared, not enforced anywhere at runtime.

**Owner's own sequencing decision:** the authoring surface does need fixing eventually ("Yes the authoring surface has to be modified") but deliberately *after* Part B's data structures settle — "I wanted to get the underlying structures correctly first before changing the authoring so we are not in multiple cycles." Neither wrinkle above is in CR-051's own scope as a result.

## 20.2 Part B ⚠️ — multi-relationship + cross-SEU sharing ✅ Built 2026-08-21, provenance/versioning/events remain (CR-051)

This is the runtime/schema mechanism connecting an *already-created* Evidence row to what it backs. Three unreconciled paths exist today:

1. ~~`evidence.related_object_type`/`related_object_id` — a single polymorphic pointer; one row names exactly one related object.~~ **✅ Built 2026-08-21** — replaced by a new `evidence_relationships` join table (migration `086_evidence_relationships.sql`); one Evidence row now relates to any number of objects via `evidenceDB.addRelationship`/`findRelationshipsByEvidenceId`, with `findByRelatedObject` reimplemented as a JOIN (same public signature, zero changes needed in `qualityGateEngine.ts`/`dependencyDefinitionEngine.ts`/`traceability.ts`).
2. An optional `evidenceId` FK on Knowledge/Decision rows only — asymmetric, no equivalent for Deliverable/Obligation. Still open.
3. A live, unpersisted query at Quality-Gate-evaluation time (`qualityGateEngine.ts` → `evidenceDB.findByRelatedObject`) — nothing records *which* Evidence satisfied *which* evaluation. Still open (join table records relationships, not per-evaluation satisfaction).

**Settled design direction (owner's own worked example): "the same test results could support Source Code and a Deployment Readiness review and a Compliance obligation, simultaneously... So: two separate persistent entities, linked by reference, not one nested in the other."** Evidence stays its own independently-persisted, top-level entity — the fix is entirely the *relationship* mechanism connecting it outward to many artefacts at once, not where Evidence itself lives. **Built exactly this way.**

**Cross-SEU sharing is part of the same fix, confirmed (owner): "An external evidence can be used across multiple SEUs."** ✅ Built 2026-08-21, as a free side effect — `findByRelatedObject` never filtered by matching `seu_id`, and `createEvidence`'s same-SEU ownership check (the one thing actively blocking this) was removed; existence-only validation remains via `assertRelatedObjectExists`.

**Provenance — Participants generate Evidence (owner): "A participant (human or AI, running its own tools) produces the evidence and it gets attributed to them permanently."** Only `seu_id` + the single related-object pointer exist; no originating Participant/Capability/Decision/activity fields anywhere. **Resolves an apparent tension, not a real one**: §4's "Evidence is independent of Participants" doesn't mean attribution is optional — confirmed against **DM-006** (Ch.15, Deliverable Model: "Deliverables are independent of Participants," the identical pattern one level over). Independence means Evidence's *validity* doesn't depend on the producing participant continuing to exist; provenance (permanent) and existential independence are two different axes.

**Evidence's own identity**: an instance, not a definition — no `code`, unlike Pack/Template/Profile/Deliverable Definition. "Versioning" (§15) reads as a supersession chain, not a `(code, version, tenant)` catalog identity like Template's.

**Evidence's siblings, Review and Finding**, are Part A precedent (a separate criteria type on the same mechanism), not Part B.

**Evidence creation stays a deliberate act (owner) — bounds CR-052: "Evidence starts at Collected (§9)... That's not something that materialises just because a participant finished a task; someone has to actually create the Evidence record with those fields filled in."** Either directly, or via an Interaction Adapter translating raw tool output into the platform's own vocabulary (confirmed real: Ch.36's own architecture). Whatever CR-052 lands on, the event still has to carry a deliberately-shaped Evidence payload.

**Event Bus's own role, settled (owner): "event bus has to be a pub/sub mode. event bus itself should not be deciding anything... we will review the event bus as part of 52."** The Bus is pure transport — never decides, never applies a transition. `eventBus.ts` already implements real pub/sub, not a stub, but almost nothing in production subscribes yet — confirmed via CR-042's own closure notes that the one existing analogous mechanism (Dependency Engine push-evaluation) is publish-only by explicit design, no reactive consumer anywhere. Folded into CR-052's own scope.

## 20.3 EM-001–006 Architectural Principles ⚠️ — mostly built, provenance and reuse open (§4/§5)

- **EM-001 Evidence precedes trust** ✅ — `qualityGateEngine.ts`'s `requires_accepted_evidence_or_approved_decision` and `core/compliance.ts`'s `requires_accepted_evidence` both gate on Evidence before allowing a transition/compliance pass.
- **EM-002 Immutable after acceptance** ✅ — architecturally, not by a runtime check: `evidenceDB.ts` has `create`/`updateStatus`/`findBy*`/`count` only, no `update`/`updateContent` method exists at all.
- **EM-003 Independently identifiable** ✅ — UUID PK, `evidence.id`.
- **EM-004 May support multiple engineering artefacts** ✅ Built 2026-08-21 — see 20.2; `evidence_relationships` join table, genuinely many-to-many now.
- **EM-005 Shall preserve provenance** ✅ Built 2026-08-21 — see 20.2/20.10.
- **EM-006 Shall remain independently reusable** ⚠️ aspirational — see 20.12.

## 20.4 FR-17.1–7 Functional Requirements ⚠️ — mixed, see individual items (§6)

| FR | Verdict | Note |
|----|---------|------|
| FR-17.1 unique identifier | ✅ | UUID PK |
| FR-17.2 provenance | ✅ Built 2026-08-21 | `originating_deliverable_id`/`originating_participant_id`/`originating_capability_id`/`originating_decision_id`/`originating_activity`, all on `evidence` |
| FR-17.3 versioning | ✅ Built 2026-08-21 | `supersedes_evidence_id`, self-referential FK on `evidence` |
| FR-17.4 multiple relationships | ✅ Built 2026-08-21 | `evidence_relationships` join table, genuinely many-to-many |
| FR-17.5 immutable after acceptance | ✅ | see EM-002 |
| FR-17.6 fully traceable | ✅ (Deliverable direction) | `core/traceability.ts`'s `explainDeliverable` surfaces `supportingEvidence` via `evidenceDB.findByRelatedObject` |
| FR-17.7 reusable across multiple objects | ✅ Built 2026-08-21 | same fix as FR-17.4; cross-SEU sharing (20.2) built as a free side effect |

## 20.5 Evidence Categories ✅ — Fixed 2026-08-21 (§7)

The chapter names 6 categories (Analytical/Validation/Operational/Review/Decision/External). `030_ontology.sql` originally seeded only 2 of them under `category:evidence`. The web form offered all 6 regardless — since `assertCanonicalCategory` rejects anything not seeded as active, selecting the other 4 threw at submission, a live bug. **Fixed**: migration `085_evidence_category_ontology_gap.sql`, all 6 chapter-named categories now seeded. No code change was needed — `assertCanonicalCategory`/the form are fully generic over whatever is seeded.

## 20.6 Evidence Structure ⚠️ — partial, Collection Method missing (§8)

Present: Identifier, Title, Category, Description, Status, Source, Confidence Level, Timestamp, Related-object (singular). **Missing**: a distinct Collection Method field (the chapter lists it separately from Source; no such column exists) — a new column + form field, not yet tracked in a CR. Related Deliverables/Knowledge/Decisions/Obligations (plural) — see 20.2.

## 20.7 Evidence Lifecycle ✅ — Fixed 2026-08-21, Rejected branch added (§9)

Collected → Validated → Accepted → Referenced → Archived exists exactly as specified. The Rejected branch didn't exist — no transition into a Rejected state from anywhere, contradicting §9's own "Rejected evidence shall remain preserved for audit purposes." **Fixed**: `Collected→Rejected` and `Validated→Rejected` added to `transitionDefinitions.json`/`authorityVocabulary.json` (new verb `reject`), Rejected is terminal. Verified live and covered by a new test in `tests/trust-pipeline.test.ts`. (The *event* for landing in Rejected is a separate, still-open gap — 20.14.)

## 20.8 Evidence Relationships ✅ — Built 2026-08-21 (§10; CR-051)

The chapter's "one Evidence Item may support many engineering artefacts" — see 20.2 for the full analysis and settled design direction, now built: a new `evidence_relationships` join table replaces the single-pointer column, with `findByRelatedObject`/`traceability.ts`/`qualityGateEngine.ts`/`compliance.ts` all reading through it unchanged (same public signature). Knowledge/Decision's own optional `evidenceId` FK (the reverse direction) is untouched by this fix, still asymmetric — not in this CR's scope. Reviews and Policies still have no Evidence linkage found anywhere.

## 20.9 Evidence Validation ❌ — open, aspirational (§11)

The chapter's five validation dimensions (authenticity/completeness/consistency/source credibility/engineering relevance) are not recorded anywhere — "Validated" is a bare state transition with no structure for which criteria were checked. Matches an already-accepted platform-wide pattern (CR-049's own Chapter 15 review, "Refinement/Validation... governed by the EBM... not authored as a field anywhere"): EBM-governed criteria are treated as conceptual governance, not concrete per-criterion data, everywhere else in this codebase. Not yet tracked in a CR.

## 20.10 Evidence Provenance ✅ — Built 2026-08-21 (§12; CR-051)

Five nullable columns on `evidence`: `originating_deliverable_id`, `originating_participant_id`, `originating_capability_id`, `originating_decision_id`, `originating_activity` — matches originating SEU (already `evidence.seu_id`) plus the five named in §12. All optional at creation time; `originating_deliverable_id` auto-derives from the creating relationship when it's a Deliverable, the rest are only ever set if supplied. The §4 "independent of Participants" tension (resolved against DM-006 — existential independence, not optional attribution) still holds: Evidence's validity doesn't depend on the Participant continuing to exist, but its attribution is now permanently recorded. A structurally similar `ProvenanceEntry` exists in `traceability.ts`, but it's a Deliverable state-history concept, unrelated to Evidence's own record.

## 20.11 Evidence Confidence ⚠️ — partial, not a computed model (§13)

`confidence_level` exists and is UI-driven (Low/Medium/High) ✅, but is typed as a plain `string` — no DB CHECK, no TS union. The chapter's "confidence may be influenced by source reliability / validation outcome / corroborating evidence / engineering review" is not computed anywhere — a flat author-set value, not a model. Same aspirational caveat as 20.9. Not yet tracked in a CR.

## 20.12 Evidence Reuse ❌ — open, aspirational (§14)

No explicit "this Evidence was reused in context X" tracking exists, and no applicability check. Evidence can be *read* by multiple consumers already, but nothing records that a read constituted a reuse. Same EBM-governance caveat as 20.9/20.11. Not yet tracked in a CR.

## 20.13 Evidence Immutability & Versioning ✅ — both built (§15; CR-051)

Immutability holds architecturally (EM-002 — no `update` method exists on `evidenceDB`). "Corrections shall create new Evidence Items linked to previous versions" — built 2026-08-21 as `supersedes_evidence_id`, a self-referential FK, a supersession chain rather than Template-style `(code, version, tenant)` catalog identity (Evidence has no `code`). Deliberately does not cascade: superseding a predecessor that's shared across multiple SEUs (item 2) changes nothing about the predecessor's own relationships or status — proven directly by test and live smoke test, not just asserted.

## 20.14 Events ✅ — Built 2026-08-21, full named set (§16; CR-051)

`EvidenceCollected` (on creation) plus five named lifecycle events — `EvidenceValidated`, `EvidenceAccepted`, `EvidenceReferenced`, `EvidenceArchived`, `EvidenceRejected` — each published via the same `EVENT_BY_TARGET_STATE` map pattern already used for Pack/Template (CR-025) and Deliverable Definition (CR-049 Phase 1). The generic `EvidenceTransitioned` remains only as a defensive fallback and never actually fires — every real Evidence target state is covered by the map. (`EvidenceLinked` and `EvidenceSuperseded`, added alongside items 1 and 4, are additional announcement-only events outside this list's original six, following the same non-reactive pattern.)

## 20.15 Non-Functional Requirements ⚠️ — mixed (§17)

Preserve provenance ❌ (20.2/20.10), maintain immutability ✅, support traceability ✅ (Deliverable direction only), support independent reuse ⚠️ aspirational (20.12), remain independent of Participant implementations ✅ — though trivially so, since Participant provenance isn't tracked at all rather than being a deliberately achieved independence.

## 20.16 Acceptance Criteria ⚠️ — mixed, re-scored against the code (§18)

| Criterion | Verdict |
|---|---|
| Evidence possesses unique identity | ✅ |
| Accepted Evidence is immutable | ✅ |
| Evidence supports multiple engineering artefacts | ❌ (20.2/20.8) |
| Provenance is preserved | ❌ (20.2/20.10) |
| Confidence assessments are available | ✅ (flat field, not a model) |
| Historical Evidence remains accessible | ✅ (no delete path; Archived is terminal, not removed) |

## 20.17 Deliverables ⚠️ — mixed, re-scored (§19)

Evidence domain model ✅, repository interfaces ✅ (`evidenceDB.ts`), lifecycle service ✅ (`transitionEvidence`), Provenance service ✅ Built 2026-08-21 (five originating-* fields on `evidence`), Confidence assessment model ⚠️ (flat field only, not a model), Evidence APIs ✅ (`api/evidence.ts`), Evidence events ✅ Built 2026-08-21 (full named set).

## Summary — what's genuinely open, ranked

All Part B (wiring). Part A (20.1) is confirmed already generic and not a gap; its two noted wrinkles (`reviewGates` and `externalEvidence` both declared-but-unenforced) are deliberately deferred until after Part B lands, not tracked in a CR yet.

1. ~~**[Code, largest]** Multi-relationship support (20.2/20.8) — a real join-table schema change.~~ **✅ Built 2026-08-21. Tracked: [CR-051](../../../change-requests/CR-051-evidence-multi-relationship-provenance-versioning-events.md).**
2. ~~**[Code]** Cross-SEU sharing (20.2/20.4) — confirmed requirement: "an external evidence can be used across multiple SEUs."~~ **✅ Built 2026-08-21, as a free side effect of item 1. Tracked: CR-051.**
3. ~~**[Code]** Provenance fields (20.2/20.10) — originating Participant/Capability/Decision/activity.~~ **✅ Built 2026-08-21. Tracked: CR-051.**
4. ~~**[Code]** Versioning + supersede-link (20.13) — a supersession chain, not Template-style catalog identity.~~ **✅ Built 2026-08-21. Tracked: CR-051.**
5. ~~**[Code, small, well-precedented]** Full named event set (20.14).~~ **✅ Built 2026-08-21. Tracked: CR-051.**
6. ~~**[Data]** Missing ontology categories (20.5)~~ **✅ Fixed 2026-08-21.**
7. ~~**[Data]** Rejected lifecycle branch (20.7)~~ **✅ Fixed 2026-08-21.**
8. **[Code, small]** Collection Method field (20.6) — not yet tracked in a CR.
9. **[Code, aspirational, same caveat as elsewhere in this platform]** Validation-criteria recording (20.9), computed confidence (20.11), reuse tracking (20.12) — not yet tracked in a CR.

**Also raised, exploratory, separate from the above:** how Evidence gets *created* — confirmed it must stay a deliberate act, and whether the Event Bus needs genuine pub/sub reactions or stays announcement-only. Both folded into **[CR-052](../../../change-requests/CR-052-evidence-accumulation-via-event-bus.md)**, including a review of the Event Bus's own current state against the "pure transport, never decides" principle.
