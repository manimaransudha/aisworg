# Participant Integration — dry-run test suite

A standalone, black-box verification suite for the Participant Integration & Attestation build (`../../design/mvp-build-plan/Participant Integration Plan.md`). It stands up two tenants — **Atlas** (ebook library management system) and **Babylon** (school student enrollment mapping students to courses for credits) — commissions an SEU for each, and drives them through the full flow plus exhaustive non-happy-path cases.

It is **independent of the repo's own `tests/`**: zero dependencies, plain Node (global `fetch`), and it talks to a running instance only over HTTP — exactly as a real external client would. Nothing here imports platform code.

## The swap point

`lib/edge.mjs` is the only part that simulates the *tenant's* side — its version control system (`SimVCS`), its participants (`SimParticipant`, human or AI), and its orchestrator endpoint (`SimOrchestrator`, which receives delivered assignments). **When a real adapter is built for a tenant, `lib/edge.mjs` is what gets replaced.** The platform client (`lib/platform.mjs`) and the scenarios stay put, because the platform core is tenant- and transition-type-invariant (Plan §0.1). If keeping this suite green ever forces a change *outside* `edge.mjs`, that is a core-invariance regression worth investigating.

## Prerequisites (one-time per clean database)

A clean-slate database has no commissionable Template (post-reset, templates are authored through the SDK UI). Seed the packs/capabilities/templates/profiles the suite commissions against, from the repo:

```
cd <aisworg repo>
pnpm db:clean-slate      # optional: reset to a known clean state first
pnpm seed:seu            # idempotent: packs -> capabilities, web-application template, profiles
```

Then start an instance with the test auto-login active (a single root identity), on a spare port:

```
NODE_ENV=test PORT=4900 pnpm dev     # or however the app is started; any port is fine
```

## Run

```
cd src/dry-run-suite
SUITE_BASE_URL=http://127.0.0.1:4900/aisworg node run.mjs
```

`SUITE_BASE_URL` defaults to `http://127.0.0.1:4900/aisworg`. Exit code is `0` when everything passes, `1` on any failure, `2` if the server is unreachable. Re-running is safe: tenants are reused by code, and each run's Objectives are suffixed with a unique id.

## What it covers

- **Tenancy & decoupling** — two tenants with different VCS providers, auth schemes, and execution modes; the *same* global capability resolved `human-on-ui` for Atlas and `external-orchestrator` for Babylon, on one identical core.
- **Full lifecycle** — `Defined → In Progress → Approved → Baselined` over the async Model-A loop (dispatch → result-in callback), for both tenants, with a human/AI participant mix.
- **External-orchestrator delivery** — a simulated tenant orchestrator receives the delivered assignment-out (carrying the tenant identity, VCS binding, outbound auth, and the transition), then reports its result back through the same result-in callback — the full round trip to an external environment.
- **Attestation vs raw reference** — production records a reference but mints no attestation; acceptance transitions mint an attestation that records the certifying authority.
- **Resolution 7** — the approval attestation does *not* satisfy the Baselining gate; Baselining needs its own fresh Accepted Evidence.
- **Empty-centre** — an approval cannot certify a Deliverable with no produced reference (`empty_centre`), and clears once a real reference exists.
- **Deferred dispatch** — dispatching before any Participant fulfils the producing Capability is refused (`dispatch_deferred`) and does not move state; it dispatches once fulfilled (also exercises the `External` participant type alongside AI and Human).
- **Undefined transition** — skipping the graph (`Defined → Baselined`) is refused (`no_transition_definition`), never silently applied.
- **Failure paths** — `failed`/`blocked` results raise Attention and do not advance state.
- **Callback error surface** — replay (`409 not_outstanding`), unknown Work Item (`404`), malformed outcome (`400`).
- **Stall/timeout** — a past deadline + `sweep-stalled` raises an escalation Attention Item (deterministic, no waiting).
- **Opaque reference round-trip** — a bizarre provider-specific reference is stored byte-for-byte; the core never parses it.
- **Participant replacement** — idle and mid-flight (while a Work Item is outstanding).
- **Traceability** — backward provenance and forward impact analysis (Ch.20).
- **Review Model (Ch.25, Phase 14)** — a governed Review with an immutable outcome that never modifies the reviewed object (`outcome_required` guard, RM-001), a High-severity Finding that auto-surfaces Attention and converts to an Obligation (once), and traceability listing the Reviews + Findings against the Deliverable.

## Known limitation

**Separation-of-duties negative case** (a creator attempting the approver transition → `authority_denied`) is not reachable black-box: the `NODE_ENV=test` auto-login is a single root badge holder that satisfies every authority. The suite instead asserts the observable structure (each acceptance records its certifying authority grant) and notes the boundary. The negative case is covered in-process by the repo's `badge-model.test.ts`.

## Files

| File | Role |
|---|---|
| `run.mjs` | entry point + preflight |
| `scenarios.mjs` | the scenarios (Atlas, Babylon, decoupling, edge cases) |
| `lib/platform.mjs` | the platform API contract (tenant-invariant) |
| `lib/edge.mjs` | **the swap point** — simulated tenant VCS, participants, and orchestrator |
| `lib/harness.mjs` | HTTP client (cookie jar + CSRF) and the test runner |
