
# Chapter 29 – State Management Model

[Sudha: I think this is the chapter where the platform's runtime philosophy becomes completely different from existing workflow engines.

Traditionally, workflow engines focus on **process state**.

Your platform focuses on **engineering state**.

That's a profound distinction.

We are **not** trying to manage workflows.

We are managing the state of an engineering system.

This chapter therefore becomes much broader than simply "state management."

It becomes the **authoritative runtime state model**.

-------------------

While writing this chapter, I realised we've introduced a concept that deserves much greater prominence than the brief mention it received in the previous chapter:

> **Transition Definitions**

I actually think **Transition Definitions** are one of the platform's core architectural objects.

Every lifecycle transition in the platform—whether for a Deliverable, Decision, Knowledge Item, Obligation, Participant or even an SEU—is governed by a Transition Definition.

That means a Transition Definition becomes the **runtime contract** for changing engineering state.

For example:

```
Deliverable

Under Review
        │
        ▼
Approved

Transition Definition

Requires:
    • Authority
    • Architecture Review
    • Security Review
    • Evidence
    • No blocking Obligations
    • Quality Gate "Architecture Approval"
```

Notice what we've achieved.

Instead of scattering transition logic across code, governance rules and workflow definitions, we've centralised it into a single declarative object.

I actually think we should elevate **Transition Definition** to a first-class architectural concept alongside Deliverables, Decisions, Obligations and Policies.

My recommendation is to create an ADR:

> **ADR – Transition Definitions**

**Decision:** Every governed lifecycle state transition shall be defined by a declarative Transition Definition. Transition Definitions shall specify the source state, target state and all prerequisites for the transition, including authority, policies, quality gates, reviews, evidence and obligations.

**Rationale:** This provides a single, reusable mechanism for governing lifecycle transitions across all engineering objects, eliminates duplicated transition logic and reinforces the platform's declarative architecture.

I believe this ADR will become one of the key implementation guides for the Runtime Kernel because it establishes that **state transitions are data, not code**. That philosophy is entirely consistent with the declarative approach we've taken throughout the platform.
]
---

# 1. Purpose

The State Management Model defines how runtime state is represented, maintained, transitioned and recovered within a commissioned Software Engineering Unit (SEU).

State Management provides the authoritative runtime view of every persistent engineering object.

The Runtime Kernel shall maintain engineering state independently of Participants, execution strategies and implementation technologies.

State is a platform concern.

Engineering meaning is provided by the Engineering Behavior Model (EBM).

---

# 2. Scope

This chapter defines:

- runtime state;
- state ownership;
- state transitions;
- state consistency;
- state persistence;
- state recovery.

This chapter does not define:

- engineering behaviour;
- governance policies;
- workflow definitions;
- storage technologies.

---

# 3. Architectural Position

```
Persistent Engineering Objects

Deliverables
Knowledge
Evidence
Decisions
Obligations
Participants
SEUs

↓

State Management

↓

Runtime Kernel

↓

Event Model
```

The State Management service is the authoritative source of runtime state.

---

# 4. Definition

State is the current authoritative condition of an engineering object at a particular point in time.

State consists of:

- lifecycle state;
- engineering attributes;
- runtime attributes;
- relationships;
- version references.

State shall always be explicit.

---

# 5. Architectural Principles

## SM-001

Every persistent engineering object shall possess explicit state.

---

## SM-002

State shall have exactly one authoritative owner.

---

## SM-003

State transitions shall be deterministic.

---

## SM-004

State transitions shall be atomic.

---

## SM-005

State history shall never be lost.

---

## SM-006

State shall be recoverable.

---

# 6. Functional Requirements

### FR-29.1

Every persistent engineering object shall maintain lifecycle state.

---

### FR-29.2

State transitions shall preserve historical versions.

---

### FR-29.3

The Runtime Kernel shall validate state transitions before committing them.

---

### FR-29.4

Every committed state transition shall publish runtime events.

---

### FR-29.5

State recovery shall preserve engineering consistency.

---

### FR-29.6

Concurrent state modifications shall be controlled.

---

### FR-29.7

