# Chapter 26 – Quality Gate Model

[Sudha: I think this chapter is where all the governance concepts we've built finally converge.

Let's look at the flow we've created:

- Policies define **constraints**.
- Authority defines **who may authorise**.
- Reviews produce **findings**.
- Findings may create **Obligations**.
- Evidence supports **Knowledge**.
- Knowledge supports **Decisions**.
- Governance evaluates all of these.

But there is still one question left:

> **When is a Deliverable actually allowed to move to the next state?**

That is the responsibility of the **Quality Gate**.

Notice something important.

A Quality Gate is **not** a checklist.

A checklist is merely one possible implementation.

A Quality Gate is actually:

> **A declarative engineering contract that must evaluate to true before a governed state transition may occur.**

That definition is much more powerful.

-------------------

While writing this chapter, I realised we've reached another architectural simplification.

Traditionally, software delivery distinguishes between:

- Definition of Ready
- Definition of Done
- Stage Gates
- Exit Criteria
- Release Gates
- Production Readiness Reviews

Architecturally, I don't think these need to be separate concepts.

They're all instances of the same abstraction:

> **A Quality Gate evaluates whether a specific lifecycle transition is permitted.**

For example:

|Traditional Term|Quality Gate Interpretation|
|---|---|
|Definition of Ready|Entry Quality Gate|
|Definition of Done|Exit Quality Gate|
|Architecture Sign-off|Architecture Quality Gate|
|Release Approval|Release Quality Gate|
|Production Readiness Review|Operational Quality Gate|

This gives the platform a single, consistent mechanism for governing state transitions while allowing Packs to define organisation-specific terminology and criteria.

I think there's one further refinement we should adopt in future chapters.

Every lifecycle transition in the platform—not just Deliverables, but also Decisions, Knowledge Items, Obligations and even SEUs—should reference a **Transition Definition**. A Transition Definition would specify:

- the source state;
- the target state;
- applicable Quality Gates;
- required Authority;
- applicable Policies;
- required Reviews;
- required Evidence;
- required Obligations.

In other words, the transition itself becomes a first-class architectural object. That idea would unify the state models we've created across the platform and eliminate duplicated governance logic. I suspect it will become an important architectural concept when we later define the Runtime Kernel and state management.
]
---

# 1. Purpose

The Quality Gate Model defines how engineering readiness is evaluated before governed state transitions occur within a Software Engineering Unit (SEU).

A Quality Gate determines whether all required engineering conditions have been satisfied before a Deliverable, Decision, Knowledge Item or other governed engineering object may transition to its next lifecycle state.

Quality Gates provide engineering assurance.

They evaluate readiness.

They do not perform engineering work.

They do not authorise engineering work.

---

# 2. Scope

This chapter defines:

- Quality Gate abstraction;
- Quality Gate lifecycle;
- gate evaluation;
- gate composition;
- gate outcomes;
- gate traceability.

This chapter does not define:

- engineering behaviour;
- authority assignments;
- policy definitions;
- review execution.

---

# 3. Architectural Position

```
Policies
     │
Reviews
     │
Evidence
     │
Knowledge
     │
Decisions
     │
Obligations
     │
──────────────
     │
Quality Gate
     │
──────────────
     │
Governance Evaluation
     │
State Transition
```

Quality Gates evaluate engineering readiness.

Governance decides whether the requested state transition may occur.

---

# 4. Definition

A Quality Gate is a declarative engineering contract that specifies the conditions required for a governed engineering state transition.

A Quality Gate evaluates engineering state.

It does not modify engineering state.

---

# 5. Architectural Principles

## QG-001

Quality Gates are declarative.

---

## QG-002

Quality Gates evaluate readiness.

---

## QG-003

Quality Gates are composable.

---

## QG-004

Quality Gates remain independent of Participants.

---

## QG-005

Quality Gate outcomes are traceable.

---

## QG-006

Quality Gates are deterministic.

Given identical engineering state, the same evaluation shall always produce the same outcome.

---

# 6. Functional Requirements

### FR-26.1

Every Quality Gate shall possess a globally unique identifier.

---

### FR-26.2

