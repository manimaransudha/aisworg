
# Chapter 30 – Event Model

[Sudha: The previous ADR ("Transition Definitions") changes how I think about the Runtime Kernel.

Originally, I thought the Runtime Kernel looked like this:

```
State Management
↓

Event Bus
↓

Execution Planning
```

I now think that's backwards.

The platform is fundamentally **event-driven**.

State changes produce events.

Events cause evaluations.

Evaluations produce new state transitions.

That means **Events** are not a messaging mechanism.

They are the **heartbeat of the SEU**.

This is exactly how modern operating systems work.

This is exactly how modern distributed systems work.

And I think it is exactly how an AI Software Engineering Unit should work.

---------------

While writing this chapter, I realised we've uncovered another architectural distinction that I think should become an ADR.

Throughout the previous chapters we've used the words **Events**, **Requests**, **Commands** and **Transitions** almost interchangeably. They are not the same thing.

I think the Runtime Kernel should distinguish them very clearly:

|Concept|Meaning|
|---|---|
|**Command**|A request to perform an engineering action.|
|**Transition Definition**|The declarative contract describing how a state transition may occur.|
|**State Transition**|The successful change of an engineering object's authoritative state.|
|**Event**|The immutable fact that the transition has occurred.|

That creates a clean runtime flow:

```
Command

↓

Transition Definition Evaluation

↓

Governance Evaluation

↓

State Transition

↓

Event Publication

↓

Subscribers React
```

Notice something subtle but important:

Participants should issue **Commands**, not Events.

The Runtime Kernel evaluates those Commands against the relevant Transition Definition and Governance Model. Only after the state transition commits does the Runtime Kernel publish an Event.

This separation prevents Participants from fabricating engineering history. They can request work, but only the Runtime Kernel can declare that something **actually happened**.

I think this distinction is one of the strongest implementation principles we've developed. It aligns naturally with CQRS and event-driven architectures while remaining technology-neutral. More importantly, it reinforces the idea that **engineering truth belongs to the Runtime Kernel**, not to individual Participants. I strongly recommend capturing this as an ADR because it will shape almost every runtime service that follows.
]
---

# 1. Purpose

The Event Model defines how significant engineering and runtime occurrences are represented, published, consumed and preserved within a Software Engineering Unit (SEU).

Events communicate changes in engineering state.

They enable decoupled collaboration between runtime services and Participants while preserving complete engineering traceability.

Events do not contain engineering behaviour.

They communicate that engineering state has changed.

---

# 2. Scope

This chapter defines:

- Event abstraction;
- Event lifecycle;
- Event publication;
- Event consumption;
- Event ordering;
- Event persistence.

This chapter does not define:

- messaging middleware;
- transport protocols;
- event broker technologies;
- infrastructure implementation.

---

# 3. Architectural Position

```
Transition Definition

↓

State Transition

↓

Event Publication

↓

Runtime Services

↓

Participants

↓

Further Engineering Activity
```

Events communicate engineering change.

They do not perform engineering work.

---

# 4. Definition

An Event is an immutable record that a significant engineering or runtime occurrence has taken place.

An Event records:

- what occurred;
- when it occurred;
- where it occurred;
- which engineering objects were affected;
- supporting context.

Events shall never modify engineering state.

---

# 5. Architectural Principles

## EM-001

Events are immutable.

---

## EM-002

Events describe facts.

They do not express intentions.

---

## EM-003

Events are published after successful state transitions.

---

## EM-004

Events are independently identifiable.

---

## EM-005

Events are traceable.

---

## EM-006

Events are implementation-independent.

---

# 6. Functional Requirements

### FR-30.1

Every Event shall possess a globally unique identifier.

---

### FR-30.2

Every committed engineering state transition shall publish one or more Events.

---

### FR-30.3

Events shall be immutable.

---

### FR-30.4

Events shall preserve ordering within the scope of an engineering object.

---

### FR-30.5

Events shall support multiple subscribers.

---

### FR-30.6

Events shall remain permanently traceable.

---

### FR-30.7

Historical Events shall remain queryable.

---

# 7. Event Categories

Illustrative categories include:

## State Events

Examples:

- DeliverableApproved
- ObligationClosed
- KnowledgePublished

---

## Governance Events

Examples:

- AuthorityGranted
- PolicyEvaluated
- QualityGatePassed

---

## Runtime Events

Examples:

