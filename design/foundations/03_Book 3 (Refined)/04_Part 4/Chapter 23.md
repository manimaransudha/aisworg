
# Chapter 23 – Obligation Model

[Sudha: Throughout our discussions, you've consistently said:

> Risks are not just project risks.

An audit finding.

A penetration test finding.

Technical debt.

A missing architecture decision.

An outstanding customer clarification.

A regulatory non-conformance.

A dependency on another organisation.

All of these should be treated uniformly.

I now think you've been right all along.

They are all **Obligations**.

In fact, I think **Obligations** are to Governance what **Deliverables** are to Execution.

They are the objects that governance continuously manages.

--------------

I think this chapter introduces one of the most distinctive concepts in the platform.

Most engineering tools fragment these concerns:

- Risks live in a risk register.
- Audit findings live in an audit tool.
- Technical debt lives in Jira.
- Security vulnerabilities live in another system.
- Compliance actions live in spreadsheets.
- Customer action items live in email.

Architecturally, they're all the same thing:

> **An outstanding engineering commitment that influences delivery.**

That's exactly what an Obligation is.

I think we can go one step further.

We should distinguish between **Obligation** and **Resolution**.

An Obligation is a persistent governance object.

A Resolution is simply one possible outcome that satisfies its completion criteria.

For example:

- A security vulnerability (Obligation) may be resolved by changing code, applying a configuration, replacing a dependency, or formally accepting the risk.
- A customer clarification (Obligation) may be resolved by receiving an answer, changing requirements, or withdrawing the feature.
- A technical debt item (Obligation) may be resolved by refactoring, redesigning, or consciously deferring it with an approved waiver.

This distinction is powerful because it prevents the platform from assuming there is only one way to satisfy an engineering commitment. The **Engineering Behavior Model**, **Policies** and **Authority Model** determine which resolution paths are acceptable, while the Obligation remains the stable governance object throughout its lifecycle.

I think this chapter also reinforces a broader architectural pattern that has emerged repeatedly:

- **Deliverables** represent engineering outcomes.
- **Knowledge** represents engineering understanding.
- **Evidence** represents engineering confidence.
- **Decisions** represent engineering judgement.
- **Obligations** represent engineering commitments.

Together, these five persistent object types form the core information model of the SEU. I suspect almost every future capability in the platform will revolve around one or more of them.

-------------

One more source of Obligations is worth naming explicitly, because without it the platform only ever measures organisational learning, never acts on it. Book 1 treats Continuous Organisational Learning as an active process: accumulated Knowledge and Evidence feed back into actually improving a Capability, not just accumulating telemetry about it. Engineering Telemetry (Chapter 35) already computes exactly the right signals — Knowledge growth, Decision reuse, recurring rework — but nothing consumed them.

I don't think that needs a new persistent object. It's the same shape as everything else in this chapter: an outstanding commitment, with an owner, a priority, and completion criteria. When Telemetry detects a sustained pattern — the same architectural decision independently reached across many Deliverables, a Service chronically missing its declared Service Level, a Policy repeatedly waived — that's an outstanding engineering commitment to *improve* something, and it belongs here as an **Organisational Learning** Obligation, resolved by publishing a revised Capability, Service or Policy through the existing Pack lifecycle. That closes the loop using machinery this book has already fully specified: Telemetry raises the Obligation, the Pack SDK and Composition Engine resolve it, and the next Effective Engineering Configuration is measurably improved. Nothing new to build except the connection.
]

---

# 1. Purpose

The Obligation Model defines how commitments, deficiencies, risks, findings, exceptions and required actions are represented, governed and resolved within a Software Engineering Unit (SEU).

An **Obligation** is any engineering commitment that must be satisfied before one or more governed engineering outcomes can be considered complete.

Obligations are first-class engineering objects.

They participate in governance, dependency evaluation and engineering execution.

---

# 2. Scope

This chapter defines:

- Obligation abstraction;
- Obligation lifecycle;
- Obligation relationships;
- Obligation governance;
- Obligation ownership;
- Obligation resolution.

This chapter does not define:

- risk analysis methodologies;
- audit frameworks;
- compliance regulations;
- issue tracking implementations.

These are contributed through Packs.

---

# 3. Architectural Position

```
Governance Model

↓

Obligations

↓

Dependency Engine

↓

Deliverable State Transitions
```

