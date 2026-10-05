# Chapter 23 – Obligation Model

## 1. Purpose

The Obligation Model defines how commitments, deficiencies, risks, findings, exceptions and required actions are represented, governed and resolved within a Software Engineering Unit (SEU).

An **Obligation** is any engineering commitment that must be satisfied before one or more governed engineering outcomes can be considered complete.

Obligations are first-class engineering objects.

They participate in governance, dependency evaluation and engineering execution.

---

## 2. Scope

This chapter defines:

- Obligation abstraction
- Obligation lifecycle
- Obligation relationships
- Obligation governance
- Obligation ownership
- Obligation resolution

This chapter does not define:

- risk analysis methodologies
- audit frameworks
- compliance regulations
- issue tracking implementations

These are contributed through Packs.

---

## 3. Architectural Position

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

## 4. Definition

An Obligation is a governed engineering commitment requiring satisfaction before one or more engineering objectives may progress.

An Obligation may arise from:

- governance
- compliance
- engineering practice
- customer requirements
- risk management
- operational experience
- engineering decisions
- sustained Engineering Telemetry patterns indicating that a Capability, Service or Policy should be improved
- Knowledge promoted to Capability, Enterprise or Platform Acquisition Scope, indicating engineering capital that should be formally codified

Obligations are persistent engineering objects.

---

## 5. Architectural Principles

### OM-001

Every significant engineering commitment shall be represented as an Obligation.
 
### OM-002

Obligations are independent of Participants.
 
### OM-003

Obligations shall participate in dependency evaluation.
 
### OM-004

Obligations shall remain fully traceable.
 
### OM-005

Obligations shall support composition from multiple Packs.
 
### OM-006

Obligations shall possess explicit lifecycle states.

---

## 6. Functional Requirements

### FR-23.1

Every Obligation shall possess a globally unique identifier.
 
### FR-23.2

Obligations shall support dependencies upon Deliverables, Decisions, Evidence and other Obligations.
 
### FR-23.3

Obligations may block Deliverable state transitions.
 
### FR-23.4

Every Obligation shall possess measurable completion criteria.
 
### FR-23.5

Every Obligation shall preserve complete engineering history.
 
### FR-23.6

Obligation state transitions shall remain fully traceable.
 
### FR-23.7

Obligations shall support delegation without changing ownership.
 
### FR-23.8

The platform shall raise an Organisational Learning Obligation when Engineering Telemetry detects a sustained pattern indicating that a Capability, Service or Policy should be improved.

---

## 7. Obligation Categories

Illustrative categories include:

### Engineering

Examples:

- Architecture review required
- Performance optimisation
- Technical debt
- Documentation completion
 
### Risk

Examples:

- High operational risk
- Vendor dependency
- Unresolved architectural uncertainty
- Security exposure
 
### Compliance

Examples:

- HIPAA evidence outstanding
- SOX control validation
- ISO corrective action
 
### Audit

Examples:

- Internal audit finding
- Customer audit observation
- External certification finding
 
### Security

Examples:

- Vulnerability remediation
- Penetration testing follow-up
- Secret rotation
- Privilege review
 
### Operational

Examples:

- Monitoring enhancement
- Capacity planning
- Disaster recovery validation
 
### Customer

Examples:

- Business clarification
- Acceptance prerequisite
- Outstanding customer decision
 
### Organisational Learning

Examples:

- Recurring architectural decision indicates a missing or under-specified Capability
- Service chronically missing its declared Service Level (Chapter 11 §8)
- Policy repeatedly waived, indicating the constraint or its Constraint Type needs revision
- Rework pattern indicates a Capability Pack should be refined
- Knowledge promoted to Capability, Enterprise or Platform Acquisition Scope (Chapter 16 §12) indicates the understanding should be formally codified rather than left as a queryable Knowledge Item

Resolution typically requires publishing a revised Capability, Service or Policy definition (see §12) rather than a Deliverable-level fix. This is the category through which Engineering Telemetry (Chapter 35) and Engineering Capital promotion (Chapter 16 §13) each turn sustained measurement or accumulated understanding into an actual improvement commitment, rather than a metric or a Knowledge Item nobody acts on.

Additional categories may be introduced through Packs.

---

## 8. Obligation Structure

Every Obligation shall define:

- Identifier 
- Title
- Category
- Description
- Origin
- Priority
- Severity
- Completion Criteria
- Status
- Related Deliverables
- Related Decisions
- Related Evidence
- Related Risks
- Related Policies
- Related Authority Rules
- Traceability References

---

## 9. Obligation Lifecycle

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

## 10. Obligation Sources

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

## 11. Dependency Integration

Obligations participate directly in the Dependency Graph.

Examples include:

- A Deliverable cannot be approved until an associated security Obligation is verified.
- A production release remains blocked while a compliance Obligation is unresolved.
- A deployment Deliverable becomes ready automatically once all blocking Obligations are resolved.

