# SDK Authoring: where an existing row changes state

Scope: SDK authoring kinds (Pack, Template, Profile, Deliverable Definition, Service, Policy, Quality Gate, Capability). Births are excluded. Quality Gates are excluded.

## 1. The transition function

Every state change of an SDK authoring row is made by `transitionEntity` ([entityTransition.ts:24](../src/domain/engine/entityTransition.ts#L24)). It reads the row, evaluates the hop, runs the hop's action and writes the state through the entity adapter in one transaction. For a Pack the adapter calls `packsDB.updateStatus` ([entityAdapters.ts:137](../src/domain/engine/entityAdapters.ts#L137)). The caller publishes the returned event.

## 2. Pack hops

Source: `src/dblayer/seed/data/transitionDefinitions.json`. All Pack hops have trigger `manual`.

| From | To | Verb | Action |
|---|---|---|---|
| Draft | Validated | validate | none |
| Validated | Published | publish | none |
| Validated | Draft | reject | none (comment required) |
| Published | Active | activate | `materialise-pack` |
| Active | Retired | retire | none |
| Retired | Archived | archive | none |

## 3. Entry points

| # | Entry point | Started by | Calls |
|---|---|---|---|
| 1 | `POST /sdk/:slug/:draftId/transition` ([web/sdkAuthoring.ts:944](../src/routes/seu/web/sdkAuthoring.ts#L944)) | Action buttons on the list page | `transitionEntity` directly, with the target state from the form |
| 2 | `POST /sdk/:slug/:draftId/publish` ([web/sdkAuthoring.ts:927](../src/routes/seu/web/sdkAuthoring.ts#L927)) | The advance button on the edit page ([edit.ejs:260](../src/views/seu/sdk/authoring/edit.ejs#L260)) | `publishAuthoringDraft` |
| 3 | `publishAuthoringDraft` ([core/sdkAuthoring.ts:1264](../src/routes/seu/core/sdkAuthoring.ts#L1264)) | Entry point 2, `demoSeed.ts`, `demoSimulator.ts`, tests | `transitionEntity` per kind, lines 1275 to 1360 |
| 4 | `publishPack`, `publishTemplate`, `publishProfile` ([packs.ts:509](../src/routes/seu/core/packs.ts#L509), [templates.ts:573](../src/routes/seu/core/templates.ts#L573), [profiles.ts:538](../src/routes/seu/core/profiles.ts#L538)) | Seed scripts only | `advancePackLifecycle` and the activate functions, which call `transitionEntity` |

Callers of entry point 4 in `src`: seedTestFixturePacks, seedCapabilityPatternPacks, seedCr104Demo, seedSdlcStandardTemplates and demoSeed.

## 4. Activation

For Pack, Template, Profile and Deliverable Definition, the hop to Active is made by `activate<Kind>SupersedingPrevious`. It moves the row to Active and then moves the earlier Active version of the same code to Retired. Both moves call `transitionEntity`. Pack: [packs.ts:477](../src/routes/seu/core/packs.ts#L477). `publishAuthoringDraft` calls these at lines 1271, 1286, 1301 and 1316.

## 5. List page buttons

`computeRowActions` ([core/sdkAuthoring.ts:491](../src/routes/seu/core/sdkAuthoring.ts#L491)) returns `endpoint: "transition"` for every action of Capability, Service, Pack, Template, Profile, Policy, Quality Gate and Deliverable. The list page ([index.ejs:70-85](../src/views/seu/sdk/authoring/index.ejs#L70-L85)) posts a form to `/transition` for such an action. The list page posts to `/publish` only for an action with `endpoint: "publish"`. For the kinds above, no action has that value.

## 6. Edit page button

| Item | Behaviour | Source |
|---|---|---|
| Edit | Allowed only when the row is in the birth state (Draft). `canEdit = canDefine && isDraft`. | [web/sdkAuthoring.ts:677](../src/routes/seu/web/sdkAuthoring.ts#L677) |
| Advance button shown | `canPublish = canAdvance`. `canAdvance` is true when `nextHop` returns a hop and the user holds a badge from `requiredBadgeForRowAction(kind, status, { endpoint: "publish" })`. The status is not required to be Draft. | [web/sdkAuthoring.ts:644-678](../src/routes/seu/web/sdkAuthoring.ts#L644-L678) |
| Button label | Comes from `nextHop`: the first active row from the current status, ordered by `to_state`. | [web/sdkAuthoring.ts:617-621](../src/routes/seu/web/sdkAuthoring.ts#L617-L621), `nextVerb` at `:680` |
| Badge required | `requiredBadgeForRowAction` uses `possibleRowActions`. An action has `endpoint: "publish"` when its edge is on the canonical forward path from Draft, found by `canonicalForwardEdges`. The badge is `<entity>_<verb>` of the first such action from the current status. | [core/sdkAuthoring.ts:457-511](../src/routes/seu/core/sdkAuthoring.ts#L457-L511) |
| Same badge on the route | `requireRowActionBadge({ endpoint: "publish" })` applies the same badge check to `POST /publish`. | [web/sdkAuthoring.ts:118-134](../src/routes/seu/web/sdkAuthoring.ts#L118-L134) |
| Page for any status | `GET /sdk/:slug/:draftId` renders the form for whatever status the row has. | [web/sdkAuthoring.ts:844](../src/routes/seu/web/sdkAuthoring.ts#L844) |
| Link to the edit page | The list page shows Edit only when the status equals `editableStatus`, the birth state. | [index.ejs:67](../src/views/seu/sdk/authoring/index.ejs#L67) |
| What a click does | `publishAuthoringDraft` takes the actions from `nextActionsFor`. It refuses unless there is exactly one. | [core/sdkAuthoring.ts:1269](../src/routes/seu/core/sdkAuthoring.ts#L1269), [entityTransition.ts:105](../src/domain/engine/entityTransition.ts#L105) |

For a Pack the canonical forward edges are Draft to Validated, Validated to Published, Published to Active, Active to Retired and Retired to Archived. Validated to Draft (reject) is not on that path.

Consequence for a Pack in Validated, derived from the rows above:

| User holds | Button label | Badge check | Click result |
|---|---|---|---|
| `pack_publish` only | Reject (first row by `to_state` is Draft) | Passes (`pack_publish`) | `nextActionsFor` returns one action, Published. The Pack is published. |
| `pack_publish` and `pack_reject` | Reject | Passes | `nextActionsFor` returns two actions. The click is refused. |
| `pack_reject` only | Reject | Fails (`pack_publish` required) | The route refuses. |

The label and the action taken differ in the first row. The label comes from `nextHop` and the action from the canonical path.

## 7. Searches behind this document

| Search | Result |
|---|---|
| `grep "transitionEntity("` in `src`, comments excluded | Callers are the SDK authoring files above, the seeds, and the SEU entities. No call has `entityType: "Deliverable"`. |
| `grep "publishAuthoringDraft"` over the repository, excluding `node_modules`, `.git` and `dist` | One web route, `demoSeed.ts`, `demoSimulator.ts`, its definition, six test files, nine CR files and one traceability file. |
| `grep "publishPack(\|publishTemplate(\|publishProfile(\|advancePackLifecycle(\|advanceProfileToActive(\|advanceTemplateToActive("` in `src` | Seed scripts and the activate functions listed in section 3. |
| `grep` of `src/views` for `/publish` and `/transition` form actions | `index.ejs:72` and `:79`, `edit.ejs:260`. |

## 8. Pack view page

The Pack view pages (`src/views/seu/packs/index.ejs` and `view.ejs`) contain no POST form and no `formaction`. They have no transition buttons. Search: `grep "method=\"POST\"\|formaction" src/views/seu/packs`, no match.

-------------

Here is the difference between the two, from entityTransition.ts, transitionEngine.ts and executionEngine.ts. I left Quality Gates out, as you asked.

Checks before the change

Check	Other entities (transitionEntity)	Deliverable (evaluateDeliverableTransition)
Transition Definition exists, and the actor holds its badge	Yes	Yes
Submit step done	Yes	Yes
The hop's own required Policies: a Policy blocks, a Standard deviates	Yes	Yes
Policies of the SEU's EBM	No	Yes, evaluated before the hop's own Policies
Participant row in the SEU	Yes, for an entity inside an SEU	No
Dependency readiness (dependency engine)	No	Yes
Open Obligation on the SEU or on the Deliverable	No	Yes
Open Decision on the Deliverable	No	Yes
A Command already in flight for the same hop	No	Yes
In Progress to Approved needs an attached reference	No	Yes
The change itself

Other entities	Deliverable
Who writes the state	The adapter's setState, as the requesting actor with that actor's badge.	applyGovernedDeliverableTransition, as the SEU system actor.
Recorded	Nothing beyond the entity row.	A governance outcome row (Approved, Approved-with-Conditions or Waived) and a Command that goes to Completed.
Concurrency	One transaction covers the comment, the action and the state write.	Requests for one Deliverable are serialised, and the state is re-read first. A request whose from-state has changed is refused.
Action and comment	runAction and addComment run in the transaction.	Neither runs.
After the change	Dependency engine not called.	Dependency engine called. An attestation is created when the transition requires one.
Events	The function returns the event and the caller publishes it.	The engine publishes the hop's event and DeliverableTransitioned itself.
So the Deliverable path is the full governance and execution flow. The other entities get one authority, policy and state-change flow.

I read the code for each cell above. The Deliverable apply step has no withTransaction. I read it from line 256 to the event publishing and didn't read the rest of the function.