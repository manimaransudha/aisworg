# Chapter 12 – Capability Fulfilment


## 1. Purpose

Capability Fulfilment is the process by which a Software Engineering Unit (SEU) satisfies the engineering capabilities required to achieve its Deliverables.

The purpose of Capability Fulfilment is not to recruit Participants, but to ensure that every required engineering capability is available when needed.

Participants are one mechanism for fulfilling capabilities.

Capability Fulfilment remains independent of the implementation of those Participants.

---

## 2. Scope

This chapter defines:

- capability fulfilment
- fulfilment strategies
- participant assignment
- fulfilment lifecycle
- reassignment
- capability availability

This chapter does not define:

- participant implementations
- AI reasoning
- engineering behaviour
- work item execution
- per-Work-Item participant selection (see Chapter 33, Dispatch Engine)

Capability Fulfilment determines **which Participants are eligible** to provide a Capability. It does not determine which eligible Participant executes a specific Work Item at a specific moment; that runtime decision belongs to the Dispatch Engine, which consumes the eligible-Participant pool this chapter produces.

---

## 3. Architectural Position

```
Deliverable

↓

Dependency Engine

↓

Required Capabilities

↓

Capability Fulfilment

↓

Participants

↓

Execution
```

Capability Fulfilment forms the bridge between engineering intent and engineering execution.

---

## 4. Definition

Capability Fulfilment is the runtime process that identifies suitable Participants capable of providing the competencies required by the SEU.

Capability Fulfilment is dynamic.

Participants may change throughout the lifetime of the SEU without affecting the Engineering Behavior Model or the Capability Model.

---

## 5. Architectural Principles

### CF-001

Capabilities are permanent. Participants are replaceable.
 
### CF-002

Capability Fulfilment shall remain independent of Participant implementation.
 
### CF-003

Capability Fulfilment shall support AI, human and external Participants equally.
 

### CF-004

Capability Fulfilment shall preserve engineering continuity when Participants change.
 

### CF-005

Capability Fulfilment shall remain fully traceable.

---

## 6. Functional Requirements

### FR-12.1

The platform shall determine the capabilities required to progress a Deliverable.
 

### FR-12.2

Capability Fulfilment shall identify one or more suitable Participants.
 

### FR-12.3

Multiple Participants may jointly fulfil a Capability.
 

### FR-12.4

One Participant may fulfil multiple Capabilities.
 

### FR-12.5

Capability Fulfilment shall support dynamic reassignment.
 
### FR-12.6

Capability reassignment shall preserve engineering continuity.
 

### FR-12.7

Capability Fulfilment decisions shall remain traceable.

---

## 7. Fulfilment Strategies

Capability Fulfilment may be achieved through:

### AI Participant

Example:

Architecture Capability fulfilled by an AI Architect.

 

### Human Participant

Example:

Security Review Capability fulfilled by a Security Architect.

 

### External Service

Example:

Static Analysis Capability fulfilled by an external scanning service.

 

### Hybrid

Example:

Architecture Capability jointly fulfilled by an AI Architect and a Human Architect.

 

### Composite

A Capability fulfilled by multiple coordinated Participants providing complementary expertise.

 

## 8. Fulfilment Criteria

Capability Fulfilment shall evaluate:

- capability compatibility
- behavioural compatibility with the EBM
- required knowledge
- required authority
- availability
- engineering constraints
- Pack-specific requirements

Selection algorithms are implementation-defined.

---

## 9. Eligibility Registration

Capability Fulfilment registers eligibility, not final assignment.

Registering a Participant as eligible for a Capability shall create a runtime relationship between:

- Capability
- Participant
- Engineering Behavior Model

This relationship makes the Participant a candidate for dispatch. It does not bind the Participant to any specific Deliverable or Work Item; that per-Work-Item binding is produced by the Dispatch Engine (Chapter 33) when it selects among eligible Participants.

Eligibility registration shall not modify the Capability definition.

---

## 10. Dynamic Reassignment

Participants may be replaced during SEU execution.

Examples include:

- AI model upgrade
- Human participant unavailable
- External service unavailable
- Improved specialist capability discovered

