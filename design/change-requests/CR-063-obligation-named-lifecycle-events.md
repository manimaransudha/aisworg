# CR-063 — Obligation: real named lifecycle events (Ch.23 §19.12, §15)

**Raised:** 2026-08-23 · **Origin:** split out of CR-062 during design discussion — Ch.23 §19.12 found only 2 of the chapter's 8 named events real (`ObligationCreated` plus one generic `ObligationTransitioned` standing in for the other 6). Owner: "Focus on the definition in CR-062" — Obligation's own event emission is a raised instance's runtime/lifecycle behavior, not Pack-authoring, so it doesn't belong in CR-062's definition-only scope. · **Status:** 🟡 Proposed (not designed, not scheduled).

## The gap

Ch.23 §15 names 8 Obligation lifecycle events. Today ([obligations.ts](../../src/routes/seu/core/obligations.ts)) only `ObligationCreated` is published on creation; every other transition publishes one generic `ObligationTransitioned` regardless of what the transition actually was (Assigned/Updated/Resolved/Verified/Closed/Escalated/Reopened all collapse into it).

## Implementation precedent

There's no standalone CR for the Event Bus redesign itself (Event Registry + Event Subscriptions, `event_registry`/`event_subscriptions`, publish/dispatch separation, `category:event-types`) — it was built directly this session (2026-08-21); CR-052/053/054 are its filed spinoffs. [seedEventSubscriptions.ts](../../src/dblayer/seed/seedEventSubscriptions.ts) says outright: *"Populating the full ~90-event catalogue is the chapter-by-chapter gap-closing work that comes after this structure, not part of it."* This CR is exactly that, for Obligation.

The real pattern to follow is Review's own ([reviews.ts:127-136](../../src/routes/seu/core/reviews.ts#L127-L136)): derive the specific `eventType` string per transition/outcome at the call site, instead of hardcoding one generic name.

## What it touches (multiple places, not just one)

- `obligations.ts`'s transition handler — map each real transition to its named event instead of always publishing `ObligationTransitioned`.
- `eventSubscriptions.json` — register the 8 named event types under `category:event-types` (`event_registry`), matching how every other entity's named events are seeded.
- Anything currently querying/expecting the generic `ObligationTransitioned` string, if any exists.

## Open design questions (none resolved yet)

- Exact mapping from the 8 named events (Ch.23 §15) to real transition/outcome combinations in the current lifecycle mechanism (§19.6, already confirmed real) — needs to be enumerated against the actual state machine, not assumed 1:1.
- Whether `ObligationTransitioned` stays as a catch-all fallback for transitions that don't map to one of the 8 named events, or is removed entirely once all 8 are real.

## Not in scope

Building any of the above. This CR exists to hold the gap and its implementation precedent, split out of CR-062 to keep that CR definition-only.
