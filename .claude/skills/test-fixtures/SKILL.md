---
name: test-fixtures
description: Write or fix tests and test fixtures in this repo (tests/, tests/testFixtures.ts) — how a test gets the badges it needs, why a granted badge must be restored, how to find published rows without fixed versions, and the participant and superuser fixture rules. Use whenever the user asks to write, fix, align or review a test or fixture, or reports an authority_denied, duplicate-key or fixed-version failure in a test.
---

# Test fixtures

Source: `tests/testFixtures.ts`. Read the helper you need there before writing a new one.

## Badges

- A test that needs a badge grants it at run time with the helpers in `tests/testFixtures.ts`. A literal badge name guessed at the call site is not acceptable.
  - `grantTransitionBadge(participantId, entityType, from, to)` resolves the badge from the real `transition_definitions` row (`${entityType.toLowerCase()}_${verb}`).
  - `grantRouteBadges(participantId, method, path)` resolves the badges from the real `route_authority` row.
  - `grantBadge(participantId, badge)` is the low-level call and is idempotent for a holder that already has the badge.
- `driveCommissioningToActive` grants the SEU hop badges for the actor it is given. A new multi-hop driver grants its own hop badges the same way.
- `grantBadge` writes to the shared tester's `participants_master` row and nothing revokes it. A test that grants a badge to a shared tester reads `authorised_badges` first and restores it in a `finally` block. Otherwise a later test that depends on that tester lacking the badge fails (for example the Objectives viewer test and `TESTER_OBJECTIVE_ACHIEVE_ONLY`).
- An `authority_denied` failure in a test is a missing grant in the fixture. Add the grant through a helper. Do not widen the seeded identity.

## Actors, badges and NOT NULL columns

- Every actor, author and badge column is NOT NULL, so core functions take a real `actorId` (a `participants_master` id). `createKnowledgeItem`, `createDecision` and `addKnowledgeValidationNote` also resolve the author through `resolveAuthor`, which needs the actor to hold a `participants` row in that SEU. Call `ensureActorParticipant(seuId, actorId)` first. The same applies to `executionEngine.execute` when `requestedBy` is a user.
- Those create functions resolve their badge themselves (`knowledge_observe`, `decision_identify`, `knowledge_validate`). A non-root actor needs it through `grantBadge`. `ROOT_ACTOR_ID` and `ROOT_ACTOR_BADGE` cover root.
- Direct DB-layer writes in a test (`decisionsDB.create`, `knowledgeItemsDB.create`) take the SEU-scoped `participants.id` of the actor, not the `participants_master` id, plus a badge.
- A test that builds an ad-hoc transition definition with policies through `transitionDefinitionsDB.upsert` declares a `verb`. The engine throws when a transition needs a badge and the definition has none. Use a verb whose `<entity>_<verb>` badge the actor holds.
- Engine-raised rows (work items, Attention Items, Obligations, the SEU capabilities and Deliverables) are authored by the SEU's system participant, which commissioning creates when the SEU is Commissioned. A test that creates an SEU with `seusDB.create` calls `ensureSeuSystemParticipant(seuId)` before anything engine-driven runs. `getSystemActor(seuId)` throws when it is missing.
- `createDraft` and `upsert` require `tenantId` (`PLATFORM_TENANT_ID` in fixtures). Nothing defaults it.
- A created row records the author's badge. Assert `"root"` for a root actor, not `null`.

## Seeded templates and codes

- A test that publishes and activates a Platform Template under a seeded code supersedes the seeded row, because activating a newer version retires the tenant's previous Active one. `seedDemo` and commissioning then fail with "Platform Template not found" or an inactive template.
- A test never reuses a seeded template code (`mobile-application`, `api-platform`, `saas-product`, and the rest). It uses its own test-only `template-categories` concept in `ontologyConcepts.json`, one per test file so files running in parallel do not supersede each other. Existing ones: `test-sdk-authoring-template`, `test-dependency-graph-template`, `test-template-lifecycle-template`, `test-cr088-publish-template`.
- After a full run, check that the seeded Platform templates are still Active before running `seedDemo`.

## Published rows and versions

- Publish is not idempotent and a version-hop transition can move a row's version. Find a published row by `findActiveByCode(code, tenantId)`. Do not look it up by its seed version.
- Assertions on a published row's version compare against the version the row carries after publishing, not the version in the seed.
- A stable code that is reused across runs accumulates rows, because rows are never deleted. A test that asserts counts or sequences takes a per-run major version (for example `Math.floor(Date.now() / 1000)`) and filters to its own versions. `uniqueTestPackVersion()` gives a unique Pack version.

## Participants and identities

- Fulfil a Capability with a real `participants_master` Participant (`ensureEligibleParticipant`, `participantMasterId`). An ad-hoc `{type, displayName}` Participant can never be dispatched.
- A missing "No superuser provisioned." error is a recurring gap with no shared fixture helper. Ask before adding one, because it touches many test files.
- `actorId`, `authorityBadge` and `author_id` are plain strings. `tsc` cannot catch a wrong value. Verify these at runtime.

## Known issues

- Check `design/Known Issues.md` before triaging a failing test. Several failures there are accepted gaps (the commence-work rescan race, the superuser fixture gap, a polluted tester row).
- When the owner says a failure is a known gap, add it to `design/Known Issues.md` with its area, how it shows up and its status. Do not edit the file otherwise.

## Running tests

- Run `tsc`, `db:clean-slate` and the tests only on the user's explicit instruction in that turn.
- Grep the output file for failures first (`grep -n "FAIL\|Error"`) and read only the relevant sections.
- Run a failing test alone to separate load from a real regression. The automatic commence-work rescan race (KI-001 in `design/Known Issues.md`) explains the Phase and attestation failures under load.
- A schema-changing CR lists the fixtures it affects and fixes them in the same pass.
