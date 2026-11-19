# CR-150 — AI Participant: skills carried by Packs and a provider adapter per AI provider

**Raised:** 2026-11-19 · **Origin:** the owner asked for a generic design that lets an AI Participant perform Work Items. A human who receives a Work Item knows the job and the platform. An AI Participant needs both supplied. The working notes are in [ai-participant-skills-design.md](../ai-participant-skills-design.md).
**Status:** 🟡 Raised — design in progress
**Related CRs:** none. The Pack, Profile, Dispatch Engine and adapter mechanisms the CR builds on already exist.

## Fix the following

- An AI Participant receives the platform protocol skill and the job skills for its provider with the Work Item.
- The skills are Packs. The skill details are Engineering Capital.
- `ai-provider-preference` in the Profile becomes an array, becomes mandatory and gains a `None` value.
- A Conditional Pack composes into the EBM when the Profile selects its provider.
- An AI adapter exists per provider. The adapter is the screen of an AI Participant. The first provider is Anthropic.

## Settled design

| # | Decision |
|---|---|
| 1 | The platform stays participant agnostic. An AI is another Participant. Dispatch selects it by Capability fulfilment, role and worktype, as for any Participant. |
| 2 | The platform protocol skill is one Mandatory Pack, the same for every provider. |
| 2a | The bootstrap instruction is a second Mandatory Pack. Each skill has its own Pack, so each versions separately and absorbs future provider nuances. |
| 3 | The job skills and prompts are one Conditional Pack per provider. |
| 4 | A skill is an Engineering Capital entry of the Pack. The entry keeps its shape `{type, url}`. For a skill type, `url` holds the skill text as markdown. The `url` field is marked `x-format: markdown` in the Pack schema, and the Pack form and the Pack view render it as markdown. The skill lives in the Pack. It needs no new table, route or entity kind, and no folder is exposed. |
| 4a | The provider is carried by the Ontology type, one type per skill kind and provider. Two provider Packs then do not raise an Engineering Capital conflict. A skill is versioned with its Pack. |
| 5 | `ai-provider-preference` is a multi-select (`referential-multi-select`, an array of Ontology codes). Today it holds one value. It is mandatory through the Ontology `is_mandatory` flag of the `profile-configuration` concept. It has a `none` value for an SEU that uses no AI, and `none` cannot be combined with a provider. |
| 6 | The Pack saves the Profile parameter values it names (`compositionConditions`, rows of parameter and value) when it is Conditional. The condition is processed only at the Profile. When the Profile is unravelled, the Active Conditional Packs whose condition the Profile's configuration meets are added to `profile_packs` under the list kind `conditional`. Composition and commissioning read `profile_packs` and need no change. |
| 7 | The Work Item carries all the information: the protocol skill and the job skills for every provider in the EBM, each labelled by type. It is built in `buildDeliverableExecutionContext` and stored as `execution_context`. |
| 8 | The bootstrap instruction is the single entry of its own Mandatory Pack (Settled 2a). It tells the AI to read the protocol skill and the job skill of its own provider. |
| 9 | One adapter class per provider (Anthropic, Gemini and so on). Each implements `ParticipantOnboardingAdapter` and `ParticipantAdapter`. |
| 10 | Work assignment (the code calls it delivery) reads the Participant named on the Work Item and uses that Participant's adapter. The adapter keeps the protocol entry and its own provider's job entry. |
| 11 | The adapter composes the provider specific prompt, calls the provider and offers the platform operations as tools. A tool call runs the core functions the Participant home uses, as the Participant. |
| 12 | The adapter holds the authentication for the return path. |
| 12a | The provider API key comes from the Profile, and no environment file is used. The Profile parameter `aiProviderCredentials` holds one row per provider, `{provider, apiKey}`. The key is stored as plain text, as `execution_targets.adapter_auth_ref` is. The EBM's settled `profileConfiguration` carries it, and the real client reads it from there (step 9). The key is write-only on screen: the Profile form takes it in a password input, and content shown to a user carries a masked key (`profileSecrets.ts`). A save that returns the mask keeps the stored key. |
| 12c | The key is not in the Work Item execution context. The context copies only an allowlist of Profile keys, and the new parameter is not in it. The EBM stores the key in its settled JSON, and the EBM Configuration tab shows only a fixed parameter list, which excludes it. A Profile copy carries the key. |
| 12b | A run starts in the background so the delivery handler is not held. A failed run raises an Attention Item for the Participant. |
| 13 | The adapter takes an injectable provider client. Tests use the mock client. The Demo uses the real client, which only a running server registers. |
| 13a | Only the Demo reaches Anthropic. Four guards: no test file imports the real client, and only the server start-up block of `app.ts` registers it, by dynamic import; the client refuses to run when `NODE_ENV` is `test` or `NODE_TEST_CONTEXT` is set; the key resolver refuses any SEU whose tenant code is not `demo`; and with no registered client, delivery throws and never reaches the network. |
| 13c | The Anthropic client calls a simulated endpoint by default. The endpoint runs inside the server process on `127.0.0.1:4010`, answers `POST /v1/messages` as the Messages API does (streaming and non-streaming), and uses no tokens. Its script provides Evidence, reports Completed with that Evidence, and stops. A `aiProviderCredentials` row for `anthropic` has an `endpoint` of `Simulated` (the default) or `Anthropic`. Only `Anthropic` bypasses the simulator and calls the live API with the row's key. A row is not needed for the simulator. For now the Demo points at the simulator. |
| 13b | The client runs its own tool loop on `claude-sonnet-5-5` (a lower model than Opus, chosen by the owner for the pilot) with effort `high`, thinking left at its adaptive default, and server-side fallbacks `default`. It stops on `refusal` or `max_tokens`, which raises the failure Attention Item. |
| 14 | Dispatch is unchanged. `human-on-ui` and `external-orchestrator` are unchanged. |
| 15 | The pilot is restricted to the Demo. Only the four Demo Profiles hold `anthropic`. The seed creates Human and AI Participants only (`SEEDED_PARTICIPANT_TYPES`). The Demo roster keeps its four Humans and three AIs. The Automated and External roster entries sit in `participants.parked.json`, which no seed reads. |
| 16 | The Demo Participants hold every Domain and Technology the Demo EBM can ask for, the `background-verification` and `cr104-demo-background-check` eligibility entries, and the Role and Work type competencies of their Capabilities, so the Demo shows the functionality and not Capability fulfilment. The three Demo AI Participants name the adapter `ai-anthropic`. |