- ParticipantActivated
- RuntimeRecovered
- ExecutionPlanned

---

## Integration Events

Examples:

- RepositoryUpdated
- BuildCompleted
- DeploymentStarted

---

## Administrative Events

Examples:

- SEUCommissioned
- PackActivated
- ProfileUpdated

Additional categories may be introduced through Packs.

---

# 8. Event Structure

Every Event shall define:

- Event Identifier
- Event Type
- Event Timestamp
- Originating Service
- Originating Object
- Related Objects
- Correlation Identifier
- Causation Identifier
- Event Version
- Event Payload
- Traceability References

The payload schema is defined by the originating service.

---

# 9. Event Lifecycle

Events progress through the following lifecycle.

```
Generated

↓

Published

↓

Consumed

↓

Archived
```

Once Published, an Event shall not be modified.

Consumption by one subscriber shall not affect other subscribers.

---

# 10. Event Publication

Events shall be published only after successful completion of the corresponding state transition.

Publication shall include:

- originating object;
- triggering transition;
- timestamp;
- correlation information;
- traceability references.

Events shall represent committed engineering facts.

---

# 11. Event Consumption

Runtime services and Participants may subscribe to Events.

Examples include:

- Dependency Engine
- Governance Service
- Scheduling Service
- Notification Service
- Observability Service
- Integration Framework

Subscribers shall remain independent of one another.

---

# 12. Event Ordering

The platform shall preserve deterministic ordering for Events relating to the same engineering object.

Ordering between unrelated engineering objects is not required unless explicitly defined by the Engineering Behavior Model.

This allows scalability while preserving engineering correctness.

---

# 13. Correlation and Causation

Every Event shall support:

**Correlation Identifier**

Links Events belonging to the same engineering activity.

Example:

Requirement Approval → Architecture Approval → Design Approval.

---

**Causation Identifier**

Identifies the Event that directly caused the current Event.

This enables reconstruction of engineering execution chains.

---

# 14. Event Replay

The platform shall support replay of historical Events.

Replay may be used for:

- diagnostics;
- auditing;
- testing;
- runtime recovery;
- engineering analytics.

Replay shall never alter historical engineering state unless explicitly operating in a recovery mode.

---

# 15. Event Persistence

Historical Events shall remain available for:

- traceability;
- explainability;
- observability;
- historical reconstruction;
- engineering analytics.

Retention policies are contributed through Packs.

---

# 16. Events

The Runtime Kernel shall publish infrastructure events including:

- EventPublished
- EventConsumed
- EventReplayStarted
- EventReplayCompleted
- EventOrderingViolationDetected
- EventPublicationFailed

Domain-specific events are defined by their respective architectural components.

---

# 17. Non-Functional Requirements

The Event Model shall:

- support high-throughput publication;
- support asynchronous consumption;
- preserve deterministic ordering where required;
- support historical replay;
- remain independent of messaging technologies.

---

# 18. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Every significant state transition publishes Events.

✓ Events are immutable.

✓ Event ordering is preserved for individual engineering objects.

✓ Multiple subscribers can consume the same Event independently.

✓ Historical replay is supported.

✓ Events remain permanently traceable.

---

# 19. Deliverables

Implementation of this chapter shall produce:

- Event domain model.
- Event publication service.
- Event subscription service.
- Event registry.
- Correlation and causation services.
- Event replay service.
- Event APIs.
- Event catalogue.

---

# 20. Implementation Status & Gaps

Code-verified audit (2026-08-21), not from memory — every claim below carries a file:line citation. Origin: reviewing CR-052 ("Evidence accumulation via the Event Bus"), which itself claimed "today, nothing in this codebase reacts to a Bus event" — that claim is **wrong**, corrected in 20.2 below.

**Update, 2026-08-21 (second pass, same day) — the Event Bus was redesigned and built** following this audit, through an extended field-by-field and mechanism-by-mechanism design conversation. §20.2, §20.3, and §20.5 below are updated in place to reflect what actually shipped; §20.1, §20.4, §20.6, §20.7, §20.8, §20.9 are unchanged from the original audit (still accurate — nothing about them was in scope for this build).

## 20.1 ✅ Event Publication — extensive and real (§7/§10; FR-30.2)