Quality Gates shall be contributed through Packs.

---

### FR-26.3

Quality Gates shall support composition from multiple organisations.

---

### FR-26.4

Quality Gates shall evaluate one or more engineering objects.

---

### FR-26.5

Quality Gate outcomes shall remain immutable.

---

### FR-26.6

Quality Gate evaluations shall preserve complete traceability.

---

### FR-26.7

Quality Gates shall support explicit waivers.

---

# 7. Quality Gate Categories

Illustrative categories include:

## Entry Gates

Determine readiness to begin a lifecycle stage.

Examples:

- Requirements Complete
- Architecture Approved

---

## Exit Gates

Determine readiness to leave a lifecycle stage.

Examples:

- Development Complete
- Testing Complete

---

## Release Gates

Evaluate readiness for deployment.

Examples:

- Security Clearance
- Operational Readiness
- Customer Acceptance

---

## Compliance Gates

Evaluate regulatory readiness.

Examples:

- HIPAA Validation
- SOX Controls
- ISO Verification

---

## Operational Gates

Evaluate production readiness.

Examples:

- Monitoring Configured
- Backup Verified
- Rollback Available

Additional categories may be introduced through Packs.

---

# 8. Quality Gate Structure

Every Quality Gate shall define:

- Identifier
- Name
- Category
- Scope
- Applicable Lifecycle Transition
- Evaluation Criteria
- Required Reviews
- Required Evidence
- Required Decisions
- Required Obligations
- Required Policies
- Waiver Rules
- Version
- Originating Pack

---

# 9. Evaluation Criteria

Quality Gate criteria may reference:

- Deliverable state;
- Review outcomes;
- accepted Evidence;
- approved Decisions;
- active Policies;
- unresolved Obligations;
- compliance requirements;
- engineering metrics.

Where a referenced Policy's Constraint Type is "Standard" rather than "Policy" (Chapter 24 §4), a Quality Gate may still choose to treat adherence as blocking for that specific gate — for example, a Release Quality Gate may require full Standard adherence even though the underlying Policy does not block by default elsewhere. Absent such an explicit gate criterion, Standard deviations remain non-blocking, consistent with Chapter 24.

Criteria are declarative and interpreted by the Governance Model.

---

# 10. Quality Gate Evaluation

Quality Gates shall be evaluated whenever a governed lifecycle transition is requested.

Evaluation shall determine:

- satisfied criteria;
- unsatisfied criteria;
- applicable waivers;
- blocking conditions;
- supporting rationale.

Evaluation shall not modify engineering state.

---

# 11. Quality Gate Outcomes

Quality Gate evaluation shall produce one of the following outcomes:

- Passed
- Passed with Conditions
- Blocked
- Waived
- Deferred
- Not Applicable

The outcome becomes an input to Governance.

Governance determines whether the state transition proceeds.

---

# 12. Quality Gate Composition

Multiple organisations may contribute Quality Gates.

Example:

```
Platform Gate Pack

+

Organisation Gate Pack

+

Customer Gate Pack

+

Compliance Gate Pack

↓

Effective Quality Gates
```

Composition shall preserve deterministic behaviour.

Conflicts shall be resolved through Governance composition rules.

---

# 13. Waivers

Quality Gates may define explicit waiver mechanisms.

Every waiver shall specify:

- justification;
- approving authority;
- applicable scope;
- duration;
- associated risks;
- compensating controls.

Waivers shall remain fully traceable.

A waiver does not remove the Quality Gate.

It modifies its evaluation for a defined context.

---

# 14. Quality Gate Traceability

Every Quality Gate evaluation shall preserve:

- evaluated engineering object;
- applicable Engineering Behavior Model;
- governing Policies;
- supporting Reviews;
- supporting Evidence;
- supporting Decisions;
- active Obligations;
- evaluation outcome;
- timestamp.

Historical evaluations shall remain reproducible.

---

# 15. Events

The Quality Gate subsystem shall publish:

- QualityGateEvaluated
- QualityGatePassed
- QualityGateBlocked
- QualityGateWaived
- QualityGateDeferred
- QualityGateConfigurationChanged

---