State changes shall remain fully traceable.

---

# 7. Managed Objects

The State Management service manages runtime state for:

- Software Engineering Units
- Deliverables
- Decisions
- Knowledge
- Evidence
- Obligations
- Participants
- Engineering Behavior Models
- Runtime Services

Future engineering objects shall participate by default.

---

# 8. State Structure

Every managed object shall contain:

- Identifier
- Object Type
- Lifecycle State
- Version
- Current Attributes
- Relationship References
- Last Transition
- Transition Timestamp
- Current Owner (logical owner)
- State History Reference

The internal persistence model is implementation-defined.

---

# 9. State Transitions

Every transition shall define:

- source state;
- target state;
- triggering event;
- applicable Transition Definition;
- required Governance evaluation;
- timestamp;
- transition rationale.

A transition shall never occur implicitly.

---

# 10. Transition Definitions

A **Transition Definition** is a declarative object describing a permitted lifecycle transition.

Every Transition Definition shall specify:

- source state;
- target state;
- required Authority;
- required Policies;
- applicable Quality Gates;
- required Reviews;
- mandatory Evidence;
- blocking Obligations;
- applicable Engineering Behavior Model rules.

Transition Definitions are contributed through Packs.

They are interpreted by the Runtime Kernel.

---

# 11. State Consistency

The Runtime Kernel shall ensure that state remains internally consistent.

Consistency includes:

- valid lifecycle transitions;
- valid object relationships;
- version consistency;
- dependency consistency;
- governance consistency.

Invalid transitions shall be rejected.

---

# 12. State Persistence

Runtime state shall survive:

- Participant replacement;
- Runtime service restart;
- Runtime Kernel restart;
- infrastructure migration;
- software upgrades.

Transient execution state may be reconstructed.

Authoritative engineering state shall never be lost.

---

# 13. State Recovery

The Runtime Kernel shall support recovery of engineering state after failures.

Recovery shall restore:

- lifecycle states;
- relationships;
- pending transitions;
- active Obligations;
- active Governance context;
- runtime configuration.

Recovery shall not require recommissioning of the SEU.

---

# 14. Concurrency

Multiple Participants may operate concurrently.

The Runtime Kernel shall prevent conflicting state transitions.

Where conflicts occur, the platform shall:

- detect the conflict;
- preserve engineering integrity;
- reject or defer invalid transitions;
- publish conflict events.

The conflict resolution strategy is implementation-defined.

---

# 15. State History

Every state transition shall preserve:

- previous state;
- new state;
- transition definition;
- initiating event;
- governing authority;
- applicable policies;
- timestamp;
- engineering rationale.

State history is immutable.

---

# 16. Events

The State Management subsystem shall publish:

- StateTransitionRequested
- StateTransitionValidated
- StateTransitionCommitted
- StateTransitionRejected
- StateRecovered
- StateConflictDetected
- StateConflictResolved

---

# 17. Non-Functional Requirements

The State Management service shall:

- support concurrent execution;
- preserve deterministic behaviour;
- support historical reconstruction;
- support efficient querying;
- remain independent of persistence technologies.

---

# 18. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Every persistent engineering object possesses explicit state.

✓ State transitions are governed through Transition Definitions.

✓ Invalid transitions are rejected.

✓ State history is immutable.

✓ Runtime state survives failures.

✓ Concurrent transitions preserve engineering consistency.

---

# 19. Deliverables

Implementation of this chapter shall produce:

- State Management service.
- Transition Definition model.
- State registry.
- State persistence interfaces.
- Recovery service.
- Concurrency management service.
- State APIs.
- State events.

---

# 20. Implementation Status & Gaps

Code-verified audit (2026-08-22), not from memory — every claim below carries a file:line citation (and, where a live schema check mattered, a direct `psql` query against the real database — 23,204 rows in `events`, 16 distinct `entity_type` values in `transition_definitions`).

## 20.1 ⚠️ Architectural Principles (SM-001–006) (§5)

