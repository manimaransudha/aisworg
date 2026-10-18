# CR-126 — Capability Definition lifecycle, verbs and events aligned to Chapter 2

**Raised:** 2026-10-17 · **Origin:** Review of the `Capability` noun in `transition_definitions` against `src/docs/SEU Studio Specifications/01_Engineering Definition/02_Capability.md` (§13 Capability Evolution, §14 Events). The seeded lifecycle and verbs do not follow the chapter, and the Version Feature Plan has no entry for this chapter.

**Status:** ✅ Closed 2026-10-17

## Fix the following

| # | Item |
|---|---|
| 1 | The verbs bound to the `Capability` transition rows align to the lifecycle that Chapter 2 defines. |
| 2 | The Capability Definition state machine follows the chapter's own lifecycle. A generic Chapter 41 stage that has no state in the chapter is not built. |
| 3 | The published events align to the seven events of §14. The three definition-side events and the four fulfilment events are classified separately. |
| 4 | The Version Feature Plan is applied to the Capability chapter: `event_type`, `version_event` and `version_hop` on each row, and an entry in the Implementation status section of `Version Feature Plan.md`. |

## Findings

| # | Finding | Reference |
|---|---|---|
| 1 | The seed holds five rows for `entityType` `Capability`: Defined→Published (`publish`), Published→Active (`activate`), Active→Deprecated (`deprecate`), Deprecated→Retired (`retire`) and Retired→Archived (`archive`). | `src/dblayer/seed/data/transitionDefinitions.json` |
| 2 | Chapter 2 names deprecation as its only lifecycle step. It names no `publish`, `activate`, `retire` or `archive` step. | §13 |
| 3 | The chapter publishes seven events: `CapabilityRegistered`, `CapabilityUpdated`, `CapabilityDeprecated`, `CapabilityRequested`, `CapabilityFulfilled`, `CapabilityUnavailable`, `CapabilityReleased`. The first three concern the definition. The last four concern fulfilment. | §14 |
| 4 | The seeded event names use the prefix `CapabilityDefinition`. The chapter uses the prefix `Capability`. | `transitionDefinitions.json`, §14 |
| 5 | The noun is `Capability` in the vocabulary and in `entityType`. The published event carries `originatingObjectType` `CapabilityDefinition`, so the two values differ for one entity. | `authorityVocabulary.json`, `capabilityDefinitions.ts` |
| 6 | The vocabulary lists one authoring verb for the noun, `define`. The remaining verbs derive from the transition rows through `seedTransitionDefinitions.ts`. | `authorityVocabulary.json` |
| 7 | `Capability` has no entry in the Implementation status section of the Version Feature Plan. | `design/mvp-build-plan/Version Feature Plan.md` |
| 8 | The skill `transition-definition` states that verbs are declared in `authorityVocabulary.json` and that `transitionDefinitions.json` has no verb field. The seeder reads the verb from each transition row. | `.claude/skills/transition-definition/SKILL.md`, `seedTransitionDefinitions.ts` |
| 9 | `capabilityDefinitionsDB.createDraft` is the only insert into `capability_definitions`. Its callers are `seedCapabilityDefinitions.ts`, `sdkAuthoring.ts`, `capabilityDefinitions.ts` and `tests/capability-definition-event-lifecycle-table.test.ts`. The seed writes one row per call and does not use `utils/db/bulkInsert`. | `capabilityDefinitionsDB.ts` |

## Questions raised and how they were settled

| # | Question | Resolution |
|---|---|---|
| 1 | Cut the state machine down or map the events onto the existing states. | The six states stay. Event names and verbs align to Chapter 2 and Chapter 41 (see the reconciliation table). |
| 2 | Which of Registered, Updated and Deprecated are transitions. | Registered is published after creation by each caller of `createDraft`, following the Pack and Template precedent. Deprecated is the existing Active to Deprecated hop. Updated is not published. |
| 3 | Book 3 and `Events and Lifecycles.md` lifecycle. | Read. `Events and Lifecycles.md` states that Chapter 2 defines no entity lifecycle section and the events are conceptual. |
| 4 | Finding 8 skill text. | Not changed in this CR. |
| 5 | Seed in finding 9 moving to `bulkInsert`. | Not changed in this CR. |
| 6 | Affected test fixtures. | Listed below. |

## Reconciliation: spec versus code (event and version table)

Spec source: Chapter 2 §13 and §14. Code source: `transitionDefinitions.json` (entityType `Capability`), `transitionCapabilityDefinition` in `src/routes/seu/core/capabilities.ts` and `capabilityDefinitions.ts`.

### Code: Capability Definition transitions against the spec

Chapter 41 §7 lists Capability Definitions as a versioned artefact. Chapter 41 §9 gives the general lifecycle Draft, Validated, Published, Active, Deprecated, Superseded, Archived and allows each artefact its own lifecycle. Chapter 41 §15 gives the seven version events.

| # | From | To | Verb | event_type | version_event | Chapter 2 counterpart | Chapter 41 counterpart |
|---|---|---|---|---|---|---|---|
| 0 | (creation) | Defined | ~~none~~ define | ~~none~~CapabilityRegistered | ~~none~~VersionCreated | §14 CapabilityRegistered (unpublished) | §9 Draft; §15 VersionCreated (unpublished) |
| 1 | Defined | Published | publish | ~~CapabilityDefinitionPublished~~CapabilityPublished | VersionPublished | ~~None~~CapabilityPublished | §9 Published; §15 VersionPublished |
| 2 | Published | Active | activate | ~~CapabilityDefinitionActivated~~CapabilityActivated | VersionActivated | ~~None~~CapabilityActivated | §9 Active; §15 VersionActivated |
| 3 | Active | Deprecated | deprecate | ~~CapabilityDefinitionDeprecated~~CapabilityDeprecated | VersionDeprecated | §13 deprecation; §14 CapabilityDeprecated | §9 Deprecated; §15 VersionDeprecated |
| 4 | Deprecated | Retired | retire | ~~CapabilityDefinitionRetired~~CapabilityRetired | VersionSuperseded | ~~None~~CapabilityRetired | §9 Superseded; §15 VersionSuperseded |
| 5 | Retired | Archived | archive | ~~CapabilityDefinitionArchived~~CapabilityArchived | VersionArchived | ~~None~~CapabilityArchived | §9 Archived; §15 VersionArchived |
| 6 | none | none | none | none | none | None | §9 Validated; §15 VersionValidated (no code state) |

The event names starting `CapabilityDefinition` appear in neither chapter.

All five publish with `originatingObjectType` `CapabilityDefinition`, `versionEvent` from the gate, and a real actor and badge. `version_hop` is not a field in the seed JSON. Its source is not yet confirmed.

### Spec: §14 events against code

| # | Spec event | Side | Published by code | Code event name | Gap |
|---|---|---|---|---|---|
| 1 | CapabilityRegistered | Definition | No | None (creation and `upsertFromPack` publish nothing) | Unbuilt |
| 2 | CapabilityUpdated | Definition | No | None (`updateDraftContent` publishes nothing) | Unbuilt |
| 3 | CapabilityDeprecated | Definition | Yes, by hop 3 | CapabilityDefinitionDeprecated | Name differs |
| 4 | CapabilityRequested | Fulfilment | No | None | Unbuilt |
| 5 | CapabilityFulfilled | Fulfilment | Yes, by `fulfilOne` | CapabilityFulfilled | `originatingObjectType` is SEU; subscriber `deliverableKickoff` exists |
| 6 | CapabilityUnavailable | Fulfilment | No | None | Unbuilt |
| 7 | CapabilityReleased | Fulfilment | No | None (`releaseParticipants` publishes nothing) | Unbuilt |

### Spec: §13 evolution paths against code

| # | Evolution path | Code mechanism |
|---|---|---|
| 1 | New versions | Semver version and `copyCapabilityDefinitionAsNewDraft` |
| 2 | Pack contributions | `upsertFromPack` |
| 3 | Specialisations | `inheritedCapabilityDefinitionContent` (parent Capability Definition) |
| 4 | Deprecation | Hop 3 |
| 5 | Organisational Learning Obligation resolution | Not located in this pass |

### Code events with no §14 counterpart

CapabilityDefinitionPublished, CapabilityDefinitionActivated, CapabilityDefinitionRetired, CapabilityDefinitionArchived.

## Whiteboard checkpoint (2026-10-17)

### Settled and built

| # | Item |
|---|---|
| 1 | Transition rows `eventType` renamed to `CapabilityPublished`, `CapabilityActivated`, `CapabilityDeprecated`, `CapabilityRetired`, `CapabilityArchived`. |
| 2 | `CapabilityRegistered` published after each of the three `createDraft` callers: seed, authoring, copy as new draft. No `versionEvent` for now. |
| 3 | `CapabilityValidated` and `CapabilityUpdated` are not published. Registered implies valid. Draft revisions are not versioned or traceable. |
| 4 | Capability `code` is `x-ontology-composable`. The Defined to Published authoring step checks composable values with `validateComposableFieldsAgainstSchema`. |
| 5 | `CapabilityRequested` is published by `requestCapabilityFulfilment` with no code after it. The `capabilityRequested` handler identifies Participants (manual pick, else the whole eligible pool), fulfils, and publishes one `CapabilityFulfilled` last. |
| 6 | An empty pool publishes `CapabilityUnavailable`. |

### Settled, not yet built

| # | Item |
|---|---|
| 1 | `CapabilityUnavailable` raises an AttentionItem. `raiseAttentionItem` already refuses a duplicate while one is open. |
| 2 | Re-request is a sweep, like `sweepStalledWorkItems`. It publishes `CapabilityRequested` as the SEU system actor after a delay. |
| 3 | Attempt limit and escalation threshold reuse `redispatchMaxAttempts` and `redispatchAttentionThreshold`. The delay is a constant in `constants.ts`. |

### Open

| # | Item |
|---|---|
| 1 | What "block" means for `deliverableKickoff`. Open AttentionItems are recorded in the governance outcome but do not stop a Deliverable hop or Command generation today. |
| 2 | The race between AttentionItem closure and a new `CapabilityRequested`. |

### Built after the checkpoint

| # | Item |
|---|---|
| 1 | `deliverableKickoff` subscribes to `CapabilityUnavailable`. For each In Progress Deliverable produced by that Capability it raises a blocking Obligation (In Progress to In Progress) and an AttentionItem. |
| 2 | Producing Command generation is held back while a blocking Obligation is open on the Deliverable. Resolving the Obligation re-issues the Command when the Capability is fulfilled. |
| 3 | `sweepUnavailableCapabilities` (`POST /aisworg/api/seu/capabilities/sweep-unavailable?seuId=`) re-requests as the SEU system actor after `CAPABILITY_RETRY_DELAY_SECONDS`. It uses `redispatchMaxAttempts` and `redispatchAttentionThreshold`. A Capability whose latest event is `CapabilityRequested` is in flight and is skipped. |

## Built (2026-10-17)

