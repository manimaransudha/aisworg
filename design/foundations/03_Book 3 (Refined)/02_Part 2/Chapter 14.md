# Chapter 14 – Engineering Collaboration Model

## 1. Purpose

The Engineering Collaboration Model defines how Participants collaborate within a Software Engineering Unit (SEU).

Unlike traditional software teams, collaboration within an SEU is **artifact-centric rather than conversation-centric**.

Participants collaborate by creating, consuming and evolving engineering artefacts through the Runtime Kernel.

The platform deliberately avoids modelling human-style conversational collaboration as the primary execution mechanism.

---

## 2. Scope

This chapter defines:

- collaboration principles
- collaboration mechanisms
- engineering communication
- collaboration contexts
- collaboration through engineering artefacts

This chapter does not define:

- participant implementations
- work item execution
- engineering behaviour
- dependency evaluation

---

## 3. Architectural Position

```
Participant

↓

Runtime Kernel

↓

Engineering Artefacts

↓

Knowledge Repository

↓

Dependency Engine

↓

Participant
```

Participants collaborate through shared engineering state.

Not through direct interaction.

---

## 4. Fundamental Principle

Participants collaborate through engineering artefacts.

Engineering artefacts include:

- Deliverables
- Knowledge
- Evidence
- Decisions
- Obligations
- Events

These artefacts constitute the shared engineering memory of the SEU.

---

## 5. Architectural Principles

### ECM-001

Engineering artefacts are the primary collaboration mechanism.


### ECM-002

Participants shall remain loosely coupled.

### ECM-003

Collaboration shall remain fully traceable.

### ECM-004

Knowledge shall be shared through the Knowledge Repository.


### ECM-005

Runtime events shall communicate engineering state changes.


### ECM-006

Direct participant communication shall not be required for normal execution.

---

## 6. Functional Requirements

### FR-14.1

Participants shall collaborate through shared engineering artefacts.


### FR-14.2

Participants shall publish engineering state changes.


### FR-14.3

Participants shall consume published engineering state.


### FR-14.4

Collaboration shall preserve engineering traceability.


### FR-14.5

Participants shall remain independently replaceable.


### FR-14.6

Engineering decisions shall be visible to authorised Participants.

---

## 7. Collaboration Artefacts

The platform recognises the following collaboration artefacts.

### Deliverables

Represent engineering outcomes.

### Knowledge

Represents reusable engineering understanding.

### Evidence

Supports engineering decisions.

### Decisions

Capture engineering intent.

### Obligations

Represent engineering commitments.

### Events

Notify changes in engineering state.

---

## 8. Collaboration Flow

Typical collaboration follows this pattern.

```
Participant

↓

Produces Deliverable

↓

Knowledge Updated

↓

Dependency Evaluated

↓

Event Published

↓

Interested Participants Continue
```

Participants need not know who consumes the event.

---

## 9. Event-Driven Collaboration

Participants publish domain events rather than invoking one another directly.

Examples include:

- DeliverableApproved
- DecisionAccepted
- EvidenceSubmitted
- ObligationResolved
- KnowledgeAccepted

Subscribers determine whether action is required.

---

## 10. Knowledge-Centred Collaboration

Participants collaborate through a shared Knowledge Repository.

Participants shall:

- contribute knowledge
- consume knowledge
- validate knowledge
- reference knowledge.

The Knowledge Repository becomes the authoritative engineering memory.

---

## 11. Deliverable-Centred Collaboration

Participants collaborate primarily around Deliverables.

Examples:

- Architecture evolves the Requirements Specification.
- Development evolves the Architecture.
- Testing validates the Source Code.
- Deployment consumes the Release Package.

The collaboration focus is the Deliverable rather than the Participant.

---

## 12. Decision-Centred Collaboration

Engineering decisions shall become shared engineering artefacts.

Participants may:

- propose decisions
- review decisions
- approve decisions
- consume decisions

Decision ownership shall remain traceable.

---

## 13. Collaboration Independence

Participants shall never assume:

- the identity of another Participant
- the implementation technology of another Participant
- the internal reasoning of another Participant

Participants collaborate through published engineering state.

---

## 14. Failure Isolation

Participant failure shall not invalidate collaboration.

Because engineering state is preserved within the SEU:

- Participants may be restarted
- Participants may be replaced
- Participants may execute concurrently

Engineering continuity shall remain unaffected.

---

## 15. Events

The Collaboration subsystem shall publish:

- CollaborationStarted
- CollaborationCompleted
- KnowledgeShared
- DeliverableShared
- DecisionPublished
- EvidencePublished
- CollaborationFailed

---

## 16. Non-Functional Requirements

The Collaboration Model shall:

- support asynchronous execution
- support concurrent Participants
- remain loosely coupled
- preserve engineering traceability
- remain implementation independent

---

## 17. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Participants collaborate without direct coupling.

✓ Engineering artefacts constitute the primary collaboration mechanism.

✓ Events communicate engineering state changes.

✓ Participants remain independently replaceable.