## Observed in the code (2026-11-19)

| Point | Where |
|---|---|
| `Conditional` existed as an `installation-classification` value. No code path used it before this CR. Only Mandatory Packs were loaded and composed. | ontologyConcepts.json, packsDB.ts `findActiveMandatory` (line 378) |
| `aiProviderPreference` is a single string with Ontology values `anthropic`, `openai`, `google`, `azure-openai`, `aws-bedrock`. It is not mandatory. | profiles.ts lines 52 and 185, ontologyConcepts.json lines 4036 and 4251 to 4287, seuTypes.ts line 920 |
| `WorkItemExecutionContext` carries `engineeringCapital` entries of pack code, type and url, plus checklists and `profileConfiguration`. | workItemGenerator.ts lines 87 to 181, seuTypes.ts lines 902 to 924 |
| An Engineering Capital entry in a Pack is `{type, url}`. The conflict engine reports different links for one type across Packs. | schemaDefinitions.json line 655, conflicts/engineeringCapital.ts lines 29 to 41 |
| `url` is a plain string. The only check on it is that it is not empty. Unravel, conflict and settle compare it as text. | packs.ts line 374, unravelEngineeringCapital.ts, settleEngineeringCapital.ts |
| The form generator reads `x-format: markdown` on a list item field. The list editor then uses the markdown editor, and the Pack view renders the value as markdown. | formGenerator.ts line 83, _referentialListGroup.ejs lines 1405 to 1406, packs/view.ejs line 274 |
| Dispatch stores `participant_id` on the Work Item and publishes `WorkItemDispatched`. The `assignmentDelivery` subscriber then resolves the adapter from the tenant and the producing Capability. It does not read the Participant. | dispatchEngine.ts lines 79 to 168, assignmentDelivery.ts, executionTargetResolver.ts |
| `AssignmentOut` carries no Participant and no `execution_context`. | participantAdapter.ts lines 3 to 12 |
| `participants_master` has no adapter reference. Onboarding adapters resolve by Participant `type`. An `AI` onboarding adapter exists and records no provider. | participants_master_schema_recovery.sql, participantOnboardingRegistry.ts, aiOnboardingAdapter.ts |

## Pilot with Anthropic: build order