The Dependency Engine evaluates these relationships continuously.

---

## 12. Resolution

Every Obligation shall define explicit completion criteria.

Resolution may require:

- new Deliverables
- additional Evidence
- engineering Decisions
- governance approval
- successful Reviews
- Quality Gate satisfaction
- a revised Capability, Service or Policy Pack version, composed by the Composition Engine into a new Engineering Behavior Model (for Organisational Learning Obligations)

Resolution alone does not close an Obligation.

Verification is required before closure.

---

## 13. Ownership

An Obligation belongs to the SEU.

Participants may be assigned responsibility for resolving an Obligation, but they do not own it.

Participant reassignment shall not affect the identity or lifecycle of the Obligation.

---

## 14. Escalation

Obligations may define escalation rules.

Escalation conditions may include:

- severity
- prolonged unresolved state
- repeated verification failures
- approaching engineering milestones
- dependency impact

Escalation behaviour is governed through Packs.

---

## 15. Events

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

## 16. Non-Functional Requirements

The Obligation Model shall:

- support deterministic lifecycle transitions
- integrate with the Dependency Engine
- preserve complete traceability
- support composition from multiple governance sources
- remain independent of Participant implementations

---

## 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Every engineering commitment is represented as an Obligation.

✓ Obligations participate in dependency evaluation.

✓ Deliverable transitions can be blocked by unresolved Obligations.

✓ Obligation closure requires verification.

✓ Obligation provenance and history are preserved.

✓ Obligations remain independent of Participant changes.

✓ Sustained Engineering Telemetry patterns raise Organisational Learning Obligations, and resolving them produces a revised Capability, Service or Policy Pack version.

---

## 18. Deliverables

Implementation of this chapter shall produce:

- Obligation domain model
- Obligation registry
- Obligation lifecycle service
- Obligation verification service
- Escalation service
- Dependency integration interfaces
- Obligation APIs
- Obligation events

---

## 19. Implementation Status & Gaps

*This section documents how the Obligation Model is realised in the current build. It does not change the requirements above (OM-001–006, FR-23.1–8, §§4–18); it records what is built, what is partial, and what is still open. Status markers: ✅ built · ⚠️ partial · ❌ not built.* Core files: `src/dblayer/obligationsDB.ts`, `src/routes/seu/core/obligations.ts`, `src/routes/seu/core/participantHome.ts`, `src/routes/seu/api/obligations.ts`, `src/domain/engine/executionEngineKickoff.ts`, `src/domain/engine/deliverableKickoff.ts`, `src/domain/engine/workItemGenerator.ts`, `ObligationRow` (`seuTypes.ts:1527-1551`).

An Obligation is a real structural gate on a governed transition, not just a record other engines consult. Two independent mechanisms raise one against a governed transition and block it: a Policy whose condition fails, and a Pack's own declared Obligation Definition whose `applicabilityDeliverables` names that exact transition. Both record `blocked_from_state`/`blocked_to_state` on the Obligation they raise, which is what lets the Execution Engine retry the exact hop once that Obligation resolves. The same mechanism also raises a matching Attention Item, and resolving *that* independently re-triggers the same retry. A Participant can raise an Obligation directly against their own dispatched Deliverable, ownership-checked server-side. The lifecycle itself (Identified → Archived, verification-gated) and its Dependency Engine integration remain the chapter's most completely built areas.

### 19.1 ⚠️ Definition (§4)

`origin` is a real column on `obligations`. `createObligation` (`core/obligations.ts`) is the single writer every real creation path calls through — no duplicated logic — but it has 9 real call sites across the codebase: sustained Telemetry blocking patterns (`origin` varies by which pattern — `"Quality Gates"`, `"Policies"`, or `"Telemetry and Knowledge Model"`, see 19.7), Knowledge Acquisition Scope promotion (`"Telemetry and Knowledge Model"`), a Policy blocking a governed transition (`"Policies"`, `raiseObligationForBlockedTransition`, gating both SEU- and Deliverable-level hops), a Pack's own declared Obligation Definition matching a governed transition (whatever the Definition itself declares, `raiseObligationsForPackDefinitions`, fully generic over which noun/transition though only one caller exists today), a Participant raising one against their own dispatched Deliverable (`"Participants"`, `raiseMyObligation`), converting a Review Finding to an Obligation (`findings.ts`, no origin set), and dispatch giving up permanently on a Work Item (`redispatch.ts`/`dispatchEngine.ts`, no origin set).

Every other named source in the chapter's own §10 list exists only as manual creation via the generic `POST /obligations` API. Full breakdown in 19.7.

### 19.2 ⚠️ Architectural Principles (OM-001–006) (§5)