# 16. Non-Functional Requirements

The Quality Gate Model shall:

- support deterministic evaluation;
- support composition from multiple Packs;
- preserve complete traceability;
- support historical reconstruction;
- remain independent of Participant implementations.

---

# 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Quality Gates evaluate readiness without changing engineering state.

✓ Evaluation criteria are declarative.

✓ Quality Gates support multi-organisation composition.

✓ Waivers are explicit, governed and traceable.

✓ Evaluation outcomes are reproducible.

✓ Historical Quality Gate evaluations remain available.

---

# 18. Deliverables

Implementation of this chapter shall produce:

- Quality Gate domain model.
- Quality Gate registry.
- Quality Gate evaluation service.
- Waiver management service.
- Quality Gate composition service.
- Quality Gate APIs.
- Quality Gate events.

---

# 19. Implementation Status & Gaps

Code-verified audit (2026-08-22), not from memory — every claim below carries a file:line citation, cross-checked against a live query against the running Postgres instance (`aisworg` DB). Core files: `src/domain/engine/qualityGateEngine.ts`, `src/dblayer/qualityGatesDB.ts`, `src/dblayer/qualityGateEvaluationsDB.ts`, `src/domain/engine/compositionEngine.ts`, `src/routes/seu/core/governanceModel.ts`, `src/routes/seu/core/packs.ts`.

Quality Gate is one of the more built subsystems audited this session — a real polymorphic evaluation engine, a real append-only evaluation log, and (unlike Decision/Authority/Event Registry) a genuine per-Pack-publish write path into the live `quality_gates` table. But the exact thing most relevant to the redesign this audit round was requested for — **Packs contributing gates that compose per-SEU into an effective, evaluated set** — is not real. `quality_gates` is a single global table keyed only by `(entity_type, from_state, to_state)`, with `ON CONFLICT DO UPDATE` semantics: whichever Pack last published on a given triple silently overwrites the live gate for every SEU platform-wide, regardless of which Packs any given SEU actually composed. A correct per-SEU "Effective Quality Gates" computation *does* exist (`governanceModel.getEffectiveGovernanceModel`) — but it's a read-only display, never consulted by the engine that actually enforces gates at transition time. Any redesign wanting genuine Pack-composed, SEU-scoped gates needs to replace this global-singleton lookup, not just extend the JSON schema around it.

## 19.1 ✅ Definition (§4)

`qualityGateEngine.evaluate`/`evaluateGate` only reads (`obligationsDB`/`evidenceDB`/`decisionsDB`/`reviewsDB.findByRelatedObject`) and writes exactly one append-only evaluation row plus an event — it never mutates the entity or any governed object. Read-only, declarative dispatch on `gate.criteria.type`, confirmed.

## 19.2 ⚠️ Architectural Principles (QG-001–006) (§5)

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| QG-001 | Declarative | ⚠️ | `criteria` is real JSONB, but the engine only interprets one hardcoded `type` string per gate via if/else — real data, only 3 executable shapes (19.6). |
| QG-002 | Evaluates readiness (read-only) | ✅ | 19.1. |
| QG-003 | Composable | ❌ | Not at the single-gate level — one gate has exactly one `criteria.type`, no AND/OR combination. "Composable" only exists at the multi-gate-list level (first-blocking-wins). **Confirmed deliberate, not a gap** — settled and built as part of CR-058: composite and/or logic resolves once, inside whatever participant execution produces the Evidence, never inside the gate itself. |
| QG-004 | Independent of Participants | ✅ | Evaluation never reads `actorId`/role. |
| QG-005 | Outcomes traceable | ⚠️ | Partial — see 19.11. |
| QG-006 | Deterministic | ✅ | No randomness, no external calls in the evaluation path — pure DB reads plus status-membership checks. |

## 19.3 ⚠️ Functional Requirements (FR-26.1–7) (§6)

