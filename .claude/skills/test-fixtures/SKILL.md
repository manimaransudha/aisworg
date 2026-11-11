---
name: test-fixtures
description: Write or fix tests and test fixtures in this repo (tests/, tests/testFixtures.ts, tests/schemaFixtures.ts) — how a test gets the badges it needs, why a granted badge must be restored, how to find published rows without fixed versions, the participant and superuser fixture rules, the schema fixtures (one maximal Active row per entity kind) and the HTTP helpers for testing controllers. Use whenever the user asks to write, fix, align or review a test or fixture, or reports an authority_denied, duplicate-key or fixed-version failure in a test.
---

# Test fixtures

Source: `tests/testFixtures.ts` and `tests/schemaFixtures.ts`. Read the helper you need there before writing a new one.

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
- `createDraft` and `upsert` require `tenantId`. Nothing defaults it. `PLATFORM_TENANT_ID` exported by `tests/testFixtures.ts` is the test-platform tenant (`getTestPlatformTenantId()`), not the real Platform tenant. A test never writes under the real one.
- `templatesDB.upsert` resolves the superuser itself (`userDB.getSuperuserId`), and `profilesDB.upsert` takes no `draftContent`. A test that needs a Template or Profile with content uses a schema fixture or `createAuthoringDraft`, not these two.
- A created row records the author's badge. Assert `"root"` for a root actor, not `null`.

## Seeded templates and codes

- A test that publishes and activates a Platform Template under a seeded code supersedes the seeded row, because activating a newer version retires the tenant's previous Active one. `seedDemo` and commissioning then fail with "Platform Template not found" or an inactive template.
- A test never reuses a seeded template code (`mobile-application`, `api-platform`, `saas-product`, and the rest). It uses its own test-only `template-categories` concept in `src/dblayer/seed/data/test-ontology.json`, one per test file so files running in parallel do not supersede each other. Existing ones: `test-sdk-authoring-template`, `test-dependency-graph-template`, `test-template-lifecycle-template`, `test-cr088-publish-template`.
- After a full run, check that the seeded Platform templates are still Active before running `seedDemo`.

## Published rows and versions

- Publish is not idempotent and a version-hop transition can move a row's version. Find a published row by `findActiveByCode(code, tenantId)`. Do not look it up by its seed version.
- Assertions on a published row's version compare against the version the row carries after publishing, not the version in the seed.
- A stable code that is reused across runs accumulates rows, because rows are never deleted. A test that asserts counts or sequences takes a per-run major version (for example `Math.floor(Date.now() / 1000)`) and filters to its own versions. `uniqueTestPackVersion()` gives a unique Pack version.

## Participants and identities

- Fulfil a Capability with a real `participants_master` Participant (`ensureEligibleParticipant`, `participantMasterId`). An ad-hoc `{type, displayName}` Participant can never be dispatched.
- A missing "No superuser provisioned." error is a recurring gap with no shared fixture helper. Ask before adding one, because it touches many test files.
- `actorId`, `authorityBadge` and `author_id` are plain strings. `tsc` cannot catch a wrong value. Verify these at runtime.

## Schema fixtures

Source: `tests/schemaFixtures.ts`. Used by `tests/registry-views.test.ts` and the other tests that import it (grep `schemaFixtures` for the list).

- A schema fixture is one maximal, Active row of a schema entity kind: every property of the latest schema carries a value, including the nested rows. Use it when a test needs a fully populated Capability, Deliverable, Service, Policy, Pack, Template or Profile, instead of a seeded row picked at run time.
- `buildStage1Fixtures(tenantId)` builds a Capability, two Deliverables, a Service and a Policy. `buildStage2Fixtures` adds a Pack and its base Pack. `buildStage3Fixtures` adds a Pack of every category and the Template. `buildStage4Fixtures` adds the Profile. Each stage includes the ones before it. The tenant comes from `ensureFixtureTenant(label)`.
- A row is created with `createAuthoringDraft` and moved to Active with `advanceAuthoringDraftToActive`, the calls the authoring pages make. A Pack is created with `createPackDraft` instead, as the seeded Packs are, because only that path writes the capabilities, services, policies, checklists and gates a Pack's contributions name. A Template's Capability prerequisites and exposed parameters read those rows. The production validators check every fixture, so a wrong value fails in the setup with the validator's own message, and a policy-validate-schema failure lists the checks that report.
- Building is an upsert. A row is looked up by code, version and tenant and created only when it is missing, so a second run reuses it and nothing accumulates. A row left short of Active by an earlier run is moved on. Change `FIXTURE_VERSION` whenever a builder authors something different, otherwise the next run reuses the stale row. `db:clean-slate` removes the fixture rows with the rest of the data, and a test never deletes them.
- The builders take a Postgres advisory lock, so two test files that build fixtures at the same time cannot both create a row.
- Every Ontology code a fixture uses is a fixture-only concept of the test Ontology, in `src/dblayer/seed/data/test-ontology.json`, with a code that starts `schema-fixture-`. That covers the entity codes (capability, service, deliverable, Pack, Template, participating organisation) and the vocabulary values (competencies, checklist dimension and value, engineering capital type, installation classification, feature flags, dispatch strategies and the Profile Configuration Parameter values). `FIXTURE_CODES` lists them, and `seedTestOntology` loads them at the start of a test run. A fixture that needs another code adds its row to that file. It never borrows a seeded code: a Pack writes rows keyed by those codes (review gates by transition and code, authority rules by code), so a shared code would overwrite a seeded row.
- The category vocabularies (`category:*`), `role-name` and `worktype-name` are read from the Platform Ontology, and so is the composition strategy `specialization`, whose source rules the composition engine keys on its code. A fixture only refers to them. Any other code a new fixture needs goes into `test-ontology.json`.
- A fixture quality gate applies to a fixture-only deliverable-name. The gate engine scans every active gate of a transition when no SEU is given, so a gate with no deliverable names would reach real Deliverables.
- There is no TransitionDefinition fixture: a persisted row would change how the engine moves real entities.
- The read-only `comments` property is not filled, because a transition writes it. The fixtures contain no derived rows, such as a child Template that inherits from a parent.

## Variants of a fixture row

- The fixture rows are shared, reused across runs and never deleted, so a test never changes one. A test that needs a variant (for example the fixture Profile with one more override) builds it in one of two ways.
  - A function that takes a row (`resolveEffectiveParameters` takes `Pick<ProfileRow, "base_template_id" | "draft_content">`, `unravelServices` takes rows) gets an in-memory copy: `{ ...row, draft_content: {...} }`. Nothing is written.
  - A function that reads by id gets a Draft authored with `createAuthoringDraft` in the fixture tenant, with a per-run code and the fixture row's `content` as the base. It uses `ROOT_ACTOR_ID` and `ROOT_ACTOR_BADGE` and the latest schema (`schemaDefinitionsDB.findLatest(kind)`), as `createDraft` in `tests/schemaFixtures.ts` does.
- Read the real fixture to learn what it holds before asserting on it, for example which parameters the Template exposes as overridable (`maximalTemplate` flags every other candidate) and which Deliverable the fixture Service makes (`FIXTURE_CODES.output`).

## Tests against seeded definitions

- A test that reads a real seeded definition (a Service, a Capability) reads its row in `src/dblayer/seed/data/*.json` first and checks the property it relies on: the number of levels, the outputs, the code. Do not assume a count or a code. A wrong assumption fails the test at its setup.
- A test file that imports `tests/testFixtures.ts` or `tests/schemaFixtures.ts` needs the seeded database when it loads, because those modules look up the tester users and the test-platform tenant at import. A test of a pure function goes in its own file with no fixture import, so it runs without the database.

## Testing a controller over HTTP

- The helpers are in `tests/testFixtures.ts`: `setWebBaseUrl`, `newSession`, `getPage`, `getRedirect`, `postForm`, `extractCsrf`, `assertPageMatches`, `assertPageDoesNotMatch` and `pageAlerts`. A test file boots the app itself with `app.listen(0)` and calls `setWebBaseUrl("http://127.0.0.1:<port>/aisworg")`. It never imports the app in the fixtures, because that would start the app in every test file.
- `newSession(userId)` logs in as a seeded or created user through the `x-test-user-id` header. Omitting the id leaves the session logged out.
- `grantRouteBadges` grants only the badges a `route_authority` row declares. A row with `roles` also needs `grantRole(participantId, role)`, which returns a restore function. Read the role from `lookupRouteAuthority`, not from a literal.
- A test that needs a role creates its own user (`userDB.createLocalPending`, `setActive`, and `createParticipantMaster` with the role) and deletes the user and its `participants_master` row at the end. Granting a role to a shared tester races with the other test files, which run in separate processes against one database.
- A denied or failed request redirects with a flash message. Read the `Location` with `getRedirect` or `postForm`, then fetch it as a separate request with `getPage`. Following a GET redirect to another GET in one request loses the session cookie, so the flash does not show.
- Set up data and read results through core functions. Use the web layer only for the page or form under test.

## Known issues

- Check `design/Known Issues.md` before triaging a failing test. Several failures there are accepted gaps (the commence-work rescan race, the superuser fixture gap, a polluted tester row).
- When the owner says a failure is a known gap, add it to `design/Known Issues.md` with its area, how it shows up and its status. Do not edit the file otherwise.

## Running tests

- Run `tsc`, `db:clean-slate` and the tests only on the user's explicit instruction in that turn.
- Grep the output file for failures first (`grep -n "FAIL\|Error"`) and read only the relevant sections.
- Run a failing test alone to separate load from a real regression. The automatic commence-work rescan race (KI-001 in `design/Known Issues.md`) explains the Phase and attestation failures under load.
- A schema-changing CR lists the fixtures it affects and fixes them in the same pass.
