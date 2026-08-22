# CR-053 — Event Bus: retry/reconciliation for failed or stuck consumption

**Raised:** 2026-08-21 · **Origin:** owner, during the Event Bus redesign (publish/consume separation, Event Registry + Event Subscriptions, `consumption_state`) — explicitly deferred out of that build, filed here so it isn't lost. · **Status:** 🟡 Proposed (not designed, not scheduled)

## Context

The Event Bus redesign (this session, 2026-08-21) separated `publish()` (persist only) from `dispatch()` (consume — invoke registered handlers), with `publish()` handing off to `dispatch()` **fire-and-forget** — deliberately not awaited, so publishing an event never blocks on however long or how many handlers react to it. Each event's `consumption_state` (a new JSONB column on `events`) tracks per-handler outcome: `"pending"` → `"consumed"` (with a timestamp) or `"failed"` (with the error message).

Fire-and-forget buys low latency in the common case, at a real cost: if a handler throws, or the process crashes between publish and dispatch completing, nothing currently retries it. `consumption_state`'s `"failed"` status makes a stuck or failed handler *visible* — queryable, auditable — but nothing acts on that visibility. This CR exists to hold that gap, explicitly out of the redesign's own scope (single-instance assumed, deployment architecture unconfirmed at the time).

## The idea, as discussed

A lightweight, low-frequency reconciliation sweep — not a replacement for the fire-and-forget fast path, a safety net alongside it:

- Fire-and-forget dispatch remains the primary path (instant reaction in the normal case, unchanged).
- A separate, infrequent job periodically scans for `consumption_state` entries still `"pending"` or `"failed"` past some age threshold (e.g. older than a minute), and re-attempts dispatch for just those stuck entries.
- Bounded scope: only recent events with an unresolved handler entry, not a full-table scan every run — successfully-consumed events never need re-checking.

## Open questions (none resolved yet)

- **Trigger mechanism**: an in-process interval/cron inside the Node app, an external scheduled job, or something else?
- **Idempotency / retry limits**: does a handler that keeps failing retry forever, or does it need a max-attempt count and a terminal "given up" state (`consumption_state` currently only has `pending`/`consumed`/`failed` — a fourth state may be needed)?
- **Ordering**: does the sweep need to preserve per-`seu_id`/per-`originating_object` ordering when retrying, or is out-of-order re-delivery acceptable for whatever handlers exist by the time this is built?
- **Multi-instance safety**: the Event Bus redesign explicitly assumed single-instance deployment (deployment architecture unconfirmed) and built no claiming/locking logic. If multiple app instances are ever running, two sweeps could both grab and re-dispatch the same stuck event to the same handler unless something claims it atomically (e.g. `SELECT ... FOR UPDATE SKIP LOCKED`, or a claimed-by/claimed-at column). Needs to be settled — or explicitly deferred again — before this is built, not assumed away.
- **Querying `consumption_state`** (a JSONB column) for "anything unresolved" at scale may need a GIN index or a different query shape once the `events` table is large — not measured yet, since nothing queries it this way today.

## Not in scope yet

Building any of the above. This CR exists to hold the idea and its open questions, not to specify an implementation — same discipline as CR-052's own "raised, not designed" status.