✓ Engineering knowledge remains centralised.

✓ Collaboration remains fully traceable.

---

## 18. Deliverables

Implementation of this chapter shall produce:

- Collaboration services
- Event publication framework
- Collaboration APIs
- Shared engineering artefact interfaces
- Collaboration traceability services
- Event subscriptions

## 19. Implementation Specifics

*Recorded 2026-09-19. This section documents how the Engineering Collaboration Model is realised in the current build. It does not change the requirements above (§§1–18); it records what is built, what is partial, and what is still open — the same convention as Chapter 5 §19 (keep the normative spec stable; capture realisation decisions separately). Status markers: ✅ built · ⚠️ partial · 🚩 not built.*

### 19.1 ✅ There is no dedicated "Collaboration" table or service — because every other entity's own engine module already IS this chapter, by construction

Migration `007_trust_pipeline.sql`'s own header states this directly: "Ch.14 (Collaboration) needs no new table at all, since the event-driven, artefact-centric collaboration it describes is already how every prior phase's engine modules work (publish an event, don't call another Participant directly)." No `collaborations` table, no `CollaborationService`, and no chapter-specific API surface exist anywhere in the codebase — this chapter's own §18 "Collaboration services"/"Collaboration APIs" deliverables were never built as their own artifacts, because the platform's realisation of ECM-001–006 is distributed across every entity's own `core/<entity>.ts` + `transitionEngine`/`eventBus` pair, not centralised into one collaboration layer. This is a structural choice, not an oversight: a dedicated "Collaboration" layer would have duplicated what `transitionEngine.evaluate()` + `eventBus.publish()` already do generically for every governed entity.

### 19.2 ✅ Event-driven collaboration (§9, ECM-001/005) is real, DB-backed, and asynchronous by design

`eventBus.ts` realises Ch.30 §9's own Publish → Consume separation: `publish()` persists an `events` row and returns immediately (fire-and-forget), then hands off to `dispatch()` — a caller's own transition function never blocks on what a subscriber does with the event it just published. Subscriptions are genuinely data, not code: `event_subscriptions` (migration `089`) maps an `event_type` to a `handler_name` string, resolved to a real function only through `HANDLER_REGISTRY` (`eventHandlerRegistry.ts`) — a database row cannot hold executable code, so this is the one place a row's string becomes behaviour. Loaded once into an in-memory map at boot (`loadSubscriptions()`), never queried on the publish hot path.

**Deliberately small**: `HANDLER_REGISTRY` holds exactly 5 real handlers (`assignmentDelivery`, `validateRequest`, `compositionCompleted`, `ebmActivated`, `executionEngineKickoff`) — CLAUDE.md's own standing rule for this codebase (an event subscriber is added only when the effect crosses an `entity_type`/chapter boundary) is visible directly in how few of these exist. Every other governed transition's "collaboration" with the rest of the platform happens through its own transition publishing an event that nothing else needs to subscribe to react to synchronously — the artefact itself (the updated Deliverable/Decision/Knowledge/Evidence row) is what the next Participant's Work Item is built from, not a handler chain.

### 19.3 ⚠️ §9's illustrative event names are almost entirely not real, literal event types — the same platform-wide pattern found in every entity chapter this session

Live-checked against `transition_definitions.event_type`: of the 5 named examples in §9 (`DeliverableApproved`, `DecisionAccepted`, `EvidenceSubmitted`, `ObligationResolved`, `KnowledgeAccepted`), only `KnowledgeAccepted` exists as a real, literal event type — and only since this session's own Ch.16 Version Feature Plan.md pass (migration `238`, coincidental, not built for this chapter's sake). `DeliverableApproved` does not exist: Deliverable's own transitions have no `event_type` populated in `transition_definitions` at all (Deliverable has not yet had a Version Feature Plan.md pass — see the plan's own "Implementation status" list, which does not include it), and the literal event actually published on a Deliverable transition is the single generic `DeliverableTransitioned` (`core/workItems.ts`), fired asynchronously from `completeWorkItem`, not from the transition request itself (19.4). `DecisionAccepted`/`EvidenceSubmitted`/`ObligationResolved` do not exist as literal names either — Decision and Evidence do have real, distinct per-state events since their own Phase 5 build (`DecisionApproved`, `EvidenceValidated`, etc.), just not these exact chapter-illustrative names. §15's own 7 named Collaboration-subsystem events (`CollaborationStarted`, `CollaborationCompleted`, `KnowledgeShared`, `DeliverableShared`, `DecisionPublished`, `EvidencePublished`, `CollaborationFailed`) fare worse: live `SELECT DISTINCT event_type FROM events WHERE event_type IN (...)` returns zero rows — none has ever existed as a literal event type anywhere in this codebase's history. This is the same "illustrative per-state event names collapse to fewer, real, differently-named events" finding already made for Ch.15/16/19/29/30 this session — here it is closer to "the illustrative names were never adopted at all," since no Collaboration entity or transition table exists for them to attach to.

