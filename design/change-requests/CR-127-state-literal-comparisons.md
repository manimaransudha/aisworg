# CR-127 — State literal comparisons removed from code

**Raised:** 2026-10-19 · **Origin:** `design/Code Repetition Survey.md` finding 5. Code compares lifecycle state and status fields against string literals such as `"Active"` and `"Draft"`. The project rule is that no constant lives in code outside `src/dblayer/constants.ts` and that everything else is Ontology driven.

**Status:** 🟡 Raised — design in progress. This CR stays open until the classification below is agreed and built.

## Fix the following

| # | Item |
|---|---|
| 1 | Each state literal assignments under `src/` is classified as Constant, Ontology. |
| 2 | A Constant assignments imports its value from `src/dblayer/constants.ts`. |
| 3 | An Ontology comparison reads its value or outcome from the Ontology or from `transition_definitions`. A change to that value is a data change. |


## Classes

| Class | Meaning | Candidates |
|---|---|---|
| Constant | The state is structural to the code. The constants have to be defined in constants.ts and imported. |
| Ontology | The behaviour follows from a state machine or a concept set that is already data. | Single-entity states such as Dispatched, Released, Fulfilled, Pending and Defined. Compliance result values. |
| Leave | Seed and test values. | rejected, dead, consumed. |

## Inventory

Assignments of lifecycle state literals outside `src/dblayer/constants.ts`, surveyed on 2026-10-23 by grep of `src/`. Comparisons are out of scope. The Class column is empty until the classes above are agreed. The grep matches `targetState`, `toState`, `newState`, `fromState`, `status`, `state` and `lifecycle_state` assigned a capitalised literal, and `SET status = '…'` in SQL. `seed/data` JSON and docs are excluded.

| File | Line | Assignment | Literal | Class |
|---|---|---|---|---|
| src/dblayer/seed/seedTestTenants.ts | 15 | `status` | Operational | |
| src/dblayer/seed/seedTestTenants.ts | 16 | `status` | Operational | |
| src/dblayer/seed/seedBaselineTenants.ts | 13 | `status` | Operational | |
| src/dblayer/seed/seedBaselineTenants.ts | 16 | `status` | Operational | |
| src/dblayer/seed/seedBaselineTenants.ts | 17 | `status` | Operational | |
| src/dblayer/seed/demo/demoSeed.ts | 93 | `status` | Draft | |
| src/dblayer/seed/demo/demoSeed.ts | 131 | `status` | Draft | |
| src/dblayer/seed/demo/demoSeed.ts | 173 | `targetState` | Active | |
| src/domain/engine/dispatchEngine.ts | 127 | `targetState` | Assigned | |
| src/routes/seu/core/profiles.ts | 415 | `targetState` | Active | |
| src/routes/seu/core/profiles.ts | 419 | `targetState` | Deprecated | |
| src/routes/seu/core/workItems.ts | 46 | `targetState` | Idle | |
| src/routes/seu/core/workItems.ts | 110 | `targetState` | Idle | |
| src/routes/seu/core/workItems.ts | 118 | `status` | Disposed | |
| src/routes/seu/core/demoSimulator.ts | 253 | `targetState` | Waived | |
| src/routes/seu/core/deliverableDefinitions.ts | 61 | `targetState` | Active | |
| src/routes/seu/core/deliverableDefinitions.ts | 65 | `targetState` | Deprecated | |
| src/routes/seu/core/ontology.ts | 451 | `targetState` | Deprecated | |
| src/routes/seu/core/capabilities.ts | 92 | `newState` | Fulfilled | |
| src/routes/seu/core/capabilities.ts | 205 | `targetState` | Released | |
| src/routes/seu/core/capabilities.ts | 208 | `targetState` | Archived | |
| src/routes/seu/core/templates.ts | 527 | `targetState` | Active | |
| src/routes/seu/core/templates.ts | 531 | `targetState` | Deprecated | |
| src/routes/seu/core/packs.ts | 446 | `targetState` | Active | |
| src/routes/seu/core/packs.ts | 451 | `targetState` | Retired | |
| src/routes/seu/core/schemaRegistry.ts | 150 | `fromState` | Packaged | |
| src/routes/seu/core/schemaRegistry.ts | 166 | `fromState` | Packaged | |
| src/routes/seu/core/schemaRegistry.ts | 170 | `fromState` | Packaged | |
| src/routes/seu/core/participants.ts | 107 | `targetState` | Released | |
| src/routes/seu/core/participants.ts | 110 | `targetState` | Archived | |
| src/routes/seu/core/objectives.ts | 126 | `targetState` | Active | |
| src/routes/seu/core/objectives.ts | 434 | `targetState` | Retired | |
| src/routes/seu/core/objectives.ts | 451 | `targetState` | Retired | |
| src/routes/seu/core/commissioning.ts | 403 | `targetState` | Active | |
| src/routes/seu/web/ontology.ts | 51 | `toState` | Deprecated | |
| src/routes/seu/web/ontology.ts | 52 | `toState` | Retired | |
| src/routes/seu/web/ontology.ts | 53 | `toState` | Archived | |
| src/routes/seu/web/objectives.ts | 232 | `targetState` | Superseded | |
| src/dblayer/seuCapabilitiesDB.ts | 74 | `status` | Fulfilled | |

