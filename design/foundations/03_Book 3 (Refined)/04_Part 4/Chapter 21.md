# Chapter 21 – Governance Model

## 1. Purpose

The Governance Model defines the framework by which engineering activities within a Software Engineering Unit (SEU) are directed, constrained, authorised and verified.

Governance ensures that engineering execution remains consistent with the Engineering Behavior Model (EBM), organisational requirements and applicable regulations.

Governance is not responsible for performing engineering work.

Its responsibility is to determine **whether engineering work is permitted to proceed, under what conditions, and with what level of assurance**.

---

## 2. Scope

This chapter defines:

- governance abstraction
- governance responsibilities
- governance hierarchy
- governance relationships
- governance lifecycle
- governance enforcement

This chapter does not define:

- authority assignments
- policy definitions
- review procedures
- compliance rules

These are specified in subsequent chapters.

---

## 3. Architectural Position

```
Engineering Behavior Model
            │
            ▼
     Governance Model
            │
 ┌──────────┼──────────┐
 │          │          │
Authority Obligations Policies
 │          │          │
 └──────────┼──────────┘
            ▼
   Deliverable State Changes
```

Governance sits between engineering behaviour and engineering execution.

---

## 4. Definition

Governance is the collection of rules, controls and decision mechanisms that regulate engineering execution within an SEU.

Governance determines:

- what may occur
- who may authorise it
- what evidence is required
- what obligations must be satisfied
- what reviews must occur

Governance does **not** determine how engineering work is performed.

---

## 5. Architectural Principles

### GM-001

Governance is explicit.

No significant engineering action shall depend upon implicit organisational knowledge.
 
### GM-002

Governance is declarative.

Governance rules are defined by Packs and interpreted by the Runtime.
 
### GM-003

Governance is composable.

Multiple organisations may contribute governance simultaneously.
 
### GM-004

Governance is traceable.

Every governance decision shall be explainable.
 
### GM-005

Governance is context-sensitive.

Governance depends upon:

- the Engineering Behavior Model
- Deliverable state
- active Obligations
- Engineering Stage
- Authority Model
 
### GM-006

Governance shall remain independent of Participant implementations.

---

## 6. Functional Requirements

### FR-21.1

Every SEU shall possess one effective Governance Model derived from its Engineering Behavior Model.
 
### FR-21.2

Governance rules shall be contributed through Packs.
 
### FR-21.3

Governance shall be evaluated before every significant Deliverable state transition.
 
### FR-21.4

Governance evaluations shall be deterministic.
 
### FR-21.5

Governance outcomes shall be fully traceable.
 
### FR-21.6

Governance shall support multiple participating organisations.
 
### FR-21.7

Governance conflicts shall be detected during composition where possible and at runtime where necessary.

---

## 7. Governance Components

The Governance Model consists of:

- Authority
- Policies
- Obligations
- Reviews
- Quality Gates
- Compliance Rules
- Delegation Rules
- Escalation Rules
- Decision Governance

Each component is specified in a dedicated chapter.

---

## 8. Governance Sources

Governance may originate from:

- Platform Packs
- Organisation Packs
- Domain Packs
- Compliance Packs
- Technology Packs
- Customer Packs

Multiple governance sources may coexist.

The Composition Engine produces one effective Governance Model as part of the Engineering Behavior Model.

---

## 9. Governance Evaluation

Governance is evaluated whenever an engineering action could change the state of the SEU.

Illustrative triggers include:

- Deliverable approval
- Decision approval
- Obligation closure
- Release authorisation
- Engineering stage transition

Evaluation determines whether the requested transition is permitted.

---

## 10. Governance Outcomes

A governance evaluation may result in:

- Approved
- Approved with Conditions
- Deferred
- Rejected
- Escalated
- Waived

A transition shall be **Rejected** or **Deferred** only on violation of a Policy whose Constraint Type is "Policy" (mandatory), on an unresolved blocking Obligation, or on missing Authority. Deviation from a Policy whose Constraint Type is "Standard" (Chapter 24 §4) shall never, by itself, produce a Rejected or Deferred outcome — it is recorded and remains traceable, but governance approves the transition regardless.

Every outcome shall include a recorded rationale.

---

## 11. Governance Lifecycle

Governance rules progress through:

```
Defined

↓

Composed

↓

Active

↓

Applied

↓

Superseded

↓

Archived
```

Historical governance rules shall remain reproducible.

---

## 12. Governance Traceability

Every governance outcome shall record:

- governing rule
- originating Pack
- applicable Authority
- supporting Evidence
- related Decision
- affected Deliverable
- timestamp

This enables complete reconstruction of governance decisions.

---

## 13. Events

The Governance subsystem shall publish:

- GovernanceEvaluated
- GovernanceApproved
- GovernanceRejected
- GovernanceEscalated
- GovernanceWaived
- GovernanceRuleApplied

---