| FR | Verdict | Note |
|---|---|---|
| FR-26.1 unique id | ✅ | `quality_gates.id` PK + `code UNIQUE`. |
| FR-26.2 contributed through Packs | ⚠️ real write path, narrowed caveat | `seedContributions` genuinely writes every `pack.contributions.qualityGates[]` entry on publish, reachable from the real SDK authoring HTTP surface — a real per-Pack-publish write, not a disconnected seed script. **CR-058** narrowed but did not close the global-table caveat: the active-slot uniqueness now includes `category` (a partial index, `WHERE is_active`), so two Packs contributing *different-category* gates to the same transition genuinely coexist — but two Packs targeting the *same* transition + category is still a global, SEU-unaware collision (now a loud constraint-violation error instead of a silent overwrite, which is real progress, but the deeper per-SEU composed-scope question — 19.9 — remains open). |
| FR-26.3 composition from multiple organisations | ⚠️ | Real conflict *detection* exists (`compositionEngine.ts:124-138`) and a real per-SEU effective-gate computation exists (`governanceModel.ts:21-77`) — but both are display/report-only; `qualityGateEngine.evaluate()` never consults either at transition time (19.9). |
| FR-26.4 evaluates one or more engineering objects | ✅ | Genuinely polymorphic — live `entity_type` CHECK allows 14 types, live data has real rows for `Deliverable`, `Pack`, `AttentionItem`. |
| FR-26.5 outcomes immutable | ✅ | `qualityGateEvaluationsDB.ts` exposes only `create` — no update/delete. |
| FR-26.6 complete traceability | ⚠️ | Partial — see 19.11. |
| FR-26.7 explicit waivers | ✅ | Built via CR-058 — `quality_gate_waivers`, badge-gated (`qualitygate_waive`), checked by `qualityGateEngine`'s `blockOrWaive` before finalizing a block. Deliberately not mirroring Compliance's own ungated waiver mechanism (19.10). |

## 19.4 ✅ Quality Gate Categories — built via CR-058, Ontology-backed with all 5 baseline values (§7)

`category` is now Ontology-validated (`assertCanonicalCategory("category:quality-gate", ...)` in `validatePackSeed`), backed by a real `category:quality-gate` concept type seeded with all 5 of the chapter's values (Entry/Exit/Release/Compliance/Operational — migration `091`), authored through a real referential picker in the Pack form. Pack-contribution of *new* categories beyond these 5 stays deliberately deferred, same status as CR-056 gave Decision categories.

## 19.5 ⚠️ Quality Gate Structure — 9 of 14 fields real after CR-058, 2 deliberately not modeled as-specified (§8)

| Chapter field | Real column/mechanism | Verdict |
|---|---|---|
| Identifier | `id` | ✅ |
| Name | `name` | ✅ |
| Category | `category`, Ontology-backed (`category:quality-gate`, 5 values) | ✅ built via CR-058 |
| Scope / Applicable Lifecycle Transition | `governedTransition`, referential picker sourced from real `transition_definitions` rows only | ✅ built via CR-058 |
| Evaluation Criteria | `criteria` JSONB, 4 named types | ✅ built via CR-058 (see 19.6) — still one criteria type per gate, deliberately, not the chapter's literal plural-fields shape |
| Required Reviews / Evidence / Decisions / Obligations as 4 distinct fields | not modeled as separate fields — expressed as named criteria types instead | ❌ (by design, not oversight) — the settled "no composite logic in the gate" principle means these stay criteria-type names, never simultaneous fields on one gate (19.2 QG-003) |
| Required Policies | new `requires_active_policy` criteria type | ✅ built via CR-058 — same "named type, not a field" treatment as the 4 above |
| Waiver Rules | `quality_gate_waivers`, badge-gated | ✅ built via CR-058 (19.10) |
| Version | `version`/`is_active`, `(code, version)` identity | ✅ built via CR-058 |
| Originating Pack | `originating_pack_id` FK → `packs(id)` | ✅ — live: all 48 pre-existing rows have it populated |

## 19.6 ✅ Evaluation Criteria — 4 named types after CR-058, deliberately no generic composite logic (§9)