| ## | Claim | Verdict | Evidence |
|---|---|---|---|
| OM-001 | Represented as Obligation | ✅ | Real table, real writes. |
| OM-002 | Independent of Participants | ✅ (trivially) | No Participant FK/column exists on `obligations` at all. |
| OM-003 | Participates in dependency evaluation | ✅ | `qualityGateEngine.ts` (`no_unresolved_obligations`) + `dependencyDefinitionEngine.ts` — see 19.8. |
| OM-004 | Fully traceable | ⚠️ | `events` gives a real timeline; Related Decisions/Evidence are genuinely resolvable via reverse lookup; Related Policies only via free text; Related Authority Rules and Related Risks are not reachable from the Obligation at all (19.5). `blocked_from_state`/`blocked_to_state` add a real, queryable "what this Obligation is blocking" fact on top of the chapter's own list. |
| OM-005 | Supports composition from multiple Packs | ⚠️ | `raiseObligationsForPackDefinitions` genuinely reads a composed Pack's own `contributionObligationDefinitions[]` off the EBM at runtime and raises a real Obligation instance from it — a real mechanism, not just an Ontology declaration. Incomplete: `obligations` carries no `originating_pack_id` column, unlike `quality_gates`/`policies`/`capabilities`, so a raised instance can't be traced back to the exact Pack that declared it (only to its own `origin` category, if the Definition set one); `category:obligation`'s own `contributed_by_pack` is NULL on every seeded row, so a Pack still can't introduce a *new* category value. |
| OM-006 | Explicit lifecycle states | ✅ | Real `transition_definitions` rows, exact 8-state match — see 19.6. |

### 19.3 ⚠️ Functional Requirements (FR-23.1–8) (§6)

| FR | Verdict | Note |
|---|---|---|
| FR-23.1 unique id | ✅ | `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`. |
| FR-23.2 dependencies on Deliverables/Decisions/Evidence/other Obligations | ⚠️ supported, unused | `dependency_definitions` (`from_entity_type`/`to_entity_type`, plain unconstrained text) already treats Deliverable/Decision/Evidence/Obligation as real, governed entity types on either side — the mechanism genuinely supports all 4. No seed data declares a real row naming Obligation as either side, so it's unexercised in practice, not unsupported. |
| FR-23.3 may block Deliverable transitions | ✅ | The `qg-deliverable-in-progress-to-approved` Quality Gate blocks on `no_unresolved_obligations`. Separately, `transitionDeliverable` refuses outright (`seu_blocked`) whenever the Deliverable's own owning SEU is itself blocked by an open commence-work Obligation — a second, structural block, checked before dependency readiness. |
| FR-23.4 measurable completion criteria | ⚠️ | The Definition already declares both halves Ch.5 §20's Verification Classification framework implies: a `classification` (`machine-verifiable`/`judgment`/`human-attested`) and, for the machine-verifiable case, a real structured `governingCondition` governance could check. Neither is wired to completion at runtime — `transitionObligation` never reads `classification` or re-evaluates a condition; every Obligation, regardless of declared classification, is closed only by a manual transition to `Resolved`/`Verified`. `completion_criteria TEXT` (the human-attested/judgment path) is real and populated by 3 of the 5 creation paths, but stays free text read by a person, never machine-checked. |
| FR-23.5 preserves complete engineering history | ⚠️ | No history table; reconstructable only from `events` (2 distinct types, 19.12). |
| FR-23.6 transitions fully traceable | ✅ | `transitionObligation` publishes `fromState`/`toState`/`actorId`/`authorityBadge` on every transition. |
| FR-23.7 delegation without changing ownership | ❌ | Zero `delegat*` hits anywhere in `src/` for Obligation, same absence Ch.22's Authority audit found; no ownership/assignment field exists to delegate from in the first place (19.10). |
| FR-23.8 Telemetry → auto-raised Organisational Learning Obligation | ✅ | Genuinely real — 3 real triggers in `telemetry.ts` (quality-gate blocking, policy waivers, capability shortages), deduplicated. |

### 19.4 ✅ Obligation Categories — fully seeded and reachable from a Pack's own Obligation Definition declaration (§7)

`category TEXT`, not DB-constrained but application-enforced via `assertCanonicalCategory("category:obligation", ...)`. `ontology_concepts WHERE concept_type='category:obligation'` carries all 9 rows: the chapter's 8 named categories (Engineering, Compliance, Security, Organisational Learning, Risk, Audit, Operational, Customer) plus one the chapter doesn't name (`Review Finding`, imported from Ch.25's Finding model).

A Pack's own `contributionObligationDefinitions[]` declares a real `category` (Ontology-backed dropdown, validated at `validatePackSeed` time exactly like Policy's own `category:policy`) and a real `origin` (`category:obligation-origin`, a categorical declaration of which kind of source this type of Obligation is meant for, not a relational FK to a specific raising entity). It also declares `applicabilityDeliverables[]` (`name`/`transitions`/`governingCondition`) — the identical shape Policy's own Eligibility-scope condition uses, validated the same way (`name` a real Authority Vocabulary noun, `transitions` real rows of that noun's own transitions). This is what `raiseObligationsForPackDefinitions` reads at runtime (19.9). What a Pack *cannot* do is introduce a new `category:obligation` value of its own — `contributed_by_pack` stays NULL on every seeded row; every real category comes from a platform-level migration, never a Pack.

