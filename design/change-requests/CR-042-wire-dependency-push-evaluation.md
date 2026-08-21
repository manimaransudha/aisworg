# CR-042 — Wire dependency push-evaluation into live transition-completion paths; publish `DeliverableReady`/`DeliverableBlocked`

**Raised:** 2026-08-20 · **Origin:** owner, asking whether hitting a dependency-graph node actually publishes to the event bus today — it doesn't. Found reviewing CR-039's own completion; scoped as its own CR rather than reopening CR-039 (owner: "we don't have to disturb 39"). Absorbed CR-040's surviving residue 2026-08-20 (owner: "Update CR040 and close it and let us move the residue to CR042") — of Ch.9's original nine-event taxonomy, only the aggregate `DeliverableReady`/`DeliverableBlocked` pair holds up against how this system actually uses its event bus (see CR-040's own closure note for the full reasoning); the other seven stay unbuilt, either lacking any real audit/telemetry consumer or blocked on mechanisms that don't exist. · **Status:** ✅ Built 2026-08-20

> **Built 2026-08-20.**

### What changed

**1. Renamed the event.** `dependencyDefinitionEngine.ts`'s `evaluateAndPublishFromTransition` now publishes `"DeliverableReady"` instead of `"DependencySatisfied"` — a pure string rename, no schema/migration involved, no other code referenced the old string outside its own test.

**2. `DeliverableBlocked` — built.** `core/deliverables.ts`'s `transitionDeliverable`, at the exact point it returns `dependency_not_satisfied`, now publishes `DeliverableBlocked` first — same payload shape as `qualityGateEngine.recordAndBlock` (`entityType`, `entityId`, `seuId`, `reason`), `reason` built from the governing rows' own `(from_entity_type, from_name, from_state)`.

**3. `evaluateAndPublishFromTransition` wired into both real trigger points:**
- **Deliverable** — `completeWorkItem` (`core/workItems.ts`), immediately after `deliverablesDB.updateLifecycleState` succeeds (the real Model-A state-change point, not `transitionDeliverable`, which only dispatches). Uses `updated.name` (the return value of `updateLifecycleState`) and `command.to_state`/`command.seu_id`, already in scope there.
- **Capability** — `fulfilCapability` (`core/capabilities.ts`), right after `seuCapabilitiesDB.markFulfilled`. Since `dependency_definitions` Capability-type rows are keyed by Service code, not the bare Capability code, this resolves `input.capabilityId` → its Services via `servicesDB.findByCapabilityId` (new import) and calls the push function once per Service code, `entityType: "Capability"`, `newState: "Fulfilled"`. Confirmed via grep that `seuCapabilitiesDB.markFulfilled` has exactly one call site in `core/` — no second wiring point needed (`replaceParticipant` doesn't re-trigger fulfilment; the Capability is already Fulfilled before a replace happens).

### Verification

- `npx tsc --noEmit` clean.
- Full suite: **149/149** passing, including `tests/dependency-definition-engine.test.ts` updated for the rename (assertions + test title, event payload shape itself unchanged).
- `pnpm db:clean-slate` run live — full seed pipeline (identity baseline, transition definitions, authority vocab, capability-pattern Packs, SDLC-phase Packs, all 9 standard Templates + Profiles) completes cleanly with the new wiring in place.

---

## The gap this closes

CR-039 built two halves: a pull-based gating check (`dependencyDefinitionEngine.isTargetReady`) and a push-evaluation function (`evaluateAndPublishFromTransition`) meant to publish `DependencySatisfied` whenever a governed entity's transition unlocks something downstream — "push, not pull" was CR-039's own stated point of building this at all.

Only the pull half is actually wired into anything live: `core/deliverables.ts`'s `transitionDeliverable` calls `isTargetReady` before every real gated transition, so gating genuinely works today. `evaluateAndPublishFromTransition` is real, tested code (`tests/dependency-definition-engine.test.ts`) — but nothing in the running system calls it. No `DependencySatisfied` event has ever been published outside a test. `eventBus` itself is a real, live mechanism used everywhere else on the platform (`QualityGatePassed`, `SEUCommissioned`, …) — this is specifically about one function never being wired to a real trigger, not a gap in the event bus itself.

## Scope

**1. Rename the already-built event.** `evaluateAndPublishFromTransition` currently publishes `"DependencySatisfied"` — but its actual logic only fires when `isTargetReady`'s *aggregate* `ready` flag is true, never per individual dependency row. That's Ch.9's `DeliverableReady` semantics, not a per-row "satisfied" signal. Nothing consumes the string anywhere except this CR's own test, so this is a pure rename, no migration: `"DependencySatisfied"` → `"DeliverableReady"`.

**2. Build `DeliverableBlocked`.** Fires from `core/deliverables.ts`'s `transitionDeliverable`, at the exact point it returns `dependency_not_satisfied` — mirroring `qualityGateEngine.recordAndBlock`'s own pattern precisely (same payload shape: `entityType`, `entityId`, `seuId`, `reason`). This is the real counterpart CR-040's closure identified as worth keeping.

**3. Wire `evaluateAndPublishFromTransition` (now publishing `DeliverableReady`) from wherever a governed entity's state actually lands**, for every entity type the canonical graph can reference:
- **Deliverable** — `completeWorkItem` (`core/workItems.ts`), the real state-change point under Model A (not `transitionDeliverable`, which only dispatches; the Deliverable's `lifecycle_state` doesn't change until the Participant's result lands here).
- **Capability** — wherever `seuCapabilitiesDB.markFulfilled` is actually called from core (`fulfilCapability` and its replace-Participant sibling), since Capability nodes have no `transitionDeliverable`-style gate of their own.
- Decision/Obligation/Evidence/Knowledge remain **out of scope** — see the resolved question below.

## Why this doesn't replace the gate (push and pull are different jobs)

Worth being explicit about, since it's easy to assume push-evaluation existing means the gate could just read a cached result instead of recomputing: it can't, and shouldn't.

`isTargetReady` (pull) is the actual authorization decision — "is this specific attempted transition allowed, right now" — and it has to be computed fresh from live instance data at the moment of the attempt. This isn't an arbitrary choice: it's the direct fix for a real bug the *old* `dependency_edges` model had. That model's `readiness_state` was a stored, write-side cache, only refreshed as a side effect of an attempt on the *downstream* Deliverable — so if the upstream Deliverable changed state and nobody happened to attempt the downstream transition afterward, the cached flag just sat there stale (`seus.ts`'s own comment on the old code: "the stored readiness_state... shows stale status on every plain page load"). CR-039 deliberately moved to computing satisfaction fresh every time specifically to kill that failure mode.

`evaluateAndPublishFromTransition` (push, this CR) is a **notification side-channel, not a gate**. Its job is: when an upstream node is hit, tell interested parties that something downstream might now be unblocked — a human sees an Attention Item, a dashboard highlights "ready to start" work, something downstream auto-triggers — without waiting for someone to manually attempt the downstream transition and get a gate response. Nothing about the gate's correctness depends on whether this event fired, arrived, or was consumed. The two mechanisms coexist; this CR does not make the pull-based check in `core/deliverables.ts` obsolete or cacheable.

## Questions from the original proposal, now resolved

- **Do Decision/Obligation/Evidence/Knowledge transitions need this wiring at all right now?** Still no. CR-041 built the authoring mechanism but nothing has used it for these four types — `dependency_definitions` still holds zero rows of those types. Deferred, same as originally leaning; scope stays Deliverable + Capability only.
- **What consumes `DeliverableReady`/`DeliverableBlocked` once real?** Resolved by CR-040's closure analysis: nothing needs to *react* to them — this system publishes events almost entirely for audit/telemetry querying (one live subscriber exists in the whole codebase, unrelated to this). Their value is being queryable later, matching `QualityGatePassed`/`Blocked`'s own precedent exactly. No dedicated consumer is required for this CR to be complete.
- **Does push-evaluation need to gather from all three owning scopes (Template/Pack/Profile)?** Resolved — CR-043 already built this, and it's already correct: `evaluateAndPublishFromTransition` calls `this.isTargetReady` internally, which already resolves the SEU's full scope (Template + composed Packs + Profile) via `resolveOwningScope`. Nothing further needed here.

## Not in scope

Decision/Obligation/Evidence/Knowledge wiring (see above); the seven other Ch.9 events CR-040's closure found weren't worth building (`DependencyCreated`, per-row `DependencySatisfied`/`Blocked`, `DependencyWaived`, `ConstraintDetected`/`Resolved`, `CircularDependencyDetected`).