The complete real enumeration in `qualityGateEngine.ts`: `no_unresolved_obligations`, `requires_accepted_evidence_or_approved_decision` (now with a `category` param, closing an asymmetry found while designing CR-058 — it had none, unlike `requires_accepted_review`'s already-real one), `requires_accepted_review`, and new `requires_active_policy` (built via CR-058 — always blocks on non-satisfaction regardless of the referenced Policy's own `constraint_type`, the explicit-gate-override Ch.26 §9 ¶2 itself describes). Against the chapter's 8 named criteria categories: Review outcomes ✅, accepted Evidence ✅, approved Decisions ✅, unresolved Obligations ✅, active Policies ✅ (closed by CR-058) — Deliverable state ❌ (no criteria type inspects the entity's own state), compliance requirements ❌ (Ch.27 Compliance is a wholly separate subsystem, never invoked from here), engineering metrics ❌ (no criteria type touches `metricRegistryEngine`) remain out of scope.

The settled design principle (CR-058, confirmed not a gap): a gate never combines multiple criteria types with AND/OR — composite logic resolves once, inside whatever participant execution produces the underlying Evidence, before the gate ever runs.

## 19.7 ⚠️ Quality Gate Evaluation — dual enforcement paths, and two entity types' gates are dead code (§10)

Two real, structurally different enforcement paths coexist: a **legacy per-entity path**, where 8 core-entity transition routes call `qualityGateEngine.evaluate()` directly and unconditionally before their own transition (Deliverable/Obligation/Decision/Knowledge/Evidence/Review/AttentionItem/ExternalInteraction); and a **generic path** via `transitionEngine.ts`'s `required_quality_gate_ids`, calling `evaluateByIds` — live-verified to be exercised by only 4 synthetic test rows, zero real seeded production transitions.

More consequentially: **Pack and Objective transitions declare live gate rows in the DB but never actually evaluate them.** `transitionPack` calls `transitionEngine.evaluate` without `entityId`/`seuId`, so the `required_quality_gate_ids` branch's own guard never fires — and Pack never calls `qualityGateEngine.evaluate` directly either (a code comment at `packs.ts:425-431` states this is deliberate). The result: the live seeded `qg-pack-a44355c1` ("Pack publish gate") is dead — never evaluated by any code path. `transitionObjective` has the identical gap.

The chapter's 5 claimed evaluation-output elements (satisfied/unsatisfied criteria, applicable waivers, blocking conditions, supporting rationale) are not built as separate structured elements — the real return type is a flat `{outcome, gate?, reason?}`, one string, no itemized breakdown.

## 19.8 ⚠️ Quality Gate Outcomes — 3 of 6 producible after CR-058 (§11)

The DB `CHECK` models all 6; the engine now persists `Passed`, `Blocked`, or `Waived` (CR-058 added real `Waived` — `qualityGateEngine.blockOrWaive`/`recordAndWaive`, checked before any block is finalized, publishing a distinct `QualityGateWaived` event). Pre-CR-058 live data: 803 total evaluations, 449 `Passed`, 354 `Blocked`, zero `Waived` (no waiver mechanism existed yet to produce one) — confirmed live-verifiable now that the mechanism exists. `NotApplicable` is still returned in-memory but never written (no gate id to attach it to). "Passed with Conditions" and "Deferred" remain schema-only — the CHECK constraint permits them, nothing in the codebase produces them; out of CR-058's scope.

## 19.9 ⚠️ Quality Gate Composition — detection and reporting are real; enforcement bypasses both (§12)

`compositionEngine.ts`'s `detectGovernanceConflicts` does real cross-Pack conflict detection — **CR-058 updated this to key on `(transition, category)` instead of just `transition`**, matching the new active-slot uniqueness (19.5 Scope) — two Packs contributing *different-category* gates to the same transition is no longer flagged as a conflict, only two Packs targeting the same transition *and* category. `governanceModel.getEffectiveGovernanceModel` computes a genuine per-SEU "Effective Quality Gates" list from that SEU's actually-composed Packs — the closest real analog to the chapter's Platform+Organisation+Customer+Compliance→Effective Gates picture. But this composed view is still read-only/cosmetic: the actual enforcement lookup (`qualityGatesDB.findAllActive`) hits the single global table described in this section's opening note, completely bypassing per-SEU composition — CR-058 narrowed the collision surface (19.3 FR-26.2) but did not build per-SEU effective-gate resolution at evaluation time; that remains only a commissioning-time report.

