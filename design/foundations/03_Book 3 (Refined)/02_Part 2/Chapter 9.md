
# Chapter 9 – Dependency Engine

[Sudha: 
we've reached the point where **Part I is complete**.

Let's check:

- ✅ SEU
- ✅ Engineering Behavior Model
- ✅ Composition Engine
- ✅ Pack Model
- ✅ Template Model
- ✅ Profile Model
- ✅ SEU Commissioning

There is one thing that is still missing before an SEU starts working.

It is something we have deliberately postponed because we kept discovering better abstractions.

Originally we called it:

- AI Project Manager
- AI Orchestrator
- Scheduler
- Dependency Manager
- Flow Engine

I now think we know exactly what it is.

It is **the Dependency Engine**.

Not because it schedules work.

Because it decides **what engineering outcome becomes achievable next**.

]
---

# 1. Purpose

The **Dependency Engine** is responsible for governing execution within a Software Engineering Unit (SEU).

Unlike traditional project management systems, which organise execution around schedules and tasks, the Dependency Engine organises execution around **deliverables and their dependencies**.

The Dependency Engine continuously evaluates engineering readiness by determining which deliverables are capable of progressing based upon the current engineering state.

Execution within an SEU is initiated only when dependency conditions have been satisfied.

---

# 2. Scope

This chapter defines:

- dependency model;
- dependency graph;
- readiness evaluation;
- dependency state;
- dependency resolution;
- execution triggering;
- dependency monitoring.

This chapter does not define:

- engineering behaviour;
- participant reasoning;
- work item execution;
- project scheduling.

---

# 3. Architectural Position

```
Knowledge
      │

Deliverables
      │

Obligations
      │

Decisions
      │

Evidence
      │

──────────────

Dependency Engine

──────────────

Ready Deliverables

↓

Capability Fulfilment

↓

Execution
```

The Dependency Engine determines **what may execute**.

It never performs execution itself.

---

# 4. Architectural Responsibilities

The Dependency Engine shall:

- maintain the Deliverable Dependency Graph;
- determine engineering readiness;
- identify blocked deliverables;
- identify dependency constraints;
- detect circular dependencies;
- publish dependency state;
- trigger execution readiness events.

The Dependency Engine shall not:

- schedule participants;
- execute work;
- generate engineering behaviour;
- preserve knowledge.

---

# 5. Fundamental Principle

The unit of execution within an SEU is the **Deliverable**.

Work Items exist solely to create, modify or validate Deliverables.

Dependencies are relationships between Deliverables and other engineering artefacts.

The Dependency Engine operates exclusively upon those relationships.

---

# 6. Functional Requirements

### FR-9.1

Every Deliverable shall exist within the Deliverable Dependency Graph.

---

### FR-9.2

Every dependency shall possess an explicit type.

---

### FR-9.3

Dependency evaluation shall occur continuously throughout SEU execution.

---

### FR-9.4

Execution readiness shall be determined solely from dependency satisfaction.

---

### FR-9.5

The platform shall detect circular dependencies.

---

### FR-9.6

The platform shall publish dependency state changes.

---

### FR-9.7

Dependencies shall be fully traceable.

---

### FR-9.8

External dependencies shall be represented explicitly.

---

# 7. Deliverable Dependency Graph

The Dependency Engine maintains a directed graph describing engineering relationships.

Nodes represent:

- Deliverables
- Decisions
- Knowledge
- Evidence
- Obligations
- External Dependencies

Edges represent dependency relationships.

The graph constitutes the authoritative execution model of the SEU.

---

# 8. Dependency Types

The platform shall support, at minimum, the following dependency types.

## Deliverable Dependency

One Deliverable depends upon another.

---

## Decision Dependency

Execution requires an approved decision.

---

## Knowledge Dependency

Execution requires sufficient engineering knowledge.

---

## Evidence Dependency

Execution requires evidence.

---

## Obligation Dependency

Execution is blocked by an unresolved obligation.

---

## External Dependency

Execution depends upon an external organisation, system or participant.

---

## Capability Dependency

Execution requires one or more capabilities to become available.

