# How an entity transitions

Scope: the state-change path only. Badge resolution, seed data, events and subscribers are named where the path hands over to them and are not described.

Sources read: `src/domain/engine/transitionEngine.ts`, `entityTransition.ts`, `entityAdapters.ts`, `executionEngine.ts`, `deliverableKickoff.ts`, `src/dblayer/transitionDefinitionsDB.ts`, `src/dblayer/recovery/transition_definitions_schema_recovery.sql`, `src/actions/index.ts`, `src/domain/engine/policyChecks.ts`, `triggerEngine.ts`, and the callers in `src/routes/seu/core` and `src/routes/seu/web`.

## 1. The idea in one paragraph

Every state machine in the platform is data. One table, `transition_definitions`, holds one Transition Definition per hop (`entity_type`, `from_state`, `to_state`). A Transition Definition declares what the hop requires (verb, policies, a prior submit) and what it causes (an action, an event, a version event). One engine reads the Transition Definition and decides whether the hop is allowed. The entity's own table is changed through a small adapter. No entity carries its own transition rules.

## 2. The parts

| Part | File | Job |
|---|---|---|
| Transition Definition | `transition_definitions` table | The rule for one hop. Unique on (entity_type, from_state, to_state). |
| Cache | `transitionDefinitionsDB.ts` | In-memory copy loaded at app start. Finders read it and fall back to the DB. Every writer reloads it. |
| Transition Engine | `transitionEngine.ts` | `evaluate` decides. It writes nothing and publishes no entity event. |
| Generic transition | `entityTransition.ts` | `transitionEntity` runs evaluate, then the write, and returns the event to publish. |
| Entity Adapter | `entityAdapters.ts` | Reaches one entity's table. Holds no rules. |
| Action | `src/actions/index.ts` | Code that a hop runs inside its transaction. Looked up by `action_code`. |
| Next actions | `entityTransition.ts` `nextActionsFor` | The buttons a user may press from a state. |

## 3. What a Transition Definition holds

In this document "Transition Definition" means a row of `transition_definitions`. "Entity record" means the row of the entity being transitioned, in its own table.

| Column | Meaning |
|---|---|
| entity_type, from_state, to_state | The hop. A birth Transition Definition has from_state `None` (`BIRTH_STATE`). One birth Transition Definition per entity type is enforced by a unique index. |
| verb | The authority verb. The badge is `<entitytype lowercase>_<verb>`. |
| trigger | `manual` (a user presses a button) or `governed` (the platform attempts it). |
| submit_verb | The hop needs an earlier submit event on the entity first. |
| required_policy_ids | Policies evaluated before the hop. |
| required_quality_gate_ids | Quality Gate ids stored on the Transition Definition. `evaluateGoverned` evaluates them for SEU-scoped entities (see observation 3). The seed ignores them, with an info log, for the SDK-authored entity types (Pack, Template, Profile, DeliverableDefinition, Service, Policy, QualityGate, Capability), because a gate evaluation is recorded against an SEU participant. |
| action_code | An Action run during the hop. |
| event_type | The event the hop names. |
| version_event, version_hop, submit_version_event | Version Management wiring. `version_hop = false` suppresses the patch bump. |
| creates_obligation, category | Metadata read by other parts. |
| is_active, retired_at | Retirement flag. See section 9. |
| author_id, author_badge | Who wrote the Transition Definition. |

## 4. The three kinds of transition

`TransitionEntityType` lists 24 entity types. Their transitions follow one of three routes.

| Route | Entity types | Entry point |
|---|---|---|
| Generic | 21 types with an adapter: SchemaDefinition, Capability, Service, Pack, Template, Profile, Policy, QualityGate, DeliverableDefinition, Objective, EBM, SEU, Obligation, Evidence, AttentionItem, Decision, Participant, Knowledge, Review, Finding, Ontology | `transitionEntity` |
| Execution Engine | Deliverable | `transitionDeliverable` |
| Bespoke | ExternalInteraction, KnowledgeScope | `transitionExternalInteraction`, `promoteKnowledgeItemScope` |

Birth (creation) is a fourth, separate entry point: `transitionEngine.beginBirth`. See section 7.

## 5. The generic route (21 entity types)