## 19.10 ✅ Waivers — built via CR-058, badge-gated (§13)

Built via CR-058: `quality_gate_waivers` (`quality_gate_id`, `seu_id`, `entity_type`/`entity_id`, `rationale`, `granted_by`, `authority_badge`, `status`, `expires_at`), `qualityGateWaiversDB`, `core/qualityGateWaivers.ts`, an API route — modeled on Compliance's existing `grantWaiver`/`findActiveWaivers` shape, with one deliberate difference found while designing it: **badge-gated**. Compliance's own `grantWaiver` has no authority check anywhere (`grantedBy` is just whoever the session user happens to be) — not mirrored here; granting a Quality Gate waiver requires the real `qualitygate_waive` badge (`badgeAuthorityEngine.authorise`, new `QualityGate` noun + `waive` verb in `authorityVocabulary.json`). `qualityGateEngine.evaluateGate`'s `blockOrWaive` checks for an active, unexpired waiver on the exact `(quality_gate_id, entity_type, entity_id)` triple before finalizing a block — a waiver applies to one specific blocked entity instance, not the gate definition globally. 5 of the chapter's 6 claimed waiver fields are real columns (justification→`rationale`, approving authority→`authority_badge`+`granted_by`, duration→`expires_at`, scope→the entity triple); "associated risks" and "compensating controls" are not separately modeled, folded into free-text `rationale` if the granting actor chooses to note them — a minor, deliberate simplification, not tracked further.

## 19.11 ⚠️ Quality Gate Traceability — real for outcome/timestamp, thin for the reasoning behind a Pass (§14)

`quality_gate_evaluations` persists `quality_gate_id`/`seu_id`/`entity_type`/`entity_id`/`outcome`/`detail` (JSONB)/`evaluated_at` — evaluated object, outcome, timestamp all real. Supporting Reviews/Evidence/Decisions/Obligations are captured only unstructured, in `detail`, and only on a **Blocked** outcome (e.g. `unresolvedObligationIds`) — a **Passed** outcome's `detail` is always `{}`, so the specific evidence/decision/review that made a gate pass is never recorded, only the fact that it did. Applicable EBM and governing Policies are both absent — no EBM reference on the evaluation row, and Quality Gates never reference Policies at all (19.6).

## 19.12 ⚠️ Events — 3 of 6 named events real after CR-058 (§15)

`QualityGatePassed`, `QualityGateBlocked`, and now `QualityGateWaived` (CR-058, published from `recordAndWaive`) exist in code; pre-CR-058 live data only shows the first two (`QualityGateBlocked`: 354, `QualityGatePassed`: 449, `QualityGateWaived`: 0 — no mechanism existed yet to produce one). `QualityGateEvaluated`, `QualityGateDeferred`, `QualityGateConfigurationChanged` remain zero hits, both in code and live — out of CR-058's scope. `QualityGateWaiverGranted` is also new (the grant action itself, distinct from the evaluation-time `QualityGateWaived`) — an event the chapter doesn't name, mirroring `ComplianceWaiverGranted`'s own precedent.

## 19.13 ⚠️ Non-Functional Requirements (§16)

| NFR | Verdict | Basis |
|---|---|---|
| support deterministic evaluation | ✅ | 19.2 QG-006 |
| support composition from multiple Packs | ❌ | Detection and reporting are real; enforcement bypasses both (19.9) |
| preserve complete traceability | ⚠️ | Real for outcome/timestamp; thin for the reasoning behind a Pass (19.11) |
| support historical reconstruction | ⚠️ | The evaluation log itself is append-only and real; no EBM-version pinning on each row |
| remain independent of Participant implementations | ✅ | 19.1/19.2 QG-004 |

## 19.14 ⚠️ Acceptance Criteria (§17)