Obligations influence engineering readiness and governance decisions.

---

# 4. Definition

An Obligation is a governed engineering commitment requiring satisfaction before one or more engineering objectives may progress.

An Obligation may arise from:

- governance;
- compliance;
- engineering practice;
- customer requirements;
- risk management;
- operational experience;
- engineering decisions;
- sustained Engineering Telemetry patterns indicating that a Capability, Service or Policy should be improved;
- Knowledge promoted to Capability, Enterprise or Platform Acquisition Scope, indicating engineering capital that should be formally codified.

Obligations are persistent engineering objects.

---

# 5. Architectural Principles

## OM-001

Every significant engineering commitment shall be represented as an Obligation.

---

## OM-002

Obligations are independent of Participants.

---

## OM-003

Obligations shall participate in dependency evaluation.

---

## OM-004

Obligations shall remain fully traceable.

---

## OM-005

Obligations shall support composition from multiple Packs.

---

## OM-006

Obligations shall possess explicit lifecycle states.

---

# 6. Functional Requirements

### FR-23.1

Every Obligation shall possess a globally unique identifier.

---

### FR-23.2

Obligations shall support dependencies upon Deliverables, Decisions, Evidence and other Obligations.

---

### FR-23.3

Obligations may block Deliverable state transitions.

---

### FR-23.4

Every Obligation shall possess measurable completion criteria.

---

### FR-23.5

Every Obligation shall preserve complete engineering history.

---

### FR-23.6

Obligation state transitions shall remain fully traceable.

---

### FR-23.7

Obligations shall support delegation without changing ownership.

---

### FR-23.8

The platform shall raise an Organisational Learning Obligation when Engineering Telemetry detects a sustained pattern indicating that a Capability, Service or Policy should be improved.

---

# 7. Obligation Categories

Illustrative categories include:

## Engineering

Examples:

- Architecture review required
- Performance optimisation
- Technical debt
- Documentation completion

---

## Risk

Examples:

- High operational risk
- Vendor dependency
- Unresolved architectural uncertainty
- Security exposure

---

## Compliance

Examples:

- HIPAA evidence outstanding
- SOX control validation
- ISO corrective action

---

## Audit

Examples:

- Internal audit finding
- Customer audit observation
- External certification finding

---

## Security

Examples:

- Vulnerability remediation
- Penetration testing follow-up
- Secret rotation
- Privilege review

---

## Operational

Examples:

- Monitoring enhancement
- Capacity planning
- Disaster recovery validation

---

## Customer

Examples:

- Business clarification
- Acceptance prerequisite
- Outstanding customer decision

---

## Organisational Learning

Examples:

- Recurring architectural decision indicates a missing or under-specified Capability
- Service chronically missing its declared Service Level (Chapter 11 §8)
- Policy repeatedly waived, indicating the constraint or its Constraint Type needs revision
- Rework pattern indicates a Capability Pack should be refined
- Knowledge promoted to Capability, Enterprise or Platform Acquisition Scope (Chapter 16 §12) indicates the understanding should be formally codified rather than left as a queryable Knowledge Item

Resolution typically requires publishing a revised Capability, Service or Policy definition (see §12) rather than a Deliverable-level fix. This is the category through which Engineering Telemetry (Chapter 35) and Engineering Capital promotion (Chapter 16 §13) each turn sustained measurement or accumulated understanding into an actual improvement commitment, rather than a metric or a Knowledge Item nobody acts on.

Additional categories may be introduced through Packs.

---

# 8. Obligation Structure

Every Obligation shall define:

- Identifier
- Title
- Category
- Description
- Origin
- Priority
- Severity
- Status
- Completion Criteria
- Related Deliverables
- Related Decisions
- Related Evidence
- Related Risks
- Related Policies
- Related Authority Rules
- Traceability References

---

# 9. Obligation Lifecycle

Every Obligation shall transition through the following lifecycle.

```
Identified

↓

Analysed

↓

Assigned

↓

In Progress

↓

Resolved

↓

Verified

↓

Closed

↓

Archived
```

Closure shall require verification.

---

# 10. Obligation Sources

Obligations may originate from:

- Engineering Behavior Model
- Policies
- Authority evaluations
- Reviews
- Quality Gates
- Compliance Packs
- Organisation Packs
- Customer requests
- Participants
- External systems
- Engineering Telemetry (Chapter 35) and the Knowledge Model (Chapter 16), for Organisational Learning Obligations

The origin shall remain permanently recorded.

---

# 11. Dependency Integration

Obligations participate directly in the Dependency Graph.

Examples include:

- A Deliverable cannot be approved until an associated security Obligation is verified.
- A production release remains blocked while a compliance Obligation is unresolved.
- A deployment Deliverable becomes ready automatically once all blocking Obligations are resolved.

The Dependency Engine evaluates these relationships continuously.

---

# 12. Resolution

Every Obligation shall define explicit completion criteria.

Resolution may require:

- new Deliverables;
- additional Evidence;
- engineering Decisions;
- governance approval;
- successful Reviews;
- Quality Gate satisfaction;
- a revised Capability, Service or Policy Pack version, composed by the Composition Engine into a new Effective Engineering Configuration (for Organisational Learning Obligations).

Resolution alone does not close an Obligation.

Verification is required before closure.

---

# 13. Ownership

An Obligation belongs to the SEU.

Participants may be assigned responsibility for resolving an Obligation, but they do not own it.

Participant reassignment shall not affect the identity or lifecycle of the Obligation.

---

# 14. Escalation

Obligations may define escalation rules.

Escalation conditions may include:

- severity;
- prolonged unresolved state;
- repeated verification failures;
- approaching engineering milestones;
- dependency impact.

Escalation behaviour is governed through Packs.

---

# 15. Events

The Obligation subsystem shall publish:

- ObligationCreated
- ObligationAssigned
- ObligationUpdated
- ObligationResolved
- ObligationVerified
- ObligationClosed
- ObligationEscalated
- ObligationReopened

---

# 16. Non-Functional Requirements

The Obligation Model shall:

- support deterministic lifecycle transitions;
- integrate with the Dependency Engine;
- preserve complete traceability;
- support composition from multiple governance sources;
- remain independent of Participant implementations.

---

# 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Every engineering commitment is represented as an Obligation.

✓ Obligations participate in dependency evaluation.

✓ Deliverable transitions can be blocked by unresolved Obligations.

✓ Obligation closure requires verification.

✓ Obligation provenance and history are preserved.

✓ Obligations remain independent of Participant changes.

✓ Sustained Engineering Telemetry patterns raise Organisational Learning Obligations, and resolving them produces a revised Capability, Service or Policy Pack version.

---

# 18. Deliverables

Implementation of this chapter shall produce:

- Obligation domain model.
- Obligation registry.
- Obligation lifecycle service.
- Obligation verification service.
- Escalation service.
- Dependency integration interfaces.
- Obligation APIs.
- Obligation events.

---

# 19. Implementation Status & Gaps

Code-verified audit (2026-08-22), not from memory — every claim below carries a file:line citation, cross-checked against a live query against the running Postgres instance (`aisworg` DB). Core files: `src/dblayer/obligationsDB.ts`, `src/routes/seu/core/obligations.ts`, `src/routes/seu/api/obligations.ts`, `ObligationRow` (`src/dblayer/seuTypes.ts:757-769`). Live `obligations` schema — 11 columns: `id, seu_id, category, title, description, severity, status, created_at, updated_at, related_object_type, related_object_id`.

The lifecycle mechanism and Dependency-Engine integration are this chapter's strongest areas — both live-verified, matching the chapter closely. The strongest single finding in the whole audit is FR-23.8: Telemetry genuinely, automatically raises Organisational Learning Obligations (`telemetry.ts:179-337`), not aspirational at all. Most relevant to the Pack-contribution question that prompted this audit round: Obligation Category **is** Ontology-backed (`category:obligation`, enforced via `assertCanonicalCategory`) — a real, working precedent — but it is not Pack-contributable in practice (`contributed_by_pack` is NULL on all 5 seeded rows), and separately, `obligations` itself carries no `originating_pack_id` at all, unlike `quality_gates`/`policies`/`capabilities`/`metric_registry`/`compliance_*`, which all do — so OM-005 ("composition from multiple Packs") has no real mechanism whatsoever, not even a partial one.

## 19.1 ⚠️ Definition (§4)

