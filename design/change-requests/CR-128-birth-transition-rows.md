# CR-128 — Birth rows in transition_definitions

**Raised:** 2026-10-19 · **Origin:** Review of `src/routes/seu/api/reviews.ts`, where the creation badge for any of the nouns has no source in the data.

**Status:** 🟡 Raised

## Fix the following

| # | Item |
|---|---|
| 1 | `transition_definitions` holds a birth row for each entity whose creation requires authority. The row takes the entity from no state into its initial state. |
| 2 | The creation badge for a governed create is read from the birth row, not written as a literal in core. |


## Findings

| # | Finding | Reference |
|---|---|---|
| 1 | `transitionDefinitions.json` holds 157 rows. Every row is a hop from one state to another. No row has an empty from-state. | `transitionDefinitions.json` |
| 2 | Four rows start from a `Created` state: AttentionItem, ExternalInteraction, Participant and SchemaDefinition. Each is a hop out of the initial state, not the creation. | `transitionDefinitions.json` |
| 3 | Review and Finding have no row that enters `Planned` or `Open`. | `transitionDefinitions.json` |
| 4 | `transition_definitions` is unique on `(entity_type, from_state, to_state)`. The representation of an empty from-state is undefined. | schema |
| 5 | `createReview`, `createFinding` and `convertFindingToObligation` resolve the badge with the literals `review_create`, `finding_create` and `finding_convert`, similar to the Objective creation badge. This interim literal is removed when this CR is built. | `core/reviews.ts`, `core/findings.ts` |

## Transitions by entity

Source: `Events and Lifecycles.md` (chapter numbers as in that catalog). The spec rows are the lifecycle diagram or table of the chapter, read as adjacent hops plus the extra edges the chapter names. Each entity opens with its birth row (`None` into the initial state), which is absent from the JSON by definition. Rows marked "Yes (not in spec)" are in the JSON and have no counterpart in the spec text. Capability, Finding and SchemaDefinition have no lifecycle in the spec text, so all of their rows are JSON-only. Spec concepts with no entity type in the JSON (Traceability Relationship, Governance Rule, Compliance Requirement, Runtime Kernel, Event, Work Item, Security Credential, Tenant) are not listed.

| Chapter | Entity | From state | To state | In transitionDefinitions.json |
|---|---|---|---|---|
| 1 | Objective | None | Proposed | No (birth) |
| 1 | Objective | Proposed | Proposed | No |
| 1 | Objective | Proposed | Validated | No |
| 1 | Objective | Validated | Activated | No |
| 1 | Objective | Activated | Superseded | No |
| 1 | Objective | Activated | Retired | No |
| 1 | Objective | Activated | Achieved | No |
| 1 | Objective | Activated | Archived | No |
| 1 | Objective | Proposed | Active | Yes (not in spec) |
| 1 | Objective | Active | Achieved | Yes (not in spec) |
| 1 | Objective | Active | Reject | Yes (not in spec) |
| 1 | Objective | Active | Superseded | Yes (not in spec) |
| 1 | Objective | Active | Retired | Yes (not in spec) |
| 1 | Objective | Achieved | Archived | Yes (not in spec) |
| 1 | Objective | Superseded | Archived | Yes (not in spec) |
| 1 | Objective | Retired | Archived | Yes (not in spec) |
| 2 | SEU | None | Requested | No (birth) |
| 2 | SEU | Requested | Engineering Behavior Composition | No |
| 2 | SEU | Engineering Behavior Composition | Commissioned | No |
| 2 | SEU | Commissioned | Executing | No |
| 2 | SEU | Executing | Monitoring | No |
| 2 | SEU | Monitoring | Completing | No |
| 2 | SEU | Completing | Knowledge Preservation | No |
| 2 | SEU | Knowledge Preservation | Archived | No |
| 2 | SEU | Pending | Commissioned | Yes (not in spec) |
| 2 | SEU | Pending | Failed | Yes (not in spec) |
| 2 | SEU | Pending | Validated | Yes (not in spec) |
| 2 | SEU | Validated | Composed | Yes (not in spec) |
| 2 | SEU | Composed | RuntimeAllocated | Yes (not in spec) |
| 2 | SEU | RuntimeAllocated | KnowledgeInitialised | Yes (not in spec) |
| 2 | SEU | KnowledgeInitialised | ParticipantsRecruited | Yes (not in spec) |
| 2 | SEU | ParticipantsRecruited | Commissioned | Yes (not in spec) |
| 2 | SEU | Commissioned | Configured | Yes (not in spec) |
| 2 | SEU | Configured | Activated | Yes (not in spec) |
| 2 | SEU | Pending | Configured | Yes (not in spec) |
| 2 | SEU | Configured | Commissioned | Yes (not in spec) |
| 2 | SEU | Commissioned | Activated | Yes (not in spec) |
| 2 | SEU | Activated | Operational | Yes (not in spec) |
| 2 | SEU | Operational | Suspended | Yes (not in spec) |
| 2 | SEU | Suspended | Operational | Yes (not in spec) |
| 2 | SEU | Operational | Retired | Yes (not in spec) |
| 2 | SEU | Suspended | Retired | Yes (not in spec) |
| 2 | SEU | Retired | Archived | Yes (not in spec) |
| 3 | EBM | None | Composed | No (birth) |
| 3 | EBM | Composed | Validated | Yes |
| 3 | EBM | Validated | Active | Yes |
| 3 | EBM | Composed | Retired | Yes |
| 5 | Pack | None | Draft | No (birth) |
| 5 | Pack | Draft | Validated | Yes |
| 5 | Pack | Validated | Published | Yes |
| 5 | Pack | Published | Active | Yes |
| 5 | Pack | Active | Retired | Yes |
| 5 | Pack | Retired | Archived | Yes |
| 5 | Pack | Validated | Draft | Yes |
| 6 | Template | None | Draft | No (birth) |
| 6 | Template | Draft | Validated | Yes |
| 6 | Template | Validated | Published | Yes |
| 6 | Template | Published | Active | Yes |
| 6 | Template | Active | Deprecated | Yes |
| 6 | Template | Deprecated | Retired | Yes |
| 6 | Template | Retired | Archived | Yes |
| 6 | Template | Deprecated | Active | Yes |
| 6 | Template | Retired | Active | Yes |
| 6 | Template | Archived | Active | Yes |
| 7 | Profile | None | Draft | No (birth) |
| 7 | Profile | Draft | Validated | Yes |
| 7 | Profile | Validated | Published | Yes |
| 7 | Profile | Published | Active | Yes |
| 7 | Profile | Active | Deprecated | Yes |
| 7 | Profile | Deprecated | Retired | Yes |
| 7 | Profile | Retired | Archived | Yes |
| 7 | Profile | Deprecated | Active | Yes |
| 7 | Profile | Retired | Active | Yes |
| 7 | Profile | Archived | Active | Yes |
| 10 | Capability | None | Defined | No (birth) |
| 10 | Capability | Defined | Published | Yes (not in spec) |
| 10 | Capability | Published | Active | Yes (not in spec) |
| 10 | Capability | Active | Deprecated | Yes (not in spec) |
| 10 | Capability | Deprecated | Retired | Yes (not in spec) |
| 10 | Capability | Retired | Archived | Yes (not in spec) |
| 11 | Service | None | Defined | No (birth) |
| 11 | Service | Defined | Published | Yes |
| 11 | Service | Published | Active | Yes |
| 11 | Service | Active | Deprecated | Yes |
| 11 | Service | Deprecated | Retired | Yes |
| 11 | Service | Retired | Archived | Yes |
| 13 | Participant | None | Created | No (birth) |
| 14 | CR-127 proceeds in parallel with this CR. No lifecycle state is assigned as a literal in code. The state written at creation is the `to_state` of the entity's birth row. The state written by a hop is the `to_state` of the resolved transition row. Comparisons against state literals are outside this row. |
| 13 | Participant | Created | Available | Yes |
| 13 | Participant | Available | Assigned | Yes |
| 13 | Participant | Assigned | Executing | Yes |
| 13 | Participant | Executing | Idle | Yes |
| 13 | Participant | Idle | Released | Yes |
| 13 | Participant | Released | Archived | Yes |
| 13 | Participant | Idle | Assigned | Yes |
| 13 | Participant | Available | Released | Yes (not in spec) |
| 13 | Participant | Assigned | Released | Yes (not in spec) |
| 13 | Participant | Executing | Released | Yes (not in spec) |
| 15 | Deliverable | None | Defined | No (birth) |
| 15 | Deliverable | Defined | Planned | No |
| 15 | Deliverable | Planned | In Progress | No |
| 15 | Deliverable | In Progress | Under Review | No |
| 15 | Deliverable | Under Review | Approved | No |
| 15 | Deliverable | Approved | Baselined | Yes |
| 15 | Deliverable | Baselined | Superseded | No |
| 15 | Deliverable | Superseded | Archived | No |
| 15 | Deliverable | Defined | In Progress | Yes (not in spec) |
| 15 | Deliverable | In Progress | Approved | Yes (not in spec) |
| 15 | Deliverable | Draft | Validated | Yes (not in spec) |
| 15 | Deliverable | Validated | Published | Yes (not in spec) |
| 15 | Deliverable | Published | Active | Yes (not in spec) |
| 15 | Deliverable | Active | Deprecated | Yes (not in spec) |
| 15 | Deliverable | Deprecated | Retired | Yes (not in spec) |
| 15 | Deliverable | Retired | Archived | Yes (not in spec) |
| 15 | Deliverable | Deprecated | Active | Yes (not in spec) |
| 15 | Deliverable | Retired | Active | Yes (not in spec) |
| 15 | Deliverable | Archived | Active | Yes (not in spec) |
| 16 | Knowledge | None | Observed | No (birth) |
| 16 | Knowledge | Observed | Proposed | Yes |
| 16 | Knowledge | Proposed | Validated | Yes |
| 16 | Knowledge | Validated | Accepted | Yes |
| 16 | Knowledge | Accepted | Published | Yes |
| 16 | Knowledge | Published | Deprecated | Yes |
| 16 | Knowledge | Deprecated | Archived | Yes |
| 16 | KnowledgeScope | None | SEU | No (birth) |
| 16 | KnowledgeScope | SEU | Capability | Yes |
| 16 | KnowledgeScope | Capability | Enterprise | Yes |
| 16 | KnowledgeScope | Enterprise | Platform | Yes |
| 17 | Evidence | None | Collected | No (birth) |
| 17 | Evidence | Collected | Validated | Yes |
| 17 | Evidence | Validated | Accepted | Yes |
| 17 | Evidence | Accepted | Referenced | Yes |
| 17 | Evidence | Referenced | Archived | Yes |
| 17 | Evidence | Collected | Rejected | Yes (not in spec) |
| 17 | Evidence | Validated | Rejected | Yes (not in spec) |
| 18 | Ontology | None | Active | No (birth) |
| 18 | Ontology | Active | Deprecated | Yes |
| 18 | Ontology | Deprecated | Retired | Yes |
| 18 | Ontology | Retired | Archived | Yes |
| 18 | Ontology | Draft | Active | Yes (not in spec) |
| 18 | Ontology | Draft | Draft | Yes (not in spec) |
| 19 | Decision | None | Identified | No (birth) |
| 19 | Decision | Identified | Analysed | Yes |
| 19 | Decision | Analysed | Proposed | Yes |
| 19 | Decision | Proposed | Reviewed | Yes |
| 19 | Decision | Reviewed | Approved | Yes |
| 19 | Decision | Approved | Applied | Yes |
| 19 | Decision | Applied | Superseded | Yes |
| 19 | Decision | Superseded | Archived | Yes |
| 23 | Obligation | None | Identified | No (birth) |
| 23 | Obligation | Identified | Analysed | Yes |
| 23 | Obligation | Analysed | Assigned | Yes |
| 23 | Obligation | Assigned | In Progress | Yes |
| 23 | Obligation | In Progress | Resolved | Yes |
| 23 | Obligation | Resolved | Verified | Yes |
| 23 | Obligation | Verified | Closed | Yes |
| 23 | Obligation | Closed | Archived | Yes |
| 23 | Obligation | Closed | Reopened | Yes |
| 23 | Obligation | Reopened | In Progress | Yes |
| 23 | Obligation | Identified | Escalated | Yes |
| 23 | Obligation | Analysed | Escalated | Yes |
| 23 | Obligation | Assigned | Escalated | Yes |
| 23 | Obligation | In Progress | Escalated | Yes |
| 23 | Obligation | Resolved | Escalated | Yes |
| 23 | Obligation | Verified | Escalated | Yes |
| 24 | Policy | None | Draft | No (birth) |
| 24 | Policy | Draft | Validated | Yes |
| 24 | Policy | Validated | Published | Yes |
| 24 | Policy | Published | Active | Yes |
| 24 | Policy | Active | Deprecated | Yes |
| 24 | Policy | Deprecated | Retired | Yes |
| 24 | Policy | Retired | Archived | Yes |
| 25 | Review | None | Planned | No (birth) |
| 25 | Review | Planned | Prepared | Yes |
| 25 | Review | Prepared | In Progress | Yes |
| 25 | Review | In Progress | Completed | Yes |
| 25 | Review | Completed | Accepted | Yes |
| 25 | Review | Accepted | Archived | Yes |
| 25 | Finding | None | Open | No (birth) |
| 25 | Finding | Open | Resolved | Yes (not in spec) |
| 25 | Finding | Open | Waived | Yes (not in spec) |
| 34 | AttentionItem | None | Created | No (birth) |
| 34 | AttentionItem | Created | Delivered | Yes |
| 34 | AttentionItem | Delivered | Acknowledged | Yes |
| 34 | AttentionItem | Acknowledged | In Progress | Yes |
| 34 | AttentionItem | In Progress | Resolved | Yes |
| 34 | AttentionItem | Resolved | Closed | Yes |
| 36 | ExternalInteraction | None | Created | No (birth) |
| 36 | ExternalInteraction | Created | Validated | Yes |
| 36 | ExternalInteraction | Validated | Dispatched | Yes |
| 36 | ExternalInteraction | Dispatched | Acknowledged | Yes |
| 36 | ExternalInteraction | Acknowledged | Completed | Yes |
| 36 | ExternalInteraction | Completed | Archived | Yes |
| 36 | ExternalInteraction | Dispatched | Failed | Yes (not in spec) |
| — | SchemaDefinition | None | Created | No (birth) |
| — | SchemaDefinition | Created | Validated | Yes (not in spec) |
| — | SchemaDefinition | Validated | Tested | Yes (not in spec) |
| — | SchemaDefinition | Tested | Packaged | Yes (not in spec) |
| — | SchemaDefinition | Packaged | Published | Yes (not in spec) |
| — | SchemaDefinition | Packaged | PublicationRejected | Yes (not in spec) |

## Design

| # | Decision |
|---|---|
| 1 | The birth row stores the reserved from-state `None`. The column stays `NOT NULL`. A null would make the unique index treat every birth row as distinct. A partial unique index `transition_definitions_one_birth_per_entity` on `(entity_type) WHERE from_state = 'None'` holds each entity to one birth row. The index is declared in `transition_definitions_schema_recovery.sql`. |🟡 Not executed. 
| 2 | `BIRTH_STATE = "None"` is added to `src/dblayer/constants.ts`. This is the only place the literal appears. | ✅
| 3 | `transitionDefinitions.json` gains one birth row for each of the 22 entity types it holds: SEU, EBM, Deliverable, Objective, Obligation, Evidence, Knowledge, Decision, KnowledgeScope, AttentionItem, ExternalInteraction, Pack, Participant, Review, Finding, Template, Profile, Service, Capability, Policy, Ontology and SchemaDefinition. Each row goes from `None` into the entity's initial state. The verb is the entity's existing creation verb, and `event_type` is the event its create path already publishes. The build pass lists the initial state, verb and event for each entity before the rows are written. |
| 4 | The version columns on a birth row follow the Version Feature Plan. A versioned entity gets `version_event` `VersionCreated` on its birth row. An unversioned entity leaves the version columns null. |
| 5 | The creation badge of each entity is `{noun}_{verb}` from the birth row verb, for example `review_create` and `finding_create`. |
| 6 | `transitionDefinitionsDB.findBirth(entityType)` is added. It selects the row where `from_state = BIRTH_STATE` and returns `to_state`, `verb` and `event_type`. |
| 7 | Each governed create path reads the badge, the initial state and the event name from its entity's birth row. The creation badge literals and the literal initial states are removed from core. A missing birth row throws. |
| 8 | `seedTransitionDefinitions.ts` needs no new branch. `None` is an ordinary `fromState`, and the noun and verb pair check covers the new rows. |
| 9 | No entity is ever in state `None`. `findPossibleNextStates` and the transition buttons never return a birth row. The admin transition listings show it, with the from-state displayed as `<None>`. The label is built from `BIRTH_STATE`. |
| 10 | Each creation badge is already granted under its present code. A birth row whose verb changes a badge code requires a grant and fixture update, which the build pass lists. |
| 11 | The four `Created` rows are unchanged. `Created` is a real state on those entities. |
| 12 | `convert` is added to `verbs` in `authorityVocabulary.json`. `transitionDefinitions.json` gains a Finding row `Open → Converted`, verb `convert`, and `convertFindingToObligation` moves the Finding into `Converted` through that row. The badge `finding_convert` comes from the row. |
| 13 | `authoringMappings` is removed from `authorityVocabulary.json` and from the seed. Every noun and verb pair derives from `transitionDefinitions.json`. The mappings `Objective propose`, `Knowledge observe`, `Decision identify` and every `{noun}_define` for an entity with states are covered by birth rows. The `{noun}_publish` pairs for Pack, Template, Profile and Deliverable are already transition verbs. |

## Shared birth helper

Every governed create does the same four things. Only the entity name differs. The steps are written once, in `transitionEngine`, and each entity's create function calls them.

`transitionEngine.beginBirth({ entityType, actorId, entityId?, seuId?, context? })`

| # | What it does |
|---|---|
| 1 | Finds the birth row of the entity with `transitionDefinitionsDB.findBirth`. It throws if the entity has no birth row. |
| 2 | Runs the normal `evaluate` from the birth row's `from_state` to its `to_state`. The badge, the policies and the quality gates on the row are checked in the same way as for any other transition. |
| 3 | Throws if the result is not allowed, and throws if the row has no verb or no event. |
| 4 | Returns `initialState` (the `to_state`), `authorityBadge`, `eventType` and `versionEvent`. |

The caller then writes its row with `initialState` and `authorityBadge` as the state and author badge, and as the last step publishes `eventType` with the actor and badge. The helper does not write the row or publish, because only the caller knows the new row id, the SEU, the tenant and the event payload. Nothing runs after the publish.

The seed does not call the helper. It calls `transitionDefinitionsDB.findBirth` once, before its loop, and uses the `to_state` of the row for every row it writes.

## Entity 1: SchemaDefinition (Chapter 39, SEU Design Kit)

Chapter 39 section 15 lists six events: `SDKElementSchemaCreated`, `Validated`, `Tested`, `Packaged`, `Published` and `PublicationRejected`. The JSON has the hops for the last five. It has no row for the first one. The Chapter 39 heading in `Events and Lifecycles.md` still lists older Pack events and is out of date.

This step covers the creation of a SchemaDefinition. The later hops (Validated, Tested, Packaged, Published, PublicationRejected) are a following step, once the creation change is agreed.

### Step 1: the data

| # | Change |
|---|---|
| 1 | Add a birth row to `transitionDefinitions.json`: SchemaDefinition, from `None` to `Created`, verb `create`, trigger `manual`, event `SDKElementSchemaCreated`, no version event. |✅
| 2 | In `transitionDefinitions.json`, write `"trigger": "manual"` on `Packaged → Published` and `Packaged → PublicationRejected`. Both rows omit the trigger today, and the seed treats an omitted trigger as `manual`. The loop in Step 4 stops at `Packaged` because these two rows are not `governed`. | ✅
| 3 | In `schema_definitions_schema_recovery.sql`, remove `DEFAULT 'Created'` from `lifecycle_state`. The column stays `NOT NULL`, so a row can no longer be written without a state. | ✅

### Step 2: the database function

| # | Change |
|---|---|
| 1 | `schemaDefinitionsDB.create` stops filling in `'Created'` when no state is given. The caller passes the state, and it is the `to_state` of the birth row. `create` stays a plain writer and does not look anything up. | ✅
| 2 | A new `transitionDefinitionsDB.findBirth(entityType)` returns the birth row of an entity. The birth helper uses it, and the seed calls it directly. | ✅

### Step 3: call site A, the seed

Today `seedSchemaDefinitions.ts` calls `create` for each baseline schema with `seed.lifecycle_state`. The seed data never sets that field, so the SQL default has been giving every baseline schema the state `Created`.

| # | Change |
|---|---|
| 1 | The seed calls `transitionDefinitionsDB.findBirth` once, before the loop. `transitionDefinitions` is seeded just before it in `cleanSlate.ts`, so the row exists. |
| 2 | Every baseline schema is written with the `to_state` of that row. The stored value stays `Created`. |
| 3 | The seed does not publish the creation event. It writes with the seed actor's author badge, as it does today. |

### Step 4: call site B, the UI

The UI path is the form that posts to `/sdk/schema-registry/publish` in `web/schemaRegistry.ts`. The handler calls `createSchemaVersion` in `core/schemaRegistry.ts`, which calls `create`. The handler needs no change. Inside `createSchemaVersion`:

| # | Today | After |
|---|---|---|
| 1 | The badge is looked up with the fixed name `schemadefinition_create`. | The function calls `transitionEngine.beginBirth` for `SchemaDefinition` and uses the badge it returns. |
| 2 | `create` fills in `Created` itself. | The function passes `initialState` to `create`. |
| 3 | No creation event is published. | The function publishes `eventType` last, with the actor and badge. |
| 4 | The three automatic hops (Created, Validated, Tested, Packaged) run from a fixed list of from-states and to-states. | The function calls the existing `transitionDefinitionsDB.findPossibleNextTransitions(entityType, fromState)`, keeps the rows whose trigger is `governed`, and calls `transitionEntity` for each pair. It repeats until the state has no governed next transition. The hop order is the data. |

### Step 5: the manual hops (Publish and Reject)

The page and the route follow the data and call the generic function. The old `publishSchemaVersion`, `rejectSchemaVersion` and `transitionPackagedSchema` are no longer called from SchemaDefinition. They are deleted at the end, with the other old copies.

| # | Where | Today | After |
|---|---|---|---|
| 1 | Detail page | The buttons show when the state equals `Packaged`. | The page shows one button for each entry of `nextActionsFor("SchemaDefinition", state, actorId)`. The button label is the verb. |
| 2 | Button | Two forms post to two fixed routes, `/publish` and `/reject`. | Each button posts its target state to one new route, `POST /sdk/schema-registry/:id/transition`. |
| 3 | New route | None. | The handler reads the actor with `requireActorId(req)` and calls `transitionEntity`. It has a controller, a `route_authority` row, a ViewModel with its `attachVM` registration and a `redirects.ts` entry, as in the `new-route` skill. |
| 4 | Event name | If a row has no event, the code makes up a name such as `SchemaDefinitionPublished`. | The generic function publishes `Undefined` and `SDKAttention`. |

### Step 6: the author

`transitionEntity` takes `actorId` and does not take a badge. The badge comes from the `evaluate` result, which calls `badgeAuthorityEngine.resolveAuthorBadge`, as set out in the `author-id-badge` skill. The author id is the actor id. The route reads it with `requireActorId(req)`. The old schema code resolved the author two different ways, and the generic function replaces both.

### SchemaDefinition tests

Two files already cover the SchemaDefinition path. Each existing test is changed to follow the new code, and a test is added only where nothing covers the case. The tests are not run in this pass.

`tests/schema-definition-event-lifecycle-table.test.ts`:

| # | Existing test | Change |
|---|---|---|
| 1 | DEFINITION: every row matches Chapter 39 section 15 | The expected list gains the birth row `None → Created`. It also expects the trigger `manual` on both `Packaged` rows. |
| 2 | DEFINITION: `route_authority` gates the publish and reject routes | It checks the new `POST /sdk/schema-registry/:id/transition` row in place of the two old routes. |
| 3 | DRIVEN: `createSchemaVersion` auto-advances, one event per hop | It also expects `SDKElementSchemaCreated` first and the row stored as `Created` before the hops. |
| 4 | DRIVEN: publish | It calls `transitionEntity` with target `Published`. |
| 5 | DRIVEN: reject | It calls `transitionEntity` with target `PublicationRejected`. |
| 6 | GUARD: only fires from Packaged | It calls `transitionEntity` and expects a refusal for a target that is not a next transition. |
| 7 | AUTHORITY: an actor without the badge is denied | It calls `transitionEntity`. |
| 8 | AUTHORITY: an unknown id is rejected | It expects `not_found` from `transitionEntity`. |

Added to the same file, because nothing covers them:

| # | New test |
|---|---|
| 9 | Birth: an actor without `schemadefinition_create` is refused when creating a schema. |
| 10 | Birth: `createSchemaVersion` throws when the birth row is missing. |
| 11 | Buttons: `nextActionsFor` for `Packaged` returns Publish and Reject for a holder of both badges and only the held one otherwise. It returns nothing for `Created`, whose next hop is `governed`. |
| 12 | `transitionEntity`: a row with no event publishes `Undefined` and then `SDKAttention`. |
| 13 | `transitionEntity`: an entity with no adapter throws. |

`tests/schema-registry.test.ts`:

| # | Case |
|---|---|
| 14 | Added: after the seed, every baseline schema is stored with the birth row's `to_state`. |

The fixture `freshCreatedSchema` passes the birth row's `to_state` to `create`.

## Implemented policies

Some entity rules cannot be written as a data condition, because they need a database lookup. The first is the Capability rule that a composable value must exist in the Ontology before the Capability is published. The rules in the old copies (see "Rules found in the old copies, not built now") move here one at a time, as each entity moves.

| # | Design |
|---|---|
| 1 | A rule of this kind is a Policy. Its JSON file in `src/dblayer/seed/data` has `constraintType` `Policy` and a `governingCondition` of `{ "type": "implemented" }`. The policy code selects the function. |
| 2 | The function lives in the new folder `src/policies/`, one file per policy, named after the code. It is async and takes the entity type, entity id and context. It returns pass or fail. It changes nothing. |
| 3 | A registry in `src/policies/index.ts` maps the policy code to its function. A policy of type `implemented` whose code is not in the registry throws, so a policy is never skipped by mistake. |
| 4 | The transition row lists the policy in `requiredPolicyCodes`, as for any policy. `seedTransitionDefinitions` already turns the code into the policy id in `required_policy_ids`, so the seed needs no change. |
| 5 | `transitionEngine.evaluate` already loads each required policy. For a condition of type `implemented` it awaits the registry function. For every other condition it keeps calling the synchronous `evaluateCondition`, which is unchanged. The events `PolicyApplied`, `PolicyViolated` and `StandardPolicyDeviation`, and the refusal on a `Policy` constraint, work as they do today. |
| 6 | Every route reaches the rule through `transitionEntity`, so the transition route and the publish route cannot differ. |
| 7 | A new entity reuses a rule by listing its code on its own transition row. A new rule is a new file in `src/policies/`, a registry entry and a JSON policy. |

## Entity 2: Capability (Chapter 2, with CR-126)

The entity type `Capability` in `transition_definitions` is the Capability Definition. Its table is `capability_definitions` and its state column is `status`. CR-126 settled the rows after creation (`Defined → Published → Active → Deprecated → Retired → Archived`) and settled that `CapabilityRegistered` is published after creation. This CR adds the birth row and makes the code read it.

### Step 1: the data

| # | Change |
|---|---|
| 1 | Add a birth row to `transitionDefinitions.json`: Capability, from `None` to `Defined`, verb `define`, trigger `manual`, event `CapabilityRegistered`, no version event (CR-126 decided none for now). The badge becomes `capability_define`, the badge the code looks up today. | ✅
| 2 | Write `"trigger": "manual"` on the five existing Capability rows, so the data says so and the seed default is not relied on. | ✅
| 3 | In `capability_definitions_schema_recovery.sql`, remove `DEFAULT 'Defined'` from `status`. The column stays `NOT NULL`. | ✅

### Step 2: the database function

| # | Change |
|---|---|
| 1 | `capabilityDefinitionsDB.createDraft` stops writing the literal `'Defined'`. It takes a required `status` and writes it. | ✅

### Step 3: the three places that create a Capability Definition

All three call `createDraft` and then publish `CapabilityRegistered` with a literal event name.

| # | Place | Today | After |
|---|---|---|---|
| 1 | `seedCapabilityDefinitions.ts` | Creates row by row, publishes `CapabilityRegistered`, then calls `transitionCapabilityDefinition` for Published and Active. | Calls `findBirth("Capability")` once before the loop and writes every row with its `to_state`. Publishes `birth.eventType`. The two hops use `transitionEntity`. | ✅
| 2 | `createAuthoringDraft` in `core/sdkAuthoring.ts` (the UI) | Takes `authorBadge` from the web route and publishes the literal event. | Calls `transitionEngine.beginBirth` for `Capability`, writes `birth.initialState` and `birth.authorityBadge`, and publishes `birth.eventType` last. The route already passes `actorId`. | ✅
| 3 | `copyCapabilityDefinitionAsNewDraft` | Takes `authorBadge` as an argument and publishes the literal event. | Same as place 2. The copy is a creation, so it uses the same birth row. | ✅

The seed does not publish through `beginBirth`, as in Entity 1 (the seed calls `findBirth` directly).

### Step 4: the hops

| # | Change |
|---|---|
| 1 | The direct callers of `transitionCapabilityDefinition` (the seed, `web/sdkAuthoring.ts` line 991 and the tests) call `transitionEntity`. The old function, `advanceCapabilityDefinitionOneStep` and `AUTHORING_NEXT_STATE` had no callers left and are deleted now, because they held the only `CapabilityDefinition*` event name. No Capability event uses that prefix, and every Capability event carries `originatingObjectType` `Capability`. | ✅
| 2 | The buttons on the SDK authoring page for a Capability come from `nextActionsFor("Capability", status, actorId)` instead of `computeRowActions`, and each button posts its target state to the transition route, which calls `transitionEntity`. The other six kinds keep `computeRowActions` until they move. | In this pass `computeRowActions` keeps one Capability branch that filters its list through `nextActionsFor` (the publish/transition endpoint choice is kept, because the publish endpoint runs the composable check). The branch goes when the other six kinds move. ✅
| 2a | `AUTHORING_NEXT_STATE` and `advanceCapabilityDefinitionOneStep` (a fixed list of next states) are replaced by `nextActionsFor` where a next step is needed. `advanceCapabilityDefinitionOneStep` is still called by the shared publish step at `core/sdkAuthoring.ts` line 1229, so it is deleted only when that step no longer calls it. | The publish step now calls `transitionEntity`; the function is unused and stays until the final cleanup. ✅
| 3 | An adapter for `Capability` is added to `entityAdapters.ts`: `findById` from `capabilityDefinitionsDB`, state from `status`, `setState` from `updateStatus`, tenant from the row's `tenant_id`. | ✅
| 4 | The composable-value check at Defined to Published (CR-126 item 3) moves out of the publish step into an implemented policy, `policy-ontology-values-present`, described in "Implemented policies" and built in Step 5. |

### Step 5: the composable-value policy

| # | Change |
|---|---|
| 1 | Add `policy-ontology-values-present.json` (Policy constraint, condition type `implemented`) to the policy seed data. | ✅ It is also listed in `platform-governance-baseline.pack.json`, which is how the Policy becomes a row the engine can load, and in the file list of `seedPolicyDefinitions.ts`.
| 2 | Add `src/policies/index.ts` (the registry) and `src/policies/ontologyValuesPresent.ts`. The function loads the Capability by id, loads the schema version the row pinned in `schema_definition_id` (not the latest version) and calls `validateComposableFieldsAgainstSchema` with that schema and the values of `code`, `category` and `roles`. It fails when the result has errors, and it fails when the row has no pinned schema. | ✅
| 3 | `transitionEngine.evaluate` awaits the registry function for a condition of type `implemented`. | ✅
| 4 | Add `"policy-ontology-values-present"` to `requiredPolicyCodes` of the Capability publish row in `transitionDefinitions.json`. Step 6 moves that row to `Validated → Published`. | ✅
| 5 | Remove the composable check from the Capability branch of `publishAuthoringDraft`. The seed publishes through `transitionEntity`, but the baseline Capabilities are seeded before the platform governance Pack is installed, so the Policy is not yet a loadable row and the seed publish is not checked by it. The old publish step never checked them either, since the seed called `transitionCapabilityDefinition`. ✅
| 6 | The `computeRowActions` Capability branch stays. It is the `nextActionsFor` filter agreed under Step 4, and the publish endpoint still runs the other draft checks (`validateCapabilityDefinitionSeed`). ✅

### Step 6: the Validated state and the generic schema policy

Decision (supersedes CR-126 items 1 and 3 for Capability): a Capability Definition gains the state `Validated` between `Defined` and `Published`. CR-126 had left it out, and Chapter 41 section 9 has it. A second implemented policy, `policy-validate-schema`, applies to every kind in `SCHEMA_ENTITY_KINDS`. It validates the draft's content against the schema version pinned in `schema_definition_id`. `policy-ontology-values-present` stays a separate policy for publish.

| # | Change |
|---|---|
| 1 | `transitionDefinitions.json`: add `Defined → Validated`, verb `validate`, trigger `manual`, event `CapabilityValidated`, version event `VersionValidated`, policy `policy-validate-schema`. | ✅
| 2 | `transitionDefinitions.json`: replace `Defined → Published` with `Validated → Published` (same verb, event and version event). Its policies are `policy-validate-schema` and `policy-ontology-values-present`. | ✅
| 3 | Add `policy-validate-schema.json` (Policy constraint, condition type `implemented`, transitions `Capability|Defined|Validated` and `Capability|Validated|Published`), list it in `seedPolicyDefinitions.ts` and in `platform-governance-baseline.pack.json`. | ✅
| 4 | Move `policy-ontology-values-present` from `Capability|Defined|Published` to `Capability|Validated|Published` in its JSON. | ✅
| 5 | Add `src/policies/validateSchema.ts` and its registry entry. It reads the entity row through the entity adapter, loads the pinned schema, and validates the content with the schema compiler used by the authoring form. It reads the schema, not the kind, so the other six kinds use it by listing the code on their own rows. It fails when the row has no pinned schema. | ✅
| 6 | Add `Validated` to the status type of `CapabilityDefinitionRow` in `seuTypes.ts`. The SQL has no state check. | ✅
| 7 | The seed hops become Validated, Published, Active. | ✅
| 8 | `publishAuthoringDraft` loses the `validateCapabilityDefinitionSeed` call, because `policy-validate-schema` replaces it. The parent-must-be-Active rule inside that function stays in the creation path, where `createAuthoringDraft` already calls the function. Decided. | ✅
| 9 | The `computeRowActions` Capability branch and the publish/transition split go. Every Capability button is a plain transition through `transitionEntity`. | Built as: the Capability branch returns the `nextActionsFor` list with every button as a plain transition. ✅
| 10 | The badge `capability_validate` appears in the authority vocabulary, derived from the new row. The test and demo identities that hold `capability_publish` are checked for the new badge. | Checked: no seed or test identity grants `capability_publish`, so nothing else needs the new badge. ✅

### Step 7: policy ids from both tables

`required_policy_ids` on a transition row holds the id of a Policy Definition at seed time. A row appears in `policies` only when a Pack that lists the Policy is installed. A first version appended that id to the transition rows (`backfillPolicyCode`); it is removed (see the fixes found by the first full test run), because it attached every per-hop copy to every row. The engine reads both tables and expands a definition for the hop being run.

| # | Change |
|---|---|
| 1 | `transitionEngine.evaluate` loads each id in `required_policy_ids` from `policies` and, for an id not found there, from `policy_definitions` (a new `policyDefinitionsDB.findByIds`). | ✅
| 2 | The two kinds are reduced to one list of checks. A materialised row (`policies`) contributes its `condition` and `constraint_type`. A definition contributes the `governingCondition` of the condition entry whose `applicabilityDeliverables.transitions` lists `Entity\|From\|To` of the current hop, and the `constraint_type` of the definition. A definition with no entry for this hop contributes no check. | ✅
| 3 | Dedupe: a definition is dropped when a materialised row for the same code is in the list. The materialised code is the Policy code, or the Policy code followed by `::` when the Policy fans out, so the match is on the text before the first `::`. | ✅
| 4 | The fan-out rule that picks the matching transition moves out of `packs.ts` (`governedTransitionsFor`) into one shared function. The Pack install and the engine both call it. | Built in `src/domain/engine/policyChecks.ts`, which also holds `loadPolicyChecks`. ✅
| 5 | `PolicyApplied`, `PolicyViolated` and `StandardPolicyDeviation` carry the id of whichever table the policy was read from. | ✅
| 6 | After this step the Capability seed hops (Validated, Published) are checked by `policy-validate-schema` and `policy-ontology-values-present`. The seed already fails on a refused hop. | ✅

### Capability tests

All Capability tests are in `tests/capability-definition-event-lifecycle-table.test.ts`. Each existing test is changed, and a test is added only where nothing covered the case. Built. Run by the owner after `db:clean-slate`, clean. The stale test "an unregistered code is rejected at write time" was deleted, because `code` is composable and the bad-code policy test covers it.

| # | Test | Covers |
|---|---|---|
| 1 | Definition table (changed) | The seven rows (birth, Validate, Publish, Activate, Deprecate, Retire, Archive): verb, manual trigger, event, version event, and the policies on the Validate and Publish rows. `Defined → Published` must not exist. |
| 2 | Birth, seeded rows (added) | The birth row is `None → Defined`. A seeded Capability published Registered, Validated, Published and Activated. |
| 3 | Birth, refusal (added) | Copy is refused without `capability_define` and no row is written. |
| 4 | Creation through copy (changed) | The row is stored with the birth `to_state`, and `CapabilityRegistered` carries the real actor and badge. |
| 5 | Hops (changed) | Validate, Publish, Activate, Deprecate, Retire and Archive each publish their event through `transitionEntity`. The final state is Archived. |
| 6 | Guard (added) | Defined to Published and a repeat Validate return `no_transition_definition`. |
| 7 | Authority (added) | Validate is refused without `capability_validate`. |
| 8 | Policy, no pinned schema (added) | `policy-validate-schema` refuses Validate. |
| 9 | Policy, bad code (added) | A code not in the Ontology cannot reach Published, and `PolicyViolated` is published. |
| 10 | Policy lookup (added) | `loadPolicyChecks` reads a definition id for its own hop only and drops it when a materialised row of the same code is listed. |
| 11 | Policy registry (added) | An `implemented` policy with no function throws. |
| 12 | Buttons (added) | `nextActionsFor` and `computeRowActions` offer Validate to a holder and nothing otherwise, and the buttons are plain transitions. |
| 13 | Regression tests (changed) | The remaining `createDraft` calls pass the birth `status`. |

`tests/capability-requested-fulfilment.test.ts` has no `createDraft` call and needs no change.

## Entity 3: Service Definition 

The entity type `Service` in `transition_definitions` is the Service Definition. Its table is `service_definitions` and its state column is `status`. The lifecycle gains a `Validated` state between Defined and Published, as Capability did: `Defined → Validated → Published → Active → Deprecated → Retired → Archived`, plus a reject hop `Validated → Defined`. Chapter 11 §14 names `ServiceDefined` as the creation event. Events and Lifecycles.md row 1 records that no code fires it. The owner chose `ServiceDefined` for the birth row.

### Step 1: the data

| # | Change |
|---|---|
| 1 | Add a birth row to `transitionDefinitions.json`: Service, from `None` to `Defined`, verb `define`, trigger `manual`, event `ServiceDefined`, no version event. The badge becomes `service_define`. ✅ |
| 2 | Replace the row `Defined → Published` with three rows: `Defined → Validated` (verb validate), `Validated → Published` (verb publish) and `Validated → Defined` (verb reject). Both forward rows carry `policy-validate-schema`. Write `"trigger": "manual"` on every Service row. ✅ |
| 2a | Add `"Validated"` to `ServiceDefinitionStatus` in `seuTypes.ts`. ✅ |
| 2b | Events are named `Service*`, not `ServiceDefinition*`: `ServiceDefined`, `ServiceValidated`, `ServiceRejected`, `ServicePublished`, `ServiceActivated`, `ServiceDeprecated`, `ServiceRetired`, `ServiceArchived`. The old names appear only in `transitionDefinitions.json`, the two Service docs and the Service lifecycle test, so the rename is local. ✅ |
| 2c (comment policy on the reject row is attached in Step 6, with its implementation; the comments column is added here) | The reject row `Validated → Defined` carries a new policy, `policy-comment-required`: the transition is refused unless a comment accompanies it. Comments are additive, like Objective comments: each one is an entry with text, actor, badge and time, and none is edited or removed. They are stored in a `comments` JSON column on `service_definitions` (`NOT NULL DEFAULT '[]'`), appended with `comments = comments || $1::jsonb`. The adapter gains an optional `addComment`, so another entity can add the same column later. The copy starts with an empty list. |
| 2d | The Service schema has no `x-ontology-composable` field. Its Ontology fields (`inputs`, `outputs`, `consumers`, `capabilityCode`) are the referential `x-ontology` kind, which `policy-validate-schema` already checks. `policy-ontology-values-present` is therefore not used for Service. |
| 3 | In the `service_definitions` schema recovery file, remove `DEFAULT 'Defined'` from `status` and the status CHECK constraint (as for Capability), and add `comments JSONB NOT NULL DEFAULT '[]'`. ✅ |

### Step 2: the database function

| # | Change |
|---|---|
| 1 | `serviceDefinitionsDB.createDraft` stops writing the literal `'Defined'`. It takes a required `status` and writes it. | ✅ |

### Step 3: the three places that create a Service Definition

| # | Place | After |
|---|---|---|
| 1 | `seedServiceDefinitions.ts` | Calls `findBirth("Service")` once before the loop (throws if missing or no event), writes every row with `to_state`, publishes `birth.event_type` with `originatingObjectType: "Service"`. The two hops use `transitionEntity`. ✅ |
| 2 | `createAuthoringDraft` (Service branch) | Calls `transitionEngine.beginBirth` for `Service`, writes the initial state and badge, publishes the event last. ✅ |
| 3 | `copyServiceDefinitionAsNewDraft` | Same as place 2. The `authorBadge` parameter is removed. ✅ |

### Step 4: the hops

| # | Change |
|---|---|
| 1 | Add a `serviceAdapter` to `entityAdapters.ts` (findById, state from `status`, `setState` via `updateStatus`, tenant from the row, schema id and content). ✅ |
| 2 | The seed, `web/sdkAuthoring.ts` and the shared publish step call `transitionEntity`. The publish step uses `nextActionsFor` and requires exactly one next step. From Validated there are two (publish and reject), so the publish step reports "more than one next step, choose one" and the buttons, which use the transition endpoint, are the way to move. The validation of the content moves out of the publish step into `policy-validate-schema`, as for Capability; creation and save still run `validateServiceDefinitionSeed`. ✅ |
| 3 | Delete `transitionServiceDefinition`, `advanceServiceDefinitionOneStep` and `AUTHORING_NEXT_STATE` once no caller is left. Every Service event carries `originatingObjectType` `Service`, not `ServiceDefinition`. ✅ |
| 4 | `computeRowActions` gets a Service branch that maps `nextActionsFor`, as Capability does. ✅ |

### Step 5: the service-name Ontology concept (settled)

`transitionServiceDefinition` writes to the `service-name` Ontology list: it adds or updates the concept on entering Active and retires it on leaving Active. The Ontology owns the service names and a Service Definition's code must already be in the list, so this write runs in the wrong direction and is removed. It goes away when `transitionServiceDefinition` is deleted in Step 4. The generic function needs no hook and no subscriber. `syncOntologyOnActivate` and `demoteOntologyIfNoOtherActive` are deleted with it.

### Step 6: the comment policy

| # | Change |
|---|---|
| 1 | New Policy `policy-comment-required` (`policy-comment-required.json`, listed in `seedPolicyDefinitions.ts` and in `platform-governance-baseline.pack.json`). Condition type `implemented`, transition `Service|Validated|Defined`. The code constant is `COMMENT_REQUIRED_POLICY_CODE`. ✅ |
| 2 | `src/policies/commentRequired.ts` returns true when `context.comment` is a non-empty string. It is registered in `src/policies/index.ts`. ✅ |
| 3 | The reject row `Service Validated → Defined` lists `policy-comment-required`. ✅ |
| 4 | `serviceDefinitionsDB.addComment(id, comment)` appends one entry to the `comments` column. The adapter exposes it as the optional `addComment`. ✅ |
| 5 | `transitionEntity` merges the caller's `context` into `{ row }`, and after the gate passes it appends `context.comment` through the adapter before it sets the state. A comment on any transition is kept. ✅ |
| 6 | `nextActionsFor` returns `requiresComment`, true when one of the row's policy ids is the comment policy. The buttons for Capability and Service read it, so the page asks for a comment on reject. ✅ |
| 7 | The web transition route passes `req.body.comment` as the context for Service. ✅ |
| 8 | The Service schema in `schemaDefinitions.json` gains `comments`: an array of entries with `text`, `actorId`, `authorityBadge` and `createdAt`, marked `"x-read-only": true`. A comment is added only with a transition. ✅ |
| 9 | `x-read-only` is a new schema key, built like the other `x-*` keys: `JsonSchemaProperty` in `formGenerator.ts` declares it and `generateFields` leaves a read-only field out of the form. Schema Studio round-trips it: `AuthoredWidget` has a `readOnly` flag that `schemaCompiler.ts` reads and writes (as for `x-configurable`), and the widget row has a "Read only" checkbox. The `comments` property also carries `x-widget: json`, so Studio keeps its array type and items. ✅ |

### Service tests

`tests/service-definition-event-lifecycle-table.test.ts` is rewritten. Built. Run by the owner after `db:clean-slate`, clean. Three first-run failures were fixed: the policy-id count assertion was dropped (a Pack install adds materialised ids to the row), the comment badge is compared with the badge on the `ServiceRejected` event (a root actor records `root`), and the stale Service schema row was refreshed. `seedSchemaDefinitions` now deletes every `schema_definitions` row and reloads the JSON in one `bulkInsert`, and `cleanSlate.ts` truncates `service_definitions`, `policy_definitions` and `deliverable_definitions` first, so the foreign keys do not block the delete.

| # | Test | Covers |
|---|---|---|
| 1 | DEFINITION: the eight rows | verb, trigger, event, version event, policy ids; `Defined → Published` absent |
| 2 | DEFINITION: event names | exactly eight rows, none named `ServiceDefinition*` |
| 3 | DEFINITION: schema | `comments` is a read-only array in the Service schema, and `generateFields` leaves it out |
| 4 | BIRTH: seeded rows | seeded events `ServiceDefined`, `ServiceValidated`, `ServicePublished`, `ServiceActivated` |
| 5 | BIRTH: authority | copy is refused without `service_define`, no row written |
| 6 | DRIVEN: creation | copy stores the birth state, starts with no comments, publishes `ServiceDefined` with the real actor and badge, and no `ServiceDefinition` object type |
| 7 | REGRESSION: inputs and outputs | real string arrays (kept) |
| 8 | DRIVEN: six forward hops | each event published as `Service`, final state Archived |
| 9 | GUARD | no skip to Published, no repeat Validate, no return from Active |
| 10 | AUTHORITY | validate refused without `service_validate`; reject refused without `service_reject` |
| 11 | POLICY: schema | no pinned schema blocks Validate; a capability code gone from the Ontology blocks Validate |
| 12 | POLICY: hops | `loadPolicyChecks` matches each Service policy on its own hop only |
| 13 | POLICY: comment | the function is true only for a non-blank text comment |
| 14 | COMMENTS | reject without a comment is refused and changes nothing; with one it keeps the trimmed text, actor, badge and time; comments accumulate; a refused transition stores none |
| 15 | ONTOLOGY | activation writes no `service-name` concept |
| 16 | PUBLISH STEP | Defined moves to Validated; Validated reports more than one next step |
| 17 | BUTTONS | Validated shows Defined (comment required) and Published (no comment) |

## Entity 4: Pack (Chapter 1)

The entity type `Pack` is in `packs`, state column `status`. Lifecycle: `Draft → Validated → Published → Active → Retired → Archived`, plus reject `Validated → Draft`. The Pack states already exist; no new state is added. The owner chose `PackDefined` as the creation event, replacing `PackRegistered`.

### What differs from Service

| # | Point | Today | After |
|---|---|---|---|
| 1 | Creation | `createPackDraft` and the SDK draft publish `PackRegistered`; no birth row | Birth row `None → Draft`, verb `define`, badge `pack_define`, event `PackDefined`, no version event |
| 2 | Comments | Separate table `pack_comments` (`packsDB.addComment`, `getComments`); the comment rule is code in `transitionPack` | A `comments JSONB NOT NULL DEFAULT '[]'` column on `packs`, same shape and rules as Service (entries `{text, actorId, authorityBadge, createdAt}`, additive, added only with a transition). The rule becomes `policy-comment-required` on the reject row. The table `pack_comments`, its recovery file, its clean-slate entry and `getComments` are removed. The Pack schema gains `comments` (`x-read-only`, `x-widget: json`). The edit page's comment list reads the column. |
| 3 | Repeat comment | `transitionPack` refuses a comment equal to the latest one | Kept in the comment policy path (to confirm when building Step 5) |
| 4 | Supersede | After Active, the previous Active version is moved to Retired by a second `transitionPack` call | Same, with `transitionEntity`; it is Pack's own state machine, so no subscriber |
| 5 | Old copies | `transitionPack`, `advancePackOneStep`, `advancePackLifecycle`, `AUTHORING_NEXT_STATE` | Deleted once no caller is left |

### Build Steps

| Step | Change | State |
|---|---|---|
| 1 | Data: birth row, comment policy on the reject row, Pack schema `comments` field, packs recovery SQL (drop `DEFAULT 'Draft'` and the status CHECK, add `comments`); remove the `pack_comments` recovery file, `run.ts` entry and clean-slate entry. Built: birth row `None → Draft` plus `"trigger": "manual"` on all 7 Pack rows; `policy-comment-required` on `Validated → Draft` (and `Pack\|Validated\|Draft` in the policy's transitions list); Pack schema `comments` field; recovery SQL (status has no default or CHECK, `comments` added); `pack_comments` file, `run.ts` and clean-slate entries removed. `packsDB.addComment` and `getComments` are still in code and go in Step 4. | ✅ |
| 2 | `packsDB.create` takes a required `status` and writes it (`$14`); `PackRow` gains `comments`. Callers do not pass it yet, so `tsc` fails until Step 3. | ✅ |
| 3 | Creation places use `beginBirth`, publish last. `createPackDraft(seed, authorId)` loses its `authorBadge` parameter (as the Service copy did); `publishPack` no longer resolves `pack_define` itself. The SDK `createAuthoringDraft` Pack branch now publishes after the Ontology proposals, not before. The seeds reach Pack only through `publishPack`, so they need no change. Tests that call `createPackDraft` with a badge, or `packsDB.create` without `status`, are fixed in Step 6. | ✅ |
| 4 | Built (see below) | ✅ |
| 5 | Comment policy function for Pack. Covered by Step 4: Pack uses the shared `policy-comment-required` function and the adapter's `addComment`. No new code. | ✅ |
| 6 | Tests: rewrite `pack-event-lifecycle-table`, fix `pack-sdk` and any test using `PackRegistered` | Built, to run |

### Step 4: what was built

| # | Change |
|---|---|
| 1 | `packAdapter` in `entityAdapters.ts` (state from `status`, `setState` via `updateStatus`, `addComment`, tenant, pinned schema id, `content` = `packContent`). `packContent` is the old `packRowToContent`, moved there so the adapter and the policies can use it; `sdkAuthoring.ts` imports it. |
| 2 | `packsDB.addComment(id, {text, actorId, authorityBadge})` appends to the `comments` column. `getComments` and `PackCommentRow` are deleted. The edit page reads `c.text` and `c.createdAt` from the column. |
| 3 | `policy-ontology-values-present` no longer reads Capability only. It asks the adapter for `composableFields(row)` (new optional hook) and checks them against the schema the row pinned. Capability returns `{code, category, roles}`; Pack returns `{code, category, contributionObligationDefinitions, contributionEngineeringCapital, contributionQualityGates}`, the fields the old publish step checked. |
| 4 | Pack rows gain policies: `Draft → Validated` has `policy-validate-schema`; `Validated → Published` has `policy-validate-schema` and `policy-ontology-values-present`. Both policies list the Pack transitions. The old publish step checked the composable fields against the latest Pack schema; the policy checks the pinned one. |
| 5 | Callers: the web transition route, the API routes and `advancePackLifecycle` call `transitionEntity`. A new `activatePackSupersedingPrevious` (in `packs.ts`) moves a Pack to Active and retires the previous Active version, both through `transitionEntity`. The shared publish step uses it and `nextActionsFor` (exactly one next step, else "more than one next step, choose one"). The buttons do not supersede, as before. |
| 6 | Deleted: `transitionPack`, `TransitionPackResult`, `advancePackOneStep`, `AUTHORING_NEXT_STATE` (Pack). `computeRowActions` handles Pack with Capability and Service. |
| 7 | Dropped: the rule that a comment must differ from the latest comment. The comment policy checks only that a comment is present, as for Service. |
| 8 | The `validatePackSeed` call is removed from the publish step (see Step 4b). Creation and save still run it. |

### Step 4b: referential-list checks in `policy-validate-schema`

Owner decision: every referential-list item check belongs in `policy-validate-schema`, so other entities get it too.

| # | Change |
|---|---|
| 1 | New `routes/seu/core/referentialOptions.ts`. `loadReferentialOptions` and `loadSelfReferentialOptions` move there from `web/sdkAuthoring.ts`; the web form imports them (no change to the form). |
| 2 | New `validateReferentialListItems(schema, content, viewer)`. For each item field of a `referential-list` with an `x-referential` source and no `x-ontology` flag, every value must be offered by that source. `x-ontology` fields stay with the Ontology check. A source with no resolver throws, so a gap shows up as an error, not a silent pass. |
| 3 | The sources `checklist` and `policy` depend on the content: a value is a name or code the Pack declares, or the id of a published record owned by a Pack with the same code. `validateChecklistIds` and `validatePolicyCodes` in `packs.ts` are exported and take `(refs, declared, packCode, context)`; `validatePackSeed` calls them the same way as before. |
| 4 | `validateSchema` (the policy function) runs the check after the structure and Ontology checks. |
| 5 | Not covered: top-level `referential-select` fields, and item fields with `x-referential-source-by` variants. |
| 6 | Pack lists use the same option lists as the form: In the check, `pack-code` accepts Packs that are Active or past Active (see Template and Profile row 8); `deliverable-name` offers labels. A Pack depending on a Draft, Validated or Published Pack fails validation at Validate. |


### Pack tests

| Test file | Change |
|---|---|
| `pack-event-lifecycle-table.test.ts` | Rewritten (24 tests): definition table for 7 rows with verb, trigger, event, version event and policies; no `PackRegistered`; schema `comments` read-only; birth (row, refusal without `pack_define`, creation stores Draft, no comments, `PackDefined` with real actor and badge); edit adds no event; five forward hops; guards; authority (`pack_validate`, `pack_reject`); policy (no pinned schema, unknown dependency pack code, `validateReferentialFields` for pack codes and checklists, `loadPolicyChecks` per hop, ontology-values policy, comment policy function); comments (refused without comment, kept trimmed with actor and time, badge equals the event's badge, accumulate, same text allowed, refused transition stores none); publish step (Draft to Validated, choose from Validated, Published to Active retires the previous Active version); buttons. |
| `pack-sdk.test.ts` | A local `transitionPack` wrapper over `transitionEntity`; `createPackDraft` without a badge; `status` on the raw `packsDB.create`; the reject test now expects `policy_blocked` without a comment and allows the same text twice. |
| `pack-composition.test.ts` | `createPackDraft` without a badge. |
| `profile-composition-unravel`, `cr088`, `cr101` | `status: "Draft"` on the raw `packsDB.create`. |
| `sdk-authoring.test.ts` | Comment names `PackDefined`. |

## Entity 5: Template (Chapter 4)

The entity type `Template` is in `templates`, state column `status`. Owner decisions: the creation event is `TemplateDefined` (replacing `TemplateCreated`); the lifecycle gains a reject hop `Validated → Draft` that needs a comment (as for Pack); a `comments` JSON column is added to the table and the schema; the three reactivation rows (`Deprecated`, `Retired`, `Archived` → `Active`) are removed. Reactivation is gone, so the rule "activating from a terminal state creates a new version" is not built.

### Build Steps

| Step | Change | State |
|---|---|---|
| 1 | Data: birth row `None → Draft` (verb `define`, trigger `manual`, event `TemplateDefined`, no version event); reject row `Validated → Draft` (verb `reject`, event `TemplateRejected`, no version event, `policy-comment-required`); `"trigger": "manual"` on every row; `policy-validate-schema` on `Draft → Validated` and `Validated → Published`; the three reactivation rows deleted; the transitions lists of `policy-validate-schema` and `policy-comment-required` gain the Template hops. Template schema gains `comments` (`x-read-only`, `x-widget: json`). Recovery SQL: `status` has no default and no CHECK (the `DEFAULT 'Active'` and the later `SET DEFAULT 'Draft'` both go); `comments JSONB NOT NULL DEFAULT '[]'` added. Built: birth row, reject row, `manual` on all 8 rows, `policy-validate-schema` on both forward rows plus `policy-ontology-values-present` on `Validated → Published`, the three reactivation rows deleted, the three policies' transition lists, Template schema `comments`, recovery SQL. | ✅ |
| 2 | `templatesDB.createDraft` takes a required `status` and writes it instead of the literal `'Draft'`. `upsert` makes `status` required (today it defaults to `"Active"`); the roughly 60 test and seed callers of `upsert` pass it. `addComment(id, {text, actorId, authorityBadge})` appends to the `comments` column. The row type gains `comments`. Built ✅. The 49 `upsert` and `createDraft` calls in 15 test files now pass `status` (`"Active"` for `upsert`, `"Draft"` for `createDraft`). The production `createDraft` callers pass it in Step 3, so `tsc` fails there until then. | ✅ |
| 3 | Creation places use `beginBirth` and publish last. Built ✅: new `createTemplateDraft(seed, actorId)` (the creating part of `publishTemplate`, which now calls it and then advances); `copyTemplateAsNewDraft(id, actorId)` loses `authorBadge` and now publishes `TemplateDefined` (it published no event before); the SDK `createAuthoringDraft` Template branch uses the birth row's state, badge and event and publishes after the Ontology proposals (it published no event before). The web copy route no longer passes a badge. `reactivateAsNewVersion` still creates a draft without `status`; Step 4 deletes it. | ✅ |
| 4 | Built ✅. `templateAdapter` in `entityAdapters.ts` (state, `setState`, `addComment`, tenant, pinned schema id, `content` = draft content with the row's own columns, `composableFields`: `{code, deliverableCatalogue}` read from the draft content first, because the column is filled by unravel, after the policy). The web transition route calls `transitionEntity` for both. New `activateTemplateSupersedingPrevious` (activates and deprecates the previous Active version, both through `transitionEntity`) and `advanceTemplateToActive` (Draft, Validated or Published to Active); `publishTemplate` now uses `advanceTemplateToActive`. The shared publish step uses `nextActionsFor` (exactly one next step, else "more than one next step, choose one") and no longer checks composable fields itself (the policy does). It still runs the seed validation and the materialise function when the row is Draft; Step 7 moves them. Deleted: `transitionTemplate`, `reactivateAsNewVersion`, `AUTHORING_NEXT_STATE`, `advanceTemplateOneStep`, the terminal-state set, `TransitionTemplateResult`. Template is in the shared `computeRowActions` branch. `testFixtures.ts` uses `advanceTemplateToActive` for a Template left mid-walk, and now throws for a Template past Active ("run db:clean-slate") because reactivation no longer exists. | ✅ |
| 5 | Comment policy: shared `policy-comment-required`, no new code. Covered by Steps 1 and 4 (the reject row lists it, and the adapter's `addComment` stores the comment). | ✅ |
| 6 | Tests: rewritten, see "Template and Profile tests". Built, to run. | Built, to run |
| 7 | Materialise and unravel. Built ✅, see "Step 7: what was built" below. | ✅ |


## Entity 6: Profile (Chapter 5)

The entity type `Profile` is in `profiles`, state column `status`. Owner decisions: the creation event is `ProfileDefined` (replacing `ProfileCreated`); the lifecycle gains a reject hop `Validated → Draft` that needs a comment (as for Pack); a `comments` JSON column is added to the table and the schema; the three reactivation rows (`Deprecated`, `Retired`, `Archived` → `Active`) are removed. Reactivation is gone, so the rule "activating from a terminal state creates a new version" is not built.

### Build Steps

| Step | Change | State |
|---|---|---|
| 1 | Data: birth row `None → Draft` (verb `define`, trigger `manual`, event `ProfileDefined`, no version event); reject row `Validated → Draft` (verb `reject`, event `ProfileRejected`, no version event, `policy-comment-required`); `"trigger": "manual"` on every row; `policy-validate-schema` on `Draft → Validated` and `Validated → Published`; the three reactivation rows deleted; the transitions lists of `policy-validate-schema` and `policy-comment-required` gain the Profile hops. Profile schema gains `comments` (`x-read-only`, `x-widget: json`). Recovery SQL: `status` has no default and no CHECK (the `DEFAULT 'Active'` and the later `SET DEFAULT 'Draft'` both go); `comments JSONB NOT NULL DEFAULT '[]'` added. Built: birth row, reject row, `manual` on all 8 rows, `policy-validate-schema` on both forward rows plus `policy-ontology-values-present` on `Validated → Published`, the three reactivation rows deleted, the three policies' transition lists, Profile schema `comments`, recovery SQL. | ✅ |
| 2 | `profilesDB.createDraft` takes a required `status` and writes it instead of the literal `'Draft'`. `upsert` makes `status` required (today it defaults to `"Active"`); `create` (literal `'Active'`, no callers found) is deleted. `addComment(id, {text, actorId, authorityBadge})` appends to the `comments` column. The row type gains `comments`. Built ✅. The 49 `upsert` and `createDraft` calls in 15 test files now pass `status` (`"Active"` for `upsert`, `"Draft"` for `createDraft`). The production `createDraft` callers pass it in Step 3, so `tsc` fails there until then. | ✅ |
| 3 | Creation places use `beginBirth` and publish last. Built ✅: new `createProfileDraft(seed, actorId)` (the creating part of `publishProfile`, which now calls it and then advances); `copyProfileAsNewDraft(id, actorId)` loses `authorBadge` and now publishes `ProfileDefined` (it published no event before); the SDK `createAuthoringDraft` Profile branch uses the birth row's state, badge and event and publishes after the Ontology proposals (it published no event before). The web copy route no longer passes a badge. `reactivateAsNewVersion` still creates a draft without `status`; Step 4 deletes it. | ✅ |
| 4 | Built ✅. `profileAdapter` in `entityAdapters.ts` (state, `setState`, `addComment`, tenant, pinned schema id, `content` = draft content with the row's own columns, `composableFields`: `{...draft content, environment}`). The web transition route calls `transitionEntity` for both. New `activateProfileSupersedingPrevious` (activates and deprecates the previous Active version, both through `transitionEntity`) and `advanceProfileToActive` (Draft, Validated or Published to Active); `publishProfile` now uses `advanceProfileToActive`. The shared publish step uses `nextActionsFor` (exactly one next step, else "more than one next step, choose one") and no longer checks composable fields itself (the policy does). It still runs the seed validation and the materialise function when the row is Draft; Step 7 moves them. Deleted: `transitionProfile`, `reactivateAsNewVersion`, `AUTHORING_NEXT_STATE`, `advanceProfileOneStep`, the terminal-state set, `TransitionProfileResult`. Profile is in the shared `computeRowActions` branch. | ✅ |
| 5 | Comment policy: shared `policy-comment-required`, no new code. Covered by Steps 1 and 4 (the reject row lists it, and the adapter's `addComment` stores the comment). | ✅ |
| 6 | Tests: rewritten, see "Template and Profile tests". Built, to run. | Built, to run |

Template and Profile are built together, then their tests are run once (owner decision).

### Template and Profile: where each validation goes

Source: `validateTemplateSeed`, `validateProfileSeed`, the Template and Profile schemas in `schemaDefinitions.json`, and the publish step in `sdkAuthoring.ts`. "Resolver" is `referentialOptions.ts` (Step 4b of Pack).

**What is reused with no change**

| Piece | Use |
|---|---|
| `policy-validate-schema` | Required fields, the semver `pattern` on `templateVersion` and `profileVersion`, `x-ontology` fields, `x-referential` item fields |
| `policy-ontology-values-present` | Composable Ontology values. Needs `composableFields(row)` on the new adapters: Template `{code, deliverableCatalogue}`, Profile `{environment}` (the fields marked `x-ontology-composable`) |
| `policy-comment-required` | The new reject row |
| `referentialOptions.ts` | The option lists and the `self:` lists |
| `entityAdapters.ts`, `transitionEntity`, `nextActionsFor`, `computeRowActions` | As for Pack |

**A. Already covered by `policy-validate-schema` as built**

| # | Check | Entity | Covered by |
|---|---|---|---|
| 1 | Name, code, version, environment, base Template required | both | schema `required` |
| 2 | Version is semver | both | schema `pattern` |
| 3 | Ontology values: `code`, `deliverableCatalogue.code`, `featureFlagCodes`, `additionalCapabilityCodes`, `participatingOrganisationCodes`, the top-level `x-ontology` selects | both | `x-ontology` check |
| 4 | Dependency graph `toCode` and `fromCode` are catalogue entries | Template | `self:deliverableCatalogue` source |
| 5 | Knowledge locations name a real capability or deliverable | Profile | `capability-name` and `deliverable-name` sources. The `deliverable-name` list holds labels and `validateProfileSeed` checks codes. This needs checking when built. |

**B. Fits `policy-validate-schema` after a small addition to the resolver**

| # | Check | Entity | Addition |
|---|---|---|---|
| 6 | A Pack in a selection slot exists and has that slot's category | both | Support the sources `pack-code:<Category>` (Active Packs of that category). Built ✅ |
| 7 | Dispatch strategy is a known strategy | Profile | Add the `dispatch-strategy-preference` Ontology list. Built ✅ (also added to the form's option lists) |
| 8 | Optional Pack codes exist | Profile | Built ✅ (owner decision). In the check, `pack-code` and `pack-code:<Category>` accept Packs that are Active or past Active (`REFERENCEABLE_PACK_STATUSES` in `constants.ts`: Active, Retired, Archived). The form's dropdown still lists Active Packs only. |
| 9 | `baseTemplateCode` names an Active Template | Profile | A top-level `referential-select` field, not a list item. Needs the check to cover top-level fields with a non-Ontology `x-referential` (source `template-code` already exists). Built ✅: `validateReferentialFields` also checks top-level `referential-select` and `referential-multi-select` fields. |

**C. Outside A and B. Each check by kind**

Kinds: **schema-imposed** = a schema key carries it; **code-imposed** = needs code that compares fields or rows, or reads other records. No row is a failure inside the materialise step, so there is no "materialisation check" kind. The materialise step appears only in D.

| # | Check | Entity | Kind | Home |
|---|---|---|---|---|
| 10 | Catalogue codes are unique | Template | code-imposed | On save only (owner decision). Save is not a transition, so there is no gate and no policy. The check runs in the Template save step and shows an error message. It is not a common module. The Template save step has no checks today, so this is a new check there. |
| 11a | Graph edge `fromType` is Deliverable or Capability | Template | schema-imposed (an item `enum`) | `policy-validate-schema`. Built ✅: `validateAgainstSchema` now checks `enum` on the fields inside `referential-list` rows. The web form save uses the same function, so it checks them too. |
| 11b | A Capability edge names a Capability the selected Packs contribute | Template | schema-imposed. The schema already declares it: `fromCapabilityCode` has `x-referential-source-derived-by: requiredCapabilityCodes`, the list the form uses for its dropdown. | `policy-validate-schema`, once the check reads the `derived:` list. The resolver builds the list from the Template's own content, as the form does. Built ✅: `loadDerivedPackCapabilityOptions` and `extractPackCodes` moved from the web layer to `referentialOptions.ts`; the check reads `x-referential-source-derived-by` as the source `derived:<name>`. |
| 11c | The graph has no cycles | Template | code-imposed | On save |
| 12 | Exposed parameters: the parameter exists, and its value is allowed | Template | The existence check is done by the materialise step: it rebuilds `exposedParameters` from the parameters the selected Packs carry, keeps the user's picks that are still valid, and drops the rest. Only the value check remains (the picked `value` is in that parameter's allowed list). The materialise step keeps the user's `value` without checking it. That remaining check is code-imposed. | The materialise step (owner decision): it refuses a value that is not in the parameter's allowed list. |
| 13 | Inherited Template: same code as the parent, keeps its mandatory Packs, keeps its locked edges | Template | code-imposed (the locked-edge comparison reads the parent's materialised graph) | On save |
| 14 | Exposed parameter overrides are parameters the base Template flags overridable | Profile | Same as row 12 (owner decision): the existence check belongs to the Profile materialise step; the value check is code-imposed. | `policy-materialise-profile` and `unravel-profile` (confirmed, see Step 7 row 4). |
| 15a | Each configuration value exists as a concept | Profile | schema-imposed (`x-ontology` selects) | Already in A3 |
| 15b | Mandatory configuration parameters are present (mandatory per tenant, from the Ontology) | Profile | code-imposed | On save |
| 16 | `primaryProgrammingLanguage` has a matching `technology` concept | Profile | code-imposed (the schema's `x-ontology` names another concept type) | On save |
| 17 | A knowledge location names exactly one of deliverable or capability | Profile | code-imposed | On save |
| 18 | Dispatch strategy orders are distinct; `redispatchMaxAttempts` is greater than `redispatchAttentionThreshold` | Profile | code-imposed | On save |
| 19 | Inherited Profile: parent rules | Profile | code-imposed | On save |

**D. Side effect that is not a validation**

| # | Item | Today | Needs a home |
|---|---|---|---|
| 20 | `materialiseTemplateDraft` and `materialiseProfileDraft` write the catalogue, the Pack selections, the required Capabilities and the dependency graph rows | Run in the publish step when the row is Draft. The Validate button and `transitionEntity` do not run them. | Decided: `unravel-template` and `unravel-profile`, named in `action_code` on the `Validated → Published` row. They run in the transition's transaction. The checks they need run first in `materialise-*` on `Draft → Validated`. |

**Owner decision: whatever `policy-validate-schema` can check is checked there.** B6, B7, B9, 11a and 11b are built. **Still open:** nothing else is open.

### Template and Profile: save, materialise and unravel (owner decision)

Three places, each with one job. Working names: `materialise-template`, `materialise-profile`, `unravel-template`, `unravel-profile`.

| Place | When | What it does | Writes tables? |
|---|---|---|---|
| Save | The user saves the form. Not a transition, so no gate and no policy. | The checks marked **On save** in table C. These are basic sanity checks the schema cannot carry. They show an error message and refuse the save. | No (it stores the form content, as today) |
| `materialise-*` | `Draft → Validated` | Runs every materialisation check: the checks that need the Packs and other records to be unravelled (rows 12 and 14, and whatever else is marked materialise). Nothing is written. | No |
| `unravel-*` | `Validated → Published` | First calls `materialise-*`, so the checks run again on the content as it now stands. If they pass, it unravels the Template (or Profile) into the tables: the catalogue, the Pack selections, the required Capabilities and the dependency graph rows. | Yes |

What this changes in the earlier tables:

| Item | Change |
|---|---|
| Row 12, row 14 | Home is `materialise-template` and `materialise-profile`. |
| Row 20 | Home is `unravel-*` on `Validated → Published`. The publish step no longer materialises at Draft. |
| The advance action (`publishAuthoringDraft`) | No longer validates or writes tables itself. Both come from the transitions. |
| Validate button | Runs `materialise-*` through the row's policy list, so the button and the advance action do the same thing. |

**How `unravel-*` runs (proposal, to be approved):** the transition row gets a field naming an action (`action_code`). `transitionEntity` reads it and runs the function registered under that code in `src/actions/`. There is no status comparison in code: the row decides.

**The action code (built).**

| # | Change | State |
|---|---|---|
| 1 | Column `action_code TEXT` on `transition_definitions` (recovery SQL), `action_code` on `TransitionDefinitionRow`, `actionCode` in `replaceAll` and in the seed (`"actionCode"` key in `transitionDefinitions.json`). | Built ✅ |
| 2 | The seed refuses an action code with no implementation in `src/actions`. | Built ✅ |
| 3 | `transitionEngine.evaluate` returns `actionCode` on an allowed outcome. | Built ✅ |
| 4 | New registry `src/actions/index.ts` (`runAction`, `isRegisteredAction`). It is empty. `unravel-template` and `unravel-profile` are added in their own passes. | Built ✅ |
| 5 | `transitionEntity` runs the row's action inside the transaction, after the gate and before the status change. No status comparison. | Built ✅ |

**Transactions.**

| # | Change | State |
|---|---|---|
| 1 | `withTransaction(work)` in `utils/db.ts`. It opens one connection, runs `work`, commits on return and rolls back on a throw. `query` and `bulkInsert` use that connection while `work` runs, however deep in the DB layer the call is, so no DB-layer function changes. A call made inside a running transaction joins it. | Built ✅ |
| 2 | `transitionEntity`: the gate runs first, outside the transaction. Then the comment, the action and the status change run inside one `withTransaction`. The event is published after the commit, as the last statement. | Built ✅ |
| 3 | (rule for each action) An action throws on any `{ error } returned by a DB-layer function, because those functions return the error instead of throwing, so nothing would roll back otherwise. | To build with `unravel-*` |
| 4 | The checklist and objective DB functions that open their own connection are not used by `unravel-*`, so they stay as they are. | Noted |
| 7 | Materialise and unravel. Built ✅, see "Step 7: what was built" below. | ✅ |


### Step 7: what was built (Template and Profile)

| # | Change |
|---|---|
| 1 | Policies `policy-materialise-template` and `policy-materialise-profile` (JSON, seed list, baseline Pack, `src/policies/materialiseTemplate.ts` and `materialiseProfile.ts`, constants). They sit on `Draft → Validated` and change nothing. Template: each exposed parameter's value is allowed by the parameter (`validateExposedParameterValues`). Profile: each override's value is allowed (`validateOverrideValues`). |
| 2 | Actions `unravel-template` and `unravel-profile` (`src/actions/`), named by `"actionCode"` on the `Validated → Published` rows and registered in `src/actions/index.ts`. Each runs the same value check again, then `materialiseTemplateDraft` or `materialiseProfileDraft`, inside the transition's transaction. |
| 3 | The materialise functions throw on any `{ error }` from the DB layer (the pack selections, capabilities, catalogue and draft content; `materialiseDependencyGraph` too), so a failure rolls the transition back. |
| 4 | Row 14 confirmed: the old Profile materialise step did not rebuild the overrides. `materialiseProfileDraft` now rebuilds them from the parameters the base Template flags overridable and drops any other row, as the Template step does for exposed parameters. |
| 5 | The exposed-parameter existence check and the override existence check are removed from `validateTemplateSeed` and `validateProfileSeed`. A stale row is dropped by the unravel step instead of refused. |
| 6 | The On save checks are split out and called from the save step and from creation: `validateTemplateOnSave` (rows 10, 11c, 13) and `validateProfileOnSave` (rows 15b, 16, 17, 18, 19). The seed validators call them. The Template and Profile save steps return their errors. |
| 7 | `createTemplateDraft` and `createProfileDraft` store the whole seed as draft content and no longer materialise. The unravel step reads the draft content. |
| 8 | The shared publish step no longer validates or materialises at Draft. The authoring page shows the draft content for Draft and Validated rows and the unravelled tables from Published on (the tables are filled at `Validated → Published`). |
| 9 | Fixed: the seeds list pack codes (and feature flags, capability codes) as plain strings, and the schema describes each entry as a row with one field (`{ packCode }`). New `toSchemaRows(schema, content)` in `formGenerator.ts` wraps each plain string in its row. `createTemplateDraft` and `createProfileDraft` store the draft content through it, so `policy-validate-schema` checks the lists. The JSON files are unchanged. The code is what the schema asks for, not an id. |

### Template and Profile tests

| Test file | Change |
|---|---|
| `template-event-lifecycle-table.test.ts` and `profile-event-lifecycle-table.test.ts` | Rewritten (23 tests each): definition table for 8 rows with verb, trigger, event, version event, policies and action code; exactly those rows, no reactivation rows, no `TemplateCreated` or `ProfileCreated`; schema `comments` read-only; birth (row, refusal without the define badge, creation stores Draft with no comments and publishes the Defined event with the real actor and badge, copy publishes the Defined event, `publishTemplate` and `publishProfile` walk to Active); six forward hops; guards (no skipping, no reactivation); authority (validate, reject); policy (no pinned schema, an unknown Pack or base Template, `loadPolicyChecks` per hop, the materialise and Ontology policies, the comment policy function); the unravel action (nothing written at creation or Validate, the Pack selection written at Publish; Profile also drops a stale override); comments (refused without comment, kept trimmed with actor and time, badge equals the event's badge, accumulate, same text allowed, refused transition stores none); publish step (Draft to Validated, choose from Validated, Published to Active deprecates the previous Active version); buttons. |
| `transaction.test.ts` (new) | `withTransaction`: queries inside share one transaction and queries outside do not; a nested call joins; the value is returned and the original error is rethrown with the pool still usable; a failed statement rolls the unit back. |
| `testFixtures.ts` | Done in Step 4 (`advanceTemplateToActive`; throws for a Template past Active). |
| The 49 `upsert` and `createDraft` callers | Done in Step 2 (`status` added). |

### Pack review gate codes (owner decision)

The first clean-slate run after Step 4b failed 90 or so Packs at `Draft → Validated`. Cause: a review gate's `code` names the source `deliverable-name` in the Pack schema, and the Pack files gave it gate names (`architecture-notebook`, `jira-integration-review-gate`) that are not in the Ontology list. `policy-validate-schema` now checks list item fields against their source, so every Pack with such a gate was blocked, and the `technology-*` Packs were blocked because the Pack `development` they depend on failed.

Owner decision: the review gate `code` is a deliverable name from the Ontology list. The schema marks it `x-ontology: true`. The Pack files use existing deliverable names, one different name per gate, because `review_gates` has a unique index on (entity type, from state, to state, code). Seven existing gates already used Ontology names (`model-evaluation-report`, `data-quality-report`, `hardware-compatibility-report`, `knowledge-base-articles`, `requirements-specification`, `solution-architecture-document`, `api-specification`) and none of those was reused. The test fixture Packs under `test-fixtures/` are unchanged: their gate codes are registered by `test-ontology.json`.

Each old code appeared once in its Pack file, so no other field referred to it. The replacement is a text change of the one value. The mapping is a judgement of the closest existing name, mostly for sign-off gates that have no natural deliverable. Please review it.

| Pack file | Old gate code | New gate code (existing deliverable name) |
|---|---|---|
| compliance-accessibility-ada-508 | `accessibility-compliance-gate` | `accessibility-conformance-report` |
| compliance-aml-kyc | `aml-bsa-officer-attestation-gate` | `regulatory-obligations-register` |
| compliance-automotive-wp29 | `automotive-type-approval-gate` | `platform-certification-report` |
| compliance-bipa | `bipa-privacy-attestation-gate` | `privacy-impact-assessment` |
| compliance-coppa | `coppa-privacy-review-gate` | `access-control-model` |
| compliance-data-residency-localization | `data-sovereignty-attestation-gate` | `data-migration-plan` |
| compliance-do178c-aviation | `do178c-der-signoff-gate` | `structural-coverage-report` |
| compliance-e-commerce-consumer-protection | `ecommerce-compliance-gate` | `api-compatibility-report` |
| compliance-eu-ai-act | `eu-ai-ethics-review-gate` | `model-card` |
| compliance-eu-dora-nis2 | `dora-resilience-attestation-gate` | `resilience-test-report` |
| compliance-eu-dsa-dma | `dsa-dma-compliance-gate` | `risk-assessment-report` |
| compliance-eu-financial-reporting | `eu-fin-regulatory-gate` | `compliance-audit-evidence` |
| compliance-eu-mdr | `eu-mdr-person-responsible-gate` | `safety-case` |
| compliance-fcpa | `fcpa-ethics-compliance-gate` | `vendor-assessment` |
| compliance-fda-21cfr11 | `fda-part11-qa-attestation-gate` | `traceability-matrix` |
| compliance-fedramp | `fedramp-3pao-authorization-gate` | `security-assessment-report` |
| compliance-fisma | `fisma-iso-attestation-gate` | `security-design` |
| compliance-gdpr | `gdpr-dpo-privacy-attestation` | `security-requirements-specification` |
| compliance-glba | `glba-ciso-attestation-gate` | `penetration-test-report` |
| compliance-hipaa | `hipaa-security-privacy-review` | `data-dictionary` |
| compliance-india-dpdp | `dpdp-data-protection-gate` | `data-migration-verification-report` |
| compliance-india-rbi-pmla | `rbi-pmla-audit-gate` | `risk-register` |
| compliance-iso-27001 | `iso27001-isms-audit-review` | `review-report` |
| compliance-itar-ear | `itar-emp-officer-gate` | `licence-compliance-report` |
| compliance-nist-800-53 | `nist-800-53-authorizing-official-gate` | `risk-mitigation-plan` |
| compliance-nydfs | `nydfs-ciso-certification-gate` | `impact-analysis-report` |
| compliance-pci-dss | `pci-dss-qsa-attestation-review` | `software-bill-of-materials` |
| compliance-psd2-psd3 | `psd2-payment-security-gate` | `contract-test-report` |
| compliance-sebi-companies | `sebi-secretarial-compliance-gate` | `decision-record` |
| compliance-soc2 | `soc2-type2-audit-readiness-gate` | `backup-restore-verification-report` |
| compliance-sox | `sox-internal-audit-signoff` | `configuration-baseline-record` |
| compliance-uk-gdpr-dpa | `uk-dpo-attestation-gate` | `capability-maturity-assessment` |
| compliance-us-state-privacy | `us-state-privacy-attestation-gate` | `policy-conflict-report` |
| domain-accounting-finance | `financial-controller-signoff-gate` | `cost-variance-report` |
| domain-banking-payments-markets | `banking-operations-signoff-gate` | `engineering-budget` |
| domain-customer-service | `support-operations-signoff-gate` | `support-resolution-record` |
| domain-energy-utilities-mining | `energy-operations-signoff-gate` | `workload-model` |
| domain-enterprise-workflows | `enterprise-chief-architect-signoff-gate` | `architecture-tradeoff-analysis-report` |
| domain-facilities-itsm | `vp-it-operations-signoff-gate` | `disaster-recovery-plan` |
| domain-government-public-services | `public-agency-director-signoff-gate` | `benefits-realisation-report` |
| domain-healthcare-pharma | `chief-medical-officer-signoff-gate` | `failure-mode-and-effects-analysis` |
| domain-hospitality-travel-aviation | `travel-operations-signoff-gate` | `effort-estimate` |
| domain-hr-payroll | `payroll-hr-director-signoff-gate` | `skills-matrix` |
| domain-insurance-claims | `claims-director-signoff-gate` | `defect-log` |
| domain-legal-compliance-risk | `general-counsel-signoff-gate` | `vendor-contract` |
| domain-manufacturing-quality | `quality-director-signoff-gate` | `test-strategy` |
| domain-marketing-advertising | `marketing-director-signoff-gate` | `product-roadmap` |
| domain-order-management | `order-operations-signoff-gate` | `project-status-report` |
| domain-procurement-sourcing | `procurement-director-signoff-gate` | `vendor-performance-record` |
| domain-product-management | `product-director-signoff-gate` | `business-analysis-plan` |
| domain-project-portfolio | `pmo-director-signoff-gate` | `project-plan` |
| domain-real-estate-construction | `construction-director-signoff-gate` | `training-plan` |
| domain-research-lifesciences | `head-of-research-signoff-gate` | `benchmark-report` |
| domain-retail-ecommerce | `ecommerce-director-signoff-gate` | `requirements-prioritisation-record` |
| domain-sales-crm | `revops-pipeline-signoff-gate` | `objective-alignment-report` |
| domain-supply-chain-wms | `scm-director-signoff-gate` | `operational-intelligence-report` |
| domain-telecom-media-publishing | `telecom-media-director-signoff-gate` | `mobile-platform-strategy` |
| integration-aws | `aws-integration-review-gate` | `deployment-manifest` |
| integration-azure-devops | `azure-devops-review-gate` | `integration-build` |
| integration-azure | `azure-cloud-review-gate` | `configuration-files` |
| integration-bitbucket | `bitbucket-integration-review-gate` | `repository-configuration` |
| integration-confluence | `confluence-integration-review-gate` | `user-technical-documentation` |
| integration-datadog | `datadog-integration-review-gate` | `monitoring-alerting-configuration` |
| integration-gcp | `gcp-integration-review-gate` | `test-environment-specification` |
| integration-github | `github-integration-review-gate` | `branching-strategy` |
| integration-gitlab | `gitlab-integration-review-gate` | `code-review-record` |
| integration-jenkins | `jenkins-integration-review-gate` | `build-artefact` |
| integration-jira | `jira-integration-review-gate` | `work-breakdown-structure` |
| integration-kubernetes | `kubernetes-integration-review-gate` | `deployment-package` |
| integration-pagerduty | `pagerduty-integration-review-gate` | `incident-communication-log` |
| integration-prometheus-grafana | `prometheus-grafana-review-gate` | `service-level-objective-specification` |
| integration-sentry | `sentry-integration-review-gate` | `known-error-record` |
| integration-servicenow | `servicenow-integration-review-gate` | `change-request` |
| integration-slack | `slack-integration-review-gate` | `stakeholder-communication-stream` |
| integration-snyk | `snyk-integration-review-gate` | `dependency-upgrade-plan` |
| integration-sonarqube | `sonarqube-integration-review-gate` | `technical-debt-register` |
| integration-terraform | `terraform-integration-review-gate` | `infrastructure-as-code-environment-configuration` |
| openup-architecture | `architecture-notebook` | `architecture-decision-record` |
| openup-configuration-and-change-management | `configuration-management-plan` | `release-package` |
| openup-development | `implementation-elements` | `source-code` |
| openup-test | `Test Report / Results` | `test-report-results` |
| sdlc-phase-00-vision-opportunity | `vision-one-pager` | `vision` |
| sdlc-phase-00-vision-opportunity | `lean-business-model-canvas` | `business-case` |
| sdlc-phase-01-product-discovery | `product-requirements-document` | `requirements-analysis-model` |
| sdlc-phase-02-experience-design | `clickable-prototype` | `prototype-evaluation-report` |
| sdlc-phase-04-security-privacy-compliance | `threat-model-stride` | `threat-model` |
| sdlc-phase-05-platform-developer-experience | `ci-cd-pipeline-specification` | `ci-cd-pipeline-definition` |
| sdlc-phase-06-backlog-release-planning | `release-plan` | `release-notes-change-log` |
| sdlc-phase-07-implementation | `technical-specifications-per-feature` | `detailed-design-specification` |
| sdlc-phase-08-quality-engineering-hardening | `master-test-plan` | `test-plan` |
| sdlc-phase-09-scale-performance-optimization | `capacity-scaling-model` | `capacity-plan` |
| sdlc-phase-10-beta-early-access | `beta-entry-exit-criteria` | `user-feedback-analysis-report` |
| sdlc-phase-11-launch | `deployment-rollout-plan` | `rollback-plan` |
| sdlc-phase-12-hypercare-stabilization | `post-mortem-lessons-learned` | `lessons-learned-report` |
| sdlc-phase-13-growth-optimization | `product-analytics-specification` | `experiment-design` |
| sdlc-phase-14-internationalization-localization | `locale-language-strategy` | `engineering-standard` |
| sdlc-phase-15-ongoing-operations-governance | `sre-playbook` | `runbook-operational-documentation` |

### Fixes found by the first full test run (Pack, Template, Profile)

| # | Finding | Change |
|---|---|---|
| 1 | Each transition took seconds. The database is remote (about 30 ms a query), and `policy-validate-schema` read all 18 referential sources and checked each Ontology value with its own query. | `loadReferentialOptions` has one loader per source and `policy-validate-schema` loads only the sources its pinned schema names. Pack lookups are cached within a call. The Ontology checks collect the values, read each concept type once and check in memory (`checkAgainstCanonicalSets`). The five Pack hops went from 48 s to 14 s and the full run from 390 s to about 100 s. |
| 2 | Every transition row held all ten per-hop copies of `policy-validate-schema`, so each hop ran the check ten times. `backfillPolicyCode` (called from `materializeContributions`) appended every copy a Pack published to every row that lists the policy code. | `backfillPolicyCode` and its call are removed. A row keeps the Policy Definition id from the seed, and `loadPolicyChecks` expands it for the hop being run. |
| 3 | The referential check read only `x-referential`, so `baseTemplateCode` (which names `x-referential-source`) was never checked. | `sourceOf` reads both keys. |
| 4 | `outputContract` on a review gate held free text (77 seed Packs, 33 test-fixture Packs). The schema allows `passed-failed-notes` and `assessment-acceptance`, and `policy-validate-schema` enforces item enums. | Every other value is now `assessment-acceptance`. Please review which gates should be `passed-failed-notes`. |
| 5 | The test-fixture Packs use 53 review gate codes that are not Ontology `deliverable-name` concepts. | The 53 codes are added to `test-ontology.json` as `deliverable-name` concepts. |
| 6 | `knowledgeLocations.deliverableCode` and `capabilityCode` in the Profile schema name an Ontology source but were not marked `x-ontology`. The referential check compared the stored code with the source's labels. | Both are marked `x-ontology: true`. They are checked against the Ontology by code, as the Pack gate `code` is. |
| 7 | A failed fixture run left Packs in Draft with their old content, and the next run failed on `packs_code_version_tenant_key`. | `seedAllTestFixturePacks` removes the unfinished fixture Packs (Draft, Validated or Published, by fixture code) and the rows that point to them, then publishes again. Active Packs and Packs that other tests create are left alone. |
| 8 | The Pack lifecycle test used a random Pack code. Pack codes must be Ontology `engineering-name` concepts. | The supersede test uses its own code `test-pack-supersede` (added to `test-ontology.json`) and the birth test uses `test-pack` with a unique version. |

## Entity 7: Policy (Chapter 24)

The entity type `Policy` in `transition_definitions` is the Policy Definition. Its table is `policy_definitions` and its state column is `status`. The lifecycle is `Draft → Validated → Published → Active → Deprecated → Retired → Archived`. It has no reject hop and no comments. The six forward rows exist and carry no policies and no `"trigger"`. The creation event is `PolicyDefinitionDefined`, named like the six existing `PolicyDefinition*` events.

### Step 1: the data

| # | Change |
|---|---|
| 1 | Add a birth row to `transitionDefinitions.json`: Policy, from `None` to `Draft`, verb `define`, trigger `manual`, event `PolicyDefinitionDefined`, no version event. The badge becomes `policy_define`. ✅ |
| 2 | Write `"trigger": "manual"` on the six Policy rows. ✅ |
| 3 | In the `policy_definitions` schema recovery file, remove `DEFAULT 'Draft'` from `status` and any status CHECK constraint, as for the earlier entities. ✅ |
| 4 | Decision 1 (settled): `Draft → Validated` and `Validated → Published` carry `policy-validate-schema`. The two hops are added to the `transitions` list of `policy-validate-schema.json`. ✅ |

### Step 2: the database function

| # | Change |
|---|---|
| 1 | `policyDefinitionsDB.createDraft` stops writing the literal `'Draft'`. It takes a required `status` and writes it. ✅ |

### Step 3: the places that create a Policy Definition

| # | Place | After |
|---|---|---|
| 1 | `createAuthoringDraft` (Policy branch, `core/sdkAuthoring.ts`) | Calls `transitionEngine.beginBirth` for `Policy`, writes the initial state and badge, publishes the birth event last (after the composable Ontology proposals). ✅ |
| 2 | `copyPolicyDefinitionAsNewDraft` | Same as place 1. The `authorBadge` parameter is removed. ✅ |
| 3 | `seedPolicyDefinitions.ts` | Decision 2 (settled): it keeps inserting every definition as `Active` in one batch. These are platform seed data, so no birth event or hops are written. |
| 4 | `testFixtures.ts` (line 949) and `policy-definition-event-lifecycle-table.test.ts` (line 38) | Pass the birth `to_state` as `status`. ✅ |

### Step 4: the hops

| # | Change |
|---|---|
| 1 | Add a `policyAdapter` to `entityAdapters.ts` (findById, state from `status`, `setState` via `updateStatus`, tenant from the row, schema id and content). ✅ |
| 2 | `web/sdkAuthoring.ts` and the shared publish step call `transitionEntity`. The publish step no longer validates; see "Policy: where each validation goes". ✅ |
| 3 | Delete `transitionPolicyDefinition`, `advancePolicyDefinitionOneStep` and `AUTHORING_NEXT_STATE` once no caller is left. Every event carries `originatingObjectType` `Policy` (it was `PolicyDefinition`, which differs from the entity type). ✅ |
| 4 | `computeRowActions` gets a Policy branch that maps `nextActionsFor`. ✅ |

### Policy: where each validation goes

Same kinds and homes as Template and Profile (see "Template and Profile: where each validation goes"). Source: `validatePolicyDefinitionSeed`, the Policy schema (version 2) and the three schema checks. What each check reads:

| Check | What it reads |
|---|---|
| `validateAgainstSchema` | Top-level `required`, `enum`, `pattern` and `minLength`. For a `referential-list` field, the first level of rows: the row `required` fields and row enums. It does not read arrays or objects nested inside a row. |
| `validateOntologyFieldsAgainstSchema` | Every field marked `x-ontology` at any depth. It skips `x-ontology-composable` fields. |
| `validateReferentialFields` | Top-level `referential-select` fields and the item fields of a top-level `referential-list`. Nested arrays are not read. |

**A. Already covered by `policy-validate-schema`**

| # | Check | Covered by |
|---|---|---|
| 1 | `code`, `name`, `category`, `constraintType` present | schema `required` |
| 2 | `scope` is `Transition` or `Eligibility` | schema `enum` |
| 3 | Each condition has a statement | `conditions` is a `referential-list` with row `required: ["statement"]` |
| 4 | Condition severity, required-evidence category, and each related obligation's `category`, `origin`, `priority`, `severity` and evidence category are concepts | `x-ontology`, read at any depth |

**B. Fits `policy-validate-schema` after one addition: read the arrays and objects nested inside a row**

The schema already declares these. The addition is the same kind as the row-enum addition built for Template (11a). It applies to every schema-governed entity.

| # | Check | Schema key it needs |
|---|---|---|
| 5 | Each applicability row has a name | nested `required` |
| 6 | Governing condition `type` and `operator` are in the allowed lists | nested `enum` |
| 7 | Each related obligation has a `category` | nested `required` |
| 8 | Each exception rule has a statement; its composition is `all` or `any` | nested `required` and `enum` |
| 9 | Exception approvers are real active badges | nested `x-referential` (`authority-badge`) |

**B is built ✅.**

| # | Change |
|---|---|
| 1 | `validateAgainstSchema` (`formGenerator.ts`) reads the arrays and objects nested inside a `referential-list` row, at any depth: the nested `required` fields and the nested `enum` values. A nested row with no filled value is skipped. A value that is not an array or an object (for example a JSON string from the form) is skipped. |
| 2 | `validateReferentialFields` (`referentialOptions.ts`) checks the nested fields with a non-Ontology `x-referential` the same way (`checkNested`), and `referentialSourcesUsedBy` reads the nested sources, so their lists are loaded. |
| 3 | Other schemas are affected too. Pack: `contributionServices.serviceLevel` (`code`, `target` required), `contributionChecklists.items` (`statement` required), and `contributionObligationDefinitions.applicabilityDeliverables` (`name` required and a noun, `transitions` real transitions, governing condition `type` and `operator` enums). Before building, every seed Pack and test-fixture Pack was compared with these rules against the database (nouns, active transitions, required fields and enums). No violation was found. |
| 4 | Tests added to `policy-definition-event-lifecycle-table.test.ts` (group NESTED, three tests): a well-formed condition passes; a missing nested required field and a nested enum value that is not allowed are reported; a nested transition and a nested exception approver that are not offered are reported. |

**C. Outside A and B**

| # | Check | Kind | Home |
|---|---|---|---|
| 10 | Composable Ontology values (`category`, `applicabilityEnvironments`) exist | composable | `policy-ontology-values-present` on `Validated → Published`, and `composableFields` on the Policy adapter: `{category, applicabilityEnvironments}`. Built ✅, as Capability Step 5. |
| 11 | `version` is semver | code-imposed (`version` is a column and not a schema property) | Create and save: `validatePolicyDefinitionSeed` (already called) |
| 12 | `Eligibility` rows: the name is an active noun. `Transition` rows: the name is a `deliverable-name` concept | schema-imposed: the row `name` carries `x-referential-source-by-value` on `scope` (Eligibility: `noun`, not Ontology; default: `deliverable-name`, Ontology) | Transition: `validateOntologyFieldsAgainstSchema`, as built. Eligibility: `validateReferentialFields`, which now resolves by-value sources. Built ✅ |
| 12a | Each transition belongs to the entity the row names (the noun, or Deliverable) | code-imposed (the schema's `transitions` field offers every entity's transitions) | Create and save: `validatePolicyDefinitionSeed` |
| 13 | Governing condition `field_in`, `comparison` and `threshold` carry the fields each type needs, with an allowed operator for each | code-imposed | Create and save |
| 14 | Exception rules only when `constraintType` is `Policy` | code-imposed (compares two fields) | Create and save |
| 15 | A parent is Active, exists and is visible to the tenant | code-imposed (reads another record) | Create and save |

Built ✅, following the Capability steps (Step 5 and Step 6 row 8):

| # | Change |
|---|---|
| 1 | `policy-ontology-values-present` is added to `Validated → Published` of Policy in `transitionDefinitions.json`, and `Policy\|Validated\|Published` to its JSON. |
| 2 | `composableFields(row)` on the Policy adapter returns `{category, applicabilityEnvironments}`. |
| 3 | `publishAuthoringDraft` loses its Policy calls to `validatePolicyDefinitionSeed` and to the composable check, because `policy-validate-schema` and `policy-ontology-values-present` replace them. The create step and the save step already call `validatePolicyDefinitionSeed` with `draft` true. They stay, as the parent rule did for Capability. |

The publish call used `draft` false, which adds the name checks of row 12. Row 12 is now covered by the schema checks at every route, so nothing is lost. The earlier statement that the row `name` is a plain string was wrong: the schema carries a by-value source, and the referential check did not read it until now.


### Policy tests

| Test file | Change |
|---|---|
| `policy-definition-event-lifecycle-table.test.ts` | Rewritten as for Service: definition table for the seven rows, birth row and refusal without `policy_define`, creation stores Draft and publishes `PolicyDefinitionDefined` with the real actor and badge, the six forward hops through `transitionEntity`, guards, and buttons. ✅ |
| `testFixtures.ts` | `status` added to the `createDraft` call. ✅ |

### Decisions

| # | Question | State |
|---|---|---|
| 1 | Does the Policy get `policy-validate-schema` on its Validated and Published rows? | Yes (settled) |
| 2 | Does the seed keep inserting Policy Definitions as `Active`, or does it use the birth row and the hops? Keep the direct insert. | Settled |

## Entity 8: Deliverable (Chapter 15, and the authoring kind "Deliverable")

Status: Part A (the Deliverable Definition) is built, on the recommendations for D1, D2 and D3. Part B (the runtime Deliverable) is built, except the creation event at commissioning. D4 is settled. D5 is open.

The entity type `Deliverable` in `transition_definitions` holds two different lifecycles under one name.

| | Runtime Deliverable | Deliverable Definition |
|---|---|---|
| What it is | The work item of an SEU (Chapter 15, Events and Lifecycles) | The authored catalogue entry that the Ontology list `deliverable-name` and the Templates refer to |
| Table and state column | `deliverables`, `lifecycle_state` (default `Defined`) | `deliverable_definitions`, `status` (default `Draft`, with a status CHECK) |
| States | Defined, In Progress, Approved, Baselined | Draft, Validated, Published, Active, Deprecated, Retired, Archived |
| Rows in `transitionDefinitions.json` | 3: Defined → In Progress (verb `create`, trigger `governed`), In Progress → Approved (`approve`, attestation), Approved → Baselined (`baseline`, attestation). Each lists `policy-deliverable-transition-baseline`. | 9: the six forward hops (`validate`, `publish`, `activate`, `deprecate`, `retire`, `archive`) and three reactivation hops (Deprecated, Retired or Archived → Active). No policies. |
| Event today | The literal `DeliverableTransitioned`, published by the Execution Engine with the Command id. No row names an event. | Made-up names in `EVENT_BY_TARGET_STATE` (`DeliverableDefinition*`), with object type `DeliverableDefinition`. No row names an event. |
| Who moves it | The Execution Engine: `evaluateDeliverableTransition` (dependencies, SEU and Deliverable Obligations, Decisions, Quality Gates, Command in flight) then `applyGovernedDeliverableTransition` (Command, attestation, state, event). | `transitionDeliverableDefinition`, one of the seven old copies in "SDK authoring: how transitions work today". |
| Creation | `createDeliverable` (badge literal `deliverable_create` through `resolveAuthorBadge`) and `commissioning.ts` (system actor). Both call `deliverablesDB.create`, which sets no state. No creation event is published. | `createAuthoringDraft` (kind `Deliverable`), `copyDeliverableDefinitionAsNewDraft` and `reactivateAsNewVersion`. All call `deliverableDefinitionsDB.createDraft`, which writes the literal `'Draft'`. No seed creates Deliverable Definitions. |
| Tests | `cr107-execution-engine-deliverable-kickoff`, `cr121-governed-deliverable-flow`, `dependency-definition-engine` (three direct `deliverablesDB.create` calls) | `sdk-authoring.test.ts` (kind `Deliverable`), `dependency-graph-relationship-kind.test.ts`. No lifecycle table test. |

The states of the two lifecycles do not overlap, so `findPossibleNextStates("Deliverable", state)` returns the right hops for each today.

### Findings

| # | Finding |
|---|---|
| 1 | `transition_definitions_one_birth_per_entity` allows one birth row per entity type, and `beginBirth` takes only the entity type. A birth row `None → Defined` (runtime) and a birth row `None → Draft` (Definition) cannot both exist under `Deliverable`. |
| 2 | The authoring creation badge for a Deliverable Definition is already `deliverable_define` (the registry's `canCopy`, and the tests pass `authorBadge: "deliverable_define"`), but no row declares `define`. The runtime creation badge is `deliverable_create`, which is also the verb of the hop Defined → In Progress. The creation authority and the start of work share one badge. |
| 3 | The Execution Engine publishes `DeliverableTransitioned` for every runtime hop. The `deliverableKickoff` handler and `eventSubscriptions.json` subscribe to that name, `deliverablesDB` queries it, and `acceptance.e2e.test.ts` asserts it. The event name cannot change without changing those. |
| 4 | The Definition's `transitionDeliverableDefinition` evaluates the gate with no `entityId`, publishes a made-up event name, runs the Ontology write (`syncOntologyOnActivate`, `demoteOntologyIfNoOtherActive`) after the state change, and reactivates a terminal Definition as a new version (`reactivateAsNewVersion`). The advance step also moves the previous Active version to Deprecated. |
| 5 | The Definition schema (version 1) has `code`, `description` and `definitionVersion`. It requires `code` and `definitionVersion`, and `definitionVersion` has a semver `pattern`. `policy-validate-schema` covers both. The parent-must-be-Active rule in `validateDeliverableDefinitionSeed` stays in the creation path, as for Capability and Service. |
| 6 | The Definition has no reject hop, no comments, and no `x-ontology-composable` field. |

### Decisions

| # | Question | Recommendation |
|---|---|---|
| D1 | The two lifecycles share the entity type `Deliverable` (finding 1). Give the Definition its own entity type `DeliverableDefinition` (noun `DeliverableDefinition`, badges `deliverabledefinition_define` and so on)? The authoring kind stays `Deliverable` and `computeRowActions` maps it to the entity type. | Yes. Every earlier entity holds one lifecycle per entity type. The runtime Deliverable keeps the name `Deliverable`. Consequence: the 9 Definition rows move to the new type, the badges change (`deliverable_define` becomes `deliverabledefinition_define`), and the holders of the old badges need the new ones. |
| D2 | Keep the three reactivation rows (a terminal Definition becomes Active as a new version)? | No. Template and Profile removed the same rows (owner decision, "Rules found in the old copies"). Activating Published → Active deprecates the previous Active version, as for Template and Profile. |
| D3 | Keep the Ontology write on Active and on leaving Active? | No, as for Service (Step 5, settled): the Ontology owns the `deliverable-name` list, so the write runs in the wrong direction. If agreed, the Definition's `code` should then be marked `x-ontology` (source `deliverable-name`) so that a Definition names an existing concept. The sdk-authoring tests create Definitions with codes that are not in the Ontology and would need real codes. |
| D4 | The runtime birth row: verb and event. | Settled (owner): the birth verb is `define` and the birth event is `DeliverableCreated`. Defined → In Progress keeps the verb `create` and takes the event `DeliverableUpdated`. In Progress → Approved takes `DeliverableApproved` and Approved → Baselined takes `DeliverableBaselined` (the names of Chapter 15 section 17, chosen by me from the verbs and not stated by the owner). `DeliverableTransitioned` is published for every Deliverable transition, after the hop's own event. |
| D5 | Commissioning creates the Deliverables as the SEU's system participant. Who is the actor of the creation event there? | Open. The system id is an app-created id and not a real actor, so `beginBirth` is not called with it (the first attempt did, and was taken back). Commissioning keeps its system participant as author and badge, and takes only the starting state from the birth row (`findBirth`). It publishes no `DeliverableCreated` event until this is answered. |

### Part A: Deliverable Definition (after D1 to D3). Built ✅

| # | Change |
|---|---|
| A1 | `transitionDefinitions.json`: the 9 Definition rows get entity type `DeliverableDefinition`. Add the birth row `None → Draft`, verb `define`, trigger `manual`, event `DeliverableDefinitionDefined`, no version event. Write `"trigger": "manual"` and an event on every row: `DeliverableDefinitionValidated`, `Published`, `Activated`, `Deprecated`, `Retired`, `Archived` (the names `EVENT_BY_TARGET_STATE` uses today), with the version events of the Policy rows. Remove the three reactivation rows (D2). `Draft → Validated` and `Validated → Published` carry `policy-validate-schema`. |
| A2 | Add `DeliverableDefinition` to `TransitionEntityType`. Add `policy-validate-schema` transitions `DeliverableDefinition\|Draft\|Validated` and `DeliverableDefinition\|Validated\|Published` to its JSON. |
| A3 | `deliverable_definitions` schema recovery: remove `DEFAULT 'Draft'` and the status CHECK from `status`. `deliverableDefinitionsDB.createDraft` takes a required `status`. |
| A4 | Creation sites call `beginBirth` and publish the birth event last: `createAuthoringDraft` (Deliverable branch) and `copyDeliverableDefinitionAsNewDraft` (its `authorBadge` parameter is removed). `reactivateAsNewVersion` is deleted with D2. |
| A5 | Add a `deliverableDefinitionAdapter` to `entityAdapters.ts` (state from `status`, `setState` via `updateStatus`, tenant, pinned schema id, content: the draft content with `code`, `description` and `definitionVersion`). Add `DeliverableDefinition` to the entity types that `computeRowActions` and `nextActionsFor` map from the kind. |
| A6 | The publish step, the web transition route and the registry call `transitionEntity` and `nextActionsFor`. The publish step drops `validateDeliverableDefinitionSeed` at Draft, because `policy-validate-schema` replaces it. The parent rule stays in the creation path. |
| A7 | Activating a Published Definition moves the previous Active version of the same code to Deprecated, as the Template and Profile activate step does (`activateDeliverableDefinitionSupersedingPrevious`). |
| A8 | Delete `transitionDeliverableDefinition`, `advanceDeliverableDefinitionOneStep`, `reactivateAsNewVersion`, `AUTHORING_NEXT_STATE`, `EVENT_BY_TARGET_STATE`, `syncOntologyOnActivate` and `demoteOntologyIfNoOtherActive` (D2, D3). Events carry the object type `DeliverableDefinition` through the generic function. Built ✅. Deviation from the first text, which said to mark `code` `x-ontology`: `code` is marked `x-ontology` and `x-ontology-composable` with the source `deliverable-name`, as the Capability `code` is. A plain `x-ontology` would refuse a new deliverable name at create, and the authoring screen exists to introduce new names. A composable code is proposed to the Ontology at create and save (`proposeComposableOntologyValues`), and `policy-ontology-values-present` on `Validated → Published` requires it to exist before the Definition is Published. The adapter returns `composableFields` `{code}`. |
| A9 | Badges: the noun `DeliverableDefinition` and its verbs derive from the rows. The registry's `canCopy` reads the new `deliverabledefinition_define`. Check the seed and test identities that hold `deliverable_define` and the verbs of the old Definition rows. |

What was built in Part A (all rows above, plus):

| # | Item |
|---|---|
| 1 | `AUTHORING_KIND_ENTITY_TYPE` in `constants.ts` maps the authoring kind `Deliverable` to the entity type `DeliverableDefinition`. `entityTypeForKind` (`core/sdkAuthoring.ts`) reads it. It is used by `computeRowActions`, `possibleRowActions`, `canonicalForwardEdges`, `requiredBadgeForRowAction` and, in `web/sdkAuthoring.ts`, `authoringBadge`, the badge prefix check, `nextHop` and the possible-next-states list. |
| 2 | The noun `DeliverableDefinition` is added to `authorityVocabulary.json`. The registry's `canCopy` reads `deliverabledefinition_define`. |
| 3 | The Policy `policy-validate-schema` lists `DeliverableDefinition\|Draft\|Validated` and `DeliverableDefinition\|Validated\|Published`; `policy-ontology-values-present` lists `DeliverableDefinition\|Validated\|Published`. |
| 4 | New `activateDeliverableDefinitionSupersedingPrevious` (activates, then deprecates the previous Active version of the code). The publish step and `copyDeliverableDefinitionAsNewDraft` (no `authorBadge` parameter) use the generic function and publish the birth event last. |
| 5 | Tests: `deliverable-definition-event-lifecycle-table.test.ts` is new (13 tests). In `sdk-authoring.test.ts` the Ontology-sync assertions are removed from the Definition tests, which register the code in the Ontology first (`ensureDeliverableNameConcept`) and use the badge `deliverabledefinition_define`; the supersede test now checks that the first version is deprecated. `dependency-graph-relationship-kind.test.ts` registers each code in the Ontology before the Definition is published. |
| 6 | Run `pnpm db:clean-slate` before the tests: the transition rows, the Definition schema, the noun, the policy transition lists and the `deliverable_definitions` table definition changed. |

### Part B: runtime Deliverable (D4 settled, D5 open). Built ✅ except the commissioning creation event

| # | Change |
|---|---|
| B1 | `transitionDefinitions.json`: the birth row `None → Defined`, verb `define`, trigger `manual`, event `DeliverableCreated`, no version event. The three runtime rows take the events `DeliverableUpdated`, `DeliverableApproved` and `DeliverableBaselined`, with no version event. The verbs stay (`create`, `approve`, `baseline`). ✅ |
| B2 | `deliverables` schema recovery: `lifecycle_state` has no default. `deliverablesDB.create` takes a required `state`. ✅ |
| B3 | `createDeliverable` calls `beginBirth` in place of the literal `deliverable_create`, writes the initial state and publishes the birth event last. ✅ `commissioning.ts` takes the starting state from the birth row (`findBirth`), keeps the system participant as author and publishes no creation event (D5 is open). ✅ |
| B4 | `applyGovernedDeliverableTransition` publishes the row's event and then `DeliverableTransitioned`, and throws when the row names no event. The Execution Engine is not replaced by `transitionEntity`: the hops stay Commands governed by `evaluateDeliverableTransition`. ✅ |
| B5 | The badge of the creation changes from `deliverable_create` to `deliverable_define`. `deliverable_create` stays the badge of the start hop. No seed or test names either badge. ✅ |

### Tests

| Test file | Change |
|---|---|
| `deliverable-definition-event-lifecycle-table.test.ts` (new) | As for Service and Policy: definition table (birth plus six forward rows, no reactivation rows), birth and refusal without `deliverabledefinition_define`, creation through the copy, the six hops through `transitionEntity`, guards, the previous Active version deprecated on activate, schema block, `loadPolicyChecks` per hop, buttons. |
| `deliverable-event-lifecycle-table.test.ts` (new, built) | The four runtime rows with their verbs, triggers and events; the birth row; refusal of an actor without `deliverable_define`; commissioning creates the Deliverable in the birth state; the start hop and the approve hop each publish their own event followed by `DeliverableTransitioned`. |
| Fixtures to change | `dependency-definition-engine.test.ts` (three `deliverablesDB.create` calls gain `state`, read from the birth row, built); `sdk-authoring.test.ts` and `dependency-graph-relationship-kind.test.ts` (Deliverable Definition cases: the badge name, and real `deliverable-name` codes if D3 is agreed); `acceptance.e2e.test.ts` asserts `DeliverableTransitioned`, which is still published for every hop; the commissioning event sequence of an SEU now also contains one `DeliverableCreated` per Deliverable (checked by the owner's run). |

## Entity 9: EBM (Chapter 3)

Status: 🟡 Built, not run. D1 to D3 are settled.

The entity type `EBM` is the Engineering Behavior Model of an SEU. Its table is `ebms` and its state column is `status`. The states are `Composed`, `Validated`, `Active`, `Superseded` and `Retired`. `transitionDefinitions.json` holds three rows: `Composed → Validated` (verb validate, event `EBMValidated`), `Validated → Active` (verb activate, event `EBMActivated`) and `Composed → Retired` (verb retire, no event). The birth row `None → Composed` does not exist.

### Findings

| # | Finding |
|---|---|
| 1 | `compositionCompletedHandler` creates the EBM through `ebmsDB.create`, which writes the literal `'Composed'`. The schema recovery file also carries `DEFAULT 'Active'` and `ebms_status_check`. The handler publishes the literal `EBMCreated` after the insert. No row names that event. |
| 2 | The author badge of the new EBM is the `authorBadge` field of the `CompositionCompleted` payload. The publisher (`POST /objectives/:id/compose-ebm`) resolves it with `resolveAuthorBadgeForRequest`. No transition definition declares the creation authority. |
| 3 | `transitionEbm` in `core/commissioning.ts` is one more copy of the old transition steps (gate, state write, event). It publishes with `seuId: ebm.seu_id`. The generic `transitionEntity` publishes with `seuId: null` and the adapter has no SEU link. |
| 4 | The Validate branch of `transitionEbm` runs `checkEbmLiveness`. When a Pack, Template, Profile or Ontology reference is dead, it writes `Retired` with `ebmsDB.updateStatus`, publishes the literal `EBMRetired`, raises an Attention Item (`EBM Retired`, High) and returns `ebm_retired`. This path uses no row and no gate. The row `Composed → Retired` (verb retire) is never reached by it. The row has no `eventType`. |
| 5 | Versioning is No on every EBM row (owner, 2026-09-11: "version is not part of validation"). The birth row therefore carries no version event. The `ebms.version` column (`MAX(version) + 1` per SEU at insert) is unchanged. |
| 6 | `EBMActivated` has a real subscriber, `ebmActivatedHandler`, which runs `finalizeCommissioning` on the SEU. The effect lands on a different entity type, so the subscriber stays. |
| 7 | `Superseded` is in `EbmStatus` and in the status CHECK. No row and no code writes it. `EBMVersioned` is unpublished and its build is a later concern. |
| 8 | `ebms` has no `tenant_id`. The tenant of an EBM is the tenant of its SEU. |
| 9 | Callers of `transitionEbm`: `POST /seus/:id/ebm/transition` (`web/seus.ts`), `demoSimulator.ts` and two calls in `tests/testFixtures.ts` (`driveCommissioningToActive`). The page `seu/seus/ebm.ejs` builds its button from `ebmView.ebm.possibleNextStates` and posts `targetState`. Direct `ebmsDB.create` callers: `compositionCompleted.ts` and `tests/cr104-mandatory-seu-eligibility-policies.test.ts`. |
| 10 | The EBM is created by an event subscriber. `compositionCompleted` is a registered handler (`eventHandlerRegistry.ts`), subscribed to `CompositionCompleted` in `eventSubscriptions.json`. The human click on the Compose EBM page publishes `CompositionCompleted` for the SEU, and `compositionCompletedHandler` then creates the row. It is the only caller of `ebmsDB.create` outside tests. The birth row is therefore `governed`. |

### Decisions

| # | Question | Recommendation |
|---|---|---|
| D1 | The birth verb and badge. The EBM is composed by the engine off `CompositionCompleted`, as the actor who triggered it. | Settled (owner): the verb is `compose`, the event is `EBMCreated`, and there is no version event. The `authorBadge` field stays in the `CompositionCompleted` payload, and the function that resolves it at the publisher returns whatever it returns. |
| D2 | The dead-reference path (finding 4). The row `Composed → Retired` has trigger `governed`: the system takes it when a Validate attempt finds a dead reference. It is never a button. A policy cannot redirect a hop to another state and an action code runs before the state write. | Behaviour is unchanged. A function `validateEbm` in `core/commissioning.ts` runs `checkEbmLiveness`. With no dead reference it calls `transitionEntity` for `Composed → Validated`. With a dead reference it calls `transitionEntity` for `Composed → Retired` (the row publishes `EBMRetired`), and returns `ebm_retired`. The Attention Item is raised by the action code `raise-ebm-retired-attention` on the `Composed → Retired` row, which runs in the same transaction as the state write. `validateEbm` passes the dead references in `context`. The verb route for `validate` calls `validateEbm`. No new Policy. |
| D3 | The generic event carries `seuId: null` (finding 3). | Settled (owner): `transitionEntity` takes a nullable `seuId` input and publishes it on the event. The default is `null`. The EBM callers pass the SEU id. |

### Step 1: the data

| # | Change |
|---|---|
| 1 | Add the birth row to `transitionDefinitions.json`: EBM, `None → Composed`, verb `compose`, trigger `governed` (an event subscriber creates the EBM, so the row is never a button; see finding 10), event `EBMCreated`, no version event. |
| 2 | Write `"trigger": "manual"` on the validate and activate rows and `"trigger": "governed"` on the birth row and on `Composed → Retired`. Give `Composed → Retired` the event `EBMRetired` and the action code `raise-ebm-retired-attention`. Version events stay empty (finding 5). |
| 3 | In `ebms_schema_recovery.sql`, remove `DEFAULT 'Active'` from `status` and drop `ebms_status_check`. |
| 4 | `eventSubscriptions.json`: the descriptions of `EBMValidated`, `EBMActivated` and `EBMRetired` stop naming `transitionEbm` and `checkEbmLiveness`. |

### Step 2: the database function

| # | Change |
|---|---|
| 1 | `ebmsDB.create` takes a required `status` and writes it. It stops writing `'Composed'`. |
| 2 | `ebmsDB.updateStatus` is unchanged. It writes only the status. The author id and author badge of the EBM stay as the composition set them, and the adapter's `setState` ignores its badge and actor arguments. |

### Step 3: the place that creates an EBM

| # | Place | After |
|---|---|---|
| 1 | `compositionCompletedHandler` (`runComposition`) | Calls `transitionEngine.beginBirth` for `EBM` with `event.actor_id` and the SEU, passes `initialState` to `ebmsDB.create` with the payload `authorBadge` as before, and publishes `eventType` with the actor and that badge as the last statement. A refused birth goes through `failComposition`. |
| 2 | `tests/cr104-mandatory-seu-eligibility-policies.test.ts` | Checked: it only reads an EBM with `findById`, so no change was needed. |

### Step 4: the hops

| # | Change |
|---|---|
| 1 | Add an `ebmAdapter` to `entityAdapters.ts`: `findById`, state from `status`, `setState` through `updateStatus`, and tenant from the owning SEU (`seusDB.findById(row.seu_id).tenant_id`, read when the adapter is built for the row). The `seuId` comes from the caller (D3). |
| 2 | `validateEbm` replaces `transitionEbm` (D2). It runs `checkEbmLiveness` and makes one `transitionEntity` call: `Composed → Validated`, or `Composed → Retired` with the dead references in `context`. It returns `ebm_retired` in the second case. It publishes the hop event itself after the call (2026-10-22 change). `checkEbmLiveness` stays. |
| 2a | New action code `raise-ebm-retired-attention` (code in `constants.ts`, registered in `src/actions/index.ts`). It raises the `EBM Retired` Attention Item (High, related object the EBM, description the dead references from `context`) with the actor and badge it is given. The Attention Item no longer comes from `validateEbm`, so every governed retire of an EBM raises it. |
| 3 | Delete `transitionEbm` and `TransitionEbmResult`. |
| 4 | `POST /seus/:id/ebm/transition` becomes `POST /seus/:id/ebm/transition/:verb`. It reads `seu.active_ebm_id`, finds the target state from the verb through `nextActionsFor`, and calls `transitionEntity` with `seuId`, or `validateEbm` for the verb `validate`. It has a `route_authority` row and a `redirects.ts` entry. The old route and its row are deleted. |
| 5 | `getSeuEbmView` returns `actions` from `nextActionsFor("EBM", status, actorId)`. `ebm.ejs` renders one button per action, posting to the verb route, and drops `transitionLabel`, the single-option and select branches and `possibleNextStates`. The message for Active ("commissioning is proceeding in the background") is chosen from the verb. The page is checked for CR-083. |
| 6 | `demoSimulator.ts` and `tests/testFixtures.ts` call `validateEbm` for Validate and `transitionEntity` with `entityType: "EBM"` for Activate. |

### EBM tests

| # | Test | Covers |
|---|---|---|
| 1 | DEFINITION: the four rows | verb, trigger (`governed` on the birth row and on Retire), event, no version event |
| 2 | BIRTH: composed EBM | state from the birth row, `EBMCreated` published with the real actor and badge `ebm_compose`, nothing published after it |
| 3 | BIRTH: authority | composition without `ebm_compose` fails through `CommissionFailed` and writes no EBM |
| 4 | DRIVEN: Validate and Activate | `EBMValidated` and `EBMActivated` published with `seuId`, final state Active, SEU reaches Operational |
| 5 | DEAD REFERENCE | a retired Pack makes Validate move the EBM to Retired, publish `EBMRetired` from the row, return `ebm_retired`; the Attention Item is raised by the action code in the same transaction |
| 6 | RETIRE | a Retired EBM has no next action, and Retire is never offered as a button on a Composed EBM |
| 7 | GUARD | no skip to Active, no return from Active |
| 8 | BUTTONS | Composed shows only Validate, for a holder of `ebm_validate` |
| 9 | ROUTE | the verb route moves the EBM and the old route returns 404 |

Fixtures to update in the same pass: `tests/testFixtures.ts` (`driveCommissioningToActive` grants `ebm_compose` through `grantTransitionBadge(actor, "EBM", BIRTH_STATE, "Composed")` and calls `transitionEntity`), `tests/cr104-mandatory-seu-eligibility-policies.test.ts` (`ebmsDB.create` status), `tests/seu-ebm-event-lifecycle-table.test.ts` (rewritten as above) and `tests/governance-ebm-sharpening.test.ts` (checked for `transitionEbm` and literal states). The recovery SQL for `ebms` drops the table with `CASCADE`, so the full recovery runs again, as for Objective.

### Build progress (EBM)

| # | Piece | State |
|---|---|---|
| 1 | Birth row, manual triggers, `EBMRetired` event (Step 1, rows 1 and 2) | Built ✅ |
| 2 | Recovery SQL and `eventSubscriptions.json` text (Step 1, rows 3 and 4) | Built ✅ |
| 3 | `ebmsDB.create` and `updateStatus` (Step 2) | Built ✅ |
| 4 | `compositionCompletedHandler` uses `beginBirth` (Step 3) | Built ✅ |
| 5 | `transitionEntity` takes a nullable `seuId` (D3), and `ebmAdapter` (Step 4, row 1) | Built ✅ |
| 6 | `validateEbm` and the action code `raise-ebm-retired-attention` (Step 4, rows 2 and 2a, D2) | Built ✅ |
| 7 | Delete `transitionEbm`, verb route, page buttons (Step 4, rows 3 to 5) | Built ✅ |
| 8 | Callers: `demoSimulator.ts`, `testFixtures.ts` (Step 4, row 6) | Built ✅ |
| 9 | Tests and fixtures | Built. Not run. |
| 10 | `07_EBM_Traceability.md` updated | Built ✅ |

## Entity 10: Ontology (Chapter 18)

Status: 🟡 Built. Run by the owner, clean. D1 to D5 are settled.

The entity type `Ontology` is the Concept. Its table is `ontology_concepts` (one row per version) and its state column is `status`. The states are `Draft`, `Active`, `Deprecated`, `Retired` and `Archived`. `transitionDefinitions.json` holds five rows: `Deprecated`, `Retired` and `Archived` (the forward hops), `Draft → Active` (verb approve, event `ConceptApproved`, version event `VersionActivated`) and `Draft → Draft` (verb approve, event `ConceptRejected`, the reject with a comment). The birth row does not exist. The CR-128 table lists the birth as `None → Active`, which follows the spec and not the code (finding 1).

Owner direction: the two seeds (`seedOntologyConcepts`, `seedTestOntology`) keep their bulk insert into `Active` and are outside this CR. Every other concept goes through `Draft` and publishes `ConceptCreated`.

### Findings

| # | Finding |
|---|---|
| 1 | The spec (Events and Lifecycles.md Ch.18) says `Active` is the initial state with no Draft. The code has a Draft and an approval queue (`/sdk/ontology/approvals`). `addConcept` for a new code and the `conceptCreated` subscriber insert `Draft`. `createConceptVersion` (a new version of an existing code, `composeConcept` and `syncConceptFromEntity`) inserts `Active` through the default in `insertConceptVersion` and the schema. |
| 2 | `ontologyDB.insertConceptVersion` writes `input.status ?? "Active"`. The recovery SQL carries `DEFAULT 'Active'` on `status` and `ontology_concepts_status_check`. `bulkInsertConceptVersions` (the seeds) writes `r.status ?? "Active"`. |
| 3 | `transitionConcept` is one more copy of the old steps. It evaluates the gate, applies the comment rules of the reject, calls `updateConceptStatus`, and publishes with `tenantId`. It resolves the target concept with `findLatestVersion`, so a hop always acts on the newest version of a code. |
| 4 | `createConceptVersion` deprecates the previous Active version at creation: a direct `updateConceptStatus(previous, "Deprecated")` and a literal `ConceptDeprecated` event, with no gate and no badge check. |
| 5 | `retireConceptForEntity` writes `Retired` directly and publishes `OntologyConceptRetired`. It has no caller in `src` or `tests`. |
| 6 | The Reject comment is stored in the table `ontology_concept_comments`. `transitionConcept` refuses a comment that repeats the most recent one. |
| 7 | `quickRetireConcept` runs Deprecate and then Retire as two separate calls. |
| 8 | `conceptCreatedHandler` is a real subscriber on `ConceptCreated`. It acts only on events whose payload has no `version`, which are proposals from a Pack or a form field, and inserts a `Draft` with the event actor and badge. Events published by the Ontology's own writes carry `version` and are ignored. |
| 9 | The seven routes `/sdk/ontology/{add,deprecate,retire,archive,compose,quick-retire}` and `/sdk/ontology/approvals/{approve,reject}` identify a concept by type, code and tenant, not by id. Their `route_authority` rows list `ontology_define` or `ontology_manage`, and `ontology_approve` for the two approval routes. |
| 10 | `syncConceptFromEntity` has callers only in tests (`sdk-authoring`, `dependency-graph-relationship-kind`, `deliverable-definition-event-lifecycle-table`), which need the `deliverable-name` concept to be Active when it returns. |
| 12 | `OntologyComposed` has no subscription in `eventSubscriptions.json` and no handler. The Events and Lifecycles.md text names `emitOntologyComposedIfUnregistered` as a Pack-proposal publisher, but that function is not in `src`. The proposals from a Pack or a form field are published as `ConceptCreated` by `emitConceptCreated` (called from `sdkAuthoring.ts`), and `conceptCreatedHandler` is the subscriber that creates the Draft. `composeConcept` publishes `OntologyComposed` as an unconsumed signal after its own write. |
| 11 | The ontology event for the hop is published with `tenantId` of the concept and `seuId` null. `transitionEntity` takes the tenant from the adapter. |

### Decisions

| # | Question | Recommendation |
|---|---|---|
| D1 | The birth row. | Settled (owner): `None → Draft`, verb `define` (the current creation badge `ontology_define` is kept), trigger `manual`, event `ConceptCreated`, no version event (the spec marks Add as Versioning No, and `VersionActivated` stays on `Draft → Active`). Every concept goes through Draft and every birth publishes `ConceptCreated`, including a new version of an existing code. `ConceptUpdated` is then published only by `updateConceptMeta`. The seeds are outside this CR. |
| D2 | `createConceptVersion` callers that insert `Active` today: a new version through `addConcept`, `composeConcept` and `syncConceptFromEntity`. After D1 each is born Draft. Who takes `Draft → Active`? | Settled (owner): `addConcept` and `composeConcept` leave the concept Draft for the approval queue, as a new code does. `syncConceptFromEntity` has no human in its callers, so it takes the approve hop at once with its own actor. |
| D3 | The previous Active version (finding 4). | Settled by precedent (Profile, Pack, Deliverable Definition): the function that takes `Draft → Active` (`approveConcept`) then calls `transitionEntity` for `Active → Deprecated` on the previous Active version. The direct write and the literal event in `createConceptVersion` are removed. |
| D4 | The Reject comment (finding 6). | Settled by precedent (CR-129 D4): `Draft → Draft` lists `policy-comment-required`, the repeat rule is dropped, and the comment goes to the table through the adapter's `addComment`. No schema change. |
| D5 | `retireConceptForEntity` (finding 5). | Delete it. It has no caller and is a direct status write that the generic function would otherwise have to carry. |

### Step 1: the data

| # | Change |
|---|---|
| 1 | Add the birth row to `transitionDefinitions.json`: Ontology, `None → Draft`, verb `define`, trigger `governed`, event `ConceptCreated`, version event null. |
| 2 | Write `"trigger": "manual"` on every other Ontology row. `Draft → Draft` lists `policy-comment-required`. |
| 3 | `ontology_concepts_schema_recovery.sql`: remove `DEFAULT 'Active'` from `status`. The status CHECK stays, because the seeds write the state directly and the table has five fixed states. |
| 4 | `eventSubscriptions.json`: the `ConceptCreated` description says every concept is born Draft. |

### Step 2: the database function

| # | Change |
|---|---|
| 1 | `ontologyDB.insertConceptVersion` takes a required `status` and writes it. The seeds' `bulkInsertConceptVersions` is unchanged. |
| 2 | `ontologyDB.updateConceptStatus` is unchanged. It writes only the status, so the author id and badge of a concept stay as its creation set them. |

### Step 3: the places that create a concept

| # | Place | After |
|---|---|---|
| 1 | `addConcept` (new code) | Calls `transitionEngine.beginBirth` for `Ontology` and writes the state it returns. It publishes the birth event last. |
| 2 | `createConceptVersion` (new version, from `addConcept`, `composeConcept` and `syncConceptFromEntity`) | Same as place 1. The deprecation of the previous Active version moves out (D3). It publishes `ConceptCreated` for every version. |
| 3 | `conceptCreatedHandler` | Calls `beginBirth` with `event.actor_id`, writes the state it returns, and publishes the birth event with the version in the payload, so the handler ignores it. |
| 4 | `composeConcept` | Publishes `OntologyComposed` after the birth event, unchanged. The result is Draft. |
| 5 | `syncConceptFromEntity` | Takes the approve hop through `transitionEntity` after the birth (D2). |

### Step 4: the hops

| # | Change |
|---|---|
| 1 | Add an `ontologyAdapter` to `entityAdapters.ts`: `findById` (`findConceptById`), state from `status`, `setState` through `updateConceptStatus`, tenant from the row, and `addComment` through `addConceptComment`. |
| 2 | `transitionConcept` finds the latest version, then calls `transitionEntity` with the comment as context. The comment rule check and the direct status write go. `approveConcept` calls `transitionEntity` for `Draft → Active` and then deprecates the previous Active version (D3). `deprecateConcept`, `retireConcept`, `archiveConcept` and `rejectConcept` keep their signatures. |
| 3 | Delete `retireConceptForEntity` (D5). |
| 4 | The routes keep their paths and their `route_authority` rows. They identify a concept by type, code and tenant, so the id-based verb route of Objective does not apply. |

### Ontology tests

| # | Test | Covers |
|---|---|---|
| 1 | DEFINITION: the six rows | verb, trigger, event, version event, the comment policy on `Draft → Draft`; the earlier test asserting exactly three rows is replaced |
| 2 | BIRTH: new code | born in the birth row's state, `ConceptCreated` published with the real actor and badge |
| 3 | BIRTH: new version | born Draft, `ConceptCreated` published, the previous Active version unchanged until approval |
| 4 | APPROVE | `Draft → Active` publishes `ConceptApproved` and the version event, and the previous Active version moves to Deprecated through its row |
| 5 | REJECT | refused without a comment, stores the trimmed comment with actor and badge, keeps the concept Draft |
| 6 | COMPOSE | the composed concept is Draft, `OntologyComposed` is published after `ConceptCreated` |
| 7 | HOPS | Deprecate, Retire and Archive publish their events, with no skip and no way back |
| 8 | PROPOSAL | a proposal event with no `version` creates a Draft through the birth row |
| 9 | SYNC | `syncConceptFromEntity` returns an Active concept |

Fixtures to update in the same pass: `tests/ontology-event-lifecycle-table.test.ts` (rewritten as above), `tests/cr101-domain-configuration-competency-union.test.ts` (checked for a state assumption after `addConcept`), and the three tests that call `syncConceptFromEntity`. `demoSimulator.ts` calls `approveConcept`, which keeps its signature.

### Build progress (Ontology)

| # | Piece | State |
|---|---|---|
| 1 | Birth row, manual triggers, comment policy (Step 1, rows 1 and 2) | Built ✅ |
| 2 | Recovery SQL and `eventSubscriptions.json` text (Step 1, rows 3 and 4) | Built ✅ |
| 3 | `insertConceptVersion` takes a required `status` (Step 2) | Built ✅ |
| 4 | Creation places use `beginBirth` (Step 3) | Built ✅ |
| 5 | `ontologyAdapter`, `transitionConcept` and `approveConcept` on `transitionEntity` (Step 4) | Built ✅ |
| 6 | Delete `retireConceptForEntity` | Built ✅ |
| 7 | Tests and fixtures | Built. Run by the owner, clean. |
| 8 | Ontology Traceability document updated | Built ✅ |

## Entity 11: SEU (Chapter 2, with Chapter 8)

Status: 🟡 Built. Run by the owner, clean (2026-10-22). D1 to D7 are settled. Plan tests 6 to 8 are not written.

The entity type `SEU` is the Software Engineering Unit. Its table is `seus` and its state column is `lifecycle_state` (`DEFAULT 'Pending'`, with `seus_lifecycle_state_check`). `transitionDefinitions.json` holds 19 SEU rows and no birth row. The live chain is `Pending → Configured → Commissioned → Activated → Operational`. The other states are `Failed`, `Suspended`, `Retired` and `Archived`.

### Flow today (SEU with its EBM)

| # | Step | Where | State written | Event published |
|---|---|---|---|---|
| 1 | The user clicks "Commission SEU" on an Objective, or "Commission a new SEU" on the SEU list, which opens `/seus/new`. The page lists the available Profiles (each shows its Template) as a radio group and posts the chosen Profile to `POST /objectives/:id/validate-commission`. That route checks that one Profile was chosen, that the Objective exists and that it has no SEU yet. It creates the SEU row itself, with the tenant of the Objective's sponsoring authority (or the default tenant) and the actor's author badge, then publishes `CommissionRequested`. `commissionSeu` is a second creation path, used by the API (`POST /commission`) and the tests. It adds the checks that the Objective is Active, is not Strategic, has no children, and that the Profile belongs to the Template, and it reuses an existing `Pending` SEU of the same Objective, Profile and Template without publishing. The web route `POST /objectives/:id/commission` is commented out (owner, dead code). | `web/objectives.ts`, `commissioning.ts`, `api/seus.ts` | `Pending` (column default) | `CommissionRequested` (literal) |
| 2 | `validateRequestHandler` evaluates the gate `Pending → Commissioned` for the actor (a probe, no state written) and runs the liveness checks. | `validateRequest.ts` | none, or `Failed` on a refusal or dead reference | `CommissionValidated`, or `CommissionFailed` |
| 3 | The user posts `compose-ebm`. The page stores the composition report on the SEU. With no unresolved conflict it publishes `CompositionCompleted` with the actor's author badge. | `web/objectives.ts` | none | `CompositionCompleted` |
| 4 | `compositionCompletedHandler` creates the EBM through the birth row (CR-128, Entity 9) and sets `seus.active_ebm_id`. | `compositionCompleted.ts` | EBM `Composed`; SEU stays `Pending`; `Failed` on error | `EBMCreated`, or `CommissionFailed` |
| 5 | The user validates the EBM (`validateEbm`), then activates it. | `commissioning.ts`, `web/seus.ts` | EBM `Validated`, then `Active` | `EBMValidated`, `EBMActivated` |
| 6 | `ebmActivatedHandler` runs `finalizeCommissioning`: system participant, Capabilities, Deliverables, then the hops `Pending → Configured` and `Configured → Commissioned`, the commissioning report, and `Commissioned → Activated`. Each hop chains correlation and cause. | `ebmActivated.ts`, `commissioning.ts` | SEU `Configured`, `Commissioned`, `Activated`; `Failed` on error | `SEUConfigured`, `SEUCommissioned`, `SEUActivated` |
| 7 | `executionEngineKickoff` takes `SEUActivated` and `attemptSeuCommenceWork` makes `Activated → Operational` when the commence-work Policy passes and no Pack Obligation is open. | `commissioning.ts` | SEU `Operational` | `SEUOperational` |

The SEU stays in `Pending` from step 1 to step 6. The only fact that says validation passed (step 2) is the event `CommissionValidated`, read by `withCommissionValidated` for the list page.

### Findings

| # | Finding |
|---|---|
| 1 | Eight rows have no caller in `src` and no event type. No event subscription or handler runs them. Whether they become governed hops for event subscribers is the owner's call (D5): `Pending → Validated`, `Validated → Composed`, `Composed → RuntimeAllocated`, `RuntimeAllocated → KnowledgeInitialised`, `KnowledgeInitialised → ParticipantsRecruited`, `ParticipantsRecruited → Commissioned`, `Commissioned → Configured`, `Configured → Activated`. They are the planned commissioning chain. Their states appear in `authorityVocabulary.json` (still read by the transition-definition seed and the identity seeds), the spec text and `tests/seu-ebm-event-lifecycle-table.test.ts`. |
| 2 | `Pending → Commissioned` (verb commission) changes no state. `validateRequestHandler` evaluates it as the authority gate for `seu_commission` with the original actor. It is also the row that makes the Validate link on `seus/index.ejs` appear (`possibleNextStates.includes('Commissioned')`, filtered by the held badge). No policy is attached to it. |
| 3 | `seusDB.create` omits the state and relies on `DEFAULT 'Pending'`. It is called by `commissionSeu` (core), by `POST /objectives/:id/validate-commission` (`web/objectives.ts`, which repeats the creation and the event) and by three tests. Both production callers then publish the literal `CommissionRequested` with `authorBadge` resolved for `seu_commission`. |
| 4 | `Failed` is written by `seusDB.updateLifecycleState(…, "Failed")` at five sites: `validateRequest.ts` (three), `compositionCompleted.ts` and `ebmActivated.ts`. Each then publishes the literal `CommissionFailed` with `{ stage, reason }`. The only row is `Pending → Failed` and its verb is `configure`. Failure from `Configured` or `Commissioned` (a later hop of `finalizeCommissioning` refused) has no row. |
| 5 | `finalizeCommissioning` makes the hops `Pending → Configured`, `Configured → Commissioned` and `Commissioned → Activated` with `transitionEngine.evaluate`, `updateLifecycleState` and a literal-fallback publish. Each event carries the `correlationId` of the commissioning and the `causationId` of the previous event. `transitionEntity` sets a new correlation id and has no cause. |
| 6 | `attemptSeuCommenceWork` makes `Activated → Operational`. It reads the row, resolves the badge, calls `policyEngine.evaluate` itself, raises an Obligation when the commence-work Policy blocks, raises Pack Obligations, then writes the state and publishes with the id chain of its caller. |
| 7 | `Suspended`, `Retired` and `Archived` have rows (`suspend`, `resume`, `retire`, `archive`) with no event, no caller and no page. A hop on them would publish `UNDEFINED_EVENT`. |
| 8 | Subscribers on SEU events stay: `executionEngineKickoff` on `SEUActivated`, `ebmActivated` on `EBMActivated`, `deliverableKickoff` on `SEUOperational`. Each effect lands on another entity type. |
| 9 | `seus.tenant_id` exists. The author id (`requested_by`) and `author_badge` are not changed by the CR. |
| 10 | The spec chapters name different states (`Requested`, `Executing`, `Monitoring`, `Completing`). The rows are marked "not in spec" in the table at the top of this CR, and the divergence is recorded there. It is not part of this entity. |

### Decisions

| # | Question | Recommendation |
|---|---|---|
| D1 | The birth row, and where an SEU is initiated. | Settled (owner): the birth row is `None → Initiated`, verb `commission` (badge `seu_commission`), trigger `manual`, event `CommissionInitiated`, no version event. An SEU is initiated only through `POST /objectives/:id/validate-commission`. The web route `POST /objectives/:id/commission` and the API route `POST /commission` are commented out. The one creation path calls `beginBirth`, passes `initialState` to `seusDB.create` and publishes `birth.eventType` as its last statement. `validateRequestHandler` drops the gate probe on finding 2, because the birth already ran authority; its report loses the item "Authority (badge seu_commission)". The creation is the Save button of D2. The remaining callers of `commissionSeu` (`demoSimulator.ts`, `commissionFromForm`, the tests) are out of scope for now (owner). |
| D2 | The commission form (`seus/new.ejs`) and the Validate link on the SEU list (finding 2). The row `Pending → Commissioned` is deleted with D5. | Settled (owner): the form takes an Objective and a Profile and has a Save button, like Draft on the authoring pages. Save is not versioned. Save starts the birth row: it checks that the Objective and the Profile are present, then calls the create (`beginBirth`, `seusDB.create`, the birth event). The form then shows the `nextActionsFor("SEU", state, actor)` buttons, read from the transition rows. The Demo path is out of scope for now (owner). `validateRequestHandler` stops being an event subscriber and becomes the action code of the row `Initiated → Validated` (verb `validate`, trigger `manual`), which runs in the transition transaction before the state write (owner). The gate probe and its badge checks are removed, because the hop's own gate checks the badge once. The subscription `CommissionRequested → validateRequest` is removed. The event of this row is `CommissionValidated` (owner). A dead reference takes the transition to `Failed` (D3), as `validateEbm` does for the EBM, and the form shows the error through `redirects.ts`. The birth row's event is `CommissionInitiated` (owner). |
| D3 | `Failed` (finding 4). Settled (owner): a dead reference takes the transition to `Failed`, as in the EBM, and the UI shows the error through `redirects.ts`. The liveness check is the action code of `Initiated → Validated`. On a dead reference it throws an error carrying the references. The transaction rolls back, so the SEU stays `Initiated` and nothing is published. The caller catches that error and calls `transitionEntity` for `Initiated → Failed` (the row's event `CommissionFailed` is published, published by the caller with `{ stage: "validate_request", reason, references, checks }` as its payload), then shows the error through `redirects.ts`. | Governed rows `Initiated → Failed`, `Validated → Failed` (composition and finalize failures happen while the SEU is `Validated`), `Configured → Failed` and `Commissioned → Failed`, verb `fail`, event `CommissionFailed`, no version event. The five sites call `transitionEntity` and then publish `result.event` themselves, with the payload `{ stage, reason, references, checks }` and the correlation and cause of the commissioning (the caller publishes, 2026-10-22). `transitionEntity` takes no payload input. The row with verb `configure` is replaced. |
| D4 | The id chain (finding 5). | The three hops of `finalizeCommissioning` and `Activated → Operational` call `transitionEntity` and publish `result.event` themselves with the `correlationId` and the `causationId` of the previous event, which `eventBus.publish` already returns. No change to `transitionEntity`. The last publish stays the last statement. |
| D1a | The rename. | `Pending` becomes `Initiated` everywhere: every row whose from-state is `Pending` (`Pending → Failed` and `Pending → Validated`). The row `Pending → Configured` becomes `Validated → Configured`, the first hop of `finalizeCommissioning`, `seus_lifecycle_state_check`, the partial unique index `idx_seus_objective_id_active_unique`, `SeuLifecycleState`, the `reusingExisting` test in `commissionSeu`, `seus/index.ejs`, the SEU tests and fixtures, the traceability text. The `DEFAULT 'Pending'` is removed. |
| D5 | The planned rows and the probe row (findings 1 and 2). | The probe row `Pending → Commissioned` is deleted from `transitionDefinitions.json`. `Pending → Validated` becomes the live row `Initiated → Validated` (D2). The other seven unwired rows stay unchanged and are listed in CR-130 (owner). |
| D6 | `Suspend`, `Resume`, `Retire`, `Archive` (finding 7). | Trigger `manual`. Events `SEUSuspended`, `SEUResumed`, `SEURetired` and `SEUArchived` are added to the rows and to `eventSubscriptions.json`. Versioning is No. The SEU detail page gets `actions` from `nextActionsFor("SEU", state, actor)` and one button per action, as the EBM page does. A route `POST /seus/:id/transition/:verb` calls `transitionEntity`, publishes `result.event`, and has a `route_authority` row for each verb (`seu_suspend`, `seu_resume`, `seu_retire`, `seu_archive`) and a `redirects.ts` entry. |
| D7 | `Activated → Operational` (finding 6). | Settled (owner), corrected after the first test run: `attemptSeuCommenceWork` keeps its call to `policyEngine.evaluate`, which resolves the SEU-scoped Policies the EBM composed from the SEU (the transition row's own `required_policy_ids` cannot see them), and keeps raising the commence-work Obligation on a block. It then keeps the Pack Obligation check, calls `transitionEntity` (trigger `governed`) for the hop, and publishes `SEUOperational` from `result.event` with the id chain of its caller as its last statement. It no longer writes the state itself. The order is the original one: Policy, then Pack Obligations. |

### Logic outside the rows

| # | Logic today | Where | Proposed home |
|---|---|---|---|
| 1 | Pre-create checks: the Objective is Active, is not Strategic, has no children, has no SEU yet, and the Profile belongs to the Template. | `commissionSeu` (and, in part, the `validate-commission` route) | Policies on the birth row (`requiredPolicyCodes`), so the Save button is refused by the gate and the checks are data. |
| 2 | The tenant of the new SEU: the Objective's sponsoring authority, else the default tenant. | The `validate-commission` route and `commissionSeu` (two copies) | The create function in core, called by the Save button. |
| 3 | Whether validation passed or failed: read from the events `CommissionValidated` and `CommissionFailed`. | `GET validate-commission`, `withCommissionValidated` in `core/seus.ts` | Unchanged (owner). `CommissionFailed` enables the Commission SEU button again, and `CommissionValidated` opens the EBM composition. |
| 4 | The liveness checks (dead Template, Profile or Pack reference) and the `Failed` write. | `validateRequestHandler` | Stays in the subscriber, which then calls `transitionEntity` for the `Failed` row (D3). A dead reference could raise its Attention Item through an action code on that row, as the EBM Retire row does. |
| 5 | Create Engineering Assets (system participant, Capabilities, Deliverables) before the hops `Configured` and `Commissioned`. | `finalizeCommissioning` | An action code on the row that enters `Commissioned`, which runs in the transition transaction before the state write. |
| 6 | Pack Obligations and the commence-work Obligation raised around `Activated → Operational`. | `attemptSeuCommenceWork` | Unchanged (D7): the SEU-scoped Policy check and the Pack Obligations stay in `attemptSeuCommenceWork`. Only the state write and the publish move to `transitionEntity` and the caller. |

Settled (owner): the SEU stays `Validated` during the whole EBM flow (flow steps 3 to 5), where it stays `Pending` today. The EBM flow is already under its own Transition Definitions. The first hop of `finalizeCommissioning` is therefore `Validated → Configured`.

### Step 1: the data

| # | Change in `transitionDefinitions.json` (SEU) |
|---|---|
| 1 | Birth row `None → Initiated`: verb `commission`, trigger `manual`, event `CommissionInitiated`, no version event. |
| 2 | `Pending → Validated` becomes `Initiated → Validated`: verb `validate`, trigger `manual`, event `CommissionValidated`, action code `validate-seu-request`, no version event. |
| 3 | `Pending → Configured` becomes `Validated → Configured`. `Configured → Commissioned` and `Commissioned → Activated` keep their events. All three get trigger `governed`, because `finalizeCommissioning` performs them. |
| 4 | `Pending → Failed` becomes `Initiated → Failed`. New rows `Validated → Failed`, `Configured → Failed` and `Commissioned → Failed`. All four: verb `fail`, trigger `governed`, event `CommissionFailed`, no version event. |
| 5 | Delete `Pending → Commissioned` (the probe, finding 2). |
| 6 | `Operational → Suspended`, `Suspended → Operational`, `Operational → Retired`, `Suspended → Retired` and `Retired → Archived`: trigger `manual` and the events `SEUSuspended`, `SEUResumed`, `SEURetired` (both Retire rows) and `SEUArchived`. Each is added to `eventSubscriptions.json` with a description. |
| 7 | `eventSubscriptions.json`: add `CommissionInitiated`. Remove only the subscription `CommissionRequested → validateRequest` (owner: the subscriber goes, the event publishing stays). The description of `CommissionRequested` stays. Rewrite the descriptions of `CommissionValidated`, `CommissionFailed`, `SEUConfigured`, `SEUCommissioned`, `SEUActivated` and `SEUOperational` so that they name `transitionEntity` and the new publishers. |
| 8 | The seven unwired rows keep their verbs and have no event. Their trigger is set to `governed`, so no button is offered for them (CR-130). With the seed default, `manual`, `nextActionsFor` would offer Compose on a `Validated` SEU. No new verb is needed: `commission`, `validate`, `fail`, `suspend`, `resume`, `retire`, `archive` are in `authorityVocabulary.json`. |

### Step 2: the schema

| # | Change |
|---|---|
| 1 | `seus_schema_recovery.sql`: `lifecycle_state TEXT NOT NULL` with no default, and `seus_lifecycle_state_check` removed (the set of states comes from the rows). |
| 2 | The partial unique index `idx_seus_objective_id_active_unique` lists the active states `Initiated`, `Validated`, `Commissioned`, `Configured`, `Activated`, `Operational`, `Suspended`. `Validated` is new, because the SEU stays there during the EBM flow. |
| 3 | The `ALTER` for the existing database: drop the default, drop the check, `UPDATE seus SET lifecycle_state = 'Initiated' WHERE lifecycle_state = 'Pending'`, drop and recreate the index. The recovery SQL drops `seus` with `CASCADE`, so the full recovery runs again, as for Objective. |
| 4 | `SeuLifecycleState` in `seuTypes.ts` gains `Initiated` and `Validated` and loses `Pending`. `ACTIVE_LIFECYCLE_STATES` in `seusDB.ts` follows the index. |
| 5 | Constants in `constants.ts`: `VALIDATE_SEU_REQUEST_ACTION_CODE` and the SEU state names the new code needs (`Validated`, `Configured`, `Commissioned`, `Activated`, `Operational`, `Failed`). |

### Step 3: the database function

| # | Change |
|---|---|
| 1 | `seusDB.create` takes a required `lifecycleState` and writes it. |
| 2 | `seusDB.updateLifecycleState` is unchanged. A new `seuAdapter` in `entityAdapters.ts` uses it: `findById`, state from `lifecycle_state`, `setState` ignoring the badge and actor, tenant from `tenant_id`. |

### Step 4: the commission form and Save

| # | Change |
|---|---|
| 1 | New `initiateSeu({ objectiveId, profileId, actorId, tenantId? })` in `core/commissioning.ts`, the one place that creates an SEU. It carries every check `commissionSeu` made: both ids are present, the Objective, the Profile and the Profile's Template exist, the Objective is Active, is not Strategic and has no children, and it has no SEU yet (an `Initiated` SEU of the same Profile and Template is reused without publishing). It takes the tenant from the input, else the Objective's sponsoring authority, else the default tenant. It calls `beginBirth`, `seusDB.create` with `initialState`, and publishes `birth.eventType` as its last statement. |
| 2 | `seus/new.ejs`: the form takes an Objective and a Profile and has a Save button that posts to `POST /seus`. The fixed "Submit" label goes. After Save the page shows the `nextActionsFor("SEU", state, actor)` buttons of the saved SEU. The Save button is shown to a holder of the birth badge (read through `findBirth`). The page is checked for CR-083. |
| 3 | `POST /seus` (Save) has a `route_authority` row (`seu_commission`) and a `redirects.ts` entry. The web route `POST /objectives/:id/validate-commission` is deleted with its row. `GET /objectives/:id/validate-commission` stays, and keeps reading the events (owner). |
| 4 | The SEU list: the Validate link for an `Initiated` SEU comes from `nextActionsFor`. It no longer depends on the deleted row. |

### Step 5: Validate and Failed

| # | Change |
|---|---|
| 1 | New action code `validate-seu-request` (`src/actions/validateSeuRequest.ts`, registered in `src/actions/index.ts`). It loads the SEU's Objective, Template and Profile and runs `checkRequestLiveness`. The caller passes an empty array in `context.livenessChecks`, and the action fills it. On a dead reference it throws a `SeuLivenessError` that carries the references. The transaction rolls back. |
| 2 | New `validateSeu({ seuId, actorId })` in `core/commissioning.ts` (the caller of the Validate button). It calls `transitionEntity` for `Initiated → Validated`. On success it publishes `result.event` with the payload `{ objectiveId, templateIds, profileIds, viewerTenantId, checks }`. On a `SeuLivenessError` it calls `failSeu`. |
| 3 | New `failSeu({ seuId, actorId, stage, reason, payload, correlationId, causationId })`. It calls `transitionEntity` for the `Failed` row from the SEU's current state, publishes `CommissionFailed` from `result.event` with the payload `{ stage, reason, references, checks }`, and returns the error for the UI. |
| 4 | `validateRequest.ts` and its registry entry in `eventHandlerRegistry.ts` are deleted. The five direct `Failed` writes (three in `validateRequest.ts`, one in `compositionCompleted.ts`, one in `ebmActivated.ts`) call `failSeu`. |
| 5 | `POST /seus/:id/transition/:verb` calls `nextActionsFor`, then `validateSeu` for `validate` or `transitionEntity` and `publishTransition` for the other verbs. It has a `route_authority` row per verb (`seu_validate`, `seu_suspend`, `seu_resume`, `seu_retire`, `seu_archive`) and a `redirects.ts` entry. A refused or failed hop shows its error through `redirects.ts`. |
| 6 | The SEU detail page gets `actions` from `nextActionsFor` and one button per action (D6). |

### Step 6: the commissioning hops

| # | Change |
|---|---|
| 1 | `finalizeCommissioning` makes the hops `Validated → Configured`, `Configured → Commissioned` and `Commissioned → Activated` through `transitionEntity`, and publishes each `result.event` with the `correlationId` and the `causationId` of the previous event (D4). The assets (system participant, Capabilities, Deliverables) are still created before the first hop. The last publish, `SEUActivated`, is the last statement. |
| 2 | `attemptSeuCommenceWork` keeps the `policyEngine.evaluate` call for the SEU-scoped Policies and the Pack Obligation check, then calls `transitionEntity` for `Activated → Operational` and publishes `SEUOperational` from `result.event` as its last statement (D7). |

### Step 7: callers that keep working

| # | Change |
|---|---|
| 1 | `commissionSeu` and `commissionFromExistingObjective` are deleted (owner). `commissionFromForm` and `demoSimulator.ts` call `initiateSeu` and then `validateSeu`; `initiateSeu` takes an optional `tenantId`, which the Demo passes. The tests call the fixture `initiateAndValidateSeu`, which does the same. `web-flow.e2e.test.ts` posts `POST /seus` and then the Validate verb route. `initiateSeu` is the one source of truth and carries every check `commissionSeu` made (owner): an Objective and a Profile are given, both exist and the Profile's Template exists, the Objective is Active, is not Strategic and has no children, and it has no SEU yet (an `Initiated` SEU of the same Profile and Template is reused). |
| 2 | The literal `"Pending"` of the SEU in `seusDB.ts`, `core/seus.ts`, `traceability.ts`, `web/objectives.ts` and `seus/index.ejs` becomes `Initiated`, where it means the SEU. The body of `commissionSeu` is not touched. |

### SEU tests

| # | Test | Covers |
|---|---|---|
| 1 | DEFINITION: the SEU rows | birth, validate, the three governed commissioning hops, the four `Failed` rows, the five manual lifecycle rows: verb, trigger, event, no version event |
| 2 | SAVE: birth | `initiateSeu` writes `Initiated`, publishes `CommissionInitiated` with the real actor and badge `seu_commission`, and nothing after it |
| 3 | SAVE: refusals | no Objective, no Profile, an Objective that has an SEU, and an actor without `seu_commission` each fail and write no row |
| 4 | VALIDATE: pass | the SEU is `Validated`, `CommissionValidated` carries the checks, and `GET validate-commission` shows them |
| 5 | VALIDATE: dead reference | a retired Pack leaves the SEU `Failed`, publishes `CommissionFailed` once with `{ stage, reason, references, checks }`, publishes no `CommissionValidated`, and the error reaches the UI |
| 6 | EBM FLOW | the SEU stays `Validated` through compose, EBM validate and EBM activate, then moves `Configured`, `Commissioned`, `Activated`, `Operational` with the event chain unbroken |
| 7 | FAILURE LATER | a composition failure and a finalize failure each take the `Failed` row of the current state |
| 8 | COMMENCE WORK | a blocking Policy raises the commence-work Obligation and the Pack Obligations, and publishes no `SEUOperational` |
| 9 | LIFECYCLE | suspend, resume, retire and archive publish their events; buttons come from `nextActionsFor` for a holder of the badge |
| 10 | GUARD | no skip from `Initiated` to `Activated`, no return from `Failed` |
| 11 | BUTTONS | `Initiated` shows Validate only to a holder of `seu_validate` |
| 12 | ROUTES | `POST /seus` and the verb route work, and the old `validate-commission` POST returns 404 |

Fixtures to update in the same pass: `tests/testFixtures.ts` (`driveCommissioningToActive`: the hop badges for `Validated`, `Configured`, `Commissioned`, `Activated`, and the `Initiated` and `Validated` states); `seusDB.create` callers (`cr104-mandatory-seu-eligibility-policies.test.ts`, three in `dependency-definition-engine.test.ts`) gain `lifecycleState`; the `"Pending"` literals in `engine.test.ts`, `acceptance.e2e.test.ts`, `service-dependency.test.ts`, `governance-ebm-sharpening.test.ts` and `seu-ebm-event-lifecycle-table.test.ts`; and `web-flow.e2e.test.ts`, which posts the old form. The tests that reach `commissionSeu` (`commissionFromFormSync` and the direct callers) are not changed.

### Build progress (SEU)

| # | Piece | State |
|---|---|---|
| 1 | Rows, events and subscriptions (Step 1) | Built ✅ |
| 2 | Schema, `SeuLifecycleState`, constants (Step 2) | Built ✅ |
| 3 | `seusDB.create`, `seuAdapter` (Step 3) | Built ✅ |
| 4 | `initiateSeu`, form, Save route, list link (Step 4) | Built ✅ |
| 5 | `validate-seu-request`, `validateSeu`, `failSeu`, verb route, detail buttons (Step 5) | Built ✅ |
| 6 | Commissioning hops, commence work (Step 6) | Built ✅ |
| 7 | `commissionSeu` replaced and the literals (Step 7) | Built ✅ |
| 8 | Tests and fixtures | Built. Not run. `tests/seu-event-lifecycle-table.test.ts` is new (definition, save, refusals, validate pass and fail, lifecycle, buttons, guard). The tests for the EBM flow, a later failure and commence work (plan tests 6 to 8) are not written. `web-flow.e2e.test.ts` and the direct `commissionSeu` callers use the new path. |
| 9 | `10_SEU_Commissioning_Traceability.md` updated | Built ✅ |

## Entity 12: Obligation (Chapter 23)

Status: 🔴 Investigated. Decisions D1 to D6 are open. Steps are written after they settle.

The entity type `Obligation` is a requirement raised against an SEU object. Its table is `obligations` (`status TEXT NOT NULL DEFAULT 'Identified'`, `version`, `revision_history`). `transitionDefinitions.json` holds 15 rows and no birth row: the chain `Identified → Analysed → Assigned → In Progress → Resolved → Verified → Closed → Archived`, `Closed → Reopened → In Progress`, and `Escalated` from every state before `Closed`. Every row has a verb, an event and the version event `VersionCreated`, carries the policy `policy-obligation-transition-baseline`, and has no `trigger` (the seed default is `manual`).

### Findings

| # | Finding |
|---|---|
| 1 | `createObligation` (`core/obligations.ts`) is the only writer. `obligationsDB.create` leaves the state to the column default `'Identified'`. The function then publishes the literal `ObligationCreated`. The caller supplies `actorId` and `authorBadge`. |
| 2 | `createObligation` has ten callers. Engine-raised, as the SEU's system participant: `raiseObligationForBlockedTransition`, `raiseObligationsForPackDefinitions`, `dispatchEngine`, `redispatch`, `deliverableKickoff`. Raised for a user: `knowledge.ts`, `findings.ts` (convert a Finding), `participantHome.ts`, `telemetry.ts`, `POST /api/seu/obligations`, and `demoSimulator.ts`. |
| 3 | `transitionObligation` is one more copy of the old transition steps. It calls `transitionEngine.evaluateGoverned` (which adds the Quality Gate check and requires the actor to hold a `participants` row in the SEU), writes the state with `obligationsDB.updateStatus` (which also adds 1 to `version`), then publishes the row's event and a second literal event, `ObligationTransitioned`. |
| 4 | `ObligationTransitioned` has two subscribers, `executionEngineKickoff` and `deliverableKickoff`, which retry a blocked SEU or Deliverable when an Obligation resolves. Their effect lands on other entity types, so both stay. |
| 5 | `evaluateGoverned` is also called by Evidence, Knowledge, AttentionItem, Decision, ExternalInteraction and Review. `transitionEntity` calls `transitionEngine.evaluate`, which has no Quality Gate check and no SEU participant check. |
| 6 | The buttons: `listObligationsWithNextStates` reads `findPossibleNextStates`, not `nextActionsFor`, so a button shows without the badge check. The detail page renders a button or a select and posts `targetState` to `POST /seus/:id/obligations/:obligationId/transition`. The API route `POST /api/seu/obligations/:id/transition/:target` does the same. |
| 7 | No engine code moves an Obligation. The only callers of `transitionObligation` are the web route, the API route and the tests. Every hop is taken by a human. |
| 8 | `reviseObligation` edits fields and appends to `revision_history`. It writes no state and publishes no event. It is not a transition and stays as it is. |
| 9 | `Escalated` has no row leaving it. |

### Decisions

| # | Question | Recommendation |
|---|---|---|
| D1 | The birth row: verb, trigger and event. | `None → Identified`, verb `identify` (badge `obligation_identify`), event `ObligationCreated`, no version event (the version column starts at 1). The trigger is open: the engine raises most Obligations, and users raise the rest. |
| D2 | The creation badge of an engine-raised Obligation. The engine acts as the SEU's system participant, whose badge is `system`. | Open. For Deliverable, commissioning kept the system participant and read only the state from the birth row, without `beginBirth`. |
| D3 | Hops through `transitionEntity` (finding 5). | An adapter that exposes the row's SEU makes `transitionEntity` call `evaluateGoverned` instead of `evaluate`, so the Quality Gate check and the participant check stay. The other SEU-scoped entities then use the same adapter shape in their own passes. |
| D4 | The second event (finding 3). | The caller publishes the row's event and then `ObligationTransitioned`, after a successful call. |
| D5 | The buttons (finding 6). | One button per action from `nextActionsFor("Obligation", state, actor)`, posting to `POST /seus/:id/obligations/:obligationId/transition/:verb`, with a `route_authority` row per verb and a `redirects.ts` entry. The API route keeps its `:target`. |
| D6 | The schema. | `obligations_schema_recovery.sql` drops `DEFAULT 'Identified'`. `obligationsDB.create` takes the state. |

## SDK authoring: how transitions work today

Scope: `core/sdkAuthoring.ts`, `web/sdkAuthoring.ts` and the seven transition functions it calls. The seven are `transitionPack`, `transitionTemplate`, `transitionProfile`, `transitionDeliverableDefinition`, `transitionServiceDefinition`, `transitionPolicyDefinition` and `transitionCapabilityDefinition`.

### The same steps in every copy

| # | Step |
|---|---|
| 1 | Load the row by id. If missing, return `not_found`. |
| 2 | Take the from-state from the row's own status. |
| 3 | Call `transitionEngine.evaluate`. Turn a refusal into a result with a text. |
| 4 | Check that a badge was resolved. |
| 5 | Write the new status with the entity's own `updateStatus`. |
| 6 | Publish the event from the row, with a made-up name if the row has none. |

### Where the copies differ

| # | Difference | Where |
|---|---|---|
| 1 | Rejecting a Pack from Validated to Draft needs a comment, refuses a repeat of the last comment, and saves the comment. | `transitionPack` |
| 2 | Activating from a terminal state creates a new version instead of changing the status. | `transitionTemplate`, `transitionProfile` |
| 3 | A missing badge returns `not_authorised` in one copy and throws in the others. | `transitionPolicyDefinition` |
| 4 | The made-up event name differs, for example `PackTransitioned` and `PolicyDefinitionTransitioned`. | each copy |
| 5 | The published object type is `PolicyDefinition` where the entity type is `Policy`. | `transitionPolicyDefinition` |
| 6 | The event payload carries different fields, for example `packVersion` for Pack only. | each copy |
| 7 | The result carries the row under a different name, for example `pack`, `template`, `policyDefinition`. | each copy |
| 8 | The web route chooses the copy with a chain of `if (kind === ...)`. | `web/sdkAuthoring.ts` transition route |

### Entity logic in the button list

| # | Where | Today |
|---|---|---|
| 1 | `canonicalForwardEdges` | Starts from the fixed state `"Draft"` and follows the first unvisited row. |
| 2 | `possibleRowActions` | Keeps rows that have a verb. It does not filter by trigger. |
| 3 | `possibleRowActions` | `requiresComment` is true only for Pack going to Draft. |
| 4 | `possibleRowActions` | Chooses the `publish` or `transition` route by whether the edge is on the forward chain. |
| 5 | `computeRowActions` | Keeps rows whose badge the user holds. This part has no entity logic. |

## The generic transition function

New code only. Nothing existing is changed in this pass. SchemaDefinition uses the new code first. Each other entity moves to it in its own pass, and the old copies are deleted at the end, when nothing calls them.

### The function

`transitionEntity({ entityType, entityId, targetState, actorId, context? })`, in a new file `src/domain/engine/entityTransition.ts`.

| # | Step |
|---|---|
| 1 | Load the row through the entity's adapter. Return `not_found` if missing. |
| 2 | The from-state is the row's own state, read through the adapter. |
| 3 | Call `transitionEngine.evaluate` and turn a refusal into a result with a text. The text is built the same way for every entity. |
| 4 | Throw if no badge was resolved. |
| 5 | Write the new state through the adapter. |
| 6 | Build the event named on the transition row, with the entity type, the row id, the tenant, the actor and the badge, and return it as `event`. The function publishes nothing (see "Change (owner, 2026-10-22)" below). `publishTransition(result)` publishes it for the caller. If the row names no event, it publishes an event whose type is `Undefined`, and then a second event of type `SDKAttention` with the same fields. `SDKAttention` has no consumer yet. |
| 7 | Return the updated row and the applied from-state and to-state. |

### The adapter

The generic function does not know which table holds an entity. The tables are reached through different DB modules (`packsDB`, `schemaDefinitionsDB` and so on), and the state is kept in a differently named column (`status` or `lifecycle_state`). An adapter tells the generic function how to reach one entity's table. It is a small lookup, and it holds no rules.

An adapter has four members:

| # | Member | What it does | SchemaDefinition |
|---|---|---|---|
| 1 | `findById(id)` | Returns the row. | `schemaDefinitionsDB.findById` |
| 2 | `getState(row)` | Returns the row's current state. | `row.lifecycle_state` |
| 3 | `setState(id, toState, authorityBadge, authorId)` | Writes the new state, and the badge and actor that did it. | `schemaDefinitionsDB.advanceLifecycle` |
| 4 | `tenantId(row)` | Returns the row's tenant, or null if the entity has none. | null |

New file `src/domain/engine/entityAdapters.ts`. The map starts with SchemaDefinition only. Each entity adds its adapter in its own pass. A missing adapter throws.

### The button list

A new function `nextActionsFor(entityType, fromState, actorId)` calls `findPossibleNextTransitions`, keeps the rows whose trigger is `manual`, and keeps the rows whose badge the actor holds. It has no entity logic.

### Rows without an event

A transition row must name an event. The check happens where rows are created, so the transition function rarely meets the gap. These two changes are made at the end, after all entities have moved to the generic function.

| # | Where | Change |
|---|---|---|
| 1 | `seedTransitionDefinitions.ts` | Throws when a row has no `eventType`. |
| 2 | The UI that creates a TransitionDefinition (`addTransitionDefinition` in `core/transitionDefinitions.ts`) | Refuses a row with no event. The form has no event field today, so one is added. |
| 3 | `constants.ts` | The name `SDKAttention` is a constant. | 

Today 62 of the 157 rows in `transitionDefinitions.json` have no `eventType`: SEU 15, Deliverable 12, Participant 10, ExternalInteraction 6, AttentionItem 5, Review 5, Template 3, Profile 3, Finding 2 and EBM 1. The seed would refuse all of them, which is why the change comes last.

### Rules found in the old copies, not built now

| # | Rule | Where it goes |
|---|---|---|
| 1 | Pack: a comment is required when rejecting. | Built as `policy-comment-required` on the reject row (Pack, Template, Profile). No flag. |
| 2 | Template and Profile: activating from a terminal state creates a new version. | Not built. The reactivation rows are removed (owner decision). |

SchemaDefinition needs neither rule, so no column is added now.

### Change (owner, 2026-10-22): the caller publishes the hop event

`transitionEntity` no longer publishes. A hop sometimes needs two events, a payload of its own or a chain of correlation and cause, and the caller knows these. A refused hop or a thrown error publishes nothing.

| # | Change |
|---|---|
| 1 | Step 6 of the function becomes: build the event the row names and return it as `event` in the result. Nothing is published. The `seuId` input stays and is carried on `event`. |
| 2 | `event` holds `eventType` (null when the row names none), `versionEvent`, `originatingObjectType`, `originatingObjectId`, `seuId`, `actorId`, `authorityBadge`, `fromState`, `toState`, `tenantId` and the default payload `{ fromState, toState }`. |
| 3 | Every caller (47 sites in `src`, listed in the progress table) publishes the returned event after a successful call, as its last statement. A caller that needs two events, another payload or an id chain builds them from `event`. |
| 4 | The rule for a row without an event (`UNDEFINED_EVENT` and `SDK_ATTENTION_EVENT`) moves with the publish. |
| 5 | Tests that call `transitionEntity` directly and assert on events publish the returned event as well. |

Status: 🟡 Built, not run. `transitionEntity` returns `event`; `publishTransition` is in `entityTransition.ts`. All 47 call sites in `src` publish after a successful call. Tests call the fixture `transitionAndPublish` (in `testFixtures.ts`), which calls `transitionEntity` and then `publishTransition`. `validateEbm` publishes the EBM hop events itself.

## Build progress (SchemaDefinition)

| # | Piece | State |
|---|---|---|
| 1 | `BIRTH_STATE`, `SDK_ATTENTION_EVENT` and `UNDEFINED_EVENT` in `constants.ts` | Built ✅|
| 2 | Partial unique index `transition_definitions_one_birth_per_entity` in the recovery SQL | Built ✅|
| 3 | Birth row and the explicit `manual` triggers in `transitionDefinitions.json` | Built ✅|
| 4 | `lifecycle_state` default removed in the recovery SQL | Built ✅|
| 5 | `transitionDefinitionsDB.findBirth` | Built✅ |
| 6 | `transitionEngine.beginBirth`, reading the from-state from the birth row | Built ✅|
| 7 | `schemaDefinitionsDB.create` takes its state from the caller | Built.✅ The seed, `createSchemaVersion` and `freshCreatedSchema` no longer compile or run until rows 8, 9 and 13 are built. |
| 8 | Seed reads the birth row once | Built.✅ The unused `lifecycle_state` field is removed from the seed type. |
| 9 | `createSchemaVersion` uses `beginBirth` and publishes the birth event | Built.✅ The automatic hops still run from the old fixed list until row 11. |
| 10 | `transitionEntity`, `entityAdapters.ts` and `nextActionsFor` | Built,✅ in `src/domain/engine/entityTransition.ts` and `entityAdapters.ts`. The event payload carries only the from-state and the to-state. |
| 11 | Automatic hops use `transitionEntity` | Built.✅ `autoAdvanceToPackaged` is renamed `autoAdvanceGoverned`, because it follows the governed rows and not a fixed target. It throws if a state has more than one governed next transition. |
| 12 | New transition route, detail page buttons | Built. The route has a `route_authority` row, a `redirects.ts` entry and a controller. It needs no ViewModel or view of its own, because it only redirects. The detail page ViewModel gains `actions`. The old `/publish` and `/reject` routes stay until the final cleanup. 🟡 Cleanup pending|
| 13 | Tests | Built. Eight tests changed and five added in `schema-definition-event-lifecycle-table.test.ts`, and one added in `schema-registry.test.ts`. The case "createSchemaVersion throws when the birth row is missing" is tested on `beginBirth` with an entity type that has no birth row, because removing the real birth row would break the other tests. Run by the owner, clean. |
| 14 | `seedTransitionDefinitions.ts` reports a row with no `eventType` as a problem and throws. Done last, once the 62 rows without an `eventType` are given one. | Not built |
| 15 | The TransitionDefinition UI gets an event field and refuses a row without one. Done last, after all entities have moved to the generic function. | Not built |

## Open questions

| # | Question |
|---|---|
| 1 | Finding has the states `Open`, `Resolved` and `Waived`. The convert row needs a target state that the `(entity_type, from_state, to_state)` key keeps distinct from `Resolved`. Is `Converted` added as a new Finding state in the Ontology? |
| 2 | Three `authoringMappings` pairs have no entity in `transitionDefinitions.json`: `TransitionDefinition define`, `TransitionDefinition publish` and `QualityGate waive`. Which states and transitions do TransitionDefinition and QualityGate receive so that these pairs derive from rows? |