Reassignment shall preserve:

- Deliverable state
- Knowledge
- Traceability
- Outstanding Obligations
- Engineering history

---

## 11. Capability Availability

Capability Fulfilment shall continuously monitor:

- available Participants
- unavailable Participants
- degraded Participants
- newly available Participants

Changes in availability may trigger re-evaluation by the Dependency Engine.

---

## 12. Capability Continuity

The platform shall ensure that capability continuity is maintained despite Participant changes.

Engineering continuity shall be preserved through:

- Knowledge Repository
- Deliverable state
- Traceability
- Engineering Behavior Model
- Decision history

Participants shall not become the primary repository of engineering knowledge.

---

## 13. Fulfilment Failure

Capability Fulfilment shall detect situations where:

- no suitable Participant exists
- required authority cannot be satisfied
- Pack constraints cannot be met
- mandatory capabilities are unavailable

Failures shall generate engineering obligations.

Commissioning or execution may be suspended depending on the affected Deliverables.

---

## 14. Events

The subsystem shall publish:

- CapabilityRequested
- CapabilityFulfilmentStarted
- CapabilityFulfilled
- CapabilityUnavailable
- ParticipantAssigned
- ParticipantReleased
- ParticipantReassigned
- CapabilityContinuityMaintained
- CapabilityFulfilmentFailed

---

## 15. Non-Functional Requirements

Capability Fulfilment shall:

- support dynamic reassignment
- support concurrent fulfilment
- remain independent of AI providers
- preserve engineering continuity
- maintain complete traceability

---

## 16. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ Required Capabilities are identified.

✓ Appropriate Participants are assigned.

✓ Participants can be replaced without affecting Deliverables.

✓ Capability Fulfilment remains traceable.

✓ AI, human and external Participants are equally supported.

✓ Capability continuity is preserved during reassignment.

---

## 17. Deliverables

Implementation of this chapter shall produce:

- Capability Fulfilment service
- Participant assignment service
- Capability continuity service
- Fulfilment registry
- Assignment APIs
- Capability Fulfilment events
- Runtime monitoring services

---

## 18. Implementation Specifics

*Recorded 2026-09-11. This section documents how Capability Fulfilment is realised in the current build. It does not change the requirements above (CF-001–005, §§6–17); it records what is built, what is partial, and what is still open — the same convention as Chapter 5 §19. Status markers: ✅ built · ⚠️ partial · 🚩 not built.*

### 18.1 ⚠️ Fulfilment is direct assignment, not a selection algorithm (§8, FR-12.2)

`fulfilCapability` (`core/capabilities.ts`) takes an explicit `participantType` + `displayName` from the caller (a form on the SEU detail page — see 18.10) and creates exactly that Participant. There is no matching/selection step that evaluates §8's own criteria list — capability compatibility, behavioural compatibility with the EBM, required knowledge, required authority, availability, engineering constraints, Pack-specific requirements. "Selection algorithms are implementation-defined" (§8) is true only in the sense that none exists yet to be defined; a human (or whatever calls the form) decides who fulfils a Capability, the platform records it.

**Update 2026-09-11:** the SEU detail page's own Fulfil form no longer takes a free-typed name — it's now a dropdown of real, eligible `participants_master` resources. This closes "who" to a real, tracked identity, but is still not a *selection algorithm* — it's every eligible Participant, presented for a human to pick from. `fulfilCapability` keeps its original `participantType`+`displayName` path too (used by the JSON API, `api/seus.ts`, and every existing test — 17 call sites, not migrated in this pass) alongside the new `participantMasterId` path; either creates the lifecycle `participants` row, but only the latter populates its `participant_id` FK (18.4).

