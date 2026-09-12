# CR-102 — `EBMActivated` subscriber: move `finalizeCommissioning` off the synchronous `transitionEbm` call path (Book 3 Ch.2/Ch.3/Ch.8)

**Raised:** 2026-09-12 · **Origin:** owner, auditing the SEU/EBM/Commissioning chain (Ch.2/3/8) against the platform's own "no code statements after an event is published" rule, following the Version Feature Plan.md pass on Events and Lifecycles.md. **Status: 🟡 Proposed — design agreed in conversation, not yet built.**

## The gap (found live, in code, not assumed from the documents)

A direct check of `src/routes/seu/core/commissioning.ts` and `src/domain/engine/validateRequest.ts` found three real violations of the platform's own event-publishing discipline (nothing after a publish should run in the same call):

1. `validateRequestHandler` — both `CommissionFailed` publishes were followed by `await seusDB.updateLifecycleState(seu.id, "Failed")`, a DB write after the event. **Fixed by owner directly, same session.**
2. `finalizeCommissioning` — after publishing the terminal `SEUOperational` event, it still ran `seusDB.setCommissioningReport(...)` and reloaded the SEU before returning. **Fixed by owner directly, same session.**
3. `transitionEbm`'s `Active` branch — after publishing `EBMActivated`, it goes on to call the entire `finalizeCommissioning` cascade (PRE_ASSETS_STEPS, Create Engineering Assets, deliverable creation, and `SEUOperational`'s own publish) inline, in the same synchronous call. **This CR is that fix.**

## Why a reorder alone doesn't settle it

The first fix considered was simply publishing `EBMActivated` last (after `finalizeCommissioning` succeeds) instead of first — no bus involved, same synchronous call. That works mechanically, but changes what `EBMActivated` *means*: from "a human clicked Activate" (announcement of intent) to "activation and every downstream consequence completed." Since nothing subscribes to `EBMActivated` today, no consumer contract would break — but the owner asked, instead, why this isn't handled as real event pub/sub, given failure doesn't have to be returned to the caller — it can be signaled by a DB status update instead, the same shape `CommissionRequested → validateRequestHandler → CommissionFailed/updateLifecycleState(..., "Failed")` already uses earlier in this same cascade (an async subscriber, driven off `event.actor_id`, reporting outcome purely via SEU state — no caller ever waits on it; `commissionSeu`/`commissionFromForm` return before validation even runs, and `driveCommissioningToActive` polls for the real outcome).

**Open question, not resolved by this CR**: the original deletion of `ebmVersioningHandler`/`seuActivationHandler`/`createEngineeringAssetsHandler` (design/mvp-build-plan/SEU Composition.md era) was justified in a code comment as *"Subscription to an event and manual trigger of transition definition are 2 different things"* — but that fuller reasoning isn't written down in any design doc found (checked `SEU Composition.md` directly; only a paraphrase survives in `eventHandlerRegistry.ts`'s own comment). The one concrete, documented failure mode from that era is a duplication bug (`commissionSeu` ran Validate Request's logic inline *and* a subscriber also ran it off the event `commissionSeu` itself published — the same work racing twice), which this CR's design must not repeat: **`transitionEbm` must stop calling `finalizeCommissioning` directly once the subscriber exists — only the subscriber may invoke it, never both.**

## Agreed design

Add a real subscriber on `EBMActivated`; move the entire `Active`-branch logic (template/profile lookup + the `finalizeCommissioning` call) out of `transitionEbm` and into it. `transitionEbm` itself, once this lands, does no more than: update the EBM's status, publish `EBMActivated`, return — nothing after the publish, satisfying the rule directly rather than by reordering around it.

Failure inside the subscriber is **not** returned to any caller — it results in a DB state change, mirroring `validateRequestHandler`'s existing pattern exactly:
- On `finalizeCommissioning` failure, set `seus.lifecycle_state = "Failed"` (the real state added by migration 177 for this exact purpose) and publish `CommissionFailed` with a new `stage` value (e.g. `"finalize_commissioning"`) for traceability — a third stage alongside `validateRequestHandler`'s existing `"validate_request"` stage variants, not a new failure-signaling mechanism.

## Implementation scope (not yet built)

- New file `src/domain/engine/ebmActivated.ts` — `ebmActivatedHandler`, mirroring `compositionCompleted.ts`'s/`validateRequest.ts`'s own shape.
- Register it in `HANDLER_REGISTRY` (`src/domain/engine/eventHandlerRegistry.ts`).
- Add the subscription row to `src/dblayer/seed/data/eventSubscriptions.json` (`event_registry`/`event_subscriptions`, migration 089), applied via `db:clean-slate` — the same mechanism every existing subscription already goes through.
- `transitionEbm` (`src/routes/seu/core/commissioning.ts`) loses its `if (input.targetState === "Active") { ... finalizeCommissioning(...) }` branch entirely; that logic (template/profile lookup, the `finalizeCommissioning` call, and its failure handling) moves into `ebmActivatedHandler`.
- The subscriber reads `event.originating_object_id` (the EBM id) and `event.actor_id` (the real human who clicked Activate) off the event row — same convention `validateRequestHandler` already uses — rather than trusting anything passed as a live function argument.
- **UI impact, not yet addressed**: the SEU detail page's "Activate EBM" action currently gets a synchronous `ok`/`fail` result from `transitionEbm`. Once the cascade moves into an async subscriber, that action returns before commissioning has actually finished — the UI needs to poll for completion instead (mirroring `driveCommissioningToActive`'s existing pattern for the earlier `CommissionRequested → CommissionValidated` stage), not assume success from the request completing.

## Related

- CR-092 Part 9 — built `transitionEbm`'s own Active branch and its inline call to `finalizeCommissioning` in the first place (the code this CR now moves).
- design/mvp-build-plan/Version Feature Plan.md — the event_type/version_event audit pass that surfaced this while reviewing Chapter 2/3/8's real transition graph.
