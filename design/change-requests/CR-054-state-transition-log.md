# CR-054 — State Transition Log: a dedicated state table, coexisting with entity tables

**Raised:** 2026-08-22 · **Origin:** owner, reviewing Chapter 29's own new "§20 Implementation Status & Gaps" section (code-verified audit, same day) — specifically the finding that the `events` table alone is not a sufficient state-history mechanism (only 2 of 8 required fields map to real columns; previous/new state live only in free-form `payload` by per-caller convention; applicable Transition Definition, applicable policies for a passing check, and engineering rationale aren't captured anywhere at all). · **Status:** 🟡 Proposed (not designed in full, not scheduled — "not building anything now. all are CRs")

## The idea, as raised

A new, dedicated table recording every governed state transition as its own structured row — **coexisting** with each entity's own `lifecycle_state`/`status` column, never replacing it. Owner: "coexist. every time we write to event, there is a log in the state table (StateTransitionRequested). no change to current entity's information."

Mechanically: whenever a governed-transition event is published (`EvidenceTransitioned`, `DeliverableTransitioned`, `ObligationTransitioned`, etc. — the ~20 of the platform's ~68 published event types that represent an entity's own lifecycle transition, not the full event catalogue), a row is also written to this new table. The entity's own row is untouched — this is purely additive history, not a second copy of "current state" competing with the entity column.

**Confirmed, not assumed**: the owner explicitly ruled out replacing the entity columns — "coexist" — precisely to avoid two sources of truth for "what is X's current state." The entity table stays authoritative for *now*; this table answers *how it got there*.

## Why this is a real gap-closer, not a redundant layer

Checked directly against Chapter 29 §20's own already-documented findings — this table's column set would close five of them at once:

- **§20.4 State Structure** (Version, Last Transition, Transition Timestamp, Current Owner, State History Reference — all confirmed missing on every entity checked): this table's own rows *are* the missing State History Reference (addressable by `entity_type`/`entity_id`, same query shape as `events`); the latest row per entity gives a real Last Transition / Transition Timestamp (today only the generic, non-transition-specific `updated_at` exists); a transition-sequence-number naturally falls out of "how many rows exist for this entity so far" — a lightweight stand-in for *transition* versioning specifically, not a substitute for the still-separately-tracked absence of *content* versioning (Deliverable/Evidence/etc. — Ch.15, CR-051).
- **§20.5 State Transitions** (no "transition rationale" concept exists anywhere): becomes a real column.
- **§20.10 Concurrency**: doesn't *prevent* the lost-update race (the separately-agreed optimistic guard on each entity's own `UPDATE ... WHERE id = $1 AND <state_col> = $2` does that) — but if rejected attempts are also logged here once that guard exists, this table makes conflicts *visible* and *diagnosable* after the fact, which is part of what §14 originally asked for ("detect the conflict... publish conflict events") even though this table isn't itself the detection mechanism.
- **§20.11 State History**: previous state, new state, the applicable Transition Definition (a real FK, not reconstructed after the fact from a hoped-for payload shape), governing authority, applicable policies, timestamp, and rationale all become real columns instead of `events.payload`'s per-caller convention.
- **§20.12 Events**: the chapter's own named events (`StateTransitionRequested`/`StateTransitionCommitted`/`StateTransitionRejected`/etc.) find a real home as this table's own outcome vocabulary, rather than as literal Bus events that would just be redundant noise alongside the entity-specific events (`EvidenceTransitioned`, etc.) that already exist and already serve the Bus's own announcement role.

## What "a consumer changes state" settles

Raised as an open question during design (does a handler *reacting* to an event need its own, separate write to this table, distinct from the write at publish time) — owner's answer: **"A consumer changes state for sure."** Resolved as: no special-cased second write path is needed. When a consumer/handler's own reaction causes *another* transition (the reactive chain this whole Event Bus redesign was built toward — e.g. a future `EvidenceAccepted` handler that re-checks a Quality Gate and applies a Deliverable's own transition), that's simply *another* governed-transition publish, and it gets logged by the exact same "every time we write to event, there's a log" rule as the original triggering one. One rule, not two.

## Explicitly deferred within this same idea — not scheduled

Owner: **"my instinct is to also capture the state that the transition actually happened (the other states as applicable)"** — beyond recording the transition itself, also capturing *which other entities' states were relevant/contributing context* at the moment a consumer-caused transition happened (e.g. which Quality Gate criteria passed, which other objects were involved in the decision). Marked explicitly as a live instinct, not a settled design, and explicitly **not scheduled for build** — noted here so it isn't lost, to be designed properly whenever this CR itself is picked up, not assumed as part of the base mechanism.

## Not yet designed (starting points only, not decisions)

- **Draft schema shape** (a starting point for whoever picks this up, not committed): `id`, `event_id` (FK to the `events` row this transition is tied to), `entity_type`, `entity_id`, `seu_id`, `from_state`, `to_state`, `transition_definition_id` (FK), `outcome` (Ontology-backed — `category:state-transition-outcome` or similar, matching the `category:event-types` precedent from the Event Bus redesign, not a hardcoded `CHECK`), `authority_badge`, `applicable_policy_ids`, `rationale`, `actor_id`, `created_at`.
- **Outcome granularity**: does this implementation's actual flow (publish only ever happens *after* a successful commit today — there's no persisted checkpoint for "requested" or "validated" as distinct stages) mean `outcome` should realistically only ever be `Committed`/`Rejected`, with the chapter's own `Requested`/`Validated`/`Recovered`/`ConflictDetected`/`ConflictResolved` staying available-but-unused Ontology concepts for later — or does the owner want full multi-stage logging (a row per stage, not per completed attempt)? Not settled.
- **Write path**: how the event-insert and the state-transition-insert become atomic (this is exactly what CR-055 is about generally — this CR's own write path needs the same discipline, not a special exception).
- **Migration scope**: does every one of the ~20 governed-transition publish call sites move to whatever new write path this becomes, all at once, or incrementally (matching the "seed minimally, backfill later" discipline already used for the Event Registry)? Not decided.
- **`Rejected` logging** depends on the separately-agreed (also not yet built) optimistic-concurrency guard existing first — there's no rejection path to hook into yet.

## Not in scope

- The optimistic-concurrency guard itself (agreed separately, tracked as its own not-yet-built item, referenced here only because `Rejected` outcome logging depends on it existing).
- CR-055 (auditing the codebase for multi-statement-should-be-transactional gaps) — a related but distinct, broader concern; this CR's own write path is one instance of that class of problem, not the whole of it.