## 14. Non-Functional Requirements

The Governance Model shall:

- remain deterministic
- support composition from multiple organisations
- preserve complete traceability
- support historical reconstruction
- remain independent of runtime implementations

---

## 15. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Every significant engineering state transition is governed.

✓ Governance rules are composable.

✓ Governance decisions are traceable.

✓ Governance supports multi-organisation engineering.

✓ Historical governance can be reconstructed.

✓ Governance remains independent of Participant implementations.

---

## 16. Deliverables

Implementation of this chapter shall produce:

- Governance domain model
- Governance evaluation service
- Governance registry
- Governance APIs
- Governance event model
- Governance traceability model

---

## 17. Implementation Specifics

*Recorded 2026-09-16. This section documents how the Governance Model is realised in the current build. It does not change the requirements above (GM-001–006, §§1–16); it records what is built, what is partial, and what is still open — the same convention as Chapter 5 §19. Status markers: ✅ built · ⚠️ partial · 🚩 not built.*

### 17.1 ✅ Governance is a real, generic pure-evaluation layer (§1, §3, §9, FR-21.3, FR-21.4)

`transitionEngine.evaluate` (`domain/engine/transitionEngine.ts`) is exactly the pure decision service the chapter preamble describes: given `(entityType, fromState, toState, actorId, context)` it resolves the governing `transition_definitions` row and returns `allowed: true/false` plus a reason — it never performs the transition itself, the caller does, matching §1's "does not perform the transition; it authorises or constrains it." It is generic over entity type (no `SEU`/`Deliverable` import), so it is the one evaluation engine for every governed entity, not a Deliverable-specific one, closing FR-21.1's "one effective Governance Model." Evaluation composes, per call: badge authority (§17.2), Policy conditions (§17.3), and — only when the definition opts in via `required_quality_gate_ids` — Quality Gates (§17.4). Deterministic by construction: a pure function of the resolved definition row + the caller-supplied context, no hidden state (FR-21.4).

### 17.2 ✅ Authority — noun × verb badges, not the §7 "Authority" component as separately specified (§7, GM-006)

`badgeAuthorityEngine.authorise` (`domain/engine/badgeAuthorityEngine.ts`) is the one authorisation check: root bypass, or the actor holds the transition's `entitytype_verb` badge (or a declared alternate). This is CR-006's noun×verb model — real, working, and independent of Participant implementation (GM-006) — but it is not the richer §7 "Authority" component as its own dedicated chapter would define it (role hierarchies, delegation); it is a flat badge-grant lookup (`badgeGrantsDB.findActiveForHolder`).

### 17.3 ✅ Policies — the "Policy" constraint type blocks, "Standard" never does (§10, GM-002)

`transitionEngine.evaluate` resolves `required_policy_ids` off the definition row and evaluates each policy's `condition` (`governingCondition.ts`) against the caller's context. §10's exact rule is realised precisely: `constraint_type === "Policy"` on an unsatisfied condition returns `policy_blocked` (Rejected); `constraint_type === "Standard"` publishes `StandardPolicyDeviation` and lets the transition proceed regardless — never blocking by itself. `PolicyApplied`/`PolicyViolated` are published per policy checked, real per-rule traceability (§12, GM-004). Policies themselves are Pack-contributed (GM-002) — see Ch.5 §19.4.

### 17.4 ⚠️ Quality Gates — a second, entity-specific evaluation path, opt-in at the generic layer (§7)

`qualityGateEngine` is a separate, older evaluation path most entities (Deliverable, AttentionItem, etc.) call directly before/alongside `transitionEngine.evaluate`, with its own outcome vocabulary (`Passed`/`Blocked`/`Waived`/`NotApplicable`) and its own waiver mechanism (`qualityGateWaiversDB`). `transitionEngine.evaluate` can also run gates itself via `required_quality_gate_ids`, but every pre-existing `transition_definitions` row leaves that array empty, so in practice Quality Gates are evaluated by the entity-specific call site, not folded into the one generic governance evaluation FR-21.1 describes. Two real evaluation paths exist side by side, not fully unified.

### 17.5 🚩 Obligations are not evaluated inside governance itself — they block by not being checked (§7, §9, GM-005)

GM-005 lists active Obligations as something governance depends on, and §9 lists "Obligation closure" as an illustrative evaluation trigger. `transitionEngine.evaluate` never queries `obligationsDB` at all — an open Obligation blocks a transition only because the *caller* (`executionEngine.ts`'s `attemptSeuCommenceWork`/deliverable-start checks) separately queries `obligationsDB.findByRelatedObject` before ever calling `transitionEngine.evaluate` (Ch.23's own `raiseObligationForBlockedTransition` flow). Governance's own evaluation function has no Obligation awareness built in — it is assembled by each call site, not centralised.

### 17.6 🚩 Reviews are not evaluated inside governance itself, same pattern as Obligations (§7)

Reviews are consulted only via a Quality Gate's `requires_accepted_review` criteria type (`qualityGateEngine.ts`, Ch.5 §19.4) — i.e. only when a caller runs the separate Quality Gate path (§17.4), never as a first-class input `transitionEngine.evaluate` itself resolves.

### 17.7 ⚠️ Compliance — a real, but explicitly read-only, downstream evaluation, not a governance blocker (§7, §10)

`core/compliance.ts` (Ch.27) is a real, deterministic evaluator over Obligations/Evidence/Decisions/Reviews, reusing the identical qualifying-status sets `qualityGateEngine` uses — but by its own file-header comment it "never modifies engineering state and never blocks a transition." §7 lists Compliance Rules as a Governance component; in the current build it sits outside the evaluation path entirely, an emergent read, not something `transitionEngine.evaluate` ever consults.

### 17.8 🚩 Delegation Rules and Escalation Rules (§7) — not built

No delegation mechanism exists (a single stray mention of "delegation" in one domain Pack's seed data, not a real construct). No governance-specific escalation mechanism exists either — the only "escalation" code in the repo is Work Item/Dispatch-level and Attention's own §13 escalation (Ch.34 §19.7, itself 🚩), unrelated to a governance rule escalating a decision per §7/§10's "Escalated" outcome.

### 17.9 🚩 Decision Governance (§7) — not built as its own component

No `decision_governance` construct exists. Decisions (`decisionsDB.ts`) are a real entity consumed by Compliance (§17.7) and Quality Gate criteria, but there is no dedicated Decision Governance component evaluating or gating decisions the way §7 names it as a distinct governance component.

### 17.10 ⚠️ Governance outcomes realised as a narrower vocabulary than §10 (§10)

`transitionEngine.evaluate` returns `allowed: true` or `allowed: false` with a reason (`authority_denied` / `policy_blocked` / `quality_gate_blocked` / `not_submitted` / `no_transition_definition`) — a binary allow/deny, not §10's six-way outcome set. **Approved** and **Rejected** map directly. **Waived** exists, but only inside the separate Quality Gate path (§17.4), not as a `transitionEngine` outcome. **Approved with Conditions** and **Deferred** have no realised equivalent — a Standard-constraint Policy deviation (§17.3) is the closest analogue to "Approved with Conditions" but is not modelled or returned as a distinct outcome, just a side-published event. **Escalated** has no realised equivalent (§17.8).

### 17.11 🚩 No named Governance events are published (§13)

None of `GovernanceEvaluated`, `GovernanceApproved`, `GovernanceRejected`, `GovernanceEscalated`, `GovernanceWaived`, `GovernanceRuleApplied` are published anywhere in the codebase. What is published instead, per evaluation, is the lower-level vocabulary each sub-mechanism owns: `PolicyApplied`/`PolicyViolated`/`StandardPolicyDeviation` (§17.3), `QualityGatePassed`/`QualityGateBlocked`/`QualityGateWaived` (§17.4), plus each entity's own `*Transitioned`/domain event once a transition is actually applied. There is no single governance-level event emitted per evaluation call.

### 17.12 ✅ Conflict detection realises FR-21.7 at composition time (§8, FR-21.7)

`detectGovernanceConflicts` (`domain/engine/compositionEngine.ts`) runs at Pack composition and blocks commissioning (Ch.5 §19.8) when two composed Packs assign different authorised roles to the same transition, or contribute a Quality Gate to the same `(entityType, fromState, toState)` — real, working composition-time conflict detection from multiple governance sources (§8, GM-003). No equivalent *runtime* conflict detection exists (FR-21.7's "at runtime where necessary" half).

### 17.13 🚩 No governance-rule lifecycle of its own (§11)

§11's `Defined → Composed → Active → Applied → Superseded → Archived` lifecycle is not modelled as a thing that happens to a governance rule. Each contributing primitive rides its *owning* Pack's own lifecycle (Ch.5 §19.3) instead — a Policy or Quality Gate becomes usable when its originating Pack reaches `Active`, and is superseded when a new Pack version does — there is no governance-rule-specific state machine distinct from Pack's.

### 17.14 ⚠️ Traceability is real but distributed, not a single governance record (§12, GM-004)

Every evaluation leaves a real, queryable trail — `PolicyApplied`/`PolicyViolated`(+ `originating_pack_id` back to the Policy's own Pack), `qualityGateEvaluationsDB` rows, each entity's own `*Transitioned` event carrying `authorityBadge` (the actual badge the actor used, per §17.2's own accountability comment) — so §12's fields (governing rule, originating Pack, applicable Authority, timestamp) are individually reconstructable. But there is no single `governance_evaluations` record tying one governance decision's full rationale (Authority + Policy + Quality Gate + Obligation state, all at once) together in one row — reconstruction means joining the Policy/QualityGate/event tables per transition, not reading one governance outcome record.