Mostly holds, with two real gaps and one partial:
- **SM-001** (explicit state) ✅ for every entity checked, **except EBM**: `ebms.status` exists but is set once at INSERT and never updated anywhere in `src/` — `ebmsDB.ts` exposes only `create`/`findById`, no `updateStatus`/transition method at all.
- **SM-002** (one authoritative owner) ✅ — each entity's state column is written by exactly one `*DB.ts` module's single `updateStatus`/`updateLifecycleState` method; no duplicate writers found.
- **SM-003** (deterministic) ✅ — `transitionEngine.evaluate()` resolves exactly one `transition_definitions` row per `(entity_type, from_state, to_state)`, enforced by a DB unique constraint.
- **SM-004** (atomic) ⚠️ — the state write itself is atomic (a single `UPDATE ... RETURNING *`), but the write and the resulting event publish are two separate, non-transactional round trips (`eventBus.publish()` called after `updateStatus` resolves, no surrounding `BEGIN/COMMIT`). A crash between the two leaves state changed with no event recorded. Generalized into its own audit CR: **[CR-055](../../../change-requests/CR-055-multi-statement-transaction-audit.md)** — is this the only instance of this pattern, or one of several across the codebase?
- **SM-005** (history never lost) ❌ — no dedicated history/audit table per governed entity; history is reconstructable only via `events`, and (20.11) several required fields aren't reliably captured there either. **[CR-054](../../../change-requests/CR-054-state-transition-log.md)** proposes a dedicated state table addressing this directly.
- **SM-006** (recoverable) ❌ — `grep -rniE "\brecover" --include="*.ts" src` (migrations excluded) returns **zero matches** anywhere in the codebase. No recovery mechanism exists.

## 20.2 ⚠️ Functional Requirements (FR-29.1–7) (§6)

| FR | Verdict | Note |
|---|---|---|
| FR-29.1 lifecycle state maintained | ✅ (EBM excepted, 20.1) | |
| FR-29.2 transitions preserve historical versions | ❌ | None of the six core entities (Deliverable, Decision, Knowledge, Evidence, Obligation, Participant) have a `version` column or any versioning concept. Of the entities that do have a `version` field, none implement "a transition preserves a version" — and they don't even share one mechanism with each other: **Objective** increments `version` in place, on the *same* row, but only via content-edit methods (`objectivesDB.update`/`updateParent`, re-parenting or statement/tier changes) — its own `updateStatus` (`objectivesDB.ts:214-218`) never touches `version` at all. **Template/Profile/Pack** never touch their own version field on any normal status transition either (`templatesDB.updateStatus`, `templatesDB.ts:110-118`, sets only `status`) — a new row with a bumped version is created only in one narrow, separate case: reactivating a row already sitting in a *terminal* state (Deprecated/Retired/Archived) back to Active (`reactivateAsNewVersion`, `templates.ts:444-529`), not on ordinary Draft→...→Active progression. **EBM** is different again — no transition mechanism exists at all (20.1), so its own version increments purely at creation time, one new row per recomposition |
| FR-29.3 validated before commit | ✅ | `transitionEngine.evaluate()` checks transition-definition existence, badge authority, policies, and quality gates, in that order, before any caller's DB write — confirmed at every one of 18 real call sites. Deliverable is a two-phase exception: validated at dispatch time, but the actual `lifecycle_state` write happens later, asynchronously, when a Participant reports Work Item completion |
| FR-29.4 every commit publishes an event | ⚠️ — one concrete violation | Evidence/Obligation/Decision/Knowledge/Deliverable all publish unconditionally. **Participant does not**: `CH13_EVENT_BY_TRANSITION` (`participants.ts:27-34`) covers only 6 of the 10 real governed `(from_state, to_state)` pairs — `Assigned→Executing`, `Assigned→Released`, `Available→Released`, `Executing→Released` commit state with **zero event published**, confirmed against the live `transition_definitions` table (10 rows for Participant) |
| FR-29.5 recovery preserves consistency | ❌ | Same zero-result grep as SM-006 — nothing to preserve, nothing exists |
| FR-29.6 concurrent modifications controlled | ❌ | The most consequential finding in this audit — see 20.10 |
| FR-29.7 fully traceable | ⚠️ | Holds via `events` for the entities that publish (20.11's caveats apply); the Participant gap above means those 4 transitions are traceable only via a generic `updated_at` bump, no from/to/actor/authority record at all |

## 20.3 ⚠️ Managed Objects — the real governed set is 16, not the chapter's 9 (§7)

Live query (`SELECT DISTINCT entity_type FROM transition_definitions`) returns exactly 16 types, matching `TransitionEntityType` in `seuTypes.ts` 1:1: `AttentionItem, Decision, Deliverable, Evidence, ExternalInteraction, Finding, Knowledge, KnowledgeScope, Objective, Obligation, Pack, Participant, Profile, Review, SEU, Template`.

Of the chapter's own 9 ("SEU, Deliverable, Decision, Knowledge, Evidence, Obligation, Participant, Engineering Behavior Models, Runtime Services"): 7 are real and governed. **"Engineering Behavior Models" is not** — EBM has no `TransitionEntityType` entry, no `transition_definitions` rows, and (20.1) no update path in code at all. **"Runtime Services" is not** — `grep -rniE "Runtime Service" src` returns zero matches; this is a documentation-only concept, not a code artifact of any kind.

**9 additional real governed types exist that the chapter never names**: `Objective`, `KnowledgeScope`, `AttentionItem`, `ExternalInteraction`, `Pack`, `Review`, `Finding`, `Template`, `Profile` — all confirmed with real `transition_definitions` rows. (`DeliverableDefinition` is not separately governed — it piggybacks on the `Deliverable` entity type at `deliverableDefinitions.ts:127`, not its own.)

Minor, separate finding: the SDK-authoring admin surface's own `VALID_ENTITY_TYPES` allowlist (`transitionDefinitions.ts:16-27`) only lists 11 of the 16 real types (missing `Participant`, `Review`, `Finding`, `Template`, `Profile`) — a stale admin-UI list, doesn't affect the runtime engine.

## 20.4 ❌ State Structure — most of the 10 required fields don't exist on any sampled entity (§8)

Checked Deliverable, Evidence, Participant against all 10: Identifier ✅, Object Type ✅ (implicit), Lifecycle State ✅, Current Attributes ✅, Relationship References ✅ — but **Version** ❌ (no column, any entity), **Last Transition** ❌ (no dedicated field), **Transition Timestamp** ❌ (only the generic `updated_at`, which also gets bumped by non-transition updates, e.g. `knowledgeItemsDB.updateAcquisitionScope`), **Current Owner** ❌ (no entity frames a column this way), **State History Reference** ❌ (no entity row points back to its own history; reconstruction is a separate query against `events` with no forward link). 5 of 10 fields hold, 5 don't, uniformly across every entity checked. **[CR-054](../../../change-requests/CR-054-state-transition-log.md)** proposes a dedicated state table closing Last Transition, Transition Timestamp, and State History Reference directly, plus a transition-sequence-number as a lightweight stand-in for Version (transition versioning specifically, not the still-separate gap of content versioning).

## 20.5 ❌ State Transitions — "transition rationale" doesn't exist as a concept (§9)

`TransitionOutcome` (`transitionEngine.ts:40-62`) carries `entityType`/`fromState`/`toState`/`createsObligation`/`authorityBadge` — no rationale field, and none of the 18 real call sites add one. The only `rationale` hits anywhere in `core/*.ts` are Decision's own business-content field (`decisionsDB.ts`, set at creation, unrelated to transitions) and Compliance's own unrelated use. Source/target state, applicable Transition Definition, and governance evaluation all hold; "triggering event" isn't a first-class concept either — transitions are triggered by a direct route/HTTP call, not by consuming a prior platform Event. **CR-054** proposes rationale as a real column on its own state table.

## 20.6 ⚠️ Transition Definitions — Authority is vestigial, and these are not Pack-contributed (§10)

Live schema: `entity_type, from_state, to_state, required_authority_rule_id, required_policy_ids, category, required_quality_gate_ids, creates_obligation, verb, is_active, retired_at`.

- **"Required Authority"** — `required_authority_rule_id` exists as a column but is never consulted by `evaluate()`; real enforcement is the `verb`-derived `${entityType}_${verb}` badge (already established this session, `transitionEngine.ts:8-12` documents the legacy path's removal directly in a comment).
- **"Required Reviews", "mandatory Evidence", "blocking Obligations"** are not literal columns anywhere on this table — reachable only indirectly, through `required_quality_gate_ids` → a Quality Gate's own `criteria.type` (`requires_accepted_evidence_or_approved_decision`, `requires_accepted_review`), or through the separate `dependency_definitions` graph.
- **"Transition Definitions are contributed through Packs" does not hold.** Every writer of `transition_definitions` was enumerated: `seedTransitionDefinitions.ts` (wipes and reseeds the whole graph from a static JSON file) and a standalone SDK-authoring admin API. Nothing in the Pack installation/composition pipeline (`compositionEngine.ts`, `commissioning.ts`) ever writes to this table — `packs.ts` only *reads* it. The real mechanism is direct JSON seeding plus a separate admin authoring surface, independent of a Pack's own lifecycle.

## 20.7 ⚠️ State Consistency (§11)

Valid lifecycle transitions ✅ (`transition_definitions`), governance consistency ✅ (badge/policy checks). "Valid object relationships" maps to `dependencyDefinitionEngine` — but that's more precisely a *readiness-gating precondition* layered on top of the transition mechanism (does a target state's prerequisites already exist and hold) than literal "relationship consistency enforcement" as the chapter frames it. "Version consistency" is moot — there's nothing to check, since (20.2) none of the core entities have a version concept at all.

## 20.8 ✅ State Persistence (§12)

Inherited for free from using a real Postgres database — survives service/process restart, infrastructure migration, and software upgrades architecturally, without any dedicated code. Not separately audited beyond confirming this is the actual persistence layer (established throughout this whole session's own work).

## 20.9 ❌ State Recovery — wholly unimplemented (§13)

Identical finding to SM-006/FR-29.5: zero matches for any recovery-related code anywhere in `src/`. Nothing exists to audit further.

## 20.10 ❌ Concurrency — no guard exists anywhere; the most consequential finding in this audit (§14)

Every transition-write UPDATE checked (Deliverable, Evidence, Obligation, Participant, Decision, Knowledge — `deliverablesDB.ts:112-120`, `evidenceDB.ts:182-190`, `obligationsDB.ts:76-84`, `participantsDB.ts:48-56`, `decisionsDB.ts:76-84`, `knowledgeItemsDB.ts:59-67`) follows the identical unconditional pattern: `UPDATE <table> SET <state_col> = $1, updated_at = NOW() WHERE id = $2 RETURNING *` — the `WHERE` clause never checks the expected prior state. `grep -rn "FOR UPDATE" src` (row locking) returns zero matches anywhere. No optimistic-concurrency version-column check exists either.

This is a genuine, exploitable lost-update race: two concurrent callers reading the same `fromState` will both pass `transitionEngine.evaluate()` and both successfully `UPDATE`, with the second silently overwriting the first — last-write-wins, no error, no signal to either caller that anything was wrong.

A structurally similar `WHERE id = $1 AND status = 'Draft'` guard exists on Template/Profile/Pack/DeliverableDefinition's own **content-edit** methods (`updateDraftContent`) — but that's a business rule ("only editable while Draft"), not a concurrency guard, and it's a different method from those same entities' own `updateStatus`, which is unconditional exactly like everything else.

No genuine state-transition conflict *detection* exists either — the only two real "conflict" mechanisms in the codebase (`compositionEngine.ts`'s cross-Pack governance-conflict check, and `compliance.ts`'s declared `conflicts_with` relationships) are both unrelated to concurrent runtime transitions; everything else matching "conflict" is a Postgres `ON CONFLICT` upsert clause.

An optimistic-concurrency guard (an expected-prior-state condition on each entity's own transition-write `UPDATE`) is agreed as the actual fix for the underlying race, tracked separately (not yet built). **CR-054**'s own state table doesn't prevent the race either, but if wired to log rejected attempts once that guard exists, it gives the *visibility* §14 also asks for ("detect the conflict... publish conflict events") — a complementary, not competing, piece.

## 20.11 ⚠️ State History — 2 of 8 required fields map to real columns (§15)

Real `events` columns: `event_type, originating_object_type/id, seu_id, correlation_id, causation_id, payload (jsonb), actor_id, authority_badge, occurred_at, sequence, consumption_state`.

| Required field | Status |
|---|---|
| Previous / new state | ⚠️ only inside free-form `payload.fromState`/`.toState`, a per-caller convention, not structurally enforced |
| Applicable Transition Definition | ❌ no `transition_definition_id` reference; only reconstructable after the fact if `payload` happens to carry `fromState`/`toState` |
| Initiating event (causation) | ⚠️ real column (`causation_id`, fixed this session — Ch.30 §20.5), but nullable and only sometimes populated by design |
| Governing authority | ✅ real column (`authority_badge`), populated at every checked call site that actually publishes |
| Applicable policies | ❌ never recorded for a *passing* check — only a blocking policy (never committed, so never persisted) or a non-blocking `StandardPolicyDeviation` leaves any trace |
| Timestamp | ✅ real column (`occurred_at`) |
| Engineering rationale | ❌ doesn't exist anywhere (20.5) |

**CR-054** proposes closing every ❌/⚠️ row above with a real, dedicated column on its own state table, rather than continuing to rely on `events.payload` convention.

## 20.12 ❌ Events — 0 of 7 named events exist, real per-entity events exist instead (§16)

`StateTransitionRequested`/`StateTransitionValidated`/`StateTransitionCommitted`/`StateTransitionRejected`/`StateRecovered`/`StateConflictDetected`/`StateConflictResolved` — confirmed zero hits for all seven via direct grep, not assumed. Same pattern already found for Ch.15 §17 and Ch.30 §7: illustrative generic names that were never built verbatim, with real per-entity events (`EvidenceTransitioned`-family, `ObligationTransitioned`, `DecisionTransitioned`, `KnowledgeUpdated`, `DeliverableTransitioned`, the `CH13_EVENT_BY_TRANSITION` Participant events, `ObjectiveTransitioned`, `AttentionItemTransitioned`) doing the real work instead. **CR-054** proposes these names find a real home as its own state table's `outcome` vocabulary (Ontology-backed) rather than as literal Bus events, which would just be redundant noise alongside the entity-specific events that already serve the Bus's own announcement role.

## Summary — ranked

1. **[Code, most consequential]** No concurrency control anywhere in the transition-write path (20.10) — a real, exploitable lost-update race on every governed entity, not a documentation gap. Agreed fix (not yet built): an optimistic guard on each entity's own state column; **CR-054** additionally proposes a state table making rejected/conflicting attempts visible after the fact.
2. **[Code]** Participant's `CH13_EVENT_BY_TRANSITION` misses 4 of its 10 real transitions, silently dropping their events (20.2 FR-29.4).
3. **[Code]** EBM has no transition mechanism at all despite being a named Managed Object (20.1, 20.3).
4. **[Code, large]** No versioning on any of the six core entities (20.2 FR-29.2) — consistent with Ch.15's own Deliverable-versioning finding and CR-051's Evidence work, now confirmed platform-wide.
5. **[Code]** No recovery mechanism exists (20.1, 20.2, 20.9) — three sections collapsing to the same zero-result finding.
6. **[Documentation/design]** "Transition Definitions contributed through Packs" doesn't match the real mechanism (direct JSON seed + admin API) — either the chapter's own claim needs revising, or this is a real gap depending on how load-bearing that design intent is (20.6).
7. **[Data structure]** State Structure's 5 missing fields (Version, Last Transition, Transition Timestamp, Current Owner, State History Reference) are uniform across every entity checked, not entity-specific gaps (20.4). **CR-054** proposes closing these with a dedicated state table; **CR-055** proposes auditing the codebase for the related multi-statement-atomicity gap the state table's own write path would inherit (also present today at every transition-write + event-publish site, 20.1 SM-004).
8. **[Documentation]** "Runtime Services" as a Managed Object is pure prose, no code artifact of any kind (20.3).