`transitionEntity({ entityType, entityId, targetState, actorId, seuId?, context? })`

The adapters are in src/domain/engine/entityAdapters.ts.

- Interface: EntityAdapter is defined at entityAdapters.ts:25.
- Adapters: There is one per entity type, defined as constants in the same file. Examples are packAdapter, obligationAdapter and seuAdapter.
- Registry: The entityAdapters map is at entityAdapters.ts:527. It lists all 21 adapters.
- Lookup: getEntityAdapter is at entityAdapters.ts:551.
- Caller: entityTransition.ts:32 calls getEntityAdapter(input.entityType) at the start of transitionEntity.
- Each adapter's findById and setState call that entity's DB-layer module, for example packsDB or obligationsDB. Those modules are in src/dblayer/.

`src/domain/engine/entityTransition.ts:24` has definitions for transitionEntity, publishTransition and nextActionsFor.

`transitionEntity` performs every step. The adapter is only called for data, as the Adapter column shows.

| Step | Done by | Adapter call | What happens |
|---|---|---|---|
| 1 | `transitionEntity` | `findById` | Loads the entity record. A missing entity record returns `not_found`. |
| 2 | `transitionEntity` | `getState` | Reads the current state. This is the from-state. The caller never supplies it. |
| 3 | `transitionEntity` | `seuId` | Calls `adapter.seuId` to see whether the entity lives in an SEU. If it returns a value, `transitionEntity` calls `transitionEngine.evaluateGoverned`. Otherwise it calls `transitionEngine.evaluate`. The adapter itself never calls the engine. |
| 4 | `transitionEntity` | none | Maps a refusal to one result shape with `gateRejection`. |
| 5 | `transitionEntity` | none | For an entity in an SEU, calls `qualityGateEngine.evaluate`, which reads the gates the SEU's active EBM names for the hop. The author, badge and tenant are the SEU's system actor (`getSystemActor`). A `Blocked` result returns `quality_gate_blocked`. A `Waived` result lets the hop continue. An SEU with no active EBM has no such gates. This check is separate from the gates of the Transition Definition. |
| 6 | `transitionEntity` | `addComment`, `setState` | Runs one database transaction with three things in order: the comment (if one was given and the adapter has `addComment`), the Action (if `action_code` is set), then `setState`. A throw rolls all three back. |
| 7 | `transitionEntity` | `tenantId` | Returns the updated entity record, the applied hop and an `event` object built from the Transition Definition's `event_type`, `version_event`, actor, badge and tenant. |
| 8 | the caller | none | Publishes the event with `publishTransition`. `transitionEntity` never publishes. |

`publishTransition` publishes the named event. A Transition Definition that names no event publishes `UNDEFINED_EVENT` followed by `SDK_ATTENTION_EVENT`. A caller needing a different payload or two events publishes from `result.event` itself.

### What `evaluate` checks, in order

| Order | Check | Refusal |
|---|---|---|
| 1 | A Transition Definition exists for the hop. | `no_transition_definition` |
| 2 | The actor's badge resolves from the Transition Definition's verb. | A held badge is required. Resolution is described elsewhere. |
| 3 | If `submit_verb` is set, a submit event for the from-state already exists on the entity. | `not_submitted` |
| 4 | Each required Policy is evaluated. A satisfied Policy raises `PolicyApplied`. A violated Policy raises `PolicyViolated`. A violated Policy of constraint type `Policy` stops the hop. A violated `Standard` raises `StandardPolicyDeviation` and the hop continues. | `policy_blocked` |
| 5 | The outcome returns the hop's badge, event, version event, action code and next version. `nextVersion` is the current version plus one patch when the Transition Definition has a `version_event`. | none |

A Policy condition is either an implemented policy function (looked up in `src/policies`) or a declarative condition evaluated against `context`. `loadPolicyChecks` accepts ids from the materialised `policies` table and from Policy Definitions.

### `evaluateGoverned` adds, for entities inside an SEU