| Criterion | Verdict |
|---|---|
| Quality Gates evaluate readiness without changing engineering state | ✅ (19.1) |
| Evaluation criteria are declarative | ✅ real JSONB storage, 4 executable shapes after CR-058 (19.6) |
| Quality Gates support multi-organisation composition | ⚠️ detection/reporting real and narrowed to the right granularity by CR-058; per-SEU enforcement still bypasses it (19.9) |
| Waivers are explicit, governed and traceable | ✅ built via CR-058, badge-gated (19.10) |
| Evaluation outcomes are reproducible | ✅ deterministic given identical state (19.2 QG-006) |
| Historical Quality Gate evaluations remain available | ✅ append-only log, no delete path |

## 19.15 ⚠️ Deliverables — 5 of 7 fully real after CR-058 (§18)

| Named Deliverable | Real artifact | Verdict |
|---|---|---|
| Quality Gate domain model | `QualityGateRow`/`QualityGateEvaluationRow`/`QualityGateWaiverRow` (`seuTypes.ts`) | ✅ |
| Quality Gate registry | `quality_gates` table + `qualityGatesDB.ts` | ✅ (still a global table, not per-SEU — 19.9) |
| Quality Gate evaluation service | `qualityGateEngine.ts` | ✅ |
| Waiver management service | `qualityGateWaiversDB.ts`, `core/qualityGateWaivers.ts`, `api/qualityGateWaivers.ts` | ✅ built via CR-058 (19.10) |
| Quality Gate composition service | `compositionEngine.ts` (detection, updated to `(transition, category)`), `governanceModel.ts` (reporting) | ⚠️ both real, both still disconnected from live enforcement (19.9) |
| Quality Gate APIs | `api/qualityGateWaivers.ts` (waiver grant/list) | ⚠️ still no dedicated `/quality-gates` CRUD surface; gates themselves remain reachable only via SDK authoring form fields, the governance-model read projection, and Telemetry aggregates |
| Quality Gate events | `QualityGatePassed`, `QualityGateBlocked`, `QualityGateWaived` | ⚠️ 3 of 6 (19.12) |

## Summary — ranked (updated post-CR-058)

1. **[Architecture, the one gap CR-058 deliberately left open]** `quality_gates` is still a single global table — CR-058 widened the active-slot uniqueness to `(entity_type, from_state, to_state, category)`, so different-category gates from different Packs now genuinely coexist instead of clobbering each other, but two Packs targeting the *same* transition and category still collide globally, with no SEU or tenant scope at evaluation time. `governanceModel.getEffectiveGovernanceModel`'s correct per-SEU "Effective Quality Gates" computation remains read-only/report-only, never consulted by the engine that actually enforces gates (19.3 FR-26.2, 19.9). This was explicitly out of CR-058's scope, not an oversight.
2. **[Code]** Pack and Objective transitions still declare live gate rows in the database that are never evaluated by any code path — `qg-pack-a44355c1` remains dead code with real seed data behind it; CR-058 didn't touch this gap (19.7).
3. **[Code, closed by CR-058]** 3 of the chapter's 6 outcomes are now producible (`Passed`/`Blocked`/`Waived`) — Waivers are built and wired into evaluation via `blockOrWaive` (19.8, 19.10).
4. **[Ontology, closed by CR-058]** Quality Gate categories are now genuinely Ontology-backed (`category:quality-gate`, all 5 chapter values seeded) — no longer the least-built category mechanism on the platform; only Pack-contribution of *new* categories stays deferred, matching CR-056's own scope decision for Decision categories (19.4).
5. **[Data model, resolved as deliberate, not closed as a gap]** The chapter's plural Required-Reviews/Evidence/Decisions/Obligations/Policies fields were confirmed, during CR-058's design, to be intentionally expressed as named criteria types rather than simultaneous fields on one gate — Required Policies is now a real 4th type, but the "one gate, one criteria type, no AND/OR" shape itself was kept on purpose (19.5, 19.6).
6. **[Genuine positive, strengthened by CR-058]** `originating_pack_id` is real and populated on all pre-existing gates, and the Pack→DB write path via `seedContributions`/`publishPack` — now carrying real validation (Ontology category, real-transition-only scope) — is the strongest real Pack-provenance mechanism found in any chapter audited this session, and the first of this session's Pack-contribution gaps to be fully closed rather than just documented (19.3 FR-26.2, 19.5).