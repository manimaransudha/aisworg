# CR-052 — Evidence accumulation via the Event Bus (exploratory)

**Raised:** 2026-08-21 · **Origin:** owner, immediately after CR-051 — "How do we accumulate the evidence? I think this should also be a push into the Event bus. Say, there is a source code. We say (deliverable, seu_id, evidence) and push it in. I am even thinking Having one evidence per seu and accumulating all evidence corresponding to the seu as it is placed in the event bus - Separate CR for this." · **Status:** 🟡 Proposed — the Event Bus itself (§"Scope addition" below) was redesigned and built 2026-08-21; the Evidence-accumulation idea this CR was actually raised for remains exploratory, unresolved

## The idea, as raised

Today Evidence is created one way: a direct `createEvidence` call (web form or API), one row per call. The owner is questioning whether that's the right *acquisition* model, separately from CR-051's own question about Evidence's data shape once it exists.

Two related but distinct threads in the owner's own framing:

1. **Evidence creation as an event-bus push, not a direct call.** "Say, there is a source code. We say (deliverable, seu_id, evidence) and push it in" — engineering activity (e.g. a Deliverable reaching a state, a Pack contribution running) publishes something onto the event bus carrying `(deliverable, seu_id, evidence content)`, and Evidence gets created *from* that event rather than from a direct authoring action. This would make Evidence accumulation a side effect of normal SEU activity, not a separate manual step.
2. **"One evidence per SEU," accumulating.** A structurally different model from today's "many independent Evidence rows, each pointing at one related object" — instead, a single Evidence *record* per SEU that grows/accumulates entries as events arrive, rather than many discrete rows.

The owner's own "I am even thinking" phrasing marks #2 as a live, unsettled possibility, not a decision — flagged here as exploratory, not to be treated as agreed scope.

## Open questions (none resolved yet)

- Does "one evidence per SEU" replace today's per-object Evidence rows entirely, or sit alongside them as a second, aggregate view?
- If Evidence becomes event-bus-sourced, what triggers the push — every Deliverable transition? Specific Capability/Service completions? Something Packs declare?
- How does this interact with CR-051's own multi-relationship redesign — an event-sourced, accumulating model and a multi-relationship join-table model may be two different solutions to a related problem (both are about Evidence relating to more than one thing over time), or may be complementary. Not yet examined against each other.
- Does accumulated per-SEU Evidence still go through the Collected → Validated → Accepted → Referenced → Archived lifecycle per entry, or does the aggregate record itself carry one lifecycle state while individual accumulated entries don't?
- What existing event(s) would this piggyback on / does a new dedicated event need to exist for "something worth evidencing just happened"?

## Scope addition, 2026-08-21 — the Event Bus itself, redesigned and built

Owner: "event bus has to be a pub/sub mode. event bus itself should not be deciding anything. We are yet to develop the event bus... we will review the event bus as part of 52 and align any mismatches to this model." Folded in here rather than a separate CR, and — unlike the rest of this CR — this part actually got built, in the same session, via an extended design conversation (Ch.30 audit → field-by-field structure review → publish/consume mechanism review) followed by implementation.

**Corrected finding, since this section originally got it wrong**: at the time this was written, `eventBus.ts` was checked and described as "nothing in this codebase reacts to a Bus event" — that was false even then. `src/adapters/assignmentDelivery.ts` was a real, live, boot-registered subscriber (`WorkItemDispatched → deliverAssignmentForWorkItem`), the one genuine exception the original audit missed. Caught during the Ch.30 implementation-status audit that followed.

**What was actually built** (migration `089_event_bus_structure.sql`, `src/domain/engine/eventBus.ts` full rewrite):
- **Publish and Consume are now genuinely separate operations** (Ch.30 §9's own `Generated → Published → Consumed → Archived` lifecycle, taken literally): `publish()` persists only; `dispatch()` — a standalone, independently-callable function — invokes registered handlers, called by `publish()` **fire-and-forget** (not awaited). Publishing an event never blocks on any handler's own work now, closing the exact gap `assignmentDelivery.ts`'s inline external-delivery call demonstrated.
- **Event Registry + Event Subscriptions** (`event_registry`, `event_subscriptions` tables) replace the old in-memory `subscribers: EventHandler[]` array and the imperative `eventBus.subscribe()` call — a DB-backed, inspectable catalogue (Ch.30 §19's own "Event registry"/"Event subscription service" deliverables), loaded into an in-memory routing map once at boot (never queried on the publish hot path).
- **`consumption_state`** (new JSONB column on `events`) tracks per-handler dispatch outcome (`pending`/`consumed`/`failed`, independently per handler — Ch.30 §9's "consumption by one subscriber shall not affect other subscribers").
- **`seu_id`** added to `events` (closing a real, demonstrated gap in `getSeuEvents()`'s own incomplete reconstruction) and **`causation_id`** fixed at every site it was previously wrong (a duplicate of `correlation_id`, or an entity id instead of a prior event's id).
- The one real pre-existing subscriber (`assignmentDelivery.ts`) migrated onto the new mechanism, live-verified over HTTP.
- **Deliberately not built**: retry/reconciliation for a handler that throws or a dispatch that never completes (fire-and-forget has no automatic redelivery) — filed separately as **[CR-053](CR-053-event-bus-consumption-retry-reconciliation.md)**.

This CR's own original question — does Evidence accumulation need the Bus to gain reactive behaviour — is now answerable in concrete terms rather than hypothetically: the mechanism exists (a handler registered against an event type runs automatically, without the publisher knowing or waiting), so an Evidence-accumulation design can genuinely use it. Whether it *should* is still the open, unresolved part of this CR.

## Not in scope yet

Everything else — this CR exists to hold the idea, not to specify an implementation. Not to be worked on before CR-051's own design (Evidence's target data shape) is further along, since a schema decision there directly affects whether "accumulating into one record" is even the right shape to build toward.
