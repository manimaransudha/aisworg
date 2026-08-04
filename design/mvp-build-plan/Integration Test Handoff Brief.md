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
- **Phase 7 (Engineering Telemetry):** a test that Flow and Governance metrics reflect real activity (not placeholders), and that a sustained pattern of the same Quality Gate blocking raises exactly one Organisational Learning Obligation — not one per blocked attempt.
- **Phase 8 (Attention Management + External Interaction):** a test that a blocked Quality Gate surfaces a real, deduplicated Attention Item on the platform-wide inbox, and that transitioning an External Interaction to "Failed" automatically raises a second, Exception-category one (Ch.36 §13 → Ch.34).

Each new phase's "Done when" line in `Post-MVP Build Sequence.md` is close to a direct translation into one of these tests — use it as the starting spec, not just a checklist to eyeball.

## What not to do

Don't retrofit these as a replacement for the direct-function unit tests — keep both layers. Don't reach for Playwright or a browser-automation tool unless a real need for rendered-page/client-JS coverage shows up later; nothing built so far needs it, and it would add a dependency and CI cost that isn't earning its keep yet.

## Status — Initial regression suite ✅ Done (2026-08-04)

Built as `tests/web-flow.e2e.test.ts`, alongside (not replacing) `tests/acceptance.e2e.test.ts` (which already covered the same journey over the CSRF-exempt JSON API — this new file covers the separate `routes/seu/web/` controller wiring instead, the layer the original Dependency Engine bug actually lived in). Same toolchain as the existing e2e test: `node --test` + Node's built-in `fetch()` + `fetch-cookie`/`tough-cookie` for session cookies, app booted on an ephemeral port via `app.listen(0)`, real Postgres, nothing mocked.

**Re-walked all five flows by hand against the current, post-Phase-3 app before writing any test**, per the status note above — confirmed the web route contract is unchanged by Phase 3 (still a form POST → `302` + flash message; Phase 3 only changed what happens internally before that redirect):
- Commissioning form: `GET /aisworg/seu/seus/new` (CSRF token in a hidden `_csrf` input) → `POST /aisworg/seu/seus` (`statement`, repeated `requiredCapabilityCodes`) → `302` to `/aisworg/seu/seus/:id`.
- Capability Fulfilment: `POST /aisworg/seu/seus/:id/capabilities/:capabilityId/fulfil` (`participantType`, `displayName`) → `302`, capability badge flips to `Fulfilled`.
- Deliverable transition: `POST /aisworg/seu/seus/:id/deliverables/:deliverableId/transition` (`targetState`) → `302` + flash (`alert-success` or `alert-danger` with the specific blocking reason in the message text).
- All exactly as this brief assumed — no discrepancies found, nothing to correct.

**One adaptation, not a discrepancy**: Flow 5 (dependency gating) now fulfils both Deliverables' producing Capabilities *before* attempting the blocked transition. Without that, a Phase-3-deferred transition (`dispatch_deferred`, no Participant assigned) and a dependency-blocked one (`dependency_not_satisfied`) would both just be "blocked," muddying which gate the test is actually proving works. Pre-fulfilling isolates the dependency gate specifically — the one the regression is about — so the test still fails the way it should if that exact bug ever comes back.

