# Integration Test Handoff Brief — SEU Commissioning Platform

*Paste this as the opening message of a new session, or point that session at this file. It is self-contained — the new session has no memory of the work that produced it.*

## Why this exists

Existing tests call core business-logic functions directly (`node --test`). That's good coverage for one thing and structurally blind to another: it confirms domain logic is correct in isolation, but it cannot catch a route handler that fails to actually *call* that logic before acting.

That's precisely the shape of bug already found once in this codebase: the Dependency Engine's readiness check was correct, but the Deliverable-transition route handler wasn't consulting it before allowing the transition through — a dependency shown as "Pending" in the UI didn't actually block the transition it was supposedly gating. A direct function-level test of the dependency-check logic would have passed throughout; it never goes near the route handler where the bug lived.

**The fix is not Playwright.** No new dependency, no browser automation, no rendering. Node's built-in `fetch()`, called from inside the same `node --test` runner already in use, hitting the real running Express server, asserting on real HTTP responses and real database state. This closes the wiring-layer gap the unit tests can't reach, in the same toolchain already chosen.

## Status note — Phase 3 is already built

Phase 3 (Command/Work Item/Dispatch Engine pipeline) was completed after this brief's routes and request shapes were originally observed, by walking the app directly at `localhost:4800/aisworg` pre-Phase-3. That means: **before writing any test below against a specific route or field name, verify it against the current implementation first.** Phase 3's whole point was replacing direct form-POST transitions with Command generation → Work Item → Dispatch — the external HTTP behaviour may be unchanged (good REST design usually keeps the route contract stable while the internals change), or it may not be. Don't assume either way; check.

Concretely, before building the "Initial regression suite" below:
1. Walk the same five flows by hand first (curl or browser) against the running app as it stands now, the same way the original audit did, and note anywhere the route, field names, response shape, or available `targetState` options differ from what's written below.
2. Update the specific request/response details in this file to match reality, or note the discrepancy, before encoding them into tests — don't write a test against a route description that hasn't been reconfirmed.
3. Once Phase 3's actual behaviour is confirmed, add tests for what's now real and wasn't before: real Command objects being generated, Work Items being produced from them, and whatever Dispatch-selection logic actually runs (even if it's still "whoever's assigned" — confirm that's true of the *current* code, not the pre-Phase-3 code this brief was written against).

## What to build

A second test suite, alongside (not replacing) the existing direct-function unit tests, that:
1. Starts the real server (or connects to one already running for tests).
2. Issues real `fetch()` requests to real routes — including the CSRF token dance and cookie-based session the app already uses (`GET` a form page first to obtain a `_csrf` token and session cookie, then `POST` with both).
3. Asserts on the real HTTP response (status code, redirect `Location` header) and on real subsequent state (reload the page or query the DB directly to confirm the transition actually happened or was actually blocked).

Keep these in their own test files/directory, separate from the direct-function unit tests, so it's obvious at a glance which layer a failing test is telling you about.

## Initial regression suite — cover what's already been manually audited

These flows were walked by hand pre-Phase-3 (see `Post-MVP Build Sequence.md`, "Where things stand," and the status note above). Turning them into automated tests first means later phases inherit a safety net immediately, and the specific bug that already happened gets a permanent regression test rather than relying on someone remembering to re-check it by hand — but re-confirm each one against the current, post-Phase-3 app before encoding it, per the status note above.

1. **Commission an SEU, end to end.** `GET` the new-SEU form, extract `_csrf`. `POST` to the commissioning endpoint with an objective statement and required Capability codes. Assert a `302` redirect to the new SEU's detail page. Follow it; assert the page shows lifecycle state `Operational` and that an `SEUOperational` event is present.
2. **Capability Fulfilment.** On a commissioned SEU, `POST` to its capability-fulfil endpoint with a participant type and display name. Assert the capability's status flips to `Fulfilled`.
3. **Deliverable transition — valid.** `POST` a Deliverable's transition endpoint with a `targetState` that's actually offered. Assert success and the new state is reflected.
4. **Deliverable transition — invalid, rejected.** Attempt a transition to a state with no Transition Definition from the current state (e.g. submit the same `targetState` twice in a row). Assert it's rejected with an explicit error, not silently accepted and not a `500`.
5. **Deliverable transition — dependency gating. This is the regression test for the bug already found and fixed; treat it as the one that must never go green by accident.** Set up a Deliverable B with an unmet dependency on Deliverable A (A not yet in the state B depends on). Attempt to transition B forward. **Assert the transition is blocked.** Then move A to the state B depends on. Attempt to transition B again. **Assert it now succeeds.** If this test ever fails on the "should be blocked" half, that's the same bug back.

## How this expands going forward

As each phase in `Post-MVP Build Sequence.md` is built, add HTTP-level tests for whatever new routes/flows that phase introduces, in the same style as above — real requests, real responses, real state checks. A rough per-phase pointer:

- **Phase 3 (Command/Work Item/Dispatch) — already built.** Deliverable state changes now go through Command generation and dispatch instead of a direct form POST (or should — confirm this per the status note above). The Deliverable-transition tests in the regression suite above are the acceptance check that this refactor didn't change externally-visible behaviour; get them passing against the current pipeline first. Then add new tests for the Command/Work Item/Dispatch layer itself: a Command is actually generated when expected, a Work Item is produced from it, and whatever Dispatch-selection logic exists behaves as intended (even trivial "whoever's assigned" logic deserves a test confirming it's what actually runs).
- **Phase 4 (Governance depth):** a test that a Quality Gate actually blocks a transition until its criteria are met, and one that an Obligation blocks a Deliverable independently of the dependency graph — same "assert it's blocked, satisfy the condition, assert it's now allowed" pattern as the dependency-gating test above.
- **Phase 5 (Knowledge/Evidence/Decision):** a test that a transition requiring accepted Evidence or a recorded Decision is blocked without it and allowed with it.
- **Phase 6 (Organisational Learning Obligation):** a test that promoting a Knowledge Item's Acquisition Scope produces a visible Obligation.

Each new phase's "Done when" line in `Post-MVP Build Sequence.md` is close to a direct translation into one of these tests — use it as the starting spec, not just a checklist to eyeball.

## What not to do

Don't retrofit these as a replacement for the direct-function unit tests — keep both layers. Don't reach for Playwright or a browser-automation tool unless a real need for rendered-page/client-JS coverage shows up later; nothing built so far needs it, and it would add a dependency and CI cost that isn't earning its keep yet.