**Update 2026-09-11 (same day) — eligibility factored into its own helper.** Owner: *"Participant dropdown has to be a separate helper. Currently we are just matching capability. But we should be able to expand technology, domain criteria etc."* `core/participantEligibility.ts`'s `findEligibleParticipants({tenantId, capabilityCode, competency?})` is now the one place "who satisfies this" is decided — the DB layer (`participantsMasterDB.findEligibleForCapability`) still does the cheap tenant/`is_active`/capability-containment narrowing, but the helper is where an optional `competency` filter (matching against a Participant's `domain`/`technology`/`hyper-scale` values, migration 195) already composes on top, in memory, with room for §8's remaining criteria (behavioural compatibility with the EBM, required knowledge/authority, engineering constraints, Pack-specific requirements) to join the same one function later. Both the dropdown (`getSeuDetailView`) and `fulfilCapability`'s own server-side re-check now call this **same** helper, so the two can't drift apart as criteria are added — the re-check no longer inlines its own `capabilities.includes(...)`/`is_active`/`tenant_id` logic, it just asks whether the submitted id is in the same eligible set the dropdown was built from. Still not wired up: no caller yet actually passes a `competency` filter (the Fulfil form has no UI for it) — the seam exists, nothing exercises it yet.

**Update 2026-09-11 (same day) — CR-099, in plain terms.** §9 says eligibility, not final assignment. CR-099 is simply widening what "eligible" checks: today it only means "holds the Capability." Once CR-099 is built, it also means "has the Technology/Domain competency this SEU actually needs" — a Pack declares which competency it represents, a Participant declares which competencies it holds, and eligibility only matches when both agree. Nothing about §9 itself changes; the eligible set just gets narrower and more honest.

**Update 2026-09-11 (same day) — CR-101: the competency filter is now actually populated, closing the "Once CR-099 is built" conditional above.** Two corrections to the two paragraphs above, landed together:

- **Dimension vocabulary, corrected.** The paragraph above still says "matching against a Participant's own `domain`/`technology`/`hyper-scale` values, migration 195" — stale. `competency`'s dimension keys are `category:pack`'s own codes (`Domain`/`Technology`, capitalised), not a standalone `competency-dimension` concept type, and `hyper-scale` is dropped entirely — no Pack category maps to it (CR-099's own revision, settled before CR-099 was built, not after).
- **The seam is exercised now.** `domain/engine/profileCompositionUnravel.ts`'s `unravelComposition` — the real, live EBM composition mechanism (`compositionEngine.compose()` is dead code in this flow, explicitly commented out per owner: *"I want compose() commented out as the very first step"*) — computes a `competencyRequirements` union at composition time: every selected Profile's own `primaryProgrammingLanguage` Configuration Parameter unions into dimension `Technology`; its new `domain` Configuration Parameter (CR-101, Ch.7 §10's ninth Configuration Parameter) unions into dimension `Domain`; every composed Pack's own declared `contributionCompetencies[]` (CR-099) unions in by whatever dimension it declares. Carried onto `ebm.behaviors.competencyRequirements` (`compositionCompleted.ts`, the sole place `ebmsDB.create()` is called from). New `getSeuCompetencyRequirements(seu)` (`core/participantEligibility.ts`) reads it back off the SEU's active EBM; both the Fulfil dropdown (`getSeuDetailView`) and `fulfilCapability`/`fulfilCapabilityWithParticipants`'s shared server-side re-check (`resolveMasterParticipant`) now pass it as `findEligibleParticipants`'s `competency` argument — no longer an unexercised seam. §8's Technology/Domain competency criterion is real: "eligible" now genuinely means "holds the Capability AND the Technology/Domain competency this SEU actually needs" (`matchesCompetency`'s own pre-existing ANY-within-dimension/ALL-across-dimensions matching, unchanged, reused as-is). §8's own remaining criteria (behavioural compatibility with the EBM, required knowledge/authority, engineering constraints, Pack-specific requirements) still join nowhere yet.

### 18.2 ⚠️ Eligibility is always exactly one Participant (§9, FR-12.2, FR-12.3)

`capabilityFulfilmentsDB.findActiveBySeuCapabilityId` returns a single row (`LIMIT 1`), by its own comment: *"Today Capability Fulfilment is 1:1 per SEU Capability, so this is the entire pool."* The Dispatch Engine (`dispatchEngine.ts`) that's meant to select among an eligible-Participant pool (§9, Chapter 33) names this directly — its own resolved-participant constant is literally `SOLE_ELIGIBLE_PARTICIPANT`. §9's "candidate for dispatch" pool is real as a concept but never holds more than one candidate in practice.

**Update 2026-09-11 (same day) — mis-scoped: this finding is Dispatch Engine's own behaviour, not Eligibility's.** Owner: *"Eligibility is not one participant. Fulfilment picks an eligibility. Assigning to 1 participant is DispatchEngine."* Correct, on the current code, on two counts this finding (written before the Composite work landed, 18.3, and never revisited) now conflates:

- **§9 Eligibility (the candidate pool) is not one.** `findEligibleParticipants` (`core/participantEligibility.ts`, 18.1) returns every `participants_master` resource that qualifies — capability match, and as of CR-101, Technology/Domain competency too. Nothing about it is capped at one; it's a real, filterable set, presented to the Fulfil dropdown as such.
- **Fulfilment itself is not one either, any more.** Since Composite (18.3), `fulfilCapabilityWithParticipants` can register several active `capability_fulfilments` rows against the same SEU Capability in one call. `findActiveBySeuCapabilityId`'s own comment quoted above is itself now stale text — the live comment reads *"active fulfilment for callers that still only want one (`dispatchEngine.ts`, `replaceParticipant`)... genuinely the 'entire pool' only when a Capability was fulfilled by exactly one Participant; see `findActiveManyBySeuCapabilityId` for the real pool"* — the singular method was **kept**, deliberately, only for the two callers that still want one, not because one is all that can exist.
- **The actual "exactly one" behaviour lives in Dispatch Engine (Ch.33), a downstream, distinct decision.** `dispatchEngine.ts` calls the singular `findActiveBySeuCapabilityId` on purpose and assigns a WorkItem to that one `participantId` under its own `SOLE_ELIGIBLE_PARTICIPANT` strategy constant — this is "of the participant(s) already established as fulfilling this Capability, which one does *this specific WorkItem* go to right now," a Ch.33 question, not a Ch.12 §9 one. It happens to currently pick "whichever fulfilment is most recorded/active most recently" rather than choosing among several (18.3's own residual-gaps note already says this), but that gap belongs to Dispatch Engine's own missing selection logic, not to Eligibility Registration being structurally limited to one.

Net: this subsection's own title overstates what's actually built-in-as-a-limit at the Fulfilment/Eligibility layer. The real, still-open gap is narrower and belongs one chapter downstream — Dispatch Engine has no logic to choose among more than one already-established fulfilling Participant, it just takes whichever `findActiveBySeuCapabilityId` happens to return.

**Owner, same exchange — where the fix belongs:** *"Dispatch Engine should be using section 8 criteria. But let us keep it open and get to it when we review DispatchEngine."* Settled direction, not yet built: when more than one Participant is actively fulfilling a Capability (Composite), Dispatch Engine's own choice of which one a given WorkItem goes to should evaluate §8's Fulfilment Criteria (behavioural compatibility with the EBM, required knowledge/authority, availability, engineering constraints, Pack-specific requirements — the same list 18.1 already names as unevaluated anywhere), not just take whichever entry the pool happens to list first. **Still** deliberately deferred — this is Chapter 33's own build, to be picked up when Dispatch Engine itself is reviewed, not a Chapter 12 change.

**Update 2026-09-19 (CR-109 §6.2) — the eligible-Participant pool is now a real, persisted snapshot, not a live query. Stale text above corrected: `findActiveBySeuCapabilityId` is no longer what Dispatch Engine reads from at all.** A new `capability_fulfilment_pools` table (migration `240`) holds one snapshot row — `{seu_id, seu_capability_id, capability_id, participant_ids[]}` — taken by `executionEngine.execute()` at the moment a Command is generated, via `capabilityFulfilmentsDB.findActiveManyBySeuCapabilityId` (this section's own real multi-Participant pool). `commands.eligible_participant_pool_id` references it — CR-109 §6.2's own named `eligibleParticipantPoolRef` field, closing the gap CR-109's design note flagged as its own next, unbuilt step. `dispatchEngine.ts` no longer calls `seuCapabilitiesDB`/`capabilityFulfilmentsDB` live at all; it reads the pool row the Command already carries and picks `participant_ids[0]` — the exact same "whichever one" selection this subsection's own settled-but-deferred note above describes, just now sourced from a persisted record instead of re-derived on every dispatch. A Command with no producing Capability declared at all gets no pool row (`eligible_participant_pool_id` stays `NULL`) — the pre-existing `NO_CAPABILITY_DECLARED` path is unchanged; a Capability that *is* declared but has zero active fulfilments still gets a real pool row, just with an empty `participant_ids` array, so "no eligible Participant" is now a real, inspectable fact rather than the absence of a query result. **What this deliberately does not change**: Dispatch Engine's own §8-criteria selection logic — still not built, still Chapter 33's own future work, per the owner's own "let us keep it open" above. **Independent of Participant execution being simulated** (the mocked delivery adapters behind `assignmentDelivery.ts`, Ch.31/Ch.33's own execution edge) — this pool-persistence layer is pure Fulfilment/Command data plumbing and does not touch, and is not affected by, how (or whether) a dispatched Work Item's execution is actually simulated. New tests: `tests/cr109-work-item-generator.test.ts` (2 new cases — a real pool snapshot matching the actual fulfilment, and a declared-but-unfulfilled Capability producing an empty-array pool rather than no pool at all).

### 18.3 🚩 Hybrid and Composite strategies are declared, not built (§7, FR-12.3)

`fulfilmentStrategy` (`capability_fulfilments.fulfilment_strategy`) accepts `"Hybrid"` and `"Composite"` as values (migration 002; widened alongside `ParticipantType` in migration 194, see Chapter 13's own Implementation Specifics), but nothing in `fulfilCapability` ever creates more than one Participant per call, and nothing interprets a `Hybrid`/`Composite` value differently from a single-Participant strategy. §7's own two worked examples (an Architecture Capability jointly fulfilled by an AI and a Human Architect) cannot happen today — FR-12.3 ("Multiple Participants may jointly fulfil a Capability") is unbuilt.

**Update 2026-09-11 — Composite built, Hybrid still not distinguished.** Owner: *"The participants dropdown should be multi-select. It chooses as many as it wants as eligible."* The Fulfil form's dropdown is now a real multi-select; `fulfilCapabilityWithParticipants` (`core/capabilities.ts`) creates one lifecycle Participant + one `capability_fulfilments` row per selection, all against the same SEU Capability, `fulfilmentStrategy` set to `"Composite"` whenever more than one is chosen together. FR-12.3 is realised. `capabilityFulfilmentsDB.findActiveBySeuCapabilityId` (singular, `LIMIT 1`) is kept unchanged for existing callers (`dispatchEngine.ts`, `replaceParticipant`) — a new `findActiveManyBySeuCapabilityId` is the real pool now, used by the SEU detail page's own display and nothing else yet. **Residual gaps, not this pass's job:** `"Hybrid"` (specifically AI+Human, §7's own example) is never chosen over `"Composite"` — the code has no rule distinguishing them, everything multi-Participant becomes `"Composite"`; and **Dispatch Engine (Ch.33) still has no real selection logic** — it keeps taking whichever fulfilment was most recently established via the untouched singular method, so with several active Participants now genuinely possible, dispatch just picks the newest one, not a considered choice among them.

**Where per-Participant-type/skill requirements belong, settled by the owner:** the earlier question ("does fulfilment need to reflect a Pack/Profile-declared required Participant Type") is resolved architecturally, even though nothing is built yet. Owner: *"At review level is correct for definition [the existing verifiable-item `participant` field — Checklist/Quality Gate/Review Gate — stays where it is]. There will be a template that will have a complete definition of prompts and skill that AI or automated participants need or use. I think the Dispatch Engine needs to check this and not the Capability Fulfilment."* i.e. Capability Fulfilment (this chapter) stays about registering *eligibility* only (§9, unchanged); matching a specific prompt/skill requirement to a specific Participant is Dispatch Engine's job (Ch.33), against a not-yet-designed prompt/skill definition artifact. Explicitly deferred — owner: "Open item, let us resolve as we go along." Nothing to build from this yet.

### 18.4 🚩 One Participant cannot fulfil multiple Capabilities (FR-12.4)

Every `fulfilCapability` call runs `participantsDB.create` unconditionally — there is no path to pick an *existing* Participant and register it against a second Capability. FR-12.4 ("One Participant may fulfil multiple Capabilities") is not realised; each Capability gets its own freshly-minted Participant, even within the same SEU. This is the same gap Chapter 13's CR-098 (`participants_master`, the tenant-scoped cross-SEU resource registry) is positioned to close — a `participants_master` row already carries a `capabilities[]` array precisely for this — but `fulfilCapability`/`replaceParticipant` have not yet been wired to select from it (Chapter 13 §19's own open item).

**Update 2026-09-11 — partially closed.** `fulfilCapability` now accepts a `participantMasterId` (18.1): the *same* `participants_master` resource, already listing several capability codes, can genuinely be selected to fulfil more than one of this SEU's Capabilities — each call still mints its own new `participants` lifecycle row (per-SEU-Capability engagement, by design, Chapter 13 §8), but every such row now shares one `participant_id` FK back to the same master. FR-12.4 is realised for *this* SEU; `replaceParticipant` (Chapter 13 §13) still only ever creates an ad hoc identity, not yet wired to the same registry.

### 18.5 ✅ Reassignment preserves continuity (§10, FR-12.5, FR-12.6)

`replaceParticipant` (`core/participants.ts`) drives the old Participant through `Released → Archived` (both real, governed `transitionParticipant` calls), creates the replacement, revokes the old `capability_fulfilments` row and establishes a new one. Deliverable state, Knowledge, Decisions, Evidence, Traceability and Outstanding Obligations are preserved by construction, not by an explicit copy step — none of those tables reference `participant_id` at all (confirmed directly; only `capability_fulfilments` does, and that's exactly what gets re-pointed). §10's own preservation list is satisfied because there is nothing participant-shaped to lose.

### 18.6 ⚠️ Capability Fulfilment's own status is an ungoverned flip (§9, cf. Chapter 13's transition discipline)

`seuCapabilitiesDB.markFulfilled` is a plain `UPDATE seu_capabilities SET status = 'Fulfilled'` — `SeuCapabilityStatus` is a two-value type (`Unfulfilled | Fulfilled`, migration 002), and neither value change goes through `transitionEngine`. This is a real inconsistency against this platform's own general discipline elsewhere (Participant, Deliverable, Objective, Pack and every other governed entity move through `transitionEngine.evaluate` with an authority/policy/quality-gate check first) — Capability Fulfilment's own lifecycle is the one place a status change happens with no gate at all.

### 18.7 🚩 No authority gate, no actor attribution (CF-005, FR-12.7)

Neither the Fulfil nor the Replace web route (`web/seus.ts`, `POST /seus/:id/capabilities/:capabilityId/fulfil` and `.../participant/:participantId/replace`) calls `badgeAuthorityEngine` — confirmed directly, no badge check anywhere in that file. §8's "required authority" criterion is therefore not evaluated on the fulfilling side at all (only `replaceParticipant`'s own `Released`/`Archived` hops carry a real actor through `transitionParticipant`, because those are governed Participant-lifecycle transitions, not because Capability Fulfilment itself checks anything). The `ParticipantCreated` and `CapabilityFulfilled` events `fulfilCapability` publishes carry no `actorId` in their payload — same for the fresh `ParticipantCreated` `replaceParticipant` publishes for the new Participant. CF-005 ("shall remain fully traceable") and FR-12.7 hold for the Deliverable/Knowledge/Obligation side (18.5) but not for "who decided this Capability should be fulfilled by this Participant."

### 18.8 ⚠️ Fulfilment Failure — only the cross-SEU pattern is detected (§13)

`seuCapabilitiesDB.findUnfulfilledByCapability` + `telemetry.ts`'s `checkSustainedCapabilityShortages` (Ch.35 §11) raise a real Organisational Learning Obligation, but only once the *same* Capability sits Unfulfilled across a sustained-pattern threshold of SEUs platform-wide — a background/telemetry concern, not an immediate reaction to one failed fulfilment attempt. §13's own list (no suitable Participant exists, required authority cannot be satisfied, Pack constraints cannot be met, mandatory capabilities are unavailable) has no single-SEU, real-time detection path at all — there being no selection algorithm (18.1) means there is nothing to report a failure from in the first place. `CapabilityUnavailable` and `CapabilityFulfilmentFailed` (§14) are never published (confirmed — zero occurrences in the codebase).

### 18.9 ✅ Capability Continuity holds structurally (§12)

Nothing in this codebase stores engineering knowledge on a Participant row — `participants`/`participants_master` carry identity and lifecycle state only (Chapter 13). Knowledge Items, Decisions, Evidence and the EBM itself are all SEU/Deliverable-scoped, never Participant-scoped, so §12's "Participants shall not become the primary repository of engineering knowledge" holds by construction rather than by an enforced rule. The same fact underwrites 18.5's reassignment guarantee.

### 18.10 ⚠️ Required Capabilities are a commissioning-time snapshot, not a live per-Deliverable derivation (FR-12.1)

`commissioning.ts` unions every selected Template's `getRequiredCapabilities` and writes them into `seu_capabilities` once, at commissioning (`seuCapabilitiesDB.createMany`). FR-12.1's own wording ("determine the capabilities required to **progress a Deliverable**") implies a live, per-Deliverable derivation; what's built is a fixed set decided up front from the Template, not re-derived as Deliverables actually progress. This is the same gap Chapter 1 §10 and Chapter 5 §19.12 already name (Objective-content-to-Capability derivation, tracked as CR-011) — Capability Fulfilment consumes whatever `seu_capabilities` already holds; it doesn't participate in deciding what belongs there.

### 18.11 ⚠️ Deliverables coverage (§17)

- **Capability Fulfilment service** — ✅ `core/capabilities.ts`'s `fulfilCapability`, though see 18.1–18.4 for how much of §8/§9 it actually evaluates.
- **Participant assignment service** — ✅ `core/participants.ts`'s `transitionParticipant`/`replaceParticipant`.
- **Capability continuity service** — ✅ by construction, 18.9 — no dedicated service, none needed.
- **Fulfilment registry** — ⚠️ `capability_fulfilments` is a real, queryable table, but there is no dedicated Registry page the way Pack/Template/Capability (Ch.10/Ch.5) have one — a SEU's own Capabilities are visible only embedded in that SEU's own detail page. `capability_fulfilment_pools` (migration `240`, 18.2) is a related but distinct artifact — a point-in-time snapshot taken per Command, not a registry of current fulfilments; it has no display surface at all, by design (it exists for Dispatch to read, not for a human to browse).
- **Assignment APIs** — ✅ `POST /aisworg/seu/api/seus/:id/capabilities/:capabilityId/fulfil` (`routes/seu/api/seus.ts`) is real, JSON-in/JSON-out — corrected from an earlier pass of this audit, which missed it by only checking for a dedicated capabilities/participants file under `routes/seu/api` rather than checking inside `api/seus.ts` itself. Still only covers Fulfil, still only the legacy `{participant: {type, displayName}}` shape (18.1) — no API path for Replace, and no API path for the new `participantMasterId` selection either.
- **Capability Fulfilment events** — ⚠️ `CapabilityFulfilled` and `ParticipantAssigned`/`ParticipantReleased` (the latter two via Chapter 13's own Participant-lifecycle transitions) are published; `CapabilityRequested`, `CapabilityFulfilmentStarted`, `CapabilityUnavailable`, `ParticipantReassigned` (Chapter 13 publishes `ParticipantReplaced` instead — functionally equivalent, differently named) and `CapabilityFulfilmentFailed` are not (18.8).
- **Runtime monitoring services** — 🚩 not built. §11's own "continuously monitor available/unavailable/degraded/newly available Participants" has no implementation; `ParticipantState` has no "degraded" value, and `ParticipantUnavailable` is explicitly deferred in `core/participants.ts`'s own header comment ("held, no graph edge to hang it on").