**Phase 3 coverage added per "How this expands"**: one further test drives a transition twice — once with nobody fulfilling the producing Capability (asserts the flash message, asserts the Deliverable didn't move, and queries `commandsDB`/`workItemsDB` directly to confirm a real `Deferred` Command with no dispatched Work Item), then again after fulfilling it (asserts a second, `Completed` Command exists with exactly one `Disposed` Work Item assigned to the fulfilling Participant via the `sole-eligible-participant` strategy). This is the acceptance check that Command generation and Dispatch are real, not just present in the engine-level tests.

Full suite: 29/29 passing (23 existing + 6 new).

## Status — Phase 4 (Governance depth) ✅ Done (2026-08-04)

Added one further test to `tests/web-flow.e2e.test.ts`, same "assert it's blocked, satisfy the condition, assert it's now allowed" pattern as Flow 5, per this brief's own §"How this expands" spec for Phase 4. Walked the flow by hand against the running app first, same discipline as before:

- Obligation create: `POST /aisworg/seu/seus/:id/obligations` (`deliverableId`, `category`, `title`, `severity`) → `302` + flash success.
- Obligation transition: `POST /aisworg/seu/seus/:id/obligations/:obligationId/transition` (`targetState`) → `302` + flash, same shape as the Deliverable transition endpoint.
- A blocked Deliverable transition (Quality Gate) redirects `302` with `alert-danger` naming the gate and the unresolved Obligation(s) by title — confirmed graceful, not a `500`, matching Flow 4's bar.

The test commissions an SEU, fulfils Requirements Specification's producing Capability, moves it to "In Progress", creates an Obligation against it, confirms the "In Progress" → "Approved" transition is now blocked by the seeded `qg-deliverable-in-progress-to-approved` Quality Gate (flash names the gate and the Obligation), walks the Obligation through its full lifecycle to "Verified", then confirms the same Deliverable transition now succeeds. Requirements Specification has zero dependency edges in the seeded Template (confirmed independently in `tests/governance-depth.test.ts`), so this test's block-then-unblock is provably the Quality Gate/Obligation, not the Dependency Engine — the same "independently of the dependency graph" bar this brief's Phase 4 pointer asked for.

Full suite: 33/33 passing (29 existing + 1 new HTTP-level test + 3 new direct-function tests in `tests/governance-depth.test.ts`, added alongside per the "keep both layers" rule).

## Status — Phase 5 (Knowledge, Evidence, Decision Models) ✅ Done (2026-08-04)

Added one further test to `tests/web-flow.e2e.test.ts`, exactly per this brief's own §"How this expands" spec for Phase 5: "a test that a transition requiring accepted Evidence or a recorded Decision is blocked without it and allowed with it." Same block-then-unblock pattern as Flow 5 and the Phase 4 test; walked the flow by hand against the running app first:

- Evidence create: `POST /aisworg/seu/seus/:id/evidence` (`deliverableId`, `category`, `title`, `source`, `confidenceLevel`) → `302` + flash success.
- Evidence transition: `POST /aisworg/seu/seus/:id/evidence/:evidenceId/transition` (`targetState`) → `302` + flash, same shape as every other governed-entity transition endpoint.
- A blocked Deliverable transition (the new "Approved" → "Baselined" Quality Gate) redirects `302` with `alert-danger` naming the gate and the reason — graceful, not a `500`.

The test commissions an SEU, walks Requirements Specification all the way to "Approved" (fulfil Capability → "In Progress" → "Approved" — Phase 4's Obligation gate passes trivially since no Obligation is ever created), confirms "Approved" → "Baselined" is now blocked by the seeded `qg-deliverable-approved-to-baselined` Quality Gate, creates an Evidence Item, walks it to "Accepted", then confirms the same Deliverable transition now succeeds. A second scenario proving the "or" — an Approved Decision alone also satisfies the same gate, with no Evidence at all — is covered in `tests/trust-pipeline.test.ts` (direct-function layer) rather than duplicated at the HTTP layer, consistent with "keep both layers" rather than testing the same fact twice through two different mechanisms.

Full suite: 38/38 passing (33 existing + 1 new HTTP-level test + 4 new direct-function tests in `tests/trust-pipeline.test.ts`).

## Status — Phase 6 (Organisational Learning Obligation + Engineering Capital surfaces) ✅ Done (2026-08-04)

Added one further test to `tests/web-flow.e2e.test.ts`, exactly per this brief's own §"How this expands" spec for Phase 6: "a test that promoting a Knowledge Item's scope produces a visible Organisational Learning Obligation." Walked the flow by hand against the running app first:

- Knowledge Item create: `POST /aisworg/seu/seus/:id/knowledge` (`deliverableId`, `category`, `title`) → `302` + flash success, same shape as every other create endpoint.
- Scope promotion: `POST /aisworg/seu/seus/:id/knowledge/:knowledgeItemId/promote-scope` (`targetScope`) → `302` + flash — new this phase, deliberately a *different* endpoint from `.../transition`, since Acquisition Scope and lifecycle status are governed as two independent tracks (Ch.16 §12 vs §9).
- Engineering Capital: `GET /aisworg/seu/knowledge/capital` → `200`, platform-wide (not nested under a specific SEU).

The test creates a Knowledge Item, confirms promoting its scope before it's Published is blocked with a clear message (not a `500`), walks it through its lifecycle to "Published", promotes it to "Capability" scope, confirms the flash message names a real Organisational Learning Obligation, confirms that Obligation is actually visible and actionable in the SEU detail page's Obligations section (not just named in a toast), then confirms the same Knowledge Item now appears on the Engineering Capital screen with the correct scope badge. Authority tiering (Capability requires `general`, Enterprise requires `power`, Platform requires `super`) and the monotonic-promotion-only rule (no skipping tiers, no demotion) are covered in `tests/engineering-capital.test.ts` (direct-function layer) rather than duplicated at the HTTP layer.

Full suite: 44/44 passing (38 existing + 1 new HTTP-level test + 5 new direct-function tests in `tests/engineering-capital.test.ts`).

## Status — Phase 7 (Engineering Telemetry) ✅ Done (2026-08-04)

Added one further test to `tests/web-flow.e2e.test.ts`, per this brief's own newly-added Phase 7 pointer above (no phase-specific pointer existed for Phase 7 before this — derived directly from `Post-MVP Build Sequence.md`'s Phase 7 "Done when" line instead, per this brief's closing instruction to use that line "as the starting spec"). Walked the flow by hand against the running app first:

- Telemetry: `GET /aisworg/seu/telemetry` → `200`, platform-wide (not nested under a specific SEU, same choice as Engineering Capital).
- No new mutating endpoints — Telemetry is observational only (ET-001); the test drives the existing Deliverable-transition and Obligation-create endpoints and checks their effect shows up in Telemetry, rather than testing any Telemetry-specific POST route (there isn't one).

**One real discrepancy found while writing this test, not present when the brief's spec line was written**: the naive assertion "exactly one occurrence of the Obligation's title text on the page" failed on the first run — not because a duplicate Obligation was raised, but because the raised Organisational Learning Obligation is itself an unresolved Obligation on the same Deliverable, so the *next* blocked attempt's own flash message correctly lists it by name alongside the original blocker (the Quality Gate is genuinely re-evaluating live data, which now includes the Obligation Telemetry just created). Not a bug — fixed by asserting against a second page fetch (after the one-shot flash has already been consumed) rather than the same response that triggered it. Logged here since it's exactly the kind of "assumed exactly-once, but real system state cascades" issue this brief exists to catch.

The test commissions an SEU, transitions Requirements Specification to "In Progress," confirms it now appears on the Telemetry page (a real Flow metric, not a placeholder), creates an Obligation deliberately left unresolved, blocks the same Quality Gate 3 times in that SEU, confirms exactly one Organisational Learning Obligation appears (not one per attempt), confirms a 4th attempt doesn't raise a second one, and confirms the gate's name now appears in the platform-wide Telemetry page's Governance section with a real (non-placeholder) latency figure. The `QualityGateBlocked`/`QualityGatePassed` event-bus publications this phase added to `qualityGateEngine` (a real Ch.26 §15 gap found during this phase, previously silent) are covered directly in `tests/telemetry.test.ts` (direct-function layer) rather than duplicated at the HTTP layer.

Full suite: 49/49 passing (44 existing + 1 new HTTP-level test + 4 new direct-function tests in `tests/telemetry.test.ts`).

## Status — Phase 8 (Attention Management + External Interaction) ✅ Done (2026-08-04)

Added one further test to `tests/web-flow.e2e.test.ts`, per this brief's own newly-added Phase 8 pointer above (no phase-specific pointer existed for Phase 8 before this, and — unlike every prior phase — `Post-MVP Build Sequence.md`'s own Phase 8 entry has no "Done when" line at all; a self-derived scope bar was written directly into that doc's Phase 8 completion notes instead, and this test is built against that bar). Walked the flow by hand against the running app first:

- Attention inbox: `GET /aisworg/seu/attention` → `200`, platform-wide, no create form (Attention Items are derived only — Ch.34 §4).
- Attention transition: `POST /aisworg/seu/attention/:id/transition` (`targetState`) → `302` + flash, same shape as every other lifecycle transition endpoint in this app.
- External Interaction create: `POST /aisworg/seu/seus/:id/external-interactions` (`deliverableId?`, `interactionType`, `direction`, `targetSystem`, `purpose?`) → `302` + flash — `deliverableId` is optional here, unlike Obligation/Evidence/Knowledge/Decision, since not every interaction is about a specific Deliverable.
- External Interaction transition: `POST /aisworg/seu/seus/:id/external-interactions/:interactionId/transition` (`targetState`) → `302` + flash.

**One real discrepancy found while writing this test, not present in any prior phase's audit**: counting substring occurrences on the platform-wide `/seu/attention` page to check AM-002 dedup (the same technique Phase 7's test used against a single SEU's Obligations) produced 34 matches, not 1 — because the inbox is genuinely platform-wide and by this point in the suite carries fixture rows from every other phase's tests that happen to share the same Deliverable name ("Requirements Specification"). Not a bug in the dedup logic itself — fixed by asserting the dedup count through the `seuId`-scoped JSON API (`GET /aisworg/api/seu/attention-items?seuId=...`) instead of the unscoped HTML page, and using the HTML page only to confirm the item is visibly present and to drive its lifecycle transition. Logged here as the Phase 8 instance of this brief's recurring lesson: a platform-wide screen genuinely accumulates cross-test state in this shared dev database, so "count occurrences of X" assertions need to be scoped, not asserted against the raw page.

The test commissions an SEU, fulfils its Requirements Analysis Capability, transitions the Deliverable to "In Progress," creates an Obligation deliberately left unresolved, blocks the "No Unresolved Obligations" Quality Gate, confirms a real "Action Required" Attention Item appears on the platform-wide inbox, confirms a second blocked attempt against the same situation does not add a second one (scoped API check), walks that Attention Item through its full Ch.34 §9 lifecycle (Created → Delivered), then records a real External Interaction against the same Deliverable, walks it to "Dispatched," transitions it to "Failed," and confirms an Exception-category, High-priority Attention Item was raised automatically — the concrete Ch.36 §13 → Ch.34 cross-chapter link the chapter itself calls out. The sustained-pattern-raises-an-Escalation-item path, the direct create/lifecycle-walk of an Attention Item, and the "External Interaction rejected against a Deliverable from a different SEU" guard are covered in `tests/attention-and-interaction.test.ts` (direct-function layer) rather than duplicated at the HTTP layer.

Full suite: 56/56 passing (49 existing + 1 new HTTP-level test + 6 new direct-function tests in `tests/attention-and-interaction.test.ts`).
