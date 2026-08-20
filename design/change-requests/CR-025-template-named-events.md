# CR-025 — Real named Template events, mirroring Pack

**Raised:** 2026-08-19 · **Origin:** owner — "20.10 Events — generic only, not the six named events - Fix this. Similar to what is on pack." Closes Chapter 6 §20.10 (§16): the build published one generic `TemplateTransitioned` event for every hop (payload `{ fromState, toState, code }`) instead of the real per-state-named events §16 specifies, unlike Pack, which has always published real named events via an explicit `EVENT_BY_TARGET_STATE` lookup. · **Status:** ✅ Built 2026-08-19

> **Built 2026-08-19.** `tsc` clean; full suite **142 pass / 1 known-environmental fail** (see CR-024 — the same pre-existing, unrelated `attention_items` volume issue). Verified via the same reactivation smoke test CR-024 already ran end to end (deprecate → reactivate → new Active version) — every hop along that path (`Validated`/`Published`/`Active`/`Deprecated`) now publishes its real named event, not the generic one, confirmed by tracing `core/templates.ts`'s `transitionTemplate` call sites: `advanceTemplateOneStep` (interactive authoring, one hop at a time) and `reactivateAsNewVersion` (CR-024) both route through the same single `transitionTemplate` function, so both got the fix with no additional call-site changes.

### What's built here
- **`EVENT_BY_TARGET_STATE`** (`core/templates.ts`), a direct structural mirror of Pack's own map (`core/packs.ts`):
  ```
  Validated → TemplateValidated
  Published → TemplatePublished
  Active     → TemplateActivated
  Deprecated → TemplateDeprecated
  Retired    → TemplateRetired
  Archived   → TemplateArchived
  ```
  `transitionTemplate`'s event publish now reads `EVENT_BY_TARGET_STATE[input.targetState] ?? "TemplateTransitioned"` — the fallback exists only for structural parity with Pack's own `?? "PackTransitioned"` pattern; every reachable target state is covered, so it never actually fires today.
- **`TemplateCreated`**, published from `publishTemplate` (the "proper" seed/CLI publish entry point) at Draft creation — mirroring `PackRegistered`'s exact placement in `createPackDraft`, **including the same asymmetry**: this does not fire from interactive authoring's `createAuthoringDraft` (`core/sdkAuthoring.ts`), because `PackRegistered` doesn't either. `publishTemplate` has no real caller today (every seed script calls `templatesDB.upsert` directly), so this is currently unobservable in practice — kept correct anyway, the same reasoning CR-024 already applied to fixing `publishTemplate`'s versioning.

### Design decision — Archived was added even though §16's own text omits it
Chapter 6 §16 lists six events: `TemplateCreated / TemplateValidated / TemplatePublished / TemplateActivated / TemplateDeprecated / TemplateRetired` — no `TemplateArchived`. Chapter 5's own §16 (Pack) lists all seven of its equivalents, `PackArchived` included. Given the owner's instruction was "similar to what is on pack," the six-vs-seven discrepancy was treated as an oversight in §16's original text, not a deliberate difference to preserve — `TemplateArchived` is built, for real parity with Pack's complete event set. §16 itself hasn't been edited (this is `design/Change Requests.md`'s CR ledger, not a chapter section) — a future editorial pass on §16's normative text could add the missing name, the same kind of catch-up §20.8 already flagged for Commissioning Parameters.

### Not in scope / notes
- No consumer currently subscribes to any of these named events differently than it subscribed to the generic one — `eventBus`'s subscribers key off `originatingObjectType`/payload contents in every case checked, not `eventType` string matching. This CR is a naming-fidelity fix (matching the chapter's own spec and Pack's precedent), not a behavioural one.
- `PackDependencyResolved`/`PackDependencyFailed`-equivalent events for Template were never in scope (Pack doesn't publish those either — Ch.5 §16 marks dependency-resolution events as not built, consistent with dependency resolution itself not being built for either entity).
