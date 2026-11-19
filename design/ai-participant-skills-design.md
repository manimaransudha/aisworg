# AI Participant Skills: Design Checkpoint

**Status:** Whiteboard. No CR raised. Nothing built.
**Scope:** A generic design that lets an AI Participant perform Work Items on the platform. It is independent of any earlier CR.

## 1. Problem

A human Participant who receives a Work Item already knows how to do the job. The human also knows how to use the platform: do the work, report status, raise an Attention Item when stuck.

An AI Participant has neither by default. The platform has to supply both as skills, and the AI has to follow them.

| Kind of skill | Content | Source |
|---|---|---|
| Platform protocol skill | How to behave as a Participant: read the Work Item, use Evidence and Knowledge, report status, raise Attention Items, stay within roles | Same for every AI provider |
| Job skill and prompts | How to perform the job for a Work Item type, Role or Deliverable | Specific to the AI provider |

Following a skill is not left to the AI alone. The platform guards that already apply to every Participant (badges, route authority, completion rules, non-waivable gates) enforce the behaviour.

## 2. Settled

| # | Decision |
|---|---|
| 1 | Skills are delivered as Packs. The skill details are Engineering Capital inside the Pack. |
| 2 | The platform protocol skill is one Mandatory Pack. It composes into every EBM and is the same for all providers. |
| 3 | Job skills and prompts are provider specific. There is one Pack per AI provider (for example Anthropic, Gemini). |
| 4 | Each provider Pack is defined as Conditional. |
| 5 | The Profile selects the provider. The Profile Configuration Parameter `ai-provider-preference` (field `aiProviderPreference`) is the selector. |
| 6 | The platform is participant agnostic. A Capability or Participant does not record "this AI participant runs on provider X". |
| 7 | `ai-provider-preference` becomes an array, because some organisations use several providers. Today it holds one value. |
| 8 | `ai-provider-preference` becomes mandatory and gains a `None` option, chosen when AI is not used. |
| 9 | Dispatch does not check who the Participant is. It checks only the Capability criteria, as today. |
| 10 | The Work Item handed over carries the information a Participant can use. The Participant uses the part that applies to it. |
| 11 | The Work Item carries all the information: the protocol skill and the job skills for every provider in the EBM, each labelled by provider. The dispatch engine hands over whatever is required. |
| 12 | A Profile already selects Packs. No new Pack selection mechanism is built. |
| 13 | The Conditional condition is declared and evaluated when the AI provider is selected in the Profile configuration. |
| 14 | The skill payload goes where the Work Item execution instructions are generated: `buildDeliverableExecutionContext` in `workItemGenerator.ts`, stored as the Work Item `execution_context`. |
| 15 | There is one AI adapter per provider (an Anthropic AI adapter, a Gemini AI adapter, and so on). The adapter holds the provider details. |
| 16 | The adapter, not dispatch and not the Participant record, knows the provider. It selects the provider's job skills from the Work Item and tells its AI what to read. |
| 17 | Adapters are the interface between dispatch and a Participant. They provide what dispatch needs to assign a Work Item to a Participant. An adapter is extended to hold or interface to whatever is required, and that is built as part of this work. |
| 18 | The execution target keyed by tenant and Capability is not the place to choose a provider adapter, because the Capability is participant agnostic. How a Participant is linked to its adapter is open. |
| 19 | The bootstrap instruction text is a Pack contribution from the Mandatory protocol Pack, versioned with the skills. |
| 20 | The AI acts through the Participant's own platform identity and badges, under the same route authority checks as a human. |
| 21 | The bootstrap text needs no new contribution kind. It is carried by the Mandatory protocol Pack as an ordinary Pack entry. |
| 22 | The adapter holds the authentication for the return path. The AI's tool calls reach the platform through the adapter. |
| 23 | The EBM holds the provider information. Dispatch reads the EBM and includes the job details needed for the Work Item. |

## 3. Design as understood

1. The Profile sets the providers through `ai-provider-preference`, an array of values.
2. A provider Pack is Conditional on that parameter. Composition includes the Anthropic Pack when the array holds Anthropic and the Gemini Pack when it holds Gemini. `None` includes no provider Pack.
3. The composed EBM holds the protocol skill (Mandatory Pack) and the job skills for every selected provider.
4. Dispatch assigns a Work Item on the Capability criteria alone. The handed-over Work Item carries the protocol skill and the job skills from the EBM for the providers it holds. The job skills are labelled by provider.
5. A human Participant ignores the skill payload and works as today.
6. Dispatch reads only the EBM. It does not read the Template, Profile or Pack directly.

## 4. Verified facts (searches run on 2026-11-19)

| Fact | Evidence |
|---|---|
| `Conditional` exists as an `installation-classification` Ontology value | `src/dblayer/seed/data/ontologyConcepts.json:1426` |
| Composition has a code path for Mandatory Packs: Active Mandatory Packs are loaded and composed into every Template | `src/dblayer/packsDB.ts:378` |
| No Conditional Pack implementation exists. Searched `installation_classification` and `installationClassification` across `src/**/*.ts` and `Conditional` in `src/domain/engine/*.ts` | The only engine hit is a commented line in `profileCompositionUnravel.ts:528` |
| `packsDB.create` and `packsDB.update` default the classification to `Mandatory` | `src/dblayer/packsDB.ts:49`, `:111` |
| The Profile carries the parameter `aiProviderPreference` mapped to `ai-provider-preference` | `src/routes/seu/core/profiles.ts:52`, `:185` |
| `aiProviderPreference` is listed among the parameters read by the Work Item generator | `src/domain/engine/workItemGenerator.ts:101-102` |
| The Work Item execution instructions are `WorkItemExecutionContext`, built by `buildDeliverableExecutionContext` from the EBM settled view and stored in `execution_context` | `src/domain/engine/workItemGenerator.ts:116-181`, `src/dblayer/seuTypes.ts:897-924` |
| The execution context already carries `engineeringCapital` (pack code, type, url) taken from `settled.engineeringCapital.result`, plus checklists and `profileConfiguration` | `src/domain/engine/workItemGenerator.ts:87-98` |
| `profileConfiguration.aiProviderPreference` is typed as a single `string` | `src/dblayer/seuTypes.ts:920` |
| An Engineering Capital entry in a Pack is `{type, url}`, with `type` driven by the Ontology (`engineering-capital`). The schema calls it a minimal declaration for now. | `src/dblayer/seed/data/schemaDefinitions.json:655-690` |
| The conflict engine reports a conflict when two Packs give different links for the same Engineering Capital type | `src/domain/engine/conflicts/engineeringCapital.ts:29-41` |
| Engineering Capital is a Pack contribution kind ("Reference knowledge and assets") | `src/docs/SEU Studio Specifications/01_Engineering Definition/01_Pack.md:266` |
| A checklist item already has a `participant` attribute with values `AI`, `AI+human`, `human` | `src/dblayer/seuTypes.ts:73` |

## 5. Open points

| # | Point | State |
|---|---|---|
| 1 | Is `ai-provider-preference` the parameter that selects the provider? | Answered yes. It becomes an array (see Settled 7 and 8). |
| 8 | With several providers in the EBM, how does the Participant know which job skills apply to it? | Settled 9 to 11: dispatch does not choose. The Work Item labels each provider's skills and the Participant picks its own. |
| 9 | Whether `None` is exclusive (cannot be combined with a provider) | Not discussed |
| 10 | Schema, Ontology and seed changes for the array and mandatory parameter, and the Profiles and test fixtures they affect | Not read yet. Needs approval before any change. |
| 2 | Where a Conditional condition is declared and evaluated | Settled 12 and 13. The exact code location is not read yet. |
| 3 | How `aiProviderPreference` flows from the Profile into the EBM settled view | Read as far as `configurationParameter(settled, key)` in `workItemGenerator.ts:107`. The Profile to EBM step is not read. |
| 4 | The shape of the skill payload inside `WorkItemExecutionContext` (the current `engineeringCapital` entry holds pack code, type and url only, with no skill text or provider label) | Location settled (14). Shape open. |
| 11 | `aiProviderPreference` is typed `string` in `WorkItemExecutionContext`. It becomes an array. | Follows Settled 7. Not changed. |
| 5 | The shape of the skill payload in Engineering Capital (skill text, prompt, tool list, output contract) and how it is versioned | Not discussed |
| 6 | Whether a provider Pack may hold job skills per Role, Work type or Deliverable | Not discussed |
| 7 | Authoring path for the Conditional classification (Pack validator, SDK authoring, Ontology) | Not read yet |

## 5a. Proposed, not yet decided: skill storage

| Item | Proposal |
|---|---|
| Storage | The skill is a document at the `url` of an Engineering Capital entry. The platform stores the pointer and the type only. |
| Provider label | Carried by the Ontology type, one type per skill kind and provider (for example a protocol type and one job type per provider). No new schema property. |
| Why distinct types | Two provider Packs that use the same type with different links raise an Engineering Capital conflict. Distinct types avoid it. |
| Version | The url should be pinned to a version, otherwise the Participant reads whatever the url returns at that time. |
| Alternative | Inline skill text in the Pack. It needs a schema change and enlarges the Pack and every `execution_context`. |

## 5b. Adapter (next part, started)

| Fact | Evidence |
|---|---|
| A delivery adapter mechanism exists. `ParticipantAdapter.deliverAssignment(assignment, target)` is resolved by execution mode. Modes are `human-on-ui` and `external-orchestrator`. | `src/adapters/participantAdapter.ts`, `src/adapters/adapterRegistry.ts`, `src/dblayer/seuTypes.ts:721` |
| The execution target is resolved per tenant and Capability, not per Participant. It holds mode, endpoint and auth reference. | `src/adapters/executionTargetResolver.ts`, `src/dblayer/executionTargetsDB.ts` |
| `external-orchestrator` POSTs the assignment as JSON to the endpoint with a bearer token. | `src/adapters/externalOrchestratorAdapter.ts` |
| Delivery is an event handler that reads the Work Item and assembles the assignment. | `src/adapters/assignmentDelivery.ts` (`assignmentDeliveryHandler`) |
| `AssignmentOut` carries no `execution_context`, so the skill payload and the bootstrap instruction do not reach an adapter today. | `src/adapters/participantAdapter.ts:3-12`, `src/adapters/assignmentDelivery.ts:40-56` |
| Onboarding adapters are a separate mechanism. They create Participants in `participants_master`. An `AI` onboarding adapter exists and records no provider. | `src/adapters/aiOnboardingAdapter.ts` |

Settled 15 and 16 replace the earlier reading: the provider adapter knows the provider, not the endpoint.

Open: how a Participant is linked to its adapter (Settled 18); extending `AssignmentOut` with the execution context; how the AI authenticates to report status; where the bootstrap instruction text comes from.

## 5c. AI provider adapter: proposed design

Adapters are mocks today and are the conduit between the platform and a Participant. The proposal below builds the AI provider adapter on the two adapter families that exist.

### Verified flow today

| Step | What happens | Evidence |
|---|---|---|
| 1 | Dispatch selects a Participant from the Capability's active fulfilments, filtered by the Work Item role and worktype, and stores `participant_id` on the Work Item | `src/domain/engine/dispatchEngine.ts:79-135` |
| 2 | Dispatch publishes `WorkItemDispatched` with `payload.participantId` | `src/domain/engine/dispatchEngine.ts:157-168` |
| 3 | The `assignmentDelivery` subscriber receives the event and calls `deliverAssignmentForWorkItem(workItemId)` | `src/dblayer/seed/data/eventSubscriptions.json:49`, `src/adapters/assignmentDelivery.ts:94` |
| 4 | Delivery reads the Work Item, Command and Deliverable, resolves the adapter from the tenant and the producing Capability, and calls `deliverAssignment` | `src/adapters/assignmentDelivery.ts:60-90`, `src/adapters/executionTargetResolver.ts` |
| 5 | The delivery code never reads the selected Participant. `AssignmentOut` has no Participant and no `execution_context`. | `src/adapters/participantAdapter.ts:3-12` |
| 6 | A Participant row holds `type`, competency, capabilities, `authorised_badges`, `user_id`. It holds no adapter reference. | `src/dblayer/recovery/participants_master_schema_recovery.sql` |
| 7 | Onboarding adapters are resolved by Participant `type` (`AI`, `Human`, `Automated`, `External`) and return the data for a new `participants_master` row | `src/adapters/participantOnboardingRegistry.ts`, `src/adapters/participantOnboardingAdapter.ts` |

### Proposal

| # | Element | Design |
|---|---|---|
| 1 | One class per provider | An Anthropic AI adapter and a Gemini AI adapter. Each implements both `ParticipantOnboardingAdapter` and `ParticipantAdapter`. |
| 2 | Adapter key | Each adapter has a key, an Ontology code such as the `ai-provider-preference` values (`anthropic`, `google`). The key is how the platform finds the adapter and has no meaning to dispatch. |
| 3 | Reaching the Participant | The adapter that onboards a Participant is the Participant's screen. Work assignment reads the Participant named on the Work Item and resolves its adapter. How the Participant row names its adapter is a build detail (extend `type` or add a column). |
| 4 | Not the Capability | The execution target is keyed by tenant and Capability. Any eligible Participant can fulfil the Capability, so the screen belongs to the Participant. |
| 5 | Dispatch | Unchanged. It still matches on Capability criteria and Work Item role and worktype. |
| 6 | `AssignmentOut` | Gains `participantId` and the Work Item `execution_context`. The adapter reads the skill entries from `execution_context.engineeringCapital`. |
| 7 | Skill selection | The adapter keeps the entries whose type is the protocol type and its own provider's job type, and ignores the others (Settled 11 and 16). |
| 8 | Bootstrap instruction | The adapter composes the provider specific prompt from the selected skill entries and the Work Item content. The instruction text source is still open (see Open). |
| 9 | Invocation | The adapter calls its provider API with the prompt. Platform operations are offered to the AI as tools (report status, raise Attention Item, provide Evidence, create Knowledge, create Decision). |
| 10 | Return path | A tool call runs the same core functions the Participant home uses, as the Participant. The Participant needs a platform identity (`user_id`) and the badges the operations require, recorded on its `participants_master` row. |
| 11 | Mock first | The adapter takes an injectable provider client. Tests and the demo use a mock client with no network. The real client comes later. |
| 12 | Human delivery | `human-on-ui` and `external-orchestrator` stay as they are and keep using the Capability execution target. |

### Terms

Work assignment is the step after dispatch in which the platform hands the Work Item to the selected Participant. The code calls it delivery (`assignmentDelivery`, `deliverAssignment`). For a human, work assignment makes the Work Item appear on the human's screen. For an AI Participant, the AI adapter is the Participant's screen.

### Why there is no conflict

An AI is another Participant. Dispatch selects it by Capability fulfilment, role and worktype, as for any Participant. A Cursor Participant that fulfils the defect-fix Capability is eligible like a human who fulfils it. The adapter is the screen that reaches the Participant, as the web UI reaches a human. The platform concept stays participant agnostic, and the adapter is the conduit.

### Open

| # | Point |
|---|---|
| 1 | Source of the bootstrap instruction text. Settled 19 and 21. Closed. |
| 2 | How the Participant row names its adapter (extend `type` or a new column). A build detail. |
| 3 | How the AI authenticates to the platform for the return path. Settled 20 and 22. The adapter holds it. The mechanism inside the adapter is a build detail. |
| 4 | The skill entry shape in Engineering Capital (Settled proposal in 5a) |

## 6. Next step

Review section 5c. Then read where composition evaluates a Pack against a Profile configuration value (open points 2 and 3). No design for Conditional composition is proposed before that reading is done.