69 `eventBus.publish(...)` call sites across `src/`, producing roughly 90 distinct event-type strings, spanning nearly every entity the platform models: SEU, Deliverable, Evidence, Knowledge, Decision, Obligation, ExternalInteraction, Pack, Template, Profile, DeliverableDefinition, Command, WorkItem, Participant, Capability (via `CapabilityFulfilled`/`DeliverableReady`), Quality Gate, Policy, Review, Finding, Metric, Attention, Objective, and cross-entity Telemetry (`SustainedPatternDetected`). Publication genuinely happens only after a state transition commits (`src/domain/engine/eventBus.ts:37-49` — persists via `eventsDB.append` first, then notifies subscribers), matching EM-003/§10's own ordering requirement.

Six entities (Evidence, Pack, Template, Profile, DeliverableDefinition, and Participant via a transition-keyed variant) publish a **named event per landed state** through an `EVENT_BY_TARGET_STATE`-style lookup map, falling back to a generic `<Entity>Transitioned` only for uncovered states (e.g. `src/routes/seu/core/evidence.ts:31-37`, `packs.ts:400-407`, `templates.ts:460-467`, `profiles.ts:269-276`, `deliverableDefinitions.ts:97-104`; Participant's own variant is keyed by `fromState->toState`, not target state alone — `src/routes/seu/core/participants.ts:24-31`). Every other entity — most notably **Deliverable** — publishes only the single generic `<Entity>Transitioned` for every transition, with the actual landed state buried in the payload (`DeliverableTransitioned`, `src/routes/seu/core/workItems.ts:168`; likewise `ObligationTransitioned`, `obligations.ts:124`, and `KnowledgeUpdated`, `knowledge.ts:121`, fired even when Knowledge reaches `Published`).

**Deliverable's own gap is chapter-mandated, not just an inconsistency with sibling entities**: Ch.15 §17 explicitly names seven events the Deliverable subsystem "shall publish" — `DeliverableCreated`, `DeliverableUpdated`, `DeliverableStateChanged`, `DeliverableApproved`, `DeliverableBaselined`, `DeliverableSuperseded`, `DeliverableArchived` — and Ch.15's own §21.11 (already audited, code-verified, prior session) confirms zero of the seven exist; only the generic `DeliverableTransitioned` fires, and there is no creation event at all (`createDeliverable` and the commissioning bulk-create path publish nothing). Ch.15 §21.11 also notes two real, differently-named adjacent events — `DeliverableReady`/`DeliverableBlocked` (Ch.9 §19.9), `originatingObjectType: "Deliverable"` — published by the Dependency Engine on transitions a `dependency_definitions` row governs; neither matches any of the seven precisely (`DeliverableStateChanged` is the closest conceptual overlap), and neither fires on every transition. See Ch.15 §21.11/§21.13 for the full account — not duplicated here.

## 20.2 ✅ Event Consumption — rebuilt: DB-backed registry, publish/consume separated, fire-and-forget dispatch (§9/§11; FR-30.5)

**Original finding (still true of the code as it stood then, corrected CR-052's own wrong claim in the process)**: exactly one `eventBus.subscribe(...)` call existed anywhere in `src/` — `assignmentDelivery.ts`'s `WorkItemDispatched` handler, genuinely wired up at boot, not dead code, but the *only* such case, and invoked synchronously inline inside `publish()` (blocking it on however long the handler took — demonstrated concretely by that same handler's own external delivery call).

**Rebuilt, 2026-08-21**: `publish()` and `dispatch()` (Ch.30 §9's own `Generated → Published → Consumed` stages) are now genuinely separate operations. `publish()` persists the event and returns immediately; `dispatch()` — a standalone, independently-callable function — invokes registered handlers, called by `publish()` **fire-and-forget** (not awaited), so publishing never blocks on any handler's own work regardless of how many exist or how slow they are.

Subscriptions moved from an imperative, in-memory `subscribers: EventHandler[]` array (populated by code calling `.subscribe()` once at boot) to a **DB-backed Event Registry + Event Subscriptions** (`event_registry`, `event_subscriptions` tables, migration `089_event_bus_structure.sql`) — the inspectable catalogue Ch.30 §19 itself names as a deliverable ("Event registry", "Event subscription service"). Loaded into an in-memory routing map once at boot (`eventBus.loadSubscriptions()`) — never queried on the publish hot path, so the DB-backed source of truth costs nothing at runtime. A DB row's `handler_name` string resolves to a real function via a small static code-side registry (`eventHandlerRegistry.ts`) — a database row can't hold executable code, so something in code still has to bridge that gap.

`event_registry` also carries a `category` column (migration `090_event_registry_category.sql`) — §7's own five-way illustrative split (State/Governance/Runtime/Integration/Administrative), useful as a taxonomy independent of §7's specific example names not being mandated. A property of the event type itself, not of any particular subscription. Kept as plain `TEXT`, no `CHECK` constraint — validated at write-time against Ontology (`category:event-types`), the exact same mechanism as `category:evidence`/`category:deliverable`/etc. (`core/ontology.ts`), so a new category is an `ontology_concepts` row, not a schema change. The one seeded row so far, `WorkItemDispatched`, is classified `Runtime`.

FR-30.5 ("Events shall support multiple subscribers") is now real infrastructure, not just a mechanically-possible array shape — the mechanism supports it directly (many `(event_type, handler_name)` rows), though only the one pre-existing subscriber (`WorkItemDispatched → assignmentDelivery`, migrated onto the new mechanism, live-verified over HTTP) is actually registered today.

**Deliberately not built**: retry/redelivery for a handler that throws or a dispatch that never completes — fire-and-forget has no automatic redelivery. A new `consumption_state` column (§20.3) makes a stuck/failed handler *visible*, not *retried*. Filed separately as **CR-053**.

**The second, pull-based precedent noted in the original audit is unchanged**: `checkSustainedPolicyWaivers()` (`src/routes/seu/core/telemetry.ts:271-291`) still reads the `events` table directly on Telemetry page load and can mint a new Obligation as a result — untouched by this build, still a valid second example of "past Events driving new behavior," just synchronous and pull-based rather than push-subscribed.

## 20.3 ⚠️ Event Structure — partial by deliberate choice, not oversight (§8)

**Original finding**: 7 of §8's 11 fields implemented, 4 missing (Originating Service, Related Objects, Event Version, Traceability References).

**Reviewed field-by-field, 2026-08-21, and deliberately not closed** — each of the 4 missing fields was checked against real usage in this codebase, not added just because §8 names it:
- **Originating Service**: no filtering need it would serve that `event_type` + `originating_object_type` don't already cover — the one case where the same entity type is touched by multiple internal services (Deliverable: `workItems.ts`, `deliverables.ts`, `dependencyDefinitionEngine.ts`) is already disambiguated by `event_type` alone (`DeliverableTransitioned` vs `DeliverableBlocked` vs `DeliverableReady`).
- **Related Objects**: every real multi-object case already has its own proper structure (Evidence's `evidence_relationships`, CR-051 item 1) or already fits in `payload` (e.g. `DeliverableTransitioned`'s `commandId`/`workItemId`/`participantId`).
- **Event Version**: would matter for long-lived reprocessing of old-schema payloads — moot with no replay mechanism (20.6) and the one real consumer only checking `event_type`.
- **Traceability References**: `correlation_id` + `causation_id` (now fixed, 20.5) + `originating_object_id` already cover this.

**Built instead, against demonstrated need**:
- **`seu_id`** (nullable, `REFERENCES seus(id)`) — closes a real, demonstrated gap: `getSeuEvents()` (`core/events.ts:16-35`) reconstructed "every event for this SEU" via three separate queries (by SEU id, by every Deliverable id, by every Command's correlation id) and was still silently incomplete (missing Evidence/Knowledge/Decision/Obligation/Participant events entirely). Null for entities with no single owning SEU (Objective — checked directly, `ObjectiveRow` has no `seu_id` and structurally can't, since a SEU points *to* an Objective, not the reverse; Pack/Template/Profile/DeliverableDefinition — platform catalog entities). Deliberately kept as a dedicated FK'd column, not generalized to a generic `owning_entity_type`/`owning_entity_id` pair — the only demonstrated need is SEU-scoping, and a generic pair would lose the `REFERENCES seus(id)` integrity check for no current benefit.
- **`consumption_state`** (JSONB, keyed by handler name) — see 20.2. Not one of §8's original 11 fields; a new field the redesign itself required.

## 20.4 ✅ Event Ordering (§12; FR-30.4)

`events.sequence` (`BIGSERIAL`, `events_sequence_seq`) gives every event a single global monotonic order, which trivially satisfies §12's narrower requirement (deterministic ordering *within* the scope of one engineering object — a subset of a total order is itself totally ordered). `idx_events_originating (originating_object_type, originating_object_id)` makes querying that per-object order efficient.

## 20.5 ✅ Correlation & Causation — causation fixed at every previously-wrong site (§13)

Correlation Identifier was already solid and remains so — populated on effectively every publish call, linking every event in one engineering activity.

**Original finding**: Causation Identifier was populated inconsistently with §13's own definition at 4 sites — `commissioning.ts:164`/`:205` (set to the *same value* as `correlationId`), `workItems.ts:172` and `workItemGenerator.ts:19` (set to a business entity's own id, not an event id).

**Fixed, 2026-08-21** — each site's real prior event traced and threaded through explicitly (capturing what every one of these publish calls' own return value had been discarding):
- `commissioning.ts`: `SEUCommissionRequested` is now the deliberate chain root (`causationId: null` — an HTTP request caused it, not a Bus event); both `SEUCommissionRejected` paths and `SEUCommissioned` are caused by that same request event; the automatic cascade (`SEUConfigured`/`SEUActivated`/`SEUOperational`) is now a real chain, each step caused by the *previous* step's own event id, not a repeated `correlationId`. Live-verified over HTTP: `SEUCommissioned.causation_id = SEUCommissionRequested.id`, and each cascade step points at the real previous event.
- `workItems.ts:172` (`DeliverableTransitioned`): `causationId: null`, deliberately — `completeWorkItem` is triggered by a Participant's external completion report, not a prior Bus event, so `null` is the honest answer, not a fabricated one.
- `workItems.ts` (`WorkItemCompleted`, previously had no causationId at all): now caused by the `DeliverableTransitioned` event published moments earlier in the same flow — a real, direct link that was simply missing before.
- `workItemGenerator.ts:19` (`WorkItemGenerated`): now caused by `executionEngine.ts`'s own `CommandGenerated` event, threaded through a new `causationEventId` parameter.

`causation_id` still carries no FK constraint (a database column can't cleanly constrain "must be a real row in this same table" the way a normal FK does across tables, and no case yet needs that level of enforcement) — but as of this fix, every site that sets it now points at a real prior event or is honestly `null`. Four sites fixed; `dispatchEngine.ts`'s own three events (`WorkItemDispatched`/`ParticipantSelected`/`DispatchDeferred`) still don't set `causation_id` at all — never flagged as *wrong* (only absent), left as a natural but separate follow-on, not bundled into fixing what was actually broken.

## 20.6 ❌ Event Replay — wholly unimplemented (§14)

No replay mechanism, route, function, or stub exists anywhere in `src/`. `eventsDB` (`src/dblayer/eventsDB.ts`) exposes only read methods (`findByOriginatingObject`, `findByCorrelationId`, `findRecent`, `count`, `countStandardPolicyDeviations`) — every one returns rows to a caller for direct display or a one-off aggregate calculation; none re-feeds historical events back through `eventBus.publish`/`.subscribe` to reconstruct state or re-run subscriber side effects. (Unrelated "replay" hits elsewhere in the codebase — migration-runner comments, a duplicate-HTTP-request-rejection path in `dry-run-suite` — are not this mechanism.)

## 20.7 ⚠️ Event Persistence — persisted and queryable, no retention policy (§15)

Every event is durably persisted in Postgres and remains queryable indefinitely (`eventsDB.findByOriginatingObject`/`findByCorrelationId`/`findRecent`) — satisfies traceability/explainability/historical-reconstruction. §15's own "Retention policies are contributed through Packs" is not built: no archival, TTL, or Pack-contributed retention mechanism exists; every event is kept forever by default.

## 20.8 ❌ Infrastructure/Meta Events — 0 of 6 implemented (§16)

None of the six Runtime-Kernel infrastructure events the chapter names — `EventPublished`, `EventConsumed`, `EventReplayStarted`, `EventReplayCompleted`, `EventOrderingViolationDetected`, `EventPublicationFailed` — are ever published anywhere (confirmed via exhaustive grep, zero hits for all six). The Bus publishes only the domain events its callers supply; it never announces its own publish/consume/replay activity as events in their own right.

## 20.9 ✅ §7's Illustrative Event Categories — closed: not a gap list, and the real part (the taxonomy) is now built

§7 explicitly frames these 15 *names* as illustrative, not mandated — the cross-reference below was never a to-do list of events to go build (most of these 9 absent names have no real equivalent and aren't expected to). What §7 actually offers of lasting value is the five-way **category split itself** (State/Governance/Runtime/Integration/Administrative) — and that part is now real: `event_registry.category`, Ontology-backed (`category:event-types`, migration `090_event_registry_category.sql`), same mechanism as `category:evidence`/`category:deliverable`. Closed — nothing further to track here.

Cross-reference kept for the record:

| Illustrative name | Verdict |
|---|---|
| `DeliverableApproved` | ❌ absent — generic `DeliverableTransitioned` fires instead (`workItems.ts:168`), state buried in payload. Not just a Ch.30 §7 illustrative miss: Ch.15 §17 explicitly names this among seven events the Deliverable subsystem "shall publish" (20.1) — a chapter-mandated gap, already tracked at Ch.15 §21.11 |
| `ObligationClosed` | ❌ absent — generic `ObligationTransitioned` fires instead (`obligations.ts:124`) |
| `KnowledgePublished` | ❌ absent — generic `KnowledgeUpdated` fires instead, even on reaching `Published` (`knowledge.ts:121`) |
| `AuthorityGranted` | ❌ absent entirely — badge-grant issuance (`identity.ts:148-169`) publishes no event at all |
| `PolicyEvaluated` | ❌ almost entirely absent — a blocking Policy-type failure publishes nothing (`transitionEngine.ts:106`); only a non-blocking Standard-type deviation fires `StandardPolicyDeviation` (`transitionEngine.ts:119`), a narrower concept |
| `QualityGatePassed` | ✅ exact — `qualityGateEngine.ts:157` |
| `ParticipantActivated` | ✅ exact — via `participants.ts:28` (`Created->Available`) |
| `RuntimeRecovered` | ❌ absent, no equivalent |
| `ExecutionPlanned` | ❌ absent — loose analogue `CommandGenerated` (`executionEngine.ts:50`), different name/concept |
| `RepositoryUpdated` | ❌ absent, no equivalent |
| `BuildCompleted` | ❌ absent, no equivalent |
| `DeploymentStarted` | ❌ absent, no equivalent |
| `SEUCommissioned` | ✅ exact — `commissioning.ts:164` |
| `PackActivated` | ✅ exact — via `packs.ts:403` (target state `Active`) |
| `ProfileUpdated` | ❌ absent — `profiles.ts` publishes only `ProfileCreated` and its own transition map, no generic "updated" event |

3 exact matches, 3 covered by a differently-named generic event, 9 with no match or equivalent at all.

## Summary — what this means for redesigning the Bus toward a real pub/sub model

The owner's own framing (reviewing this audit): *"The Bus's role is only the two notifications on either side of that: it publishes `EvidenceAccepted` (which triggers the engine to re-check), and once the engine has already applied the transition, it publishes `DeliverableApproved` (announcing what already happened). The Bus never evaluates 'met' and never pushes state."*

Checked against the above, at the time of the original audit:
- `EvidenceAccepted` existed but nothing subscribed to it.
- `DeliverableApproved` did not exist at all — Ch.15 §17 names it (and `DeliverableBaselined`) among seven events the Deliverable subsystem "shall publish," zero of which existed.
- The "triggers the engine to re-check" half was entirely unbuilt — no mechanism made anything reactive.
- `causation_id` couldn't reliably link "this happened because that arrived."

**Update, 2026-08-21 (second pass) — the mechanism itself is now built; the specific reactive chain the owner described is not.** The Event Bus redesign (20.2) makes "a handler runs automatically when event X is published, without the publisher knowing or waiting" a real, working, tested, live-verified capability — the piece that was "entirely unbuilt" now exists. `causation_id` (20.5) is fixed and could genuinely thread "this transition happened because that event arrived" through a causal chain now. But the *specific* `EvidenceAccepted → re-check → DeliverableApproved` reactive chain the owner described still doesn't exist as working behavior, for two unchanged reasons: (1) `DeliverableApproved` is still unbuilt — Ch.15 §17's own gap, untouched by this build, tracked there; (2) nobody has yet registered a handler against `EvidenceAccepted` in `event_subscriptions` — the mechanism can carry that reaction, but the reaction itself (resolving which Deliverable(s) an Evidence event might unblock, re-running `qualityGateEngine`, applying the transition) is real new logic that hasn't been written. Building it is chapter-by-chapter gap-closing work layered on top of this structure, not something this structural build did on its own.