`origin` is not a captured field at all (absent from the live schema). Of the chapter's 9 listed origin sources, only 2 programmatically create an Obligation: sustained Telemetry patterns (`telemetry.ts:179-337`) and Knowledge Acquisition Scope promotion (`knowledge.ts:194-208`, calling `createObligation` directly). The other 7 exist only as manual creation via the generic `POST /obligations` API.

## 19.2 ⚠️ Architectural Principles (OM-001–006) (§5)

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| OM-001 | Represented as Obligation | ✅ | Real table, real writes — 281 live `ObligationCreated` events. |
| OM-002 | Independent of Participants | ✅ (trivially) | No Participant FK/column exists on `obligations` at all. |
| OM-003 | Participates in dependency evaluation | ✅ | `qualityGateEngine.ts:95-104` (`no_unresolved_obligations`) + `dependencyDefinitionEngine.ts:89-100` — see 19.8. |
| OM-004 | Fully traceable | ⚠️ | Only via `events` (`ObligationCreated`/`ObligationTransitioned`) — no dedicated history table, no Related-* FK trail (19.5). |
| OM-005 | Supports composition from multiple Packs | ❌ | No `originating_pack_id` on `obligations`, unlike comparable Pack-contributed entities. `category:obligation`'s own `contributed_by_pack` is NULL on all 5 live rows. |
| OM-006 | Explicit lifecycle states | ✅ | Real `transition_definitions` rows, exact 8-state match — see 19.6. |

## 19.3 ⚠️ Functional Requirements (FR-23.1–8) (§6)

| FR | Verdict | Note |
|---|---|---|
| FR-23.1 unique id | ✅ | `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`. |
| FR-23.2 dependencies on Deliverables/Decisions/Evidence/other Obligations | ⚠️ misrepresented as 4-way | Reality is one polymorphic `related_object_type`/`related_object_id` pair per row, not simultaneous typed links to all 4. Live `dependency_definitions` has zero rows naming Obligation as either side — the engine supports it, nothing seeds it. |
| FR-23.3 may block Deliverable transitions | ✅ | Live `qg-deliverable-in-progress-to-approved` gate (`criteria={"type":"no_unresolved_obligations"}`), 666 live evaluations against it. |
| FR-23.4 measurable completion criteria | ❌ | No `completion_criteria` column of any kind — not even free text. |
| FR-23.5 preserves complete engineering history | ⚠️ | No history table; reconstructable only from `events` (2 distinct types, 19.12). |
| FR-23.6 transitions fully traceable | ✅ | `transitionObligation` publishes `fromState`/`toState`/`actorId`/`authorityBadge` on every transition — 577 live events. |
| FR-23.7 delegation without changing ownership | ❌ | Zero `delegat*` hits anywhere in `src/` for Obligation — same absence independently confirmed as Ch.22's Authority audit; no ownership/assignment field exists to delegate from in the first place (19.10). |
| FR-23.8 Telemetry → auto-raised Organisational Learning Obligation | ✅ | Genuinely real — 3 real triggers in `telemetry.ts:179-337` (quality-gate blocking, policy waivers, capability shortages), deduplicated. The strongest-built claim in the chapter. |

## 19.4 ⚠️ Obligation Categories — Ontology-backed, but not Pack-contributable and only half-seeded (§7)