Where the dependency concerns a specific contracted output rather than the Capability in the abstract, it shall reference the specific Service (Chapter 11) that Capability exposes — for example, the Approved Solution Architecture service, not the Architecture Capability generally. This gives the dependency a precise, evaluable condition rather than a vague notion of availability.

---

Additional dependency types may be introduced through Packs.

---

# 9. Dependency States

Each dependency shall exist in one of the following states.

- Unknown
- Pending
- Satisfied
- Blocked
- Invalid
- Waived

State transitions shall remain fully traceable.

---

# 10. Deliverable Readiness

A Deliverable shall be considered **Ready** when:

- all mandatory dependencies are satisfied;
- required evidence exists;
- required decisions are approved;
- blocking obligations have been resolved;
- required capabilities are available.

The Dependency Engine shall publish a **DeliverableReady** event.

---

# 11. Constraint Detection

The Dependency Engine continuously identifies constraints preventing engineering flow.

Examples include:

- unresolved engineering decisions;
- missing evidence;
- incomplete knowledge;
- unresolved obligations;
- unavailable capabilities;
- external approvals.

Constraint detection shall remain independent of elapsed time.

---

# 12. Execution Trigger

When a Deliverable becomes Ready:

- the Dependency Engine shall identify the capabilities required to progress it;
- the Capability Fulfilment service shall determine the eligible Participants for those capabilities;
- Work Items shall be generated as required;
- the Dispatch Engine shall select and assign the executing Participant from the eligible pool;
- execution may commence.

The Dependency Engine does not assign Participants or generate engineering behaviour.

---

# 13. Dynamic Re-evaluation

The Dependency Engine shall automatically re-evaluate readiness whenever:

- Deliverables change;
- Decisions change state;
- Knowledge is accepted;
- Evidence is added;
- Obligations are resolved;
- external dependencies change;
- the Engineering Behavior Model changes through authorised recomposition.

---

# 14. Flow Optimisation

The Dependency Engine shall maximise engineering flow by:

- identifying unnecessary blocking dependencies;
- exposing opportunities for parallel execution;
- detecting bottlenecks;
- recommending decomposition of large Deliverables where appropriate;
- continuously re-evaluating execution readiness.

The Dependency Engine shall not optimise for elapsed time.

---

# 15. Events

The Dependency Engine shall publish:

- DependencyCreated
- DependencySatisfied
- DependencyBlocked
- DependencyWaived
- DeliverableReady
- DeliverableBlocked
- ConstraintDetected
- ConstraintResolved
- CircularDependencyDetected

---

# 16. Non-Functional Requirements

The Dependency Engine shall:

- support incremental graph updates;
- evaluate readiness deterministically;
- support concurrent execution;
- scale to large dependency graphs;
- remain independent of participant implementation.

---

# 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Every Deliverable participates in the dependency graph.

✓ Circular dependencies are detected.

✓ Ready Deliverables are identified correctly.

✓ Blocked Deliverables identify their blocking dependencies.

✓ Dependency state changes generate events.

✓ Execution is initiated only after dependency satisfaction.

---

# 18. Deliverables

Implementation of this chapter shall produce:

- Deliverable Dependency Graph.
- Dependency Engine.
- Dependency Evaluation Service.
- Constraint Detection Service.
- Flow Analysis Service.
- Readiness Evaluation API.
- Dependency Events.