| Step | Work | Result |
|---|---|---|
| 1 | Draft the skill documents: the protocol skill, the bootstrap instruction and one Anthropic job skill. Drafts are in [design/ai-skills/](../ai-skills/). | Drafted 2026-11-19 |
| 2 | Add the Engineering Capital types to the Ontology (protocol, bootstrap and one job type per provider, starting with Anthropic). Mark `url` as `x-format: markdown` in the Pack schema and update its help text. | Data change |
| 3 | Author three Packs: the Mandatory protocol Pack, the Mandatory bootstrap Pack and the Conditional Anthropic Pack, with the drafts as the entry text. | Packs exist |
| 4 | Change `ai-provider-preference` to a mandatory multi-select with `none`. Profile seeds take `none`, the three that named a provider keep it, and the demo Profiles take `anthropic`. | Built pending testing 2026-11-19 |
| 5 | Save the condition on the Conditional Pack. Match it when the Profile is unravelled and write the matching Packs to `profile_packs`. | Built pending testing 2026-11-19. Anthropic Pack is selected only when the Profile holds `anthropic`. |
| 6 | Add `participantId` and `executionContext` to `AssignmentOut`. The execution context already carries the Engineering Capital entries with their `url`. | Built pending testing 2026-11-19 |
| 7 | Name the adapter on the Participant row (`participants_master.adapter`, nullable) and resolve it in work assignment. A Participant with no adapter follows the Capability's execution target as before. | Built pending testing 2026-11-19 |
| 8 | Build the Anthropic AI adapter with a mock client: skill selection, prompt composition, tools, a client registry. The pilot Participant is added to the Demo roster in step 9, when a client is registered. | Built pending testing 2026-11-19 |
| 9 | The real Anthropic client, enabled for the Demo only, then a live run on a Demo SEU commissioned from a Profile version that holds the key. | Client built pending testing 2026-11-19. No live call has been made. |

## Accepted trade-offs

| # | Trade-off |
|---|---|
| 1 | The markdown flag applies to `url` for every Engineering Capital entry. Entries that hold a real link also open in the markdown editor and render as markdown. |
| 2 | The field is named `url` and holds text for a skill. The help text states this. |
| 3 | Each Work Item copies the skill text of every provider in the EBM. |
| 4 | A skill edit makes a new Pack version. |

## Test fixtures updated in the same pass

| File | Change |
|---|---|
| tests/schemaFixtures.ts | The maximal Profile holds `[schema-fixture-ai]`, an array. `FIXTURE_VERSION` moves to 1.0.7. |
| commission-profile-choice, cr088-filter-shaped-overrides, cr107-execution-engine-deliverable-kickoff, cr108-obligation-model-seu-execution (3 seeds), cr109-work-item-generator (2 seeds), objective-lifecycle, profile-event-lifecycle-table, seu-event-lifecycle-table, tenant-contract, web-flow.e2e, sdk-authoring (2 contents) | Each Profile seed sets `aiProviderPreference: ["none"]`. |
| Pack and Ontology | Step 2 and step 3 changes still need a check for tests that count Engineering Capital concepts or Mandatory Packs. |
| tests/schemaFixtures.ts (step 5) | The maximal Pack carries `compositionConditions`. `FIXTURE_VERSION` moves to 1.0.8. |
| tests/cr150-conditional-packs.test.ts | New. Covers Conditional Pack validation and the Profile hop. |
| tests/participant-adapters.test.ts (step 6) | The external-orchestrator test asserts that the delivered assignment carries `participantId` and the `executionContext` with its Engineering Capital entries. |
| tests/participant-adapters.test.ts and tests/testFixtures.ts (step 7) | A new test registers an adapter, gives a fixture Participant that adapter, and asserts the assignment reaches it and not the Capability's external-orchestrator target. `ensureEligibleParticipant` takes an optional adapter. |
| tests/cr150-simulated-anthropic.test.ts | New. The turn logic and the wire formats of the simulated endpoint, as pure functions. No server is started. |
| tests/cr150-profile-secrets.test.ts | New. Masking, redaction of shown content, and restoring a masked key on save, with no database. |
| tests/schemaFixtures.ts (credentials) | The maximal Profile carries `aiProviderCredentials`. `FIXTURE_VERSION` moves to 1.0.9. |
| tests/cr150-ai-skills.test.ts (step 8) | New. Skill selection, prompt composition, the five tools and the mock client, with no database. |
| tests/cr150-anthropic-adapter.test.ts (step 8) | New. A dispatched Participant's scripted run provides Evidence and reports status, a rule failure reaches the model as text, a failed run raises an Attention Item, and a missing skill or client is refused at delivery. |

## Verification runs

`tsc` was run after each step and is clean. `db:clean-slate` and the tests have not been run. Steps 1 to 8 are built pending testing. Step 9: the client is built and no live run has been made.

## Still open

| # | Point |
|---|---|
| 2 | The mechanism of the adapter's authentication (session, token or API). A build detail for step 8. |