`category TEXT`, not DB-constrained but application-enforced via `assertCanonicalCategory("category:obligation", ...)` (`obligations.ts:29`) — real, not aspirational. Live `ontology_concepts WHERE concept_type='category:obligation'` has only 5 rows: `Compliance`, `Engineering`, `Organisational Learning`, `Review Finding`, `Security` — `contributed_by_pack` NULL on all 5. Of the chapter's 8 named categories, only 3 (Engineering/Compliance/Security) plus Organisational Learning are seeded; Risk/Audit/Operational/Customer are absent. `Review Finding` is an extra category the chapter doesn't name (imported from Ch.25's Finding model). "Additional categories introduced through Packs" is confirmed aspirational — zero Pack seed JSON references `category:obligation`.

## 19.5 ❌ Obligation Structure — 7 of 16 fields real (§8)

| Chapter field | Real column? |
|---|---|
| Identifier | ✅ `id` |
| Title | ✅ `title` |
| Category | ✅ `category` |
| Description | ✅ `description` |
| Origin | ❌ absent |
| Priority | ❌ absent |
| Severity | ✅ `severity` |
| Status | ✅ `status` |
| Completion Criteria | ❌ absent |
| Related Deliverables | ⚠️ collapsed into one polymorphic `related_object_type`/`related_object_id`, not plural or Deliverable-specific |
| Related Decisions | ❌ resolvable only via reverse lookup, not stored on the Obligation |
| Related Evidence | ❌ absent |
| Related Risks | ❌ absent — no Risk entity exists anywhere in the codebase |
| Related Policies | ❌ absent |
| Related Authority Rules | ❌ absent |
| Traceability References | ❌ absent — only `events` reconstruction |

## 19.6 ✅ Obligation Lifecycle — matches the chapter exactly, verification gate structurally enforced (§9)

Live `transition_definitions WHERE entity_type='Obligation'` returns exactly the chapter's 8-state chain: `Identified→Analysed→Assigned→In Progress→Resolved→Verified→Closed→Archived`, no shortcut rows. "Closure shall require verification" is structurally enforced, not just conventionally observed — no `Resolved→Closed` or `In Progress→Closed` row exists, and `transitionEngine.evaluate()` fails closed for anything not in the table. Live data currently exercises only 3 of the 8 states, but the mechanism itself is fully real.

## 19.7 ❌ Obligation Sources — 2 of 11 automated (§10)

`origin` doesn't exist as a captured field in any form (19.1) — "the origin shall remain permanently recorded" isn't implemented at all. Of the 11 named sources, real automated creation exists for exactly 2: Quality Gates (sustained-blocking detection) and Telemetry + Knowledge Model (FR-23.8). The remaining 9 — EBM, Policies, Authority evaluations, Reviews, Compliance Packs, Organisation Packs, Customer requests, Participants, External systems — are manual-only via the generic API.

## 19.8 ✅ Dependency Integration — the strongest-built section besides FR-23.8 (§11)

`qualityGateEngine.ts:95-104` and `dependencyDefinitionEngine.ts:89-100` both treat Obligation as a real blocking node via the polymorphic `related_object_type`/`related_object_id`. The chapter's own worked examples are literally live: security-Obligation-blocks-Deliverable-approval is the real `qg-deliverable-in-progress-to-approved` gate (666 live evaluations); auto-unblock-on-resolution is `dependencyDefinitionEngine.evaluateAndPublishFromTransition` publishing `DeliverableReady`. Caveat: the named-dependency-graph path (`dependency_definitions` rows naming Obligation) is unused in practice even though the engine supports it — the Quality Gate path is what's actually exercised.

## 19.9 ⚠️ Resolution — the verification gate is real; the Pack-republish loop is confirmed absent (§12)

"Resolution alone does not close an Obligation; Verification is required" is enforced by the same lifecycle gap as 19.6 — real, not aspirational. But "a revised Capability/Service/Policy Pack version, composed by the Composition Engine" is **not built**: zero Obligation references anywhere in `compositionEngine.ts`. Notably, the chapter's own embedded authorial note already flags this as acknowledged-aspirational ("Nothing new to build except the connection") rather than an accidental gap.

## 19.10 ❌ Ownership — not built (§13)

No `assigned_to`/`owner` column exists at all (11-column live schema, confirmed). There is no assignment field, let alone the owner-vs-assignee distinction the chapter describes. "Belongs to the SEU" holds only because `seu_id` is the sole ownership-adjacent FK present — not a designed ownership model.

## 19.11 ❌ Escalation — not built as the chapter describes it (§14)

The only real escalation logic in the codebase (`workItemHeartbeat.ts`, `telemetry.ts`) is not Obligation-scoped: `workItemHeartbeat.ts:43` explicitly excludes non-Deliverable entities, and `telemetry.ts:217-229`'s "Escalation"-category Attention Item is a side effect of *creating* an Organisational Learning Obligation, not a state-driven trigger off any of the chapter's 5 named conditions (severity, prolonged-unresolved, repeated-verification-failure, approaching milestone, dependency impact). No `ObligationEscalated` event exists (19.12).

## 19.12 ⚠️ Events — 2 of 8 named events real (§15)

Live query confirms exactly 2 distinct event types: `ObligationCreated` (281 rows) and generic `ObligationTransitioned` (577 rows, `fromState`/`toState` payload). `ObligationAssigned`/`Updated`/`Resolved`/`Verified`/`Closed`/`Escalated`/`Reopened` are all collapsed into the one generic transition event. `SustainedPatternDetected` (`telemetry.ts:209`) is a real extra event the chapter doesn't name.

## 19.13 ⚠️ Non-Functional Requirements (§16)

| NFR | Verdict | Basis |
|---|---|---|
| deterministic lifecycle transitions | ✅ | `transition_definitions`-gated (19.6) |
| integrate with the Dependency Engine | ✅ | 19.8 |
| preserve complete traceability | ⚠️ | Events-only, no history table, no Related-* trail (19.5) |
| support composition from multiple governance sources | ⚠️ | Quality Gate + Dependency Engine integration real; multi-Pack composition absent (19.2 OM-005) |
| remain independent of Participant implementations | ✅ | No coupling exists |

## 19.14 ⚠️ Acceptance Criteria (§17)

| Criterion | Verdict |
|---|---|
| Every engineering commitment represented as an Obligation | ⚠️ real entity, but only 2/11 sources auto-create one (19.7) |
| Obligations participate in dependency evaluation | ✅ (19.8) |
| Deliverable transitions can be blocked by unresolved Obligations | ✅ (19.3 FR-23.3) |
| Obligation closure requires verification | ✅ (19.6/19.9) |
| Obligation provenance and history are preserved | ⚠️ events-only (19.5) |
| Obligations remain independent of Participant changes | ✅ |
| Sustained Telemetry patterns raise Organisational Learning Obligations, and resolving them produces a revised Pack version | ⚠️ half true — raising is real (FR-23.8); "produces a revised Pack version" is not built (19.9) |

## 19.15 ⚠️ Deliverables (§18)

| Named Deliverable | Real artifact | Verdict |
|---|---|---|
| Obligation domain model | `ObligationRow` (`seuTypes.ts:757`) | ✅ |
| Obligation registry | `obligationsDB.ts` | ✅ |
| Obligation lifecycle service | `transitionObligation` (`core/obligations.ts:85-136`) | ✅ |
| Obligation verification service | — | ⚠️ not a separate service — Verification is just another `transitionObligation` call to state `Verified` |
| Escalation service | — | ❌ no Obligation-scoped escalation code exists (19.11) |
| Dependency integration interfaces | `dependencyDefinitionEngine.ts`, `qualityGateEngine.ts` | ✅ |
| Obligation APIs | `src/routes/seu/api/obligations.ts` | ✅ |
| Obligation events | `ObligationCreated`, generic `ObligationTransitioned` | ⚠️ 2 of 8 named events (19.12) |

## Summary — ranked

1. **[Ontology / Pack-contribution — most relevant to the current redesign question]** Obligation Category is genuinely Ontology-backed — a real, working precedent for the redesign — but has zero Pack-contributed rows, and separately `obligations` itself has no `originating_pack_id` at all, unlike every comparable Pack-contributed entity on the platform (quality_gates/policies/capabilities/metric_registry/compliance_*). OM-005 has no mechanism whatsoever, not even a partial one (19.2, 19.4).
2. **[Governance, real and strong]** Dependency Engine integration and the verification-gated closure lifecycle are both live-verified and match the chapter closely — the strongest-built area of this chapter besides FR-23.8 (19.6, 19.8).
3. **[Code, genuinely surprising positive]** FR-23.8's Telemetry→Organisational-Learning-Obligation loop is fully real and automated, not aspirational at all — the strongest single claim verified in this audit (19.3, 19.7).
4. **[Code]** The chapter's own closing loop — Obligation resolution feeding back into a revised Pack via the Composition Engine — is confirmed absent in code, and the chapter's own authorial note already flags it as acknowledged-aspirational rather than an oversight (19.9).
5. **[Data model]** 9 of 16 §8 structure fields are entirely absent — Origin, Priority, Completion Criteria, and 5 of the 6 "Related *" fields don't exist as columns anywhere (19.5).
6. **[Code]** Delegation (FR-23.7) and Ownership (§13) are both entirely unbuilt — there's no assignment field to delegate from in the first place, mirroring the same absence Ch.22 found for Authority (19.10).
7. **[Code]** Escalation (§14) exists nowhere for Obligation specifically — the only real escalation logic in the codebase explicitly excludes non-Deliverable entities (19.11).