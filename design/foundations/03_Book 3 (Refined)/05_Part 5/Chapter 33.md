# Chapter 33 – Dispatch Engine

## 1. Purpose

The Dispatch Engine is responsible for assigning executable Work Items to suitable Participants within a commissioned Software Engineering Unit (SEU).

The Dispatch Engine determines **who should perform the requested engineering activity**, based on the current engineering context, available Participants and applicable governance constraints.

The Dispatch Engine does not determine **what** should be executed.

That responsibility belongs to the Execution Engine.

---

## 2. Scope

This chapter defines:

- Dispatch abstraction
- participant selection
- dispatch policies
- dispatch strategies
- dispatch lifecycle
- dispatch traceability

This chapter does not define:

- engineering behaviour
- command generation
- work item generation
- participant implementation

---

## 3. Architectural Position

```
Execution Engine

↓

Command

↓

Work Item Generator

↓

Dispatch Engine ←── eligible Participants ── Capability Fulfilment

↓

Participant

↓

Execution
```

The Dispatch Engine determines the most appropriate execution destination.

Capability Fulfilment (Chapter 12) determines **which Participants are eligible** to provide a required Capability. The Dispatch Engine consumes that eligible pool and determines **which eligible Participant executes a specific Work Item now**. The two responsibilities are complementary, not overlapping.

---

## 4. Definition

Dispatch is the runtime process of assigning one or more Work Items to one or more suitable Participants.

Dispatch decisions are contextual.

They consider engineering requirements rather than organisational hierarchy.

Dispatch does not imply execution.

It merely initiates execution.

---

## 5. Architectural Principles

### DE-001

Dispatch is capability-driven.

Participants are selected because they fulfil required Capabilities.

### DE-002

Dispatch is context-sensitive.

Selection depends upon the current engineering state.

### DE-003

Dispatch is dynamic.

Assignments may differ even for identical Commands.

### DE-004

Dispatch is replaceable.

Participant failure shall trigger redispatch where appropriate.

### DE-005

Dispatch is traceable.

Every dispatch decision shall preserve rationale.

### DE-006

Dispatch shall remain independent of Participant implementation technologies.

---

## 6. Functional Requirements

### FR-33.1

Every Work Item shall be dispatched only after successful generation.

### FR-33.2

Dispatch shall evaluate all eligible Participants.

### FR-33.3

Dispatch shall support one-to-one, one-to-many and many-to-one assignment strategies.

### FR-33.4

Dispatch decisions shall preserve engineering traceability.

### FR-33.5

Dispatch shall support redispatch.

### FR-33.6

Dispatch shall respect Authority and Governance constraints.

### FR-33.7

Dispatch decisions shall be reproducible.

---

## 7. Dispatch Inputs

The Dispatch Engine evaluates:

- the eligible-Participant pool produced by Capability Fulfilment (Chapter 12) for each required Capability
- Participant availability
- Participant type
- applicable Authority
- Engineering Behavior Model
- active Policies
- active Obligations
- organisational constraints

Future Packs may introduce additional dispatch criteria.

---

## 8. Dispatch Outputs

The Dispatch Engine may produce:

- Participant Assignment
- Parallel Assignment
- Deferred Assignment
- Redispatch Request
- Escalation Request

Dispatch outputs are runtime decisions.

They do not modify engineering state.

---

## 9. Dispatch Strategies

Illustrative strategies include:

### Capability Match

Select the Participant best matching the required Capability.

### Specialist Preference

Prefer specialist Participants when available.

### Cost Optimisation

Select the lowest-cost Participant satisfying engineering constraints.

### Confidence Optimisation

Prefer Participants with the highest demonstrated engineering confidence for similar work.

### Load Balancing

Distribute work evenly across Participants.

### Locality Preference

Prefer Participants possessing relevant contextual knowledge.

### Organisation Preference

Prefer Participants belonging to a specified Organisation Pack where required.

Strategies are contributed through Packs.

---

## 10. Parallel Dispatch

Where engineering dependencies permit, the Dispatch Engine may assign Work Items concurrently.

Parallel dispatch shall preserve:

- dependency correctness
- governance constraints
- engineering consistency

Concurrency shall never compromise engineering correctness.

---

## 11. Redispatch

Redispatch may occur when:

- a Participant becomes unavailable
- execution fails
- governance changes
- capability availability changes
- engineering priorities change

Redispatch shall preserve engineering continuity.

---

## 12. Dispatch Context

Every dispatch decision shall consider:

- current Deliverable state
- current engineering stage
- active Knowledge
- active Decisions
- active Obligations
- current Participant state
- Transition Definitions

Dispatch shall never operate using incomplete engineering context.

---

## 13. Dispatch Traceability

Every dispatch decision shall preserve:

- originating Command
- generated Work Item
- selected Participant
- dispatch strategy
- evaluation criteria
- rationale
- timestamp

Dispatch history shall remain immutable.

---

## 14. Events

The Dispatch subsystem shall publish:

- WorkItemDispatched
- DispatchDeferred
- DispatchRejected
- ParticipantSelected
- ParticipantUnavailable
- RedispatchRequested
- RedispatchCompleted

---

## 15. Non-Functional Requirements

The Dispatch Engine shall:

- support large numbers of Participants
- support dynamic participant availability
- support deterministic selection when required
- support pluggable dispatch strategies
- remain independent of AI implementation technologies

---

## 16. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Work Items are dispatched only after generation.

✓ Dispatch decisions are capability-driven.

✓ Parallel dispatch is supported.

✓ Redispatch preserves engineering continuity.

✓ Dispatch decisions remain traceable.

✓ Dispatch strategies are extensible through Packs.

---

## 17. Deliverables

Implementation of this chapter shall produce:

- Dispatch Engine
- Participant selection service
- Dispatch strategy framework
- Redispatch service
- Dispatch registry
- Dispatch APIs
- Dispatch events

---

## 18. Implementation Specifics

*Recorded 2026-09-19. This section documents how the Dispatch Engine is realised in the current build. It does not change the requirements above (DE-001–006, §§6–17); it records what is built, what is partial, and what is still open — the same convention as Chapter 5 §19. Status markers: ✅ built · ⚠️ partial · 🚩 not built.*

### 18.1 ✅ Architectural position and the async execution model (§3, §4)

`dispatchEngine.dispatch()` (`src/domain/engine/dispatchEngine.ts`) sits exactly where §3 places it, between the Work Item Generator and the Participant. Dispatch does not simulate execution synchronously: it selects a Participant, assigns the Work Item, marks it `Dispatched`, and returns. The Work Item then waits Outstanding for an out-of-process result callback (`completeWorkItem`, `core/workItems.ts`), matching §4's "dispatch does not imply execution, it merely initiates execution." Completion — applying the Deliverable transition, recording the reference, minting attestation where due, returning the Participant to `Idle` — happens entirely in `core/workItems.ts`, not in the engine: the engine layer never applies a governed transition itself.

### 18.2 ✅ Capability Fulfilment is consumed as a persisted snapshot, not resolved live (§3, §7; CR-109 §6.2)

`dispatchEngine.dispatch()` takes an `eligibleParticipantPoolId` as input and reads it via `capabilityFulfilmentPoolsDB.findById` — the pool was already resolved and persisted once, at Command generation (migration `240`, `commands.eligible_participant_pool_id`). The engine never re-resolves eligibility itself. This realises §3's stated separation cleanly: Capability Fulfilment (Ch.12) is upstream and structural; Dispatch consumes its output and does not duplicate it.

### 18.3 🚩 Participant selection is "first in the pool" — no selection logic, no strategy framework (§9, DE-001)

Where the pool holds more than one eligible Participant (the Composite case, Ch.12 §18.2), Dispatch picks `pool.data.participant_ids[0]` — literally the first id recorded — and records the fixed literal `"sole-eligible-participant"` as its "strategy." None of §9's illustrative strategies (Capability Match, Specialist Preference, Cost Optimisation, Confidence Optimisation, Load Balancing, Locality Preference, Organisation Preference) exist. There is no pluggable dispatch-strategy framework and no Pack-contributed strategy mechanism (§9's closing sentence, §15's "pluggable dispatch strategies," §17's Deliverable). The `dispatchStrategyPreference` Configuration Parameter is authored and stored on a Profile (`profiles.ts`, `profileCompositionUnravel.ts`) specifically so Dispatch could interpret it, but no code anywhere reads it back — `dispatchEngine.ts` has zero reference to it. Selection is therefore correctly described as unbuilt, not merely simplified.

### 18.4 ⚠️ Dispatch inputs — only the eligible pool is evaluated (§7)

Of §7's list, only "the eligible-Participant pool produced by Capability Fulfilment" is actually consulted. Participant availability is read only incidentally (a `null` pool id defers; an empty pool defers); Participant type, applicable Authority, Engineering Behaviour Model, active Policies, active Obligations, and organisational constraints are not evaluated by Dispatch at all. (Authority and Policy are enforced upstream, at the Command's own governance evaluation — `governance_outcome_id`, CR-109 §6.1 — before Dispatch ever runs; Dispatch itself performs no independent authority/policy check of its own.)

### 18.5 ⚠️ Dispatch outputs — two of five built (§8)

- **Participant Assignment** — ✅ built (`workItemsDB.assign`, `ParticipantSelected`/`WorkItemDispatched` events).
- **Deferred Assignment** — ✅ built: an empty pool publishes `DispatchDeferred` with `reason: "no_eligible_participant"` and returns `{dispatched: false}` rather than assigning.
- **Parallel Assignment** — 🚩 not built (§18.6).
- **Redispatch Request** — 🚩 not built (§18.7).
- **Escalation Request** — 🚩 not built as a Dispatch output; a related but distinct mechanism exists one layer away (§18.7).

A Work Item with no producing Capability declared at all (`producingCapabilityId === null`) is a third, chapter-unlisted outcome: it is dispatched unassigned (`participantId: null`) rather than deferred, on the reasoning that there is nothing for Dispatch to gate on when the requirement was never declared. This is a deliberate implementation choice, not a §8 category.

### 18.6 🚩 Parallel dispatch not built (§10)

`dispatchEngine.dispatch()` operates on exactly one Work Item and assigns at most one Participant per call. There is no concurrent-assignment path, and therefore nothing to preserve dependency correctness or governance constraints across parallel assignments — the section does not yet apply.

### 18.7 🚩 Redispatch not built (§11); stall handling is a stand-in, not a substitute

There is no redispatch mechanism anywhere in the codebase — no code path returns a failed or unavailable Participant's Work Item to Dispatch for reassignment. Two adjacent, already-built mechanisms cover related ground but do not amount to §11:

- **Explicit failure** (`completeWorkItem`, outcome `failed`/`blocked`): the Work Item moves to `Failed`, the Command moves to `Failed`, the Participant returns to `Idle`, and an Attention Item is raised for a human (Ch.34/Ch.36 path). The Work Item is not redispatched; a human decides what happens next.
- **Silent stall** (`workItemHeartbeat.ts`'s `sweepStalledWorkItems`): a Work Item outstanding past its `target_completion_at` with no callback raises an Escalation-category Attention Item (`WorkItemStalled`) but leaves the Work Item `Dispatched` and the Participant assigned — no reassignment, no `RedispatchRequested`/`RedispatchCompleted` event.

Both routes end at a human Attention Item, never at a new Dispatch cycle. §11's four other triggers (governance changes, capability availability changes, engineering priorities changing) have no handling of any kind today.

### 18.8 ⚠️ Dispatch context — narrower than §12's list

Only Participant state (via the pool) and the producing Capability's declared Service Level (for the target-completion default, §18.9) are considered. Current Deliverable state, current engineering stage, active Knowledge, active Decisions, active Obligations, and Transition Definitions are not read by Dispatch itself — some are enforced earlier, at the governance-evaluation step that produced the Command (CR-109 §6.1), which Dispatch consumes only as an already-resolved pool, not as live context of its own.

### 18.9 ✅ Target completion time from Service Level (Ch.11 §8, Resolution 9 — outside §7–§13's own list, an added mechanism)

An explicit `targetCompletionAt` passed at dispatch time wins; otherwise `resolveTurnaroundSeconds` looks for a `service_level` item (on the Services attached to the producing Capability) whose label mentions "turnaround" and parses `target` as a bare number of seconds. No SLA and no override means no target is set, and the Work Item is never stall-escalated (§18.7). This is not itself a Dispatch Strategy (§9) — it sets a deadline on the one Work Item already selected, not a criterion for choosing among candidates.

### 18.10 ⚠️ Dispatch traceability — events carry it, no persisted Dispatch Decision record (§13, DE-005, FR-33.4, FR-33.7)

Every dispatch publishes events carrying the originating Command (via `correlationId`/`seuId`), the generated Work Item id, the selected Participant id, and the fixed "strategy" literal — satisfying most of §13's list at the event-payload level. What is missing is a persisted, queryable **Dispatch Decision record** distinct from the event stream: no table records evaluation criteria or rationale beyond the pool-membership fact itself, and CR-109's own audit (§6.4) confirms no such record is produced anywhere. Reproducibility (FR-33.7, DE-005) currently rests entirely on event history plus the persisted pool snapshot (§18.2), not on an explicit decision artefact.

### 18.11 ⚠️ Events — three of seven published (§14)

- **WorkItemDispatched** — ✅ published (both the assigned and the no-Capability-declared paths).
- **DispatchDeferred** — ✅ published (empty pool).
- **ParticipantSelected** — ✅ published (assigned path only).
- **DispatchRejected** — 🚩 not published; no code path represents outright rejection.
- **ParticipantUnavailable** — 🚩 not published by Dispatch (a Participant-lifecycle event of the same name is contemplated in `core/participants.ts` but is not wired to any Dispatch flow).
- **RedispatchRequested** / **RedispatchCompleted** — 🚩 not published; consistent with §18.7 (no redispatch mechanism exists to emit them).

### 18.12 🚩 Dispatch Decision / `governance_outcome` not consulted by Dispatch itself (relationship to CR-109)

CR-109's own outstanding-work list (§6.4) records this precisely: `dispatchEngine.ts` has zero references to `governance_outcome`, and the `dispatchStrategyPreference` Configuration Parameter (§18.3) is populated but read by no code. This section's findings are consistent with that audit, not a duplicate of it — recorded here as the chapter-side view of the same gap.