## Actor and author badge resolution

The session user id and the author badge are resolved through shared helpers. No call site reads `req.session.user.id` directly, picks a badge by hand, or falls back to a default. A missing actor or a missing badge throws.

### Helpers

| Layer | Helper | Behaviour |
|---|---|---|
| Route | `requireActorId(req)` | Returns the session user id as a string. Throws when it is undefined or null. |
| Route | `resolveHeldBadges(req)` | Returns `{ isRoot, badgeTypes, has }` for the session actor. |
| Route | `resolveAuthorBadgeForRequest(req)` | Picks the badge from the `route_authority` row of the request. Root records `root`. Records `system` when the row lists no badge. Throws when no held badge matches. |
| Route | `resolveActorAndBadge(req)` | Returns `{ actorId, authorBadge }` from the two helpers above. |
| Core | `badgeAuthorityEngine.resolveAuthorBadge(actorId, "<noun_verb>")` | Returns `root` for a root holder and the badge itself for a holder. The platform system actor passes `deliverable_*` badges. Throws otherwise. |
| Core | `badgeAuthorityEngine.getHeldBadges(actorId)` | Returns the held set for reads that gate a view. |
| Events | `getSystemActor(seuId)` and `findPlatformSystemActorId()` | The system actor and the `system` badge for engine-published events. |

### Changes

| Area | Change |
|---|---|
| `resolveAuthorBadge(authRow, held)` | Throws. The `?? "pack_define"`, `?? "general"` and first-held-badge fallbacks are removed. |
| `badgeAuthorityEngine.authorise` | The return type is a discriminated union. `matchedBadge` is required when `via` is `badge`. The fallback in `transitionEngine.ts` is removed. |
| Core authoring | Profile, Pack and Template define, Review create, Finding create and convert, Obligation create, Deliverable create, Schema Definition create, Objective propose and submit, Ontology sync and Quality Gate Waiver grant resolve the badge from the actor. |
| Core inputs | `createReview`, `createFinding` and `convertFindingToObligation` no longer accept `authorBadge`. |
| Routes | The api and web layers use `requireActorId` or `resolveActorAndBadge`. The six registry copy handlers use `held.has("<x>_define")` for `canCopy`. |
| Objectives | The tenant check in `createObjective` is removed. The `requireTenantScope.forField` middleware on the create routes enforces tenant scope. |
| Commissioning | `attemptSeuCommenceWork` resolves one `commenceBadge` and uses it for the policy call and the published event. |
| Metrics | `metricRegistryEngine.compute` publishes `MetricCalculated` as the platform system actor. |
| Demo seed | `demoSeed.ts` resolves the badge with `resolveAuthorBadge(actor.participantId, "<x>_define")`. |

### Retained

| Location | Reason |
|---|---|
| `dataMigrations.ts` | Records `root` unconditionally. |
| `demoSimulator.ts` `authorBadgeFor` and the `ontology_define` literal | Simulated actors. |
| `badgeBootstrap.ts` | Login root grant and platform badges. |
| `executionEngine.ts` and `transitionEngine.ts` `authorise` calls | Governance engines. |
| `participantHome.ts` `getHeldBadges` | Reads the held set to filter decisions. |

### Interim literals

Birth rows are not yet in `transition_definitions` (CR-128). Until then the creation badges are `review_create`, `finding_create`, `finding_convert`, `obligation_create`, `deliverable_create` and `schemadefinition_create`. No seed data grants these badges, so only root holders can create these rows until the grants exist.

### Behaviour changes

| Case | Before | After |
|---|---|---|
| Actor without the required badge | `{ ok: false }` or a redirect with a message | Throws into the catch block or the global error handler. |
| Quality Gate Waiver without `qualitygate_waive` | `{ ok: false }`, HTTP 403 | Throws, HTTP 400. |
| Commence work without `seu_<verb>` | Logged and left the SEU at Activated | Throws. The event bus catches and logs it. The SEU stays at Activated. |
| `createObjective` called directly | Tenant check in core | No tenant check. |

### Tests

| File | Change |
|---|---|
| `tests/testFixtures.ts` | `createReviewAsRoot` and `createFindingAsRoot` drop `authorBadge`. The `holdAtActivated` comment describes the throw. |
| `tests/review-model.test.ts` | `convertFindingToObligation` calls drop `authorBadge`. |
| `tests/author-badge-resolution.test.ts` | New. Covers `requireActorId`, `resolveAuthorBadge`, `badgeAuthorityEngine.resolveAuthorBadge` and the waiver throw. |

## Open points

| # | Point |
|---|---|
| 1 | Which hits are Constant, which are Ontology and which are Leave. |
| 2 | Where the Ontology source lives for each Ontology hit. |
| 3 | Fixtures and tests that compare the same literals. |
