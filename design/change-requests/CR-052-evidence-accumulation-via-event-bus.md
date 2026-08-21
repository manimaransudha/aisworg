# CR-052 — Evidence accumulation via the Event Bus (exploratory)

**Raised:** 2026-08-21 · **Origin:** owner, immediately after CR-051 — "How do we accumulate the evidence? I think this should also be a push into the Event bus. Say, there is a source code. We say (deliverable, seu_id, evidence) and push it in. I am even thinking Having one evidence per seu and accumulating all evidence corresponding to the seu as it is placed in the event bus - Separate CR for this." · **Status:** 🟡 Proposed (exploratory — owner thinking out loud, not yet a settled design; filed so it isn't lost)

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

## Scope addition, 2026-08-21 — the Event Bus itself is reviewed as part of this CR

Owner: "event bus has to be a pub/sub mode. event bus itself should not be deciding anything. We are yet to develop the event bus... we will review the event bus as part of 52 and align any mismatches to this model." Folded in here rather than a separate CR.

The governing principle: the Bus is pure infrastructure/transport — it carries a signal in and an announcement out, and never itself decides anything or applies a transition. All evaluation ("are the criteria now met") and all state mutation stay in the engines (`qualityGateEngine`/`transitionEngine`), same as today; the Bus doesn't gain decision-making authority by becoming more reactive.

What's already true, checked against the code while this was being discussed: `eventBus.ts` already implements genuine in-process pub/sub (`subscribe`/`publish`, independent subscribers, one's failure isolated from another's) — it is not a stub. What's actually thin is real production usage of `.subscribe()` — almost nothing in the running system reacts to a published event yet (Quality Gate events becoming a real publisher was itself recent; subscribing was previously test-only). Confirmed via CR-042's own closure notes: the one existing analogous mechanism (Dependency Engine push-evaluation, `DeliverableReady`/`DeliverableBlocked`) is publish-only by design — "a notification side-channel, not a gate... nothing needs to react to them... no dedicated consumer is required." So today, *nothing* in this codebase reacts to a Bus event by re-running an engine check — every existing case is a direct, synchronous function call immediately following a state change, with the Bus used only for the announcement after the fact.

This CR now needs to settle: does Evidence accumulation (the idea above) require the Bus to gain real subscription-triggered reactions (new behaviour, no precedent yet), or does it keep matching the existing shape — a direct call triggers re-evaluation, and the Bus only ever announces what already happened? Whatever CR-051's own schema lands on, and whatever this CR decides Evidence acquisition looks like, needs to be checked against this model and any mismatch resolved here, not assumed.

## Not in scope yet

Everything else — this CR exists to hold the idea, not to specify an implementation. Not to be worked on before CR-051's own design (Evidence's target data shape) is further along, since a schema decision there directly affects whether "accumulating into one record" is even the right shape to build toward.