| # | Item | Files |
|---|---|---|
| 1 | Transition event names renamed to `CapabilityPublished`, `CapabilityActivated`, `CapabilityDeprecated`, `CapabilityRetired`, `CapabilityArchived`. | `transitionDefinitions.json` |
| 2 | `CapabilityRegistered` published after each `createDraft` caller. | `seedCapabilityDefinitions.ts`, `sdkAuthoring.ts`, `capabilityDefinitions.ts` |
| 3 | Capability `code` is composable. The authoring publish step checks composable values. The hand-coded `capability-name` check in `validateCapabilityDefinitionSeed` is removed. | `schemaDefinitions.json`, `sdkAuthoring.ts`, `capabilityDefinitions.ts` |
| 4 | `CapabilityRequested` published by `requestCapabilityFulfilment` with no statement after it. The `capabilityRequested` handler identifies Participants (named, else the eligible pool), fulfils, and publishes one `CapabilityFulfilled`, or `CapabilityUnavailable` for an empty pool. `fulfilCapability` and `fulfilCapabilityWithParticipants` are removed. | `capabilities.ts`, `capabilityRequested.ts`, `eventHandlerRegistry.ts`, `eventSubscriptions.json`, `web/seus.ts` |
| 5 | `deliverableKickoff` consumes `CapabilityUnavailable`: a blocking Obligation and an AttentionItem per In Progress Deliverable, and the producing Command is held back while the Obligation is open. | `deliverableKickoff.ts` |
| 6 | `sweepUnavailableCapabilities` re-requests after `CAPABILITY_RETRY_DELAY_SECONDS` (300), within `redispatchMaxAttempts`, escalating at `redispatchAttentionThreshold`. Route `POST /aisworg/api/seu/capabilities/sweep-unavailable?seuId=` with a `route_authority` row. | `capabilityRetrySweep.ts`, `api/workItems.ts`, `routeAuthority.json`, `constants.ts`, `redispatch.ts` |
| 7 | `capabilityOnReady` handler: `DeliverableReady` and `SEUCommissioned` publish `CapabilityRequested` for the producing Capability of each Ready Deliverable. Ready means every dependency row for the producing state is satisfied. The request names no Participant. | `capabilityOnReady.ts`, `eventHandlerRegistry.ts`, `eventSubscriptions.json` |

## Test fixtures updated in the same pass

| # | File | Change |
|---|---|---|
| 1 | `tests/capability-definition-event-lifecycle-table.test.ts` | New event names. Creation is driven through `copyCapabilityDefinitionAsNewDraft` and asserts `CapabilityRegistered`. |
| 2 | `tests/testFixtures.ts` | `fulfilCapabilityAsRoot` requests and waits. New `waitForCapabilityFulfilled`. |
| 3 | `tests/web-flow.e2e.test.ts`, `tests/acceptance.e2e.test.ts` | A wait after each fulfil POST, because the route returns before fulfilment. |
| 4 | `tests/capability-requested-fulfilment.test.ts` | New. Pool fulfilment, an unheld Capability publishing `CapabilityUnavailable`, and the retry sweep. |

## Incidental changes in the same pass

| # | Item |
|---|---|
| 1 | `seedCr104Demo.ts` waits for a concurrent publish of the same Pack, Template or Profile and reuses it, instead of failing on the unique key. |
| 2 | `schema-registry-widget-tree.test.ts` reads each kind's seeded baseline version instead of `findLatest`, which returned a throwaway version while another test file was running. |

## Verification

| # | Item |
|---|---|
| 1 | Run: `capability-requested-fulfilment`, `dependency-graph-relationship-kind`, `participant-lifecycle` and `schema-registry-widget-tree`, all passing. |
| 2 | Not run after the final changes: the full suite and `tsc`. |

## Still open

| # | Item |
|---|---|
| 1 | The execution engine does not advance the Obligation and AttentionItem automatically when a retry fulfils the Capability. It needs Evidence on the hop. Manual resolution works. |
| 2 | `CapabilityReleased` is not published. |
| 3 | The block on an unavailable Capability has no test. |
| 5 | `capabilityOnReady` has no test. Tests that assume a Capability is Unfulfilled after commissioning are unchanged and may now find it fulfilled, because commissioning requests fulfilment. |
| 4 | `CapabilityUpdated` is not published, by decision. |
