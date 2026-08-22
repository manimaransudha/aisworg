# CR-055 — Audit the codebase for multi-statement operations that should be transactional

**Raised:** 2026-08-22 · **Origin:** owner, while designing CR-054's own write path (an `events` insert and a new `state_transitions` insert that need to land together or not at all) — "if there are multiple atomic inserts/updates happening one after another, they have to be inside a commit block. Open a CR for this so we check the current codebase for this gap." · **Status:** 🟡 Proposed (audit not yet performed, not scheduled)

## The gap, already documented once

Chapter 29 §20.1 (SM-004, "state transitions shall be atomic"), code-verified the same day this CR was raised: the state write and the resulting event publish are two separate, non-transactional round trips — `eventBus.publish()` is called after `updateStatus` resolves, on a different connection, with no surrounding `BEGIN`/`COMMIT`. A crash between the two leaves state changed with no event recorded. That finding was scoped to the transition-write path specifically; the owner's own instinct here is broader — this is a *class* of bug, not a one-off, and the codebase should be checked systematically for every other instance of it, not just the one already found.

## What "should be transactional" means here

A real precedent already exists in this codebase for doing this correctly: `evidenceDB.create()` (CR-051 item 1) inserts into `evidence` and `evidence_relationships` inside a single `pool.connect()` + `BEGIN`/`COMMIT`/`ROLLBACK` block — two related writes that must both land or both roll back, on one connection. The gap this CR is about is every place that does the equivalent of two-or-more-related-writes *without* that discipline — separate calls to separate `*DB.ts` modules (each opening its own connection from the shared pool via the plain `query()` helper), where a crash or error between them leaves the system in a partially-written, inconsistent state.

## Scope

1. **Audit**: systematically enumerate every place in `src/routes/seu/core/*.ts` and `src/domain/engine/*.ts` that performs more than one related write (INSERT/UPDATE) as part of a single logical operation, without wrapping them in one transaction. The already-known instance (state UPDATE + `eventBus.publish()`, effectively present in every one of the ~20 governed-transition functions) is the largest, most repeated pattern, but not necessarily the only one — Command/WorkItem generation, dispatch, and Participant-replacement flows (`replaceParticipant` archives one Participant and activates another, plus a Capability Fulfilment handoff) are candidates worth checking specifically, not assumed clean.
2. **Classify**: for each instance found, whether it's genuinely a correctness risk (a crash mid-sequence leaves inconsistent, hard-to-detect state) or a lower-stakes case (e.g. a failed second write is easy to notice/retry, or eventual consistency is acceptable there).
3. **Fix**: only once the audit exists — not scoped or estimated yet.

## Not yet designed

- Audit methodology — a `grep`-based sweep for "two `*DB.ts` calls close together" will have both false positives and false negatives; likely needs a systematic read-through of every core transition function, not a mechanical search.
- Whether the fix, once scoped, is per-instance (mirroring `evidenceDB.create`'s own pattern each time) or some shared helper that makes "do these N writes as one transaction" easier to reach for consistently across the codebase.
- Priority/ordering — CR-054's own new write path is one concrete, soon-relevant instance; whether that gets fixed first as a template for the rest, or the full audit happens before any fix, isn't settled.

## Not in scope

- CR-054 (the State Transition Log itself) — related, since its own write path is one instance of this class of gap, but this CR is about the codebase-wide pattern, not that one table's own design.