### 19.4 ✅ Deliverable-centred collaboration (§11) is real, and more asynchronous than the chapter's own diagram implies

§8's Collaboration Flow diagram (Produces Deliverable → Knowledge Updated → Dependency Evaluated → Event Published → Interested Participants Continue) undersells how decoupled the real mechanism is. `transitionDeliverable` (`core/deliverables.ts`) does not apply the state change or publish an event synchronously at all: it calls `executionEngine.evaluateDeliverableTransition` (governance/authority/policy check) then `executionEngine.execute()`, which resolves the eligible Participant via Capability Fulfilment and *dispatches* a Work Item — the request returns `dispatched: true` with no state change yet. The Deliverable's `lifecycle_state` only actually changes, and `DeliverableTransitioned` only actually publishes, later and asynchronously, when that Participant reports a `done` result through `completeWorkItem` (Participant Integration Plan's "Model A" control-flow inversion). If no Participant currently fulfils the producing Capability, the transition is deferred outright (`dispatch_deferred`) rather than silently applied. This is §13's "Participants collaborate through published engineering state," realised literally: the platform does not ask a Participant "have you finished," it dispatches, then waits for the Participant's own callback to say so.

### 19.5 ✅ Collaboration Independence (§13, ECM-002/006) holds structurally — no Participant-to-Participant call exists anywhere in the codebase

Confirmed by search, not just by design intent: no route, function, or adapter anywhere sends a message, notification, or call from one Participant to another. A Participant's only two touchpoints with the platform are Work Item dispatch (in) and completion report (out, `completeWorkItem`) — `dispatchEngine.ts`'s own comment states the operating principle directly: "the platform is deliberately blind to what the Participant does in its own environment (Book 1: govern behaviour, not competence)." §13's three named assumptions a Participant must never make (another Participant's identity, implementation technology, internal reasoning) are honoured by there simply being no API surface through which a Participant could observe any of those things about another Participant.

### 19.6 ⚠️ Failure Isolation (§14) is partial — failure is surfaced to governance, not silently absorbed by automatic reassignment

`dispatchEngine.ts` has real, Service-Level-driven stall detection (a Work Item whose Capability declares an SLA target and exceeds it is flagged; one with no declared target is never stall-escalated — not a gap, a deliberate consequence of no target existing). A Work Item reported `failed` or `blocked` (`completeWorkItem`, `core/workItems.ts`) raises a real `AttentionItem` — a human/governance-facing escalation — rather than the platform silently retrying or auto-reassigning the same Work Item to a different Participant fulfilling the same Capability. §14's "Participants may be restarted; Participants may be replaced" is therefore true at the level the chapter cares about (engineering state in the SEU is never corrupted or lost by a Participant's failure — the Deliverable simply stays wherever it was, an AttentionItem now points at it), but the replacement step itself is a governance/human action reacting to that AttentionItem, not an automatic platform behaviour.

### 19.7 ✅ Knowledge-Centred Collaboration (§10, ECM-004) is real via the Ch.16 Knowledge Model, unchanged in kind by this session's own Knowledge structure work

`knowledge_items` is the "shared Knowledge Repository" this chapter names — Participants contribute (`createKnowledgeItem`), validate (the governed `Observed→...→Published` lifecycle, badge-gated per Ch.16 §20.6), and reference (§10's own relationship-typed `evidence_references`/`deliverable_references`/`decision_references`/`knowledge_references`, added this session — Ch.16 §20.7) knowledge through this one table, never through one another directly. "Consume" is realised concretely by `workItemGenerator.ts`'s own Execution Context resolution — a dispatched Work Item's instructions are pre-resolved to include the real Decisions/Evidence/Knowledge relevant to that Deliverable (owner's own worked example, quoted in that file's header: "these are the inputs... this is the knowledge you need"), so a Participant never has to itself query "what does someone else know" — the platform resolves and hands it over at dispatch time.

### 19.8 ⚠️ Deliverables (§18) — named artifacts map to distributed mechanisms, not a dedicated Collaboration layer

| Named Deliverable | Real artifact | Verdict |
|---|---|---|
| Collaboration services | — | 🚩 no dedicated service; distributed across every entity's own `core/<entity>.ts` (19.1) |
| Event publication framework | `eventBus.ts`, `eventsDB.ts`, `event_subscriptions`/`HANDLER_REGISTRY` | ✅ |
| Collaboration APIs | — | 🚩 no dedicated API; each artefact type has its own (`api/knowledge.ts`, `api/decisions.ts`, etc.) |
| Shared engineering artefact interfaces | `knowledge_items`, `evidence`, `decisions`, `obligations`, `deliverables`, `events` tables | ✅ — the 6 artefact kinds §7 names are all real tables |
| Collaboration traceability services | `events.correlation_id`/`.causation_id`, `PublishInput`'s `actorId`/`authorityBadge` accountability fields | ✅ — traceability is a property of the generic event mechanism, not a separate service |
| Event subscriptions | `event_subscriptions` table + `HANDLER_REGISTRY` (19.2) | ✅ |