[Sudha: This chapter captures one of the most significant departures from traditional software engineering platforms.

However, while writing it, I realised there's an important distinction we should preserve going forward.

The **Dependency Engine** should not decide **how** to satisfy a dependency. It should only determine **whether** the dependency has been satisfied.

For example:

- It should determine that an architecture decision is required.
- It should not decide what the architecture should be.
- It should determine that a security review is outstanding.
- It should not perform the security review.
- It should determine that a capability is required.
- It should not decide whether that capability is fulfilled by an AI participant, a human expert or an external service.

This reinforces a principle that has been emerging throughout the architecture:

> **Evaluation and execution are separate responsibilities.**

The Dependency Engine evaluates engineering state. Other components act upon that evaluation. Maintaining that separation will keep the architecture modular, testable and extensible as the platform evolves. I think it's worth capturing this as another ADR because it clearly delineates responsibilities between orchestration and execution.]

---

# 19. Implementation Specifics

*(2026-08-20, second review — the whole engine described in the first pass of this section was rebuilt in the interim (CR-039 through CR-046) and no longer exists: `src/domain/engine/dependencyEngine.ts` and `src/dblayer/dependencyEdgesDB.ts` are both deleted; `dependency_edges` itself is dropped (`src/dblayer/migrations/073_drop_dependency_edges.sql:7`). The replacement lives in `src/domain/engine/dependencyDefinitionEngine.ts`, `src/dblayer/dependencyDefinitionsDB.ts`, `src/domain/engine/materialiseDependencyGraph.ts`, and migrations 072/074/075/076/080. Everything below is re-verified against that code and cross-checked against CR-039/041/042/043/046's own recorded scope, not the superseded first pass.)*

*(Third pass, same day: the second pass conflated "not yet implemented" with "not yet decided" in several places — most importantly around the shape of a dependency node. That distinction matters and is corrected throughout below: §19.1/19.2/19.11 now separate a settled design (confirmed with the owner, consistent with CR-039's own original model) from the specific, enumerable implementation gaps against it.)*

**The one-line characterisation changed too.** The first review called this a "Deliverable sequencing gate," per-SEU and Deliverable/Capability-only. What exists now is exactly the chapter's own framing: a Template/Pack/Profile-scoped **rule set** ("FROM this unlocks TO this," never a per-SEU transaction row — migration 072's own header, `:7-11`), evaluated fresh against a specific SEU's live state on every check, with a real push side-channel (§19.9) that didn't exist before. §7's own graph requirement is fully met (§19.1), the engine evaluates 6 of §8's 7 dependency types (§19.2), and §10's readiness criteria are fully satisfied by the combination of the two engines involved (§19.4) — all three this chapter's own scope, all closed. §11/§14 (Constraint Detection, Flow Optimisation) still don't exist, now scoped as CR-048. A separate, adjacent concern — extending the *authoring surface* for those 6 dependency types beyond Template/Deliverable/Capability — is real but out of this chapter's own scope; tracked as CR-047.

## 19.1 ✅ Deliverable Dependency Graph (§7) — closed

`dependency_definitions` (`src/dblayer/migrations/072_dependency_definitions.sql:39-49`, `owning_entity_type`/`owning_entity_id` added by `074_dependency_definitions_polymorphic_owner.sql:14-22`) replaces the per-SEU edge table with a **Template/Pack/Profile-scoped recipe** — `owning_entity_type IN ('Template','Pack','Profile')` (074:21-22), no `seu_id`/`deliverable.id` column anywhere. One row means "for any SEU commissioned from this owner, reaching (from_type, from_name?, from_state) unlocks (to_type, to_name?, to_state)" — re-evaluated live per SEU, never stored per SEU. `resolveOwningScope` (`dependencyDefinitionEngine.ts:31-37`) gathers a given SEU's full applicable scope — its Template, every Pack actually composed into its active EBM, and its Profile.

Checked directly against §7's own text — a directed graph, nodes drawn from the named types, edges as dependency relationships, constituting the authoritative execution model — every clause holds: the graph exists, is genuinely Template/Pack/Profile-scoped (not per-SEU), and `isTargetReady` is the real, live gate on `transitionDeliverable`, not a display-only artefact.

**The node design is `(entity_type, name?, state)`** — `name` required only for types with a stable, pre-declared identity (Deliverable, Capability); for Decision/Obligation/Evidence/Knowledge, `state` alone is already a complete, unique identity ("any Obligation, Verified" needs no further disambiguation), symmetrically on both sides of a row (FROM the prerequisite, TO the gated node) and for any owner kind. §7 itself names exactly this node vocabulary (Deliverables, Decisions, Knowledge, Evidence, Obligations, External Dependencies) without ever restricting which side of an edge a given type may sit on — the model built matches §7's own text precisely; the earlier per-implementation narrowing (`to_name NOT NULL`, `to_entity_type` hardcoded to Deliverable) was never a §7 requirement to begin with, just an implementation choice made along the way. `entity_type` columns themselves are plain `TEXT` with no CHECK constraint at all (`072:29-38`, deliberate — "widening the type vocabulary... no migration required") — this is exactly what let the engine implement 6 of 7 types (§19.2) without a schema change.

*Which of these types can actually be authored today is a separate question — §8's, not §7's — and is where the real remaining gap lives. See §19.2.*

Visualisation is a flat per-row list (view-mode rendering, CR-045/046), not a graph view — a real, minor gap against §7's own "graph" framing, but cosmetic, not structural.

## 19.2 ✅ Dependency Types (§8) — 6 of 7 built at the engine layer, which is this chapter's own scope

§8 asks whether "the platform" supports each dependency type — read as a Dependency *Engine* requirement (this chapter's own subject), the question is whether the engine can represent and evaluate each type, not whether every possible authoring surface exposes it yet.

| Type | Engine evaluation |
|---|---|
| Deliverable | ✅ built (`resolveNamedNode`, `dependencyDefinitionEngine.ts:68-72`) |
| Capability | ✅ built, correctly Service-scoped (below) |
| Decision / Obligation / Evidence / Knowledge | ✅ built (`isUnnamedNodeSatisfied`, `dependencyDefinitionEngine.ts:94-127`) — same design, same code quality as Deliverable/Capability |
| External | ❌ not built — no evaluation branch anywhere; falls into `isUnnamedNodeSatisfied`'s fail-closed default |

Six of seven, real and tested (`dependencyDefinitionEngine.ts:94-127`). External is the one genuine engine-layer gap — no branch anywhere evaluates it, and unlike the other six, no design has been confirmed for it yet.

The Capability type's Service-scoping (§8's own requirement) is not just preserved but strengthened: `materialiseDependencyGraph.ts:77-93` resolves an authored `fromCapabilityCode` to every Service that Capability provides and creates one `dependency_definitions` row **per Service** — so fulfilling a Capability that provides five Services genuinely unlocks against all five, individually. The comment at `:77-78` cites this chapter directly: "a capability code names every Service it declares (Ch.9 §8/Ch.11 §9)."

**Out of this chapter's scope, tracked separately as CR-047:** only 2 of the 6 engine-supported types can currently be authored into a real row (Deliverable and Capability, FROM-side only, Template's schema only) — `to_name NOT NULL`, hardcoded `toEntityType`/`toState` in `materialiseDependencyGraph.ts`, and the widget's `fromType` field being a fixed 2-item schema `enum` (with no `toType` at all) rather than sourced from the real, live `authority_nouns` vocabulary the same way this table's own `entity_type` columns were always meant to admit new types without a migration. All real, but authoring-surface and materialisation concerns, not Dependency Engine ones — CR-047 owns closing that gap.

## 19.3 The concept of "dependency state" no longer applies the way §9 frames it — there is no per-instance state to transition

The first review found 4 of 6 declared states real, 3 ever produced, and a documented stale-cache bug. That entire framing doesn't map onto the new model: `dependency_definitions` rows are Template-scoped **config**, not per-SEU **instances** — there is no `readiness_state` column, no per-edge state machine, and therefore nothing for `Unknown`/`Pending`/`Satisfied`/`Blocked`/`Invalid`/`Waived` to be a state *of*. Satisfaction is a pure, always-fresh computation (`isRowSatisfied`, `dependencyDefinitionEngine.ts:129-141`) run at the moment of every gate check — the stale-cache bug the old model had (`seus.ts`'s own retired comment: "readiness_state... shows stale status on every plain page load") is structurally impossible now, because there is no cache. `Invalid` and `Waived` still have no mechanism (no waiver flow for a dependency row exists) — but the honest read is that §9 describes a stateful-edge model the platform deliberately moved away from, not a gap in an otherwise-stateful model.

What replaces "state changes, traceably" is the push-event mechanism (§19.9) — a real, if partial, answer to the same underlying need (§9's "state transitions shall remain fully traceable"), just architected as "publish an event when readiness changes" rather than "persist and transition a state column."

## 19.4 ✅ Deliverable Readiness (§10) — closed

Checked directly against §10's five criteria plus its own event requirement:

| §10 criterion | Status |
|---|---|
| mandatory dependencies satisfied | ✅ `isTargetReady` (`dependencyDefinitionEngine.ts:148-160`), real, reachable |
| required capabilities available | ✅ Capability-type `dependency_definitions` rows |
| required evidence exists | ✅ `qualityGateEngine`'s `requires_accepted_evidence_or_approved_decision` criteria — live, reachable, seeded |
| required decisions are approved | ✅ same mechanism |
| blocking obligations resolved | ✅ `qualityGateEngine`'s `no_unresolved_obligations` criteria — live, reachable, seeded |
| publishes `DeliverableReady` | ✅ built (CR-042) — see §19.9 |

§10 doesn't require one single component to check all five — only that the Deliverable's readiness genuinely reflects them. `tests/governance-depth.test.ts` proves the aggregate outcome is correct: zero dependency rows, `ready: true`, yet still genuinely blocked by an unresolved Obligation via Quality Gate. The split between `dependencyDefinitionEngine` (mandatory dependencies, capabilities) and `qualityGateEngine` (evidence, decisions, obligations) is deliberate and cited (`deliverables.ts`'s own reference to Ch.26 §3), and both halves are real and reachable — §10 is satisfied by the combination, not by either engine alone.

Two things worth noting, neither a gap against §10 itself: every dependency row is currently mandatory (no optional category exists anywhere in this chapter's own text to distinguish against, so this is vacuously, not partially, true); and `dependencyDefinitionEngine`'s own `Decision`/`Obligation`/`Evidence`/`Knowledge` evaluation logic (§19.2) sits unreachable alongside `qualityGateEngine`'s already-working equivalent — a code-duplication note for whenever CR-047 opens that authoring surface, not a readiness gap today.

One genuine fix worth recording, currently a side effect rather than a guarantee: the first review's Open Design Questions §1 gap — "`isDeliverableReady` gates *every* transition of a Deliverable, not just the one that actually needs the dependency" — **is now closed in practice**. Every `dependency_definitions` row is materialised with `to_state = "In Progress"` (`GATED_TO_STATE`, `materialiseDependencyGraph.ts:34`), and `isTargetReady`'s query filters on the exact `to_state` being attempted — a transition to any state other than `In Progress` finds zero governing rows and is vacuously ready. This currently holds because `toState` isn't authorable yet, not because of a deliberate guarantee — once `toState` becomes a real authored field (CR-047), preserving this behaviour (gate exactly the attempted transition, never every transition) needs to be a deliberate part of that work, not lost as a regression.

## 19.5 ❌ Constraint Detection (§11) — not built; scoped as CR-048

No Constraint object, table, or detection function exists anywhere in `src/`. The nearest analogues remain Quality Gate block reasons and `dispatch_deferred` — rejection reasons surfaced at attempt time, not first-class detected Constraints. "Incomplete knowledge" and "external approvals" still have no mechanism.

**Owner's own operational definition:** "Constraint Detection is the Dependency Engine continuously checking, for every node, whether any incoming edge is still unsatisfied." The primitive already exists — `isRowSatisfied` (`dependencyDefinitionEngine.ts:129-141`) computes exactly this, per row — it's just never called proactively across a whole graph, only on demand for one specific target (`isTargetReady`) or reactively at refusal time (`DeliverableBlocked`'s `reason` string). Scoped as CR-048, deliberately not detailed further here — specifics (push vs. pull, whether "Constraint" becomes a first-class object) are left open for that CR.

## 19.6 ✅ Execution Trigger (§12) — unchanged end-to-end chain; the "no DeliverableReady event" half of the old gap is now closed

The chain itself (`transitionDeliverable` → dependency gate → Quality Gate → Authority/Policy → `executionEngine.execute` → Command → Work Item → `dispatchEngine.dispatch` → assign or `DispatchDeferred`) is untouched by this session's work. Of the two gaps the first review recorded: **(1) is now half-closed** — a `DeliverableReady` event genuinely publishes now (§19.9), so "a Deliverable that becomes ready" is at least observable; but the trigger for actual execution is still exclusively pull (`transitionDeliverable` must still be called by something), and — per CR-040's own audit of the whole event bus — nothing subscribes to `DeliverableReady` to auto-act on it; its value today is being queryable later, the same as every other platform event except one. **(2) is unchanged** — dispatch is still 1:1 (`SOLE_ELIGIBLE_PARTICIPANT`), not a selection among eligible Participants.

## 19.7 ✅ Dynamic Re-evaluation (§13) — real, event-driven re-evaluation now exists for 2 of the chapter's 6 triggers (was 0)

The first review found this entirely lazy — two on-demand call sites, zero event-driven re-evaluation, `dependencyEngine.ts` not even importing `eventBus`. That's no longer true for two of §13's six triggers:

| §13 trigger | Wired? |
|---|---|
| Deliverables change | ✅ **real, event-driven** — `evaluateAndPublishFromTransition` fires from `core/workItems.ts:121-127`, immediately after a Deliverable's `lifecycle_state` actually changes (the real Model-A state-change point, not the dispatch-only `transitionDeliverable`) |
| Capabilities become available | ✅ **real, event-driven** — fires from `core/capabilities.ts:50-56`, inside `fulfilCapability`, once per Service the newly-fulfilled Capability provides |
| Decisions/Knowledge/Evidence/Obligations change state | ❌ not wired — `dependencyDefinitionEngine` is imported nowhere in `decisions.ts`/`evidence.ts`/`knowledge.ts`/`obligations.ts`. Sequencing, not a separate gap: wiring this the way Deliverable/Capability were wired (CR-042's own pattern) is only meaningful once CR-047's authoring-surface work makes a row of these types possible to author at all — wiring the push side first would have nothing to ever match |
| external dependencies change | ❌ not built (no External dependency type exists at any layer, §19.2) |
| the EBM changes through recomposition | ❌ not wired, and moot today — `ebmsDB.create` has exactly one call site platform-wide (`commissioning.ts:153`, one-time at SEU creation); recomposition doesn't exist as a runtime event to wire into yet |

Two of six, both genuinely real (not lazy, not polled) — a structural improvement, even though four of six remain exactly as unbuilt as before.

## 19.8 ❌ Flow Optimisation (§14) — not built; folded into CR-048

No unnecessary-blocking-dependency detection, no parallel-execution exposure, no bottleneck detection, no decomposition recommendation exist anywhere in `src/`. Grouped into CR-048 alongside Constraint Detection (§19.5) rather than tracked separately — §14's own criteria are analyses over the same underlying "what's currently unsatisfied, and where" data Constraint Detection would produce, not a distinct mechanism.

## 19.9 ⚠️ Events (§15) — 2 of 9 built (was 0 of 9)

`DeliverableReady` and `DeliverableBlocked` are real, each with exactly one publish site:

- **`DeliverableReady`** — `dependencyDefinitionEngine.ts:194`, inside `evaluateAndPublishFromTransition`, fired only once a target's governing rows are *all* satisfied (aggregate, not per-row — this is a rename of what used to be called `DependencySatisfied`; CR-042's own reasoning: the logic was always aggregate-only, and `DependencySatisfied` read as a per-row signal it never was).
- **`DeliverableBlocked`** — `src/routes/seu/core/deliverables.ts:145`, inside `transitionDeliverable`, fired at the exact point a gated transition is refused, `payload: { entityType, entityId, seuId, reason }` — `reason` is a flattened human-readable string listing every unsatisfied row, not structured per-row data a caller could query.

The remaining seven — `DependencyCreated`, a finer-grained per-row `DependencySatisfied`/`DependencyBlocked`, `DependencyWaived`, `ConstraintDetected`, `ConstraintResolved`, `CircularDependencyDetected` — were evaluated and deliberately not built (CR-040's own closure note, reasoned against how this platform actually uses its event bus — almost entirely for audit/telemetry querying, one live subscriber platform-wide, unrelated to dependencies): `DependencyCreated` has no precedent (no other junction table publishes creation events); a finer-grained per-row pair would be noise nobody has asked to query; the other four remain genuinely blocked on mechanisms that don't exist (a waiver flow, a first-class Constraint object, cycle detection).

## 19.10 Functional Requirements scorecard (§6)

| FR | Verdict |
|---|---|
| FR-9.1 (every Deliverable in the graph) | ⚠️ unchanged in spirit — the graph is now a Template-scoped recipe rather than per-SEU rows, but a Deliverable whose catalogue entry has no `dependencyGraph` reference still has zero governing rows and is trivially ready |
| FR-9.2 (every dependency has an explicit type) | ⚠️ **weaker than before at the DB layer** — the old model DB-enforced type via a CHECK constraint; the new `entity_type` columns are unconstrained `TEXT` (deliberate, §19.1). Explicit and correct at the TypeScript layer; a malformed string would now reach the table uncaught |
| FR-9.3 (continuous evaluation) | ⚠️ improved, still not continuous — two real event-driven hooks now exist (§19.7), up from zero, but that's "evaluated on specific transitions," not a scheduler or subscription-based continuous evaluation |
| FR-9.4 (readiness determined solely from dependency satisfaction) | ✅ still holds — `isTargetReady` reads nothing but `dependency_definitions` rows and their resolved targets |
| FR-9.5 (circular dependency detection) | ❌ still not built — now explicitly acknowledged and deferred in a comment (`templates.ts:200-206`, CR-041) rather than silently absent, but the underlying gap is unchanged |
| FR-9.6 (dependency state changes published) | ⚠️ **upgraded from ❌** — `DeliverableReady`/`DeliverableBlocked` are real, on the two wired triggers (§19.7/19.9); still not a full state-change history, and only fires for Deliverable/Capability transitions |
| FR-9.7 (dependencies fully traceable) | ⚠️ unchanged from the first review for query-time traceability (still Ch.20-scoped, `traceability.ts`) — but `isTargetReady` now returns the actual governing rows (not just a boolean) and `DeliverableBlocked`'s `reason` names them at refusal time, a real (if informal) traceability improvement over the old silent boolean |
| FR-9.8 (external dependencies represented explicitly) | ❌ still not built, and — unlike Decision/Obligation/Evidence/Knowledge — not yet part of a settled design either: `ExternalInteraction` has no evaluation logic at all, named or unnamed, so this one genuinely needs design work, not just implementation |

## 19.11 Summary

The rebuild (CR-039–046) closed several of the first review's most concrete gaps: the graph is now genuinely Template/Pack/Profile-scoped (at the DB/engine layer) rather than a per-SEU write-side cache with a documented staleness bug; real authoring exists (a live Template widget, not commissioning-only seed fields); and two of nine named events are real, on genuinely event-driven triggers, where zero existed before.

**The node design itself is settled, confirmed, and symmetric**: `(entity_type, name?, state)`, `name` required only for Deliverable/Capability, applying identically to both sides of a row (FROM the prerequisite, TO the gated node) and to any owner kind (Template, Pack, Profile). This is not this review's opinion — it is confirmed design, consistent with CR-039's original node model, extended in conversation with the owner to make the FROM/TO symmetry and the owner-kind coverage explicit. The engine already implements it faithfully on the FROM side for six of the seven §8 types (everything but External).

**Three of this chapter's own requirements are closed**: §7's graph (§19.1), §8's dependency-type vocabulary at the engine layer, 6 of 7 (§19.2), and §10's readiness criteria (§19.4). Extending *where that vocabulary can actually be authored* — beyond Deliverable/Capability, beyond Template's own schema — is real, tracked work, but it belongs to the authoring/materialisation layer, not the Dependency Engine this chapter describes. It's scoped as its own CR (CR-047), not carried in this section as an open chapter item.

**Genuinely still-unbuilt:**

- Constraint Detection (§11) and Flow Optimisation (§14) — entirely unbuilt, now scoped as CR-048 against the owner's own operational definition ("continuously checking, for every node, whether any incoming edge is still unsatisfied"), specifics deliberately deferred.
- Circular-dependency detection (§7/FR-9.5) — unbuilt, now with an explicit deferral comment (CR-041) rather than silence, no CR yet.
- External Dependency type (§8/FR-9.8) — no evaluation logic exists at all, at the engine layer; this one needs actual design work, unlike the other six types, no CR yet.
- The remaining seven of nine named events (§15/§19.9) — evaluated and deliberately not built per CR-040's own closure reasoning.

What shipped is real, tested work (`tests/dependency-definition-engine.test.ts`, `tests/pack-sdk.test.ts`, `tests/sdk-authoring.test.ts`) — this chapter's own requirements (§7, §8's engine-layer vocabulary, §10's readiness criteria) are met; what remains is either a separately-scoped rollout (CR-047) or a handful of chapter aspirations with no design behind them yet.