### 19.5 ⚠️ Obligation Structure — the information the chapter asks for, checked by intent rather than by column name (§8)

The real `obligations` row directly carries Identifier, Title, Category, Description, Origin, Priority, Severity, Status, and Completion Criteria. Every real creation path populates Origin. Priority is populated only by the Policy-block and Pack-Obligation-block paths (`raiseObligationForBlockedTransition`/`raiseObligationsForPackDefinitions`); Quality-Gate/Telemetry/Participant-raised leave it null. Completion Criteria is populated by those same two paths plus, optionally, the Participant-raised path (`raiseMyObligation` accepts a caller-supplied `completionCriteria`); Quality-Gate/Telemetry leave it null. Its own structured half — the Definition's `classification`/`governingCondition` for the machine-verifiable case — is declared but never read at runtime, so completion is always a manual transition regardless of declared classification.

None of the chapter's "Related *"/Traceability fields exist as a named column on `obligations` itself, but most of them are genuinely answerable today via the same reverse-lookup pattern this platform already uses everywhere for a polymorphic relationship — the question is whether the *information* is retrievable, not whether there's a column of that exact name:

| Chapter field | Retrievable today? |
|---|---|
| Identifier | ✅ `id` |
| Title | ✅ `title` |
| Category | ✅ `category` |
| Description | ✅ `description` |
| Origin | ✅ `origin` — populated by every real creation path (`category:obligation-origin`) |
| Priority | ✅ `priority` — populated by the Policy-block and Pack-Obligation-block paths only |
| Severity | ✅ `severity` |
| Status | ✅ `status` |
| Completion Criteria | ✅ `completion_criteria` — free text for the human-attested/judgment path; the machine-verifiable path (classification/condition) is declared but not executed |
| Related Deliverables | ⚠️ collapsed into one polymorphic `related_object_type`/`related_object_id`, not plural or Deliverable-specific — but genuinely resolvable for whichever one Deliverable (or SEU) it names |
| Related Decisions | ✅ `decisionsDB.findByRelatedObject("Obligation", id)` — real, callable, the same reverse-lookup mechanism a Deliverable's own Related Decisions already use |
| Related Evidence | ✅ `evidenceDB.findByRelatedObject("Obligation", id)` (`evidence_relationships`) — same mechanism |
| Related Risks | ❌ genuinely absent — no Risk entity exists anywhere in the codebase to relate to |
| Related Policies | ⚠️ recoverable for a Policy-raised Obligation only, and only from free text — `raiseObligationForBlockedTransition` writes the raising Policy's own name/code straight into `title`/`description`; there's no structured query (`policiesDB` has no `findByGovernedTransition`-style lookup) |
| Related Authority Rules | ❌ the applicable authority rule for a governed hop is real and stored, but only on `governance_evaluation_outcomes` (reached via Command, per Ch.32's Work Item Execution Context) — nothing reverse-queries from an Obligation's own id back to that outcome |
| Traceability References | ⚠️ `events` (`ObligationCreated` plus each hop's own named event and `ObligationTransitioned`, 19.12) give a real, queryable timeline of every transition; `revision_history` (migration 252) separately preserves the old value of any plain field edit (title/description/severity/category/priority/completion criteria/assignment) that isn't a transition at all — together they cover the chapter's own traceability intent, still not a dedicated cross-reference table |

Beyond the chapter's own §8 list, the live row also carries `blocked_from_state`/`blocked_to_state` — which governed transition this Obligation is blocking, set only by the two raise-on-block paths, null for every other creation path — the structural fact `executionEngineKickoff` reads to know exactly what to retry once the Obligation resolves (19.9).

### 19.6 ✅ Obligation Lifecycle — matches the chapter exactly, verification gate structurally enforced (§9), plus Reopen and a deferred-escalation hop (migration 252)

`transition_definitions WHERE entity_type='Obligation'` carries the chapter's 8-state chain: `Identified→Analysed→Assigned→In Progress→Resolved→Verified→Closed→Archived`. "Closure shall require verification" is structurally enforced, not just conventionally observed — no `Resolved→Closed` or `In Progress→Closed` row exists, and `transitionEngine.evaluate()` fails closed for anything not in the table. Every raise-and-retry mechanism drives this exact same lifecycle via the same `transitionObligation`, never a parallel one.

Two additions, migration 252: `Closed→Reopened` and `Reopened→In Progress` re-enter a Closed Obligation into the normal chain without a fresh `Identified` row (owner: "reopened is equivalent to created" — version-significant, not a bare state flip, see 19.12). `{Identified,Analysed,Assigned,In Progress,Resolved,Verified}→Escalated` gives every pre-Closed state a real escalation hop (Ch.23 §14's own severity/prolonged-unresolved/repeated-verification-failure/approaching-milestone/dependency-impact conditions are what *should* trigger it — none of that trigger logic is built yet, deliberately deferred; this migration only wires the state and its event, the same "row exists, driving logic doesn't yet" pattern CR-097 left for Ontology's own review-queue rows).

### 19.7 ⚠️ Obligation Sources — 9 real call sites across 7 mechanisms, short of covering all 11 named sources (§10)

`createObligation` (`core/obligations.ts`) is the one, single writer — every real creation path calls through it, no duplicated logic anywhere. It has 9 real call sites across the codebase (including the generic `POST /obligations` API route itself):

| Source (chapter §10) | Mechanism | Sets `origin`? |
|---|---|---|
| Quality Gates | Sustained-blocking detection, quality-gate-blocking pattern (`telemetry.ts`) | ✅ `"Quality Gates"` |
| Telemetry and Knowledge Model | Acquisition Scope promotion (`knowledge.ts`); sustained-blocking detection's capability-shortage pattern (`telemetry.ts`) | ✅ `"Telemetry and Knowledge Model"` |
| Policies | `raiseObligationForBlockedTransition` — a Policy blocking a governed transition (called from both `commissioning.ts`, SEU-level, and `executionEngine.ts`, Deliverable-level); sustained-blocking detection's policy-waiver pattern (`telemetry.ts`) | ✅ `"Policies"` (or a declared `relatedObligations[]` override) |
| EBM / Organisation Packs / Compliance Packs | `raiseObligationsForPackDefinitions` — a Pack's own `contributionObligationDefinitions[].applicabilityDeliverables` matching the attempted transition. Fully generic over `relatedObjectType`/`fromState`/`toState`, exactly like Policy's own Eligibility-scope mechanism — it can check any Authority Vocabulary noun's transition without any code change. Currently called from exactly one place (`commissioning.ts`'s `attemptSeuCommenceWork`, hardcoded to `SEU\|Activated\|Operational`) — a scope fact, not a restriction in the mechanism itself: a second caller checking a Deliverable transition would invoke the same function with different arguments, nothing more. | ✅ whatever the Definition itself declares (`category:obligation-origin`) |
| Reviews | `convertFindingToObligation` (`findings.ts`, Ch.25 Finding model) — manual conversion of a Finding to an Obligation; category defaults to `"Review Finding"`, the one extra `category:obligation` value the chapter doesn't name (19.4) | ❌ null |
| Participants | `raiseMyObligation` (`participantHome.ts`) — a Participant raising one against their own dispatched Deliverable | ✅ `"Participants"` |
| *(not named by the chapter)* | Dispatch giving up permanently — `redispatch.ts` (redispatch limit exhausted) and `dispatchEngine.ts` (`rejectDispatch`, no Participant ever became Available) both raise an `"Operational"`-category Obligation | ❌ null |
| Authority evaluations, Customer requests, External systems | none | — still manual-only, via the generic `POST /obligations` API |

`category:obligation-origin`'s 11 seeded values are all real, and a Pack Obligation Definition can declare any of them. Of the real mechanisms above, 4 tag `origin` with a real value from that vocabulary; the Finding-conversion and dispatch-failure paths don't tag it at all. Of the chapter's 11 named sources, 3 (Authority evaluations, Customer requests, External systems) still have no automatic path at all, only the generic API.

### 19.8 ✅ Dependency Integration — the strongest-built area besides FR-23.8, real at both Deliverable and SEU level (§11)

`qualityGateEngine.ts` and `dependencyDefinitionEngine.ts` both treat Obligation as a real blocking node via the polymorphic `related_object_type`/`related_object_id`. The chapter's own worked examples are literally live: security-Obligation-blocks-Deliverable-approval is the real `qg-deliverable-in-progress-to-approved` gate; auto-unblock-on-resolution is `dependencyDefinitionEngine.evaluateAndPublishFromTransition` publishing `DeliverableReady`. The named-dependency-graph path (`dependency_definitions` rows naming Obligation) is unused in practice even though the engine supports it — the Quality Gate path is what's actually exercised.

A Policy blocking a governed transition genuinely gates both SEU-level (`commissioning.ts`) and Deliverable-level (`executionEngine.ts`) hops today, via the same `raiseObligationForBlockedTransition`. A Pack's own Obligation Definition is checked the identical, fully generic way (19.7) — only one call site currently invokes it (the SEU commence-work hop), not because the mechanism is SEU-specific.

Obligation also blocks at the **SEU** level, not just Deliverable: `attemptSeuCommenceWork` (`commissioning.ts`) treats an open Obligation against `related_object_type: "SEU"` (raised by either the Policy-block or Pack-Obligation-block path) as a reason to leave the SEU at `Activated` rather than advancing to `Operational` — and `transitionDeliverable` itself separately refuses (`seu_blocked`) to start any owned Deliverable while its owning SEU sits in that state, so a blocked SEU-level Obligation transitively blocks every Deliverable under it, not only ones a Quality Gate directly names.

### 19.9 ✅ Resolution — the verification gate is real and genuinely re-triggers a blocked hop for both Policy- and Pack-raised Obligations; the Pack-republish/Composition-Engine loop remains absent (§12)

"Resolution alone does not close an Obligation; Verification is required" is enforced by the same lifecycle gap as 19.6 — real, not aspirational.

`blocked_from_state`/`blocked_to_state` let `executionEngineKickoff.ts` know exactly what to re-attempt: on `ObligationTransitioned` reaching a resolved status (`Verified`/`Closed`/`Archived`), it re-runs `attemptSeuCommenceWork` for that Obligation's own SEU; on `AttentionItemTransitioned` reaching `Resolved`/`Closed`, it does the same for any Attention Item related to a SEU (Attention Item carries no `blocked_from_state`/`blocked_to_state` of its own — Ch.34 has no such concept, so this side is unconditional per-SEU, relying on `attemptSeuCommenceWork`'s own self-check for safety), and `deliverableKickoff.ts` runs its existing blanket per-Deliverable rescan off the same two events. For a Policy-raised Obligation this works because `attemptSeuCommenceWork` re-evaluates the live Policy row fresh on every retry — the Obligation is bookkeeping, the Policy's own condition is the real gate. For a Pack-raised Obligation, whose `applicabilityDeliverables[].governingCondition` has no live re-evaluation the way a Policy row does (it's frozen into the EBM's own composed pool at commissioning time, evaluated only against an always-empty `context`), `raiseObligationsForPackDefinitions` treats a *resolved* match for the same blocked transition as satisfied for good — it neither re-raises a duplicate nor re-blocks — mirroring Policy's own resolution semantics even though the underlying condition itself can never change post-commissioning.

The chapter's own second half of §12 — "a revised Capability/Service/Policy Pack version, composed by the Composition Engine" — is not built: zero Obligation references anywhere in `compositionEngine.ts`. Resolving an Obligation genuinely unblocks the governed transition it names, but never mints a new Pack version on its own.

### 19.10 ⚠️ Ownership (§13)

No `assigned_to`/`owner` column exists on `obligations`. There is no assignment field, let alone the owner-vs-assignee distinction the chapter describes — "belongs to the SEU" holds only because `seu_id` is the sole ownership-adjacent FK present, not a designed ownership model. The one real ownership-shaped check that does exist sits at creation, not as a field: `raiseMyObligation` re-derives and enforces which Deliverables a calling Participant is actually dispatched against before letting them raise an Obligation against one. That's a genuine, structural check on *who may create* an Obligation for a given Deliverable — not an owner/assignee field that persists on the Obligation once created.

### 19.11 ❌ Escalation — not built as the chapter describes it (§14)

The only real escalation logic in the codebase (`workItemHeartbeat.ts`, `telemetry.ts`) is not Obligation-scoped: `workItemHeartbeat.ts` explicitly excludes non-Deliverable entities, and `telemetry.ts`'s "Escalation"-category Attention Item is a side effect of *creating* an Organisational Learning Obligation, not a state-driven trigger off any of the chapter's 5 named conditions (severity, prolonged-unresolved, repeated-verification-failure, approaching milestone, dependency impact). No `ObligationEscalated` event exists (19.12). The Attention Item cross-link in 19.9 is a resolution-triggered retry, not an escalation.

### 19.12 ✅ Events — Version Feature Plan.md applied (migration 252): every hop now publishes its own named event, plus the generic one, plus a real version event (§15)

`transition_definitions.event_type`/`.version_event` were NULL for every Obligation row before migration 252, despite `transitionObligation` already existing — it only ever published the one generic `ObligationTransitioned` (`fromState`/`toState` payload), never a named event. `transitionObligation` now reads `gate.eventType` (Version Feature Plan.md §3's mechanism, already platform-wide) and publishes it **in addition to** `ObligationTransitioned`, not instead of it — same correlation id, both fire, nothing after either publish (owner, explicit: "every transition also has to publish ObligationTransitioned which is not stated in the chapter").

§15 names 8 events for 7 real state-machine hops with no clean 1:1 mapping (no chapter-given name exists for the Identified→Analysed, Assigned→In Progress, or Closed→Archived hops). Built mapping: `Identified→Analysed`=`ObligationUpdated`, `Analysed→Assigned`=`ObligationAssigned`, `Assigned→In Progress`=`ObligationProcessing`, `In Progress→Resolved`=`ObligationResolved`, `Resolved→Verified`=`ObligationVerified`, `Verified→Closed`=`ObligationClosed`, `Closed→Archived`=`ObligationArchived`, `Closed→Reopened`=`ObligationReopened`, `Reopened→In Progress`=`ObligationProcessing` (reused — same destination state as the row it re-enters), `{6 pre-Closed states}→Escalated`=`ObligationEscalated`. `ObligationProcessing`/`ObligationArchived` are real names this migration adds; §15 doesn't name them. `ObligationEscalated`/`ObligationReopened` are now real, closing 2 of the previous 6 collapsed-into-generic gaps; `ObligationCreated` (unchanged, at creation) plus the 9 hop-level events above account for every event this subsystem now publishes.

Every real transition (including Reopen and Escalate) also carries `version_event = 'VersionCreated'` — owner, explicit: "reopened is equivalent to created", generalised to "all are VersionCreated" rather than a position/name match against Ch.41 §15's 7-item Version vocabulary the way every other chapter's pass used (Verified→Closed forcing `VersionDeprecated`, etc. would have read as wrong). Version history for an Obligation is `events` filtered to these event types, per Version Feature Plan.md §4's read-only mechanism — no new table.

`SustainedPatternDetected` (`telemetry.ts`) remains a real extra event the chapter doesn't name. Field-level edit history (a plain Revision — title/description/severity/category/priority/completion criteria/assignment, no transition, no event of any kind) is not covered by `events` at all by design; migration 252 adds `obligations.revision_history` (JSONB, append-only) for exactly this case, written only by the new revise/save path (`reviseObligation`, `core/obligations.ts`) — see 19.5. On the AttentionItem side: `AttentionItemTransitioned` — real since Ch.34's own original build — is a catalogued event in `event_subscriptions` with two real subscribers (`executionEngineKickoff`, `deliverableKickoff`, see 19.9).

### 19.13 ✅ Non-Functional Requirements (§16)

| NFR | Verdict | Basis |
|---|---|---|
| deterministic lifecycle transitions | ✅ | `transition_definitions`-gated (19.6) |
| integrate with the Dependency Engine | ✅ | Deliverable- and SEU-level (19.8) |
| preserve complete traceability | ⚠️ | Real `events` timeline; most Related-* links resolvable by reverse lookup; Related Authority Rules/Risks are not (19.5) |
| support composition from multiple governance sources | ✅ | Quality Gate, Dependency Engine, Policy-block, and Pack-Obligation-block are all real, independent raise-on-block paths (19.7/19.9), though `originating_pack_id` traceability (19.2 OM-005) is still absent. |
| remain independent of Participant implementations | ✅ | No coupling exists |

### 19.14 ⚠️ Acceptance Criteria (§17)

| Criterion | Verdict |
|---|---|
| Every engineering commitment represented as an Obligation | ⚠️ real entity; 9 real call sites across 7 mechanisms, still short of covering all 11 named sources (19.7) |
| Obligations participate in dependency evaluation | ✅ (19.8) |
| Deliverable transitions can be blocked by unresolved Obligations | ✅ directly (19.3 FR-23.3) and transitively via a blocked owning SEU (19.8) |
| Obligation closure requires verification | ✅ (19.6/19.9) |
| Obligation provenance and history are preserved | ⚠️ real event timeline plus reverse-lookup Related Decisions/Evidence; Related Authority Rules/Risks not reachable (19.5) |
| Obligations remain independent of Participant changes | ✅ |
| Sustained Telemetry patterns raise Organisational Learning Obligations, and resolving them produces a revised Pack version | ⚠️ half true — raising is real (FR-23.8); "produces a revised Pack version" is not built (19.9) |

### 19.15 ✅ Deliverables (§18)

| Named Deliverable | Real artifact | Verdict |
|---|---|---|
| Obligation domain model | `ObligationRow` (`seuTypes.ts:1527`) | ✅ |
| Obligation registry | `obligationsDB.ts` | ✅ |
| Obligation lifecycle service | `transitionObligation` (`core/obligations.ts`) | ✅ |
| Obligation verification service | — | ⚠️ not a separate service — Verification is just another `transitionObligation` call to state `Verified` |
| Escalation service | — | ❌ no Obligation-scoped escalation code exists (19.11) |
| Dependency integration interfaces | `dependencyDefinitionEngine.ts`, `qualityGateEngine.ts`, `executionEngineKickoff.ts`, `deliverableKickoff.ts` | ✅ |
| Obligation APIs | `src/routes/seu/api/obligations.ts` (generic create/list, transition, and now `PATCH /obligations/:id` for a pure Revision); `participantHome.ts`'s `raiseMyObligation` (Participant-facing, ownership-checked) | ✅ — the SEU-detail page's own manual "Create Obligation" web form/route is removed entirely; `raiseMyObligation` (quickview) is the only human-facing creation surface beyond the generic JSON API. The SEU-detail Obligation modal (migration 252) now has a Save button for the Revision fields (description/severity/priority/completion criteria). |
| Obligation events | `ObligationCreated`; every hop's own named event (`ObligationUpdated`/`Assigned`/`Processing`/`Resolved`/`Verified`/`Closed`/`Archived`/`Reopened`/`Escalated`) plus generic `ObligationTransitioned`, both on every hop | ✅ migration 252 — Version Feature Plan.md applied (19.12) |

Not named in the chapter's own §18 list: the Work Item Execution Context (`workItemGenerator.ts`, Ch.32) surfaces every Obligation related to a dispatched Deliverable to the Participant performing the work — a plain, unscoped `obligationsDB.findByRelatedObject("Deliverable", …)`, the same breadth already given to that Deliverable's Decisions/Evidence/Knowledge, not limited to whichever Obligations a specific Governance Evaluation Outcome happened to consult for one transition attempt. This is the first place Obligation visibility reaches the Participant doing the work, not just the governance engines.

### Summary — ranked

1. **[Governance, real and strong]** Obligation is a real structural gate on a governed transition: a Policy or a Pack's own declared Obligation Definition can genuinely block SEU commence-work (and transitively every Deliverable under it), and resolving either one genuinely unblocks it via the Execution Engine's own retry, off either `ObligationTransitioned` or `AttentionItemTransitioned` (19.8, 19.9).
2. **[Data model]** Origin, Priority, and Completion Criteria are real columns on the live *instance*. Every real creation path now tags Origin with a real `category:obligation-origin` value; Priority is still Policy-block/Pack-Obligation-block only, and Completion Criteria's own structured half — the Definition's `classification`/`governingCondition` for the machine-verifiable case — is declared but never read at runtime, so completion stays a manual, free-text-guided human call regardless of classification (19.5, 19.7).
3. **[Ontology / Pack-contribution]** `raiseObligationsForPackDefinitions` genuinely reads a composed Pack's own Obligation Definitions at runtime and raises real instances from them. Still incomplete: no `originating_pack_id` column on `obligations`, and `category:obligation` still has zero Pack-*contributed* rows (19.2, 19.4).
4. **[Code, strong]** FR-23.8's Telemetry→Organisational-Learning-Obligation loop is fully real and automated (19.3, 19.7).
5. **[Code]** A Pack-raised Obligation's own resolution genuinely satisfies its blocking requirement for good — it does not re-raise a duplicate on the next retry, matching Policy's own resolution semantics even though its underlying condition can never change post-commissioning (19.9).
6. **[Code]** The chapter's own closing loop — Obligation resolution feeding back into a revised Pack via the Composition Engine — is confirmed absent in code; resolving an Obligation unblocks the transition it names, never mints a new Pack version (19.9).
7. **[Data model]** Most of §8's "Related *"/Traceability fields are genuinely answerable today via the platform's own reverse-lookup pattern (Related Decisions/Evidence, real queries), not a dedicated Obligation-side column — Related Authority Rules and Related Risks are the two that are genuinely unreachable, and Related Policies only via free text (19.5).
8. **[Code]** Delegation (FR-23.7) and an owner/assignee field (§13) are both entirely unbuilt on the Obligation itself; `raiseMyObligation` adds a real ownership *check* at creation time, not a persisting field (19.10).
9. **[Code]** Escalation (§14) exists nowhere for Obligation specifically — the only real escalation logic in the codebase excludes non-Deliverable entities, and the Attention Item cross-link is a retry mechanism, not an escalation trigger (19.11).
10. **[UI/UX]** The chapter's only human-facing creation surface is now Participant-scoped and ownership-checked (`raiseMyObligation`), not an ungated generic web form (19.15).
11. **[Execution visibility]** A Participant's own Work Item surfaces every Obligation on their Deliverable, not just the ones a specific governance check consulted for one transition attempt (19.15).
10. **[UI/UX, CR-108]** The chapter's only human-facing creation surface is now Participant-scoped and ownership-checked (`raiseMyObligation`), replacing an ungated generic web form whose own legitimacy had never been settled (19.15).
11. **[Execution visibility, CR-108 follow-on]** A Participant's own Work Item now surfaces every Obligation on their Deliverable, not just the ones a specific governance check happened to consult — the first place Obligation visibility reaches the person actually doing the work, not just the governance engines (19.15).
12. **[Events/versioning, migration 252]** Version Feature Plan.md applied to Chapter 23: every hop now publishes a real named event (in addition to the generic `ObligationTransitioned`, per owner's explicit instruction) and is version-significant (`version_event = 'VersionCreated'`, owner: "reopened is equivalent to created", generalised to every hop rather than a forced position match against Ch.41 §15's 7-item vocabulary). Two real lifecycle additions in the same pass: `Closed→Reopened→In Progress` re-enters a Closed Obligation without a new row, and `{6 pre-Closed states}→Escalated` gives §14 a real state/event to land on — its own trigger conditions (severity, prolonged-unresolved, etc.) stay deliberately deferred, same as 19.11 (19.6, 19.12).
13. **[Data model, migration 252]** `revision_history` (JSONB, append-only) closes a gap `events` structurally can't: a plain field edit (Revision, not a transition) publishes no event by this codebase's own convention, so without it the old value of an edited description/severity/priority/completion-criteria/assignment would be unrecoverable. Written only by the new revise/save path, never by a governed transition (19.5, 19.12).