| Addition | Detail |
|---|---|
| Badge is mandatory | A Transition Definition with no verb throws. |
| Participant check | The actor's `participants` row in that SEU, found with the actor id (the `participants_master` id). A missing row throws. |
| Quality Gates of the Transition Definition | If the Transition Definition has `required_quality_gate_ids`, `qualityGateEngine.evaluateByIds` evaluates exactly those gates. The author, badge and tenant of the evaluation are the SEU's system actor (`getSystemActor`), because the platform and not a user starts the evaluation. A `Blocked` result refuses the hop. A `Waived` result lets it continue. The gates of the SEU's EBM are not evaluated here. `transitionEntity` evaluates them in its own step (step 5 above). |
| Result | The outcome carries `authorId` (the participant id). |

The adapter signals this by providing `seuId`, and `transitionEntity` then chooses `evaluateGoverned`. The SEU-scoped entities are Obligation, Knowledge, Review, Finding, Participant, Decision, Evidence and AttentionItem.

## 6. The adapter

An adapter has no rules. It answers these questions about one table.

| Member | Required | Meaning |
|---|---|---|
| findById | yes | Load the entity record. |
| getState | yes | Which column holds the state (`status`, `lifecycle_state` or `state`). |
| setState | yes | Write the new state. Some adapters also write the actor and badge. Others leave the creation author untouched. |
| tenantId | yes | The tenant for the event. For SEU children it is read from the SEU. |
| seuId | optional | Turns on the governed evaluation. |
| addComment | optional | Entities that keep comments. |
| schemaDefinitionId, content | optional | Entities whose content a policy validates against a pinned schema. |
| composableFields | optional | Entities whose Ontology fields a policy checks. |

State columns by entity type:

| Column | Entity types |
|---|---|
| `lifecycle_state` | SchemaDefinition, SEU |
| `state` | Participant |
| `status` | all other adapter-backed types |

Adding a new generic entity means writing one adapter and registering it in `entityAdapters`. `getEntityAdapter` throws for any type without one.

## 7. Birth

`transitionEngine.beginBirth({ entityType, actorId, seuId? })`

| Step | What happens |
|---|---|
| 1 | Finds the birth Transition Definition (from-state `None`). A missing one throws. |
| 2 | Runs `evaluate` on that hop. A refusal throws. |
| 3 | Requires a resolved badge and a named event. A missing one throws. |
| 4 | Returns `initialState`, `authorityBadge`, `eventType` and `versionEvent`. |

`beginBirth` writes nothing. The caller inserts its own entity record using `initialState` and `authorityBadge`, then publishes `eventType` as its last step.

Callers found: Objective, SEU, Pack, Template, Profile, DeliverableDefinition, Service, Policy, QualityGate, Capability, SchemaDefinition, Ontology (create and promote), and EBM (during composition completion).

## 8. The other routes

### Deliverable (Execution Engine)

A Deliverable has no adapter. `transitionDeliverable` first governs the request, then the Execution Engine applies it as a Command.

Governance (`evaluateDeliverableTransition`), in order:

| Order | Check | Refusal |
|---|---|---|
| 1 | Dependency readiness for the target state. | `dependency_not_satisfied` |
| 2 | An open blocking Obligation on the SEU. | `seu_blocked` |
| 3 | An open blocking Obligation on the Deliverable. | `obligation_blocked` |
| 4 | Every Decision on the Deliverable is Approved or beyond. | `decision_blocked` |
| 5 | No Command for the same hop is already in flight. | `already_in_flight` |
| 6 | A Transition Definition exists and declares a verb. The actor's badge is resolved. | `no_transition_definition` |
| 7 | Quality Gates, evaluated with the SEU system actor as author. A block raises an Attention Item. | `quality_gate_blocked` |
| 8 | Policies of the SEU's EBM, then Policies the Transition Definition requires. A block raises an Obligation. | `policy_blocked` |
| 9 | Submit check. | `not_submitted` |
| 10 | In Progress to Approved needs an attached reference. | `empty_centre` |

The result is a governance outcome record plus the acting badge.

Application (`applyDeliverableTransition`):

| Step | What happens |
|---|---|
| 1 | Requests for one Deliverable run one at a time (an in-process queue per Deliverable id). |
| 2 | The Deliverable is read again. If its state has changed since governance, the request is refused as `already_in_flight`. |
| 3 | The governance outcome is stored. |
| 4 | A Command is created (requester, acting badge, from and to state). |
| 5 | The Deliverable state is updated and the Command is marked Completed. |
| 6 | The dependency engine is told about the new state. |
| 7 | An attestation is recorded when the Transition Definition requires one. |
| 8 | The Transition Definition's event and `DeliverableTransitioned` are published, as the SEU system actor. |

Who triggers it: a user button (`POST /seus/:id/deliverables/:deliverableId/transition`) or the platform. For governed hops, `deliverableKickoff.attemptGovernedTransitions` reads the Deliverable's next transitions with `trigger = governed` and requests each one as the SEU system actor.

### ExternalInteraction

`transitionExternalInteraction` runs `evaluateGoverned`, writes the status through `externalInteractionsDB.updateStatus`, publishes `InteractionFailed` or `InteractionCompleted`, and raises an Attention Item on Failed. It does not use `transitionEntity`, an adapter, Actions or the Transition Definition's `event_type`.

### KnowledgeScope

The Acquisition Scope of a Knowledge Item is a second lifecycle on the same record (SEU, Capability, Enterprise, Platform). `promoteKnowledgeItemScope` requires the item to be Published, runs `evaluate` with entity type `KnowledgeScope`, writes the scope with `updateAcquisitionScope`, publishes the Transition Definition's event (default `KnowledgeScopePromoted`) and creates an Obligation. The Knowledge Item status lifecycle uses the generic route and its adapter.

## 9. Showing the next buttons

`nextActionsFor(entityType, fromState, actorId)`:

| Step | Rule |
|---|---|
| 1 | Read every hop leaving the from-state. |
| 2 | Keep Transition Definitions with `trigger = manual` and a verb. |
| 3 | Keep Transition Definitions whose badge `<entitytype>_<verb>` the actor holds. A root actor holds all. |
| 4 | Mark `requiresComment` when a required Policy has the comment-required code. |
| 5 | Return `{ toState, verb, requiresComment, actionCode }`. |

The web route then finds the action by verb (for example `POST /seus/:id/transition/:verb`) and calls `transitionEntity`. The route never names the target state itself, except where a business flow chooses one (for example Objective to Active during commissioning).

## 10. Observations from the code

| # | Observation | Evidence |
|---|---|---|
| 1 | `evaluate` and the cache finder `find` do not read `is_active` or `retired_at`. Only `listActiveEdges` (used for pickers) filters on `is_active`. A retired Transition Definition still authorises its hop. | `grep -rnE "is_active\|isActive\|retired_at"` over `src/domain`, `src/actions`, `src/policies`, `src/middleware` returned no match. `transitionEngine.ts` and `transitionDefinitionsDB.find` were read in full. |
| 2 | The from-state is always the entity's stored state in the generic route. A caller cannot assert a different from-state. | `entityTransition.ts` lines 36 to 44. |
| 3 | `evaluate` does not check `required_quality_gate_ids`. `evaluateGoverned` does, for SEU-scoped entities only. The paths that call `evaluate` alone never evaluate them: entity types whose adapter has no `seuId` (SchemaDefinition, Capability, Service, Pack, Template, Profile, Policy, QualityGate, DeliverableDefinition, Objective, EBM, SEU, Ontology), `beginBirth` and `promoteKnowledgeItemScope`. `transitionExternalInteraction` calls `evaluateGoverned`, so it does evaluate them. The EBM gates are a separate check: `transitionEntity` step 5 for entities in an SEU, and the Execution Engine for Deliverable. | `grep -rn "evaluateByIds" src` returns the definition in `qualityGateEngine.ts` and one caller in `transitionEngine.ts` `evaluateGoverned`. |
| 4 | Deliverable serialisation is an in-memory map, so it covers one process only. | `executionEngine.ts` `deliverableTurns`. |
| 5 | The `governed` trigger is read in one place: `deliverableKickoff.ts`. No other entity type is attempted by the platform on its own through this column. | `grep -rn '"governed"' src --include='*.ts'`, matches in the DB layer, vocabulary, seed and `deliverableKickoff.ts` only. |

## 11. Open points for the owner

| # | Point |
|---|---|
| 1 | Observation 1: confirm whether a retired Transition Definition should refuse the hop. |
| 2 | Observation 3: Objective, EBM, SEU, SchemaDefinition and Ontology are outside an SEU, are not covered by the seed guard, and their gate ids are never evaluated. |
