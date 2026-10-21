# CR-129 — Objective transition

**Raised:** 2026-10-21 · **Origin:** CR-128 (birth rows in `transition_definitions`). The owner took Objective out of CR-128 to understand its workflow first. This CR carries forward what CR-128 established and what the code does today. No design is decided.

**Status:** 🟡 Built, one decision open (D6: who moves Active → Achieved). The full test suite passed on 2026-10-21 (owner-run) before the last change, D10 controls from `nextActionsFor`, which is not run.

## Carried forward from CR-128

| # | Rule or precedent | Source |
|---|---|---|
| 1 | One birth row per entity type: `from_state` `None` into the initial state, with a verb, a trigger and an event. The creation badge is `{entity lowercased}_{verb}` and the creation event is the row's event. `transitionEngine.beginBirth` evaluates the row and returns the initial state, the badge and the event. The caller writes its row with that state and publishes the event as its last step. | CR-128, Steps 1 to 3 |
| 2 | The table column that holds the state has no DB default. The DB-layer create function takes the state as a required parameter. | CR-128, Pack, Policy, Deliverable |
| 3 | The generic `transitionEntity` and `nextActionsFor` replace per-entity transition copies where a shared caller (sdkAuthoring) used the copies. An entity reaches `transitionEntity` through an adapter in `entityAdapters.ts`. | CR-128, "The generic transition function" |
| 4 | Validations are placed one by one: schema checks go to `policy-validate-schema`, Ontology composable values to `policy-ontology-values-present`, comments to `policy-comment-required`, side effects to an action code. A check on creation or save that no transition can make stays in code. | CR-128, Capability Steps 5 and 6, "where each validation goes" for Template, Profile and Policy |
| 5 | Every row names an event and, where it is version-significant, a version event, wired at build time. | CLAUDE.md, Version Feature Plan |
| 6 | Event publishing is the last statement. Every publish carries a real actor and badge. | CLAUDE.md |
| 7 | Do not add an entity to a mechanism that was not built for it (the owner's correction on Knowledge). Understand the workflow first, then decide. | CR-128, Entity 9 withdrawn |

## What exists today

| Item | Today |
|---|---|
| Table | `objectives`: `status` has `DEFAULT 'Active'` and a CHECK on Proposed, Active, Achieved, Superseded, Retired, Archived, Reject. `objectivesDB.create` writes `input.status ?? "Active"`. |
| Rows in `transitionDefinitions.json` | 9, all with the policy `policy-objective-transition-baseline`: Proposed → Active (verb `activate`, `submitVerb` `propose`), Active → Achieved (`achieve`, governed), Active → Reject (`reject`), Active → Superseded (`supersede`), Active → Retired (`retire`), and Achieved, Superseded, Retired → Archived (`archive`). There is no birth row. The CR-128 table lists `None → Proposed` as the birth. |
| Creation | `createObjective` (core/objectives.ts): checks the tier and parent rules, resolves the badge with the literal `objective_propose` (`resolveCapabilityAuthor`), writes the row with the status from the caller or `Active`, adds the required Capabilities. It publishes no creation event. |
| Submit step | `submitObjective` records a submission (`triggerEngine.submit`) with the badge `objective_{submitVerb}`. The transition to Active then requires it (`not_submitted` otherwise). |
| Hops | `transitionObjective` calls `transitionEngine.evaluate`, checks a comment on Active → Reject, runs `supersessionEngine.check` and the tenant check on Superseded, writes the status, writes the comment, and publishes the row's event with the version event and the sponsoring authority's tenant. |
| Other state-changing functions | `retireObjectiveSubtree`, `updateObjective` and `reParentObjective` and `deleteObjective` (all only while Proposed). |
| Callers | `web/objectives.ts`, `api/objectives.ts`, `demoSeed.ts` (creates, submits and activates), `seedEbookLibraryObjectives.ts`, `commissioning.ts`, and six test files that call `createObjective`. |
| Comments | `objectivesDB.addComment` and `getComments`. |

## Findings

| # | Finding |
|---|---|
| 1 | An Objective is created in `Active`, not in `Proposed`, unless the caller passes a status. The submit step and the hop Proposed → Active apply only to Objectives created as Proposed. The birth state in the CR-128 table (`Proposed`) and the creation default (`Active`) disagree. |
| 2 | The creation badge `objective_propose` is also the submit verb of the hop Proposed → Active. Creation authority and the submit step share one badge (as in the Deliverable finding 2 of CR-128). |
| 3 | The Reject rule (a comment is required, and it must differ from the latest comment) is entity logic in `transitionObjective`. Pack has the same rule as the Policy `policy-comment-required` and an adapter `addComment`. |
| 4 | The supersede rule (a superseding Objective, in the same tenant) is entity logic in `transitionObjective`, built in CR-116 as `supersessionEngine`, which is meant to be reused. |
| 5 | The Objective is a definition-only, single-entity, linear lifecycle entity, so it needs no event subscriber (CLAUDE.md). |
| 6 | The Active → Achieved hop has trigger `governed`. Who moves it is to be traced. |
| 7 | The event is published with the tenant from `sponsoring_authority`, and `seuId` is null. |
| 8 | The submit step publishes the event `Objective{fromState}` (`triggerEngine.submit`), which is `ObjectiveProposed` for a Proposed Objective. `triggerEngine.hasBeenSubmitted`, `computeEditLockedIds` and the `not_submitted` gate read that event. A birth event named `ObjectiveProposed` (D2) would mark every new Objective as submitted at once. It would be edit-locked, and the activate gate would pass without a submit. |
| 9 | All eight existing birth rows from CR-128 carry `versionEvent: null`. The row Proposed → Active already carries `submitVersionEvent: VersionCreated`. A birth `versionEvent` of `VersionCreated` (D2) duplicates it and departs from the CR-128 precedent. |
| 10 | The web create route (`POST /objectives`) already passes `status: "Proposed"`. The `Active` default is used only by tests, the seeds (`demoSeed.ts`, `seedEbookLibraryObjectives.ts`), `commissioning.ts` and `ensureOneShotContainer`. D3 concerns those callers only. |
| 11 | Nothing drives Active → Achieved. The web layer has no route for it and the detail page lists only `manual` rows. The only entry point is the API route `/transition/achieve`. No governed driver exists for Objective, whereas Deliverable has `deliverableKickoff`. The badge `objective_achieve` is used only by the fixture `TESTER_OBJECTIVE_ACHIEVE_ONLY`. Chapter 8 names no trigger for Achieved. |
| 12 | The row Active → Reject has no exit row. Chapter 8 §12 says an Objective can be returned to Proposed for rework. `08_Objective_Traceability.md` reads this as editing while Proposed, so Reject is a terminal state. The Reject form on the detail page shows only for status Active. D4 covers the comment rule only. |
| 13 | `POST /objectives` (web) calls `createObjective` and then, when `supersedes` is set, `transitionObjective` on the superseded Objective (CR-116). Both calls change under D2 and D5. The create-new-successor flow has to keep working. |

## Owner direction

Objective is legacy code and is modified to follow the pattern of CR-128. The Objective is not authored through sdkAuthoring (no mention in `sdkAuthoring.ts` or `entityAdapters.ts`). `transitionObjective` is the one transition function, with entity logic inside it, and it moves to the shared function with an adapter.

## Decisions

| # | Question | Recommendation or owner answer |
|---|---|---|
| D1 | Follow the CR-128 pattern. | Settled (owner). |
| D2 | Birth row: `None → Defined`, verb `propose`, trigger `manual`, event `ObjectiveCreated`, version event `VersionCreated`. The badge `objective_propose` is unchanged. | Settled (owner, D8). Built. |
| D3 | An Objective is born in the initial state of the birth row and reaches `Active` through the hop `Defined → Active`. Callers that need an Active Objective walk it there. | Settled and built. `ensureOneShotContainer` and `commissionFromForm` call `transitionEntity` after creating the row. The test helper `createActiveObjective` does the same for fixtures. `demoSeed.ts` activates each Objective through `transitionEntity`. |
| D4 | Reject rule (comment required). | Settled and built. The Policy `policy-comment-required` is on the Reject and Superseded rows. The repeat-comment rule is dropped, as for Pack. Comments are the JSONB column `objectives.comments` (the table `objective_comments` is removed), written by `objectivesDB.addComment` through the `objectiveAdapter`. |
| D5 | Supersede rule (superseding id required and found, same tenant, comment required). | The comment is `policy-comment-required`. Supersede is an action code on the row, not a Policy (owner). The action calls the existing generic `supersessionEngine.check` (CR-116) for the id, the existence and the comment checks, then checks the same tenant and writes `superseding_objective_id`. It does not re-implement the check. `supersessionEngine` stays and is shared by other entities later. It runs in the transaction before the status changes and refuses by throwing. A Policy only gates and changes nothing, so no supersede Policy is written. `supersessionEngine` is reduced or removed once nothing else calls it. |
| D6 | Who moves Active → Achieved (trigger `governed`; the API has a manual route `/transition/achieve`; the web layer has no achieve route)? | **Open.** The row stays `governed`. To be traced and decided before the trigger and the actor are written on the row. |
| D7 | Edit, re-parent, delete and the retire subtree. | Not transitions. `retireObjectiveSubtree` moves several Objectives to Retired and calls `transitionObjective` per Objective; it follows the shared function. The others stay. |
| D8 | The initial state is named `Defined`, not `Proposed` (owner; Chapter 8 §12 names the lifecycle `Defined → Active → Achieved → Archived`). | Settled (owner). Effects: the birth row is `None → Defined` (D2, D3 and the build plan read `Proposed` as `Defined`). The submit step publishes `Objective{fromState}`, so the submit event becomes `ObjectiveDefined` and finding 8 no longer collides with `ObjectiveProposed`. The birth event name is open again (D2). Chapter 8 §14 lists `ObjectiveProposed` as a published event, and no row publishes it after the rename. The state is renamed in: the `objectives.status` CHECK and recovery SQL, `ObjectiveStatus` in `seuTypes.ts`, the rows Proposed → Active in `transitionDefinitions.json`, `core/objectives.ts` (`DECOMPOSABLE_PARENT_STATUSES`, edit, re-parent and delete guards, `computeEditLockedIds` event name), `web/objectives.ts`, the three objective views (state badge class), the seeds (`demoSeed.ts`, `seedEbookLibraryObjectives.ts`) and about 17 test files that create or compare an Objective status. Each file's `Proposed` also needs checking for other entities (Knowledge uses the word). |
| D9 | The submit step (`submitObjective`, the lock after a submit, the Submit button) is deleted. | Settled (owner). Activate is the transition button from `nextActionsFor`. The event it publishes is the record. Tests that call `submitObjective` or assert `editLocked` are rewritten: `objective-lifecycle.test.ts` (the lock tests and 6 calls), `objective-event-lifecycle-table.test.ts` (row 3 and 3 calls), `objective-supersession.test.ts`, `tenant-contract.test.ts`, `governance-ebm-sharpening.test.ts`. |
| D10 | Hops that need more than a comment are routes of their own (owner). The generic transition (`POST /objectives/:id/transition/:verb`, `transitionEntity`) takes a target state and an optional comment only. Supersede (needs the successor) and Retire (retires the subtree) each get a route that collects what it needs and then calls `transitionEntity` or `retireObjectiveSubtree`. The flags `retirable`, `rejectable`, `supersedable` and the `can*Objective` flags are removed, and the controls come from `nextActionsFor`. | Settled (owner). Every button comes from `nextActionsFor` and posts to its verb route `/objectives/:id/transition/<verb>`. The verb route owns any extra input, so the page needs no other knowledge. |

## Build plan (after D2 to D6)

| # | Change |
|---|---|
| 1 | `transitionDefinitions.json`: the birth row (D2). `"trigger": "manual"` written on the other rows (Active → Achieved per D6). `policy-comment-required` on Active → Reject and Active → Superseded (D4, D5). The action code on Active → Superseded (D5). Built in part: the row `Proposed → Active` is now `Defined → Active` (D8); `"trigger": "manual"` on every row except Active → Achieved (D6 open, kept `governed`); `policy-comment-required` on Active → Reject and Active → Superseded, and the two hops in that policy's transitions list. Birth row built: `None → Defined`, verb `propose`, trigger `manual`, event `ObjectiveCreated` (owner), no version event (CR-128 precedent; the version event stays on the submit step). The action code on Active → Superseded is wired in step 2. The DB CHECK, `ObjectiveStatus` and the code still say `Proposed` until the D8 rename is built, so an Objective created as `Proposed` has no transition row to leave it, and an insert as `Defined` is refused by the CHECK, until then. The seed itself does not validate state names. ✅ |
| 2 | New action `supersede-objective` (`src/actions`) that calls `supersessionEngine.check`, its code in `constants.ts` and its registration in `src/actions/index.ts`. No Policy and no `policy_definitions` seed. Built: `src/actions/supersedeObjective.ts` calls `supersessionEngine.check`, applies the same-tenant rule and writes the link through the new `objectivesDB.setSupersedingObjectiveId`. `SUPERSEDE_OBJECTIVE_ACTION_CODE` is in `constants.ts` and registered. `ActionInput` gains `actorId` and `authorityBadge` (the engine's check requires them; `transitionEntity` passes the real ones). The row Active → Superseded carries `"actionCode": "supersede-objective"`. ✅ |
| 3 | `objectives` schema recovery: remove `DEFAULT 'Active'` from `status`. `objectivesDB.create` takes a required `status`. Built: `status` is `TEXT NOT NULL` with no default, and the status CHECK constraint is removed (as for Pack and Service in CR-128, because `transition_definitions` holds the states, and the CHECK still listed `Proposed`). `objectivesDB.create` takes a required `status`. The three direct `create` calls in `dependency-definition-engine.test.ts` pass `"Active"`. `createObjective` does not pass a status yet, so `tsc` fails until step 5. ✅ |
| 4 | Add `"Objective"` to `TransitionEntityType`. Add an `objectiveAdapter` (state from `status`, `setState` through `updateStatus`, tenant from `sponsoring_authority`, `addComment` through `objectivesDB.addComment`). Built: `"Objective"` was already in `TransitionEntityType`. `objectiveAdapter` is in `entityAdapters.ts` and registered; `addComment` appends to the `objectives.comments` column through `objectivesDB.addComment(id, {text, actorId, authorityBadge})`. ✅ |
| 5 | `createObjective` calls `beginBirth`, writes the initial state, and publishes the birth event with the version event as its last step. `resolveCapabilityAuthor` stops resolving the literal badge. `ensureOneShotContainer` stops passing a status literal. Built: `createObjective` calls `beginBirth` (the badge `objective_propose` comes from the birth row), writes `birth.initialState`, adds the Capabilities, then publishes `ObjectiveCreated` as its last statement with the real actor and badge. It no longer takes a `status`. `objectiveInitialState()` (core/objectives.ts) reads the state from the birth row, and every former `"Proposed"` literal in `core/objectives.ts`, `web/objectives.ts`, `demoSeed.ts`, `seedEbookLibraryObjectives.ts` and the views reads it instead (the edit page gets `editable`, the new page `initialState`; `toListItem` takes the initial state). `ObjectiveStatus` says `Defined`. `resolveCapabilityAuthor` is replaced by `resolveBirthAuthor`, also used by `updateObjective`. `ensureOneShotContainer` passes no status. Consequence (D3): every `createObjective` caller that omitted the status or passed `"Active"` now starts in `Defined`. `commissionFromForm` and `ensureOneShotContainer` produce a `Defined` Objective, and commissioning refuses an Objective that is not `Active` (`commissioning.ts:147`). 12 test files call `createObjective`; 46 test lines name an Objective status. Tests are not changed yet. ✅ |
| 6 | `transitionObjective` becomes a call to `transitionEntity`. The web route, the API route and `demoSeed.ts` call the generic function. The result shape changes (the extra reasons `comment_required` and `superseding_*` come from the policies). The buttons use `nextActionsFor`. `retireObjectiveSubtree` calls the generic function. Built: `transitionObjective` and `TransitionObjectiveResult` are deleted. The web transition route, the web create-and-supersede step, the API route, `demoSeed.ts` and `retireObjectiveSubtree` call `transitionEntity` with `context: {comment, supersedingObjectiveId}`. The API returns `row` where it returned `objective`. A refusal by the supersede action now throws (the create-and-supersede step catches it and keeps its message). The detail page buttons come from `nextActionsFor`; an action that requires a comment (Reject, Supersede) keeps its own form. The rule that a Reject comment must differ from the latest comment is dropped with the old function, as for Pack (D4 to confirm). `not_submitted` stays in the shared result type. Tests not yet updated. ✅ |
| 7 | The submit step is deleted (owner). The Activate button comes from `nextActionsFor`, and the event the transition publishes is the record, so no separate submitted record is written. Built: `submitObjective`, `isObjectiveEditLocked`, `computeEditLockedIds`, `computeSubmitInfo`, the route `POST /objectives/:id/submit` with its `route_authority` row and its redirect, the Submit buttons in the views, `editLocked`, `submitVerb` and `alreadySubmitted` on the list and detail views, `submitVerb` and `submitVersionEvent` on the row Defined → Active, and the submit grant in `demoSeed.ts` (it now grants the birth badge from the birth row). The list row shows a quick transition for the initial state when it has exactly one manual hop. `VersionCreated`, which the submit step carried, is now the `versionEvent` of the birth row (to confirm). ✅ |
| 8 | Delete the old `transitionObjective` body. `supersessionEngine` stays, because the action calls it. |

## Tests and fixtures

| Test file | Change |
|---|---|
| `objective-event-lifecycle-table.test.ts`, `objective-lifecycle.test.ts`, `objective-supersession.test.ts` | Birth row, birth refusal, comment and supersede checks as Policies, and the new result shapes. |
| All tests that call `createObjective` without a status (D3) | Use the shared helper or the birth state. Listed when D3 is answered. |
| `dependency-definition-engine.test.ts` (three direct `objectivesDB.create` calls) | Pass `status`. |
| Run `pnpm db:clean-slate` first. |

### Built (tests)

| Change | Files |
|---|---|
| `createActiveObjective(input)` (creates, then walks the Objective through the governed hop to Active) and `transitionObjective(input)` (the old call shape over `transitionEntity`) added to `tests/testFixtures.ts`. A call that passed `status: "Proposed"` is a plain `createObjective` without a status; a call that passed `"Active"` or no status is `createActiveObjective` without a status. | 12 test files (`createObjective` calls) |
| Lock tests deleted (the lock came with the submit step): the submitted-Objective lock, the subtree lock, the rejected-row lock, and the web test of the hidden Edit link. The `submitObjective` calls and the web `/submit` post are removed. | `objective-lifecycle.test.ts`, `web-flow.e2e.test.ts`, `tenant-contract.test.ts`, `governance-ebm-sharpening.test.ts`, `objective-supersession.test.ts` |
| Reject without a comment is `policy_blocked`; the repeat-comment check is removed. Supersede refusals (missing id, unknown id, other tenant) are thrown by the action and asserted with `assert.rejects`; a missing comment is `policy_blocked`. | `objective-lifecycle.test.ts`, `objective-supersession.test.ts` |
| Table test: row 1 is the birth (`None → Defined`, `ObjectiveCreated`, `VersionCreated`), the submit row is gone, create publishes the birth event with the real actor and badge, edit publishes nothing more. | `objective-event-lifecycle-table.test.ts` |
| Engine test of the Objective hop no longer exercises `not_submitted` (no seeded row has a submit step). | `engine.test.ts` |
| The API create route no longer reads `status`. The acceptance test activates the leaf through `/transition/activate` before it commissions. | `acceptance.e2e.test.ts` |
| Seeds checked: `demoSeed.ts` creates every Objective in the initial state and activates each through `transitionEntity`; `seedEbookLibraryObjectives.ts` creates them in the initial state; the demo `objectives.json` is unchanged. | seeds |

Not run. Run `pnpm db:clean-slate` first.

### Built (controls from transition definitions, D10)

| Change | Where |
|---|---|
| `NextAction` and `findPossibleNextTransitions` carry `actionCode`. | entityTransition.ts, transitionDefinitionsDB.ts |
| `retirable`, `rejectable`, `supersedable` and `canRetire/Reject/SupersedeObjective` removed. | core/objectives.ts, web/objectives.ts, views |
| Detail page renders every control from `nextActionsFor`. A kind is derived per action: Retired hop = subtree retire, `supersede-objective` action code = target picker, comment-required Policy = comment form, otherwise a plain button. Each posts to its verb route. | web/objectives.ts, detail.ejs |
| Tree rows show Retire from `retireStatuses`, the states whose Retired hop the viewer holds the badge for. | web/objectives.ts, _nodes.ejs, index.ejs |
| objective-supersession test no longer reads `supersedable`. | tests |

Not run. Re-run the Objective tests and web-flow.e2e.
