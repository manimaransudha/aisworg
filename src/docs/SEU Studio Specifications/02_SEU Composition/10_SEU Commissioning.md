# Chapter 8 – SEU Commissioning

## 1. Purpose

SEU Commissioning is the process by which the platform creates a new Software Engineering Unit (SEU) from a defined ~~Template and ~~ Profile.

*[Remarks: Commissioning from a Template is disallowed. A Template with no variants (typically never the case in software engineering) still has to have a default profile]*

Commissioning transforms static engineering definitions into an executable engineering environment by:

- validating the commissioning request
- composing the Engineering Behavior Model (EBM)
- allocating runtime resources
- establishing governance
- creating the initial engineering state

Commissioning is the only mechanism by which an SEU may be created.

---

## 2. Scope

This chapter defines:

- commissioning workflow
- commissioning validation
- engineering composition
- runtime allocation
- participant recruitment
- initialisation
- activation

This chapter does not define:

- Pack internals
- runtime execution
- participant implementation
- engineering workflows

---

## 3. Architectural Position

```
User

↓

Commissioning Request

↓

Template

+

Profile

↓

Composition Engine

↓

Engineering Behavior Model

↓

SEU Runtime Allocation

↓

Commissioned SEU
```

Commissioning represents the transition from design-time to runtime.

---

## 4. Commissioning Objectives

Commissioning shall ensure that:

- every SEU begins from a valid engineering foundation
- engineering behaviour is completely defined before execution
- governance is established before work begins
- runtime state is consistent
- knowledge repositories are initialised
- traceability begins at SEU creation

---

## 5. Inputs

A commissioning request shall contain:

- Authorised Requestor
- Engineering Objectives
- Profile consisting of
    - Project Metadata
    - Commissioning Parameters
    - Underlying Templates, Capabilities, Services and Packs

Optional inputs include:

- Existing Knowledge Repository
- Existing Deliverables
- Legacy Code Base
- Existing Ontology
- Existing Engineering Assets

Optional inputs can be part of Packs or parameters. 


## 6. Outputs

Commissioning shall produce:

- Commissioned SEU
- Engineering Behavior Model
- Initial Deliverable Catalogue
- Capability Catalogue
- Participant Requirements
- Knowledge Repository
- Dependency Graph
- Obligation Register
- Traceability Repository

---

## 7. Functional Requirements

### FR-8.1

Only authorised users may commission an SEU.
 
### FR-8.2

Every commissioning request shall reference one Template.
 
### FR-8.3

Every commissioning request shall reference one Profile.
 
### FR-8.4

The platform shall validate all mandatory Packs before composition.
 
### FR-8.5

The Composition Engine shall produce exactly one Engineering Behavior Model.
 
### FR-8.6

Commissioning shall fail if behavioural conflicts remain unresolved.
 
### FR-8.7

The platform shall allocate runtime resources only after successful composition.
 
### FR-8.8

The platform shall initialise the Knowledge Repository.
 
### FR-8.9

The platform shall initialise the Dependency Graph.
 
### FR-8.10

The platform shall initialise the Obligation Register.
 
### FR-8.11

Commissioning shall establish complete traceability before execution begins.
 
### FR-8.12

No engineering work shall begin until commissioning completes successfully.

---

## 8. Commissioning Workflow

Every commissioning request shall progress through the following lifecycle.

```
Commission Request

↓

Validate Request

↓

Resolve Template

↓

Resolve Profile

↓

Resolve Packs

↓

Compose EBM

↓

Validate Engineering Model

↓

Allocate Runtime

↓

Create Engineering Assets

↓

Recruit Participants

↓

Activate SEU

↓

Ready for Execution
```

Failure at any stage shall terminate commissioning.

---

## 9. Request Validation

The platform shall validate:

- Template existence
- Profile existence
- user authorisation
- Pack availability
- version compatibility
- commissioning parameters
- mandatory configuration

Validation failures shall produce diagnostic reports.

---

## 10. Engineering Composition

The platform shall invoke the Composition Engine.

The Composition Engine shall:

- discover Packs
- resolve dependencies
- compose behaviour
- validate behaviour
- produce the Engineering Behavior Model

No runtime resources shall be allocated before successful composition.

---

## 11. Runtime Allocation

Following successful composition, the Runtime Kernel shall allocate:

- SEU identifier
- runtime services
- event channels
- configuration
- persistence
- security context
- observability context

The Runtime Kernel remains independent of engineering behaviour.

---

## 12. Engineering Asset Initialisation

Commissioning shall initialise:

- Deliverable Catalogue
- Capability Catalogue
- Role Catalogue
- Knowledge Repository
- Dependency Graph
- Obligation Register
- Traceability Repository

No runtime execution shall occur during initialisation.

---

## 13. Participant Recruitment

Participant recruitment establishes the initial execution capability of the SEU.

Recruitment determines which Participants shall provide the capabilities defined by the Template.

Participants may be:

- AI
- Human
- External Systems

Recruitment may occur:

- automatically
- manually
- through hybrid assignment

Participant recruitment shall not modify the Engineering Behavior Model.

---

## 14. Initial Deliverable State

Every Deliverable shall begin in a defined lifecycle state.

Typical initial states include:

- Planned
- Awaiting Dependency Resolution
- Awaiting Human Input
- Awaiting External Asset
- Ready

The Dependency Engine determines subsequent state transitions.

---

## 15. Initial Knowledge State

The Knowledge Repository shall contain:

- commissioning metadata
- Template reference
- Profile reference
- Engineering Behavior Model reference
- Pack references
- composition report
- commissioning decisions

This establishes the first knowledge baseline.

---

## 16. Initial Obligation State

Commissioning shall create obligations arising from:

- mandatory compliance
- mandatory governance
- mandatory engineering reviews
- required approvals
- unresolved recommendations

Obligations shall become part of the Dependency Graph where appropriate.

---

## 17. Commissioning Report

Every commissioning operation shall produce a permanent Commissioning Report.

The report shall contain:

### Identity

- SEU Identifier
- Template
- Profile
- Engineering Behavior Model Version
 

### Composition

- Packs used
- Pack versions
- Composition summary
- Behaviour summary
 
### Validation

- Warnings
- Errors
- Manual resolutions
- Outstanding recommendations
 
### Runtime

- Participants recruited
- Runtime services allocated
- Initial Deliverables
- Initial Obligations
 
### Traceability

- Commissioning decisions
- Composition traceability
- Behaviour provenance

The Commissioning Report becomes part of the permanent engineering record.

---

## 18. Events

The platform shall publish events including:

- CommissionRequested
- CommissionValidated
- CompositionStarted
- CompositionCompleted
- RuntimeAllocated
- KnowledgeInitialised
- ParticipantsRecruited
- SEUActivated
- CommissionCompleted
- CommissionFailed

---

## 19. Non-Functional Requirements

Commissioning shall:

- be deterministic
- be repeatable
- be fully auditable
- preserve complete traceability
- support concurrent commissioning
- support rollback upon failure

---

## 20. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ An authorised user can commission an SEU.

✓ The Engineering Behavior Model is successfully composed.

✓ Runtime resources are allocated only after successful composition.

✓ Initial engineering assets are created.

✓ Participants are recruited.

✓ The Commissioning Report is generated.

✓ The SEU enters the **Ready for Execution** state.

---

## 21. Deliverables

Implementation of this chapter shall produce:

- Commissioning Service
- Commissioning Workflow
- Commissioning Validation Service
- Runtime Allocation Service
- Participant Recruitment Service
- Commissioning Report Generator
- Commissioning APIs
- Commissioning Events

---

## 22. Implementation Specifics

*Code-verified audit (2026-09-05), not from memory. This section documents how SEU Commissioning is realised in the current build, the same convention Chapter 5 §19 uses. It does not change the requirements above (FR-8.1–12, §§1–21); it records what is built, what is partial, and what is still open. Status markers: ✅ built · ⚠️ partial · 🚩 not built.*

**Updated 2026-09-07, code-verified — CR-092 Part 9 closed this section's own §22.6 "Validate Engineering Model" and §22.14 "Events" gaps for real, by finally splitting Chapter 8's own "Validate Request" (shallow, §9) from "Compose EBM" (deep, §10) instead of continuing to extend `commissionSeu` as one monolithic function. `commissionSeu` (`core/commissioning.ts`) now does only the shallow gate (existence/Authority + a new Pack/Ontology liveness check, `checkRequestLiveness`) and publishes `CommissionValidated`; a new event-bus consumer, `src/domain/engine/ebmComposer.ts`, does Compose EBM for real off that event; `commissionSeu`'s own former tail (Create Engineering Assets, `AUTOMATIC_STEPS`) is extracted into `finalizeCommissioning`, now triggered by a new, separate, human-gated `transitionEbm` Activate action rather than falling straight through the same function body. `compositionEngine.compose()` is no longer called anywhere in this flow. Every other finding below not called out inline as updated — the headline ordering finding included — is unchanged and still accurate.**

Core file: `src/routes/seu/core/commissioning.ts` (`commissionSeu`, `commissionFromForm`, `commissionFromExistingObjective`, and as of 2026-09-07 `finalizeCommissioning`/`transitionEbm`/`checkRequestLiveness`) — one real pipeline, now split across two functions plus an event-driven consumer rather than one linear one, still not the three separate services (`Commissioning Validation Service`, `Runtime Allocation Service`, `Participant Recruitment Service`) §21 names. `CommissioningReport`/`SeuRow` (`src/dblayer/seuTypes.ts:613-632`). Cross-references Chapter 2's own audit (lifecycle states, event names) rather than re-deriving them.

`seusDB.create()` (`commissioning.ts:215`) inserts the SEU's own identity row (`id`, `objective_id`, `template_id`, `profile_id`, `lifecycle_state='Pending'`) ahead of the chapter's own Workflow (§8) order, which lists "Compose EBM" before "Allocate Runtime." It publishes no event and allocates no runtime resource — Runtime Allocation itself is not built (§22.9; no `RuntimeAllocated` event is published anywhere in the code). Out of scope for the 2026-09-07 pass (confirmed with the owner: a Runtime Allocation (§11) concern, not part of the Validate-Request/Compose-EBM split).

### 22.1 ✅ Purpose (§1)

The core claim holds: commissioning is the only path that creates a `seus` row (no other code path calls `seusDB.create`), and it does validate the request, compose the EBM, and create initial engineering state, all for real. "Allocating runtime resources" and "establishing governance" are real in a much thinner sense than the prose implies — see 22.9/22.6 below.

### 22.2 ✅ Architectural Position (§3) — updated 2026-09-07

The real call graph still matches the diagram's own shape, but the middle two boxes ("Composition Engine" → "Engineering Behavior Model") are no longer one synchronous call inside `commissionSeu`: `commissionSeu` resolves Template + Profile and does the shallow gate only, then publishes `CommissionValidated`; the separate `ebmComposer.ts` event-bus consumer picks that up, does the deep composition (`unravelComposition`/`detectCompositionConflicts`, no longer `compositionEngine.compose()`), and creates the EBM (`ebmsDB.create`) itself. The SEU row then still transitions through its own lifecycle, but only once a human separately Activates the EBM (`transitionEbm`) — a real, asynchronous hop the diagram's own straight-line arrows don't show. No step is skipped relative to this diagram; one is now asynchronous and human-gated where it used to be synchronous, plus the ordering already flagged in the headline finding, unchanged.

### 22.3 ⚠️ Commissioning Objectives (§4)

"Every SEU begins from a valid engineering foundation" and "governance is established before work begins" hold in the sense that a Composition conflict or Authority rejection blocks commissioning outright (`commissioning.ts:136-147`, `156-167`). "Knowledge repositories are initialised" and "traceability begins at SEU creation" do not — no `knowledge_items` row is ever created by this pipeline (22.14), and traceability is only as real as the event trail (22.17), which is itself thin.

### 22.4 🚩 Inputs / Outputs — mostly narrower than named (§5–6)

| §5 named input | Real? |
|---|---|
| Template | ✅ `templateId` |
| Profile | ✅ `profileId` |
| Engineering Objectives | ✅ `objectiveId` — singular in practice, per Chapter 2's own `idx_seus_objective_id_unique` finding (1:1, not the plural this section implies) |
| Authorised Requestor | ✅ `actorRole`/`actorId`/`requestedBy` |
| Commissioning Parameters | ⚠️ storage built, not yet consumed — this is CR-088's own Template-exposes/Profile-overrides mechanism (Service Level, Policy, Checklist), a genuinely different thing from Ch.7 §10's Ontology-driven Configuration Parameters (CR-091). Structurally it arrives via `profileId` rather than needing its own top-level input, the same way `optionalPackCodes` does — real now: Profile's own `exposedParameterOverrides` field (migration 176) stores an overriding value for each Service Level/Policy candidate its base Template flags overridable, alongside a "Parameter Overrides" tab. Not real: `commissionSeu`/`compositionEngine.compose()` has no logic yet that reads any of it — same shape of gap as Project Metadata below, storage ahead of consumption |
| Project Metadata | ⚠️ correctly implied by `profileId`, not a separate input — CR-091's own Configuration Parameters (`developmentMethodology`, `primaryProgrammingLanguage`, `defaultRepositoryStructure`, `documentationLevel`, etc.) are exactly this kind of project-level metadata, and they're real fields on Profile today. No plumbing gap either: `commissionSeu` already resolves the full Profile row (`profilesDB.findById`), so every one of these values is already sitting in scope, reachable with zero new wiring. The actual gap is narrower and already tracked, not newly found here — nothing in `commissionSeu`/`compositionEngine.compose()` has any *logic* yet that acts on them, the same "Profile only defines it; SEU commissioning will use it" sequencing already settled in Ch.7 §19.5 |
| *Optional*: Existing Knowledge Repository / Deliverables / Legacy Code Base / Ontology / Engineering Assets | 🚩 none exist — there is no "brownfield" import path into commissioning at all |

| §6 named output | Real? |
|---|---|
| Commissioned SEU | ✅ |
| Engineering Behavior Model | ✅ |
| Initial Deliverable Catalogue | ✅ `deliverablesDB.create` per catalogue entry |
| Capability Catalogue | ✅ `seuCapabilitiesDB.createMany` |
| Dependency Graph | ⚠️ reused, not produced — the canonical graph is materialised once at Template authoring time (`commissioning.ts:190-196`'s own comment), not freshly built per commissioning |
| Participant Requirements | 🚩 not produced |
| Knowledge Repository | 🚩 not initialised |
| Obligation Register | 🚩 not initialised |
| Traceability Repository | 🚩 no distinct output beyond the event trail (22.17) |

### 22.5 ⚠️ Functional Requirements — half hold cleanly (§7)

| FR | Verdict | Note |
|---|---|---|
| FR-8.1 only authorised users may commission | ✅ | Real Authority-gated `transitionEngine.evaluate` (`commissioning.ts:128-135`) |
| FR-8.2 references one Template | ✅ | Required param, resolved and existence-checked |
| FR-8.3 references one Profile | ✅ | Required param; also checked against the Template (`profile.base_template_id !== template.id`) |
| FR-8.4 validate mandatory Packs before composition | ✅ **updated 2026-09-07** | `checkRequestLiveness` (`commissioning.ts`) now runs a real, distinct pre-composition check — every mandatory/selected Pack code (`packsDB.findActiveByCode`), every `additionalCapabilityCodes` entry, and every Service-sourced exposed-parameter override — failing commissioning outright (`CommissionFailed`, SEU → `Failed`) before Compose EBM ever starts, not just a warning |
| FR-8.5 exactly one EBM produced | ✅ | One `ebmsDB.create` call, no loop — now called from `ebmComposer.ts`, not inline in `commissionSeu` |
| FR-8.6 fail on unresolved conflicts | ✅ **updated 2026-09-07** | No longer `compositionReport.conflicts.length > 0` — `detectCompositionConflicts` (`profileCompositionUnravel.ts`) runs inside `ebmComposer.ts` and blocks by publishing `CommissionFailed`/transitioning the SEU to `Failed`, covering every Pack contribution type, not just Authority Rules/Quality Gates |
| FR-8.7 allocate runtime only after composition | 🚩 | Violated — see headline finding |
| FR-8.8 initialise Knowledge Repository | 🚩 | No `knowledge_items` write anywhere in this pipeline |
| FR-8.9 initialise Dependency Graph | ⚠️ | Deliberately *not* freshly initialised — reuses the Template's own pre-materialised graph (design decision, not an oversight) |
| FR-8.10 initialise Obligation Register | 🚩 | No obligation-creation code in this pipeline at all |
| FR-8.11 complete traceability before execution | ⚠️ | Same basis as Ch.2's own FR-2.6/2.12 — real via `events`, not a dedicated traceability service |
| FR-8.12 no work before commissioning completes | ✅ | Deliverables/Capabilities are only created once validation and composition both succeed; a rejected commission creates neither |

### 22.6 ✅ Commissioning Workflow — real, still reordered on Allocate Runtime, but no longer collapsed on Validate Engineering Model (§8) — updated 2026-09-07

| Chapter stage | Real equivalent |
|---|---|
| Commission Request | ✅ `commissionSeu` creates the Pending SEU row and publishes the real `CommissionRequested` event (renamed from `SEUCommissionRequested`, 22.14) |
| Validate Request | ✅ existence + Authority gate + (new) `checkRequestLiveness`'s own Pack/Ontology liveness check, publishing `CommissionValidated` |
| Resolve Template / Resolve Profile | ✅ both, before the gate check |
| Resolve Packs | ⚠️ still not an independent step — happens inside "Compose EBM" |
| Compose EBM | ✅ now a genuinely separate, asynchronous step — `ebmComposer.ts`, off `CommissionValidated`, publishing `CompositionStarted` then `EBMCreated`; no longer `compositionEngine.compose()` |
| Validate Engineering Model | ✅ **no longer folded into composition** — a real, separate, human-gated transition (`transitionEbm`, `Composed → Validated`, publishing `EBMValidated`), matching this chapter's own name for the first time |
| Allocate Runtime | 🚩 still out of order, unchanged — the SEU row is still created before Validate Request/Compose EBM, not after (headline finding); deliberately out of scope for this pass |
| Create Engineering Assets | ✅ Capabilities + Deliverables, still no Role Catalogue (Chapter 2 §19.6) — now runs from `finalizeCommissioning`, triggered by the EBM's own Activate transition, not inline in `commissionSeu` |
| Recruit Participants | 🚩 no participant-recruitment code anywhere, unchanged |
| Activate SEU | ✅ the `AUTOMATIC_STEPS` cascade, unchanged in substance — now runs inside `finalizeCommissioning`, publishing `CompositionCompleted` first |
| Ready for Execution | ⚠️ real lifecycle still ends at `Operational` (Chapter 2 §19.5), never literally named "Ready for Execution," unchanged |

### 22.7 ✅ Request Validation — updated 2026-09-07 (§9)

Real: Template existence, Profile existence, user authorisation (Authority gate), and the Profile↔Template match are all checked (`commissioning.ts`, existence/Authority block). **Pack availability is now real too** — `checkRequestLiveness` re-checks every selected Pack code (and capability-name/service Ontology liveness) as a genuine *pre*-composition check, not folded into composition anymore (FR-8.4 above). Still not real as named: "version compatibility" as its own distinct concept (liveness covers "does an Active version exist," not compatibility between versions); "commissioning parameters" and "mandatory configuration" — neither concept is validated here since neither is an input at all (22.4). "Validation failures shall produce diagnostic reports" — real in a thin sense: a rejection returns a `reason` string (`describeRejection`), not a structured report; the liveness check specifically does return a list of every dead reference found, closer to a real diagnostic than the single-string rejections elsewhere.

### 22.8 ✅ Engineering Composition — updated 2026-09-07 (§10)

Matches closely, via a different, real mechanism than originally audited: `ebmComposer.ts` (not `compositionEngine.compose()`, no longer called anywhere in this flow) discovers/resolves Packs (`unravelComposition`) and produces the EBM; conflicts (`detectCompositionConflicts`, now covering every Pack contribution type this chapter's §7 sibling chapter names, not just 2) block commissioning. The real deviations: the ordering claim already covered in the headline finding, and this step is now genuinely asynchronous (an event-bus consumer, not an inline call) — composition itself, once invoked, behaves exactly as described.

### 22.9 🚩 Runtime Allocation — mostly not built as named (§11)

Of the seven named resources (SEU identifier, runtime services, event channels, configuration, persistence, security context, observability context), only **SEU identifier** is real (the `seus.id` UUID, created at `commissioning.ts:105`) — and it's created *before* composition, not "following successful composition" as this section claims. No code anywhere provisions a distinct "runtime service," "event channel," "security context," or "observability context" per SEU; the platform's actual services/events/persistence are shared infrastructure, not per-SEU allocated resources. "The Runtime Kernel remains independent of engineering behaviour" holds only in that there's no dedicated Runtime Kernel module to couple anything to in the first place.

### 22.10 ⚠️ Engineering Asset Initialisation (§12)

| Named asset | Real? |
|---|---|
| Deliverable Catalogue | ✅ `deliverablesDB.create` per catalogue entry, with producing-Capability resolved from Service Definition outputs (`commissioning.ts:203-239`) |
| Capability Catalogue | ✅ `seuCapabilitiesDB.createMany` |
| Role Catalogue | 🚩 no `Role` entity exists anywhere (Chapter 2 §19.6) |
| Knowledge Repository | 🚩 not initialised |
| Dependency Graph | ⚠️ reused, not initialised fresh (FR-8.9 above) |
| Obligation Register | 🚩 not initialised |
| Traceability Repository | 🚩 no distinct entity, only the event trail |

### 22.11 🚩 Participant Recruitment (§13)

Entirely unbuilt within commissioning — `commissionSeu` never creates a `participants` row, and no recruitment logic (automatic, manual, or hybrid) exists in this pipeline. Participants are attached to an SEU later, through a separate mechanism (`fulfilCapability`, exercised in `tests/service-dependency.test.ts`) — commissioning produces the *requirement* (via `seuCapabilitiesDB.createMany`), never the fulfilment.

### 22.12 ⚠️ Initial Deliverable / Knowledge / Obligation State — one of three real (§14–16)

- **Initial Deliverable State (§14)**: ⚠️ partial — Deliverables are created (22.10), but none of the five named initial states (Planned, Awaiting Dependency Resolution, Awaiting Human Input, Awaiting External Asset, Ready) are asserted here; whatever `deliverablesDB.create`'s own default status is applies uniformly, not a state chosen per-Deliverable at commissioning time.
- **Initial Knowledge State (§15)**: 🚩 not built — no `knowledge_items` row is created carrying commissioning metadata, Template/Profile/EBM references, the composition report, or commissioning decisions. The equivalent information exists only in the `CommissioningReport` (22.13) and the `seus` row's own FK columns, never copied into Knowledge.
- **Initial Obligation State (§16)**: 🚩 not built — no obligation is created from mandatory compliance/governance/review/approval sources at commissioning time; Obligations arise later, through Chapter 23's own separately-audited mechanisms, never from this pipeline.

### 22.13 ⚠️ Commissioning Report — real but four of five sections, several fields missing (§17)

`CommissioningReport` (`seuTypes.ts:613-618`) is a real, persisted (`seus.commissioning_report`) object with exactly four sections — **Traceability is entirely absent**, not five as this section claims.

| §17 named field | Real? |
|---|---|
| SEU Identifier, Template, Profile, EBM (Identity) | ✅ `identity.seuId/templateCode/profileCode/ebmId` — though "Engineering Behavior Model **Version**" is really just the EBM's id, no version field |
| Packs used | ✅ `composition.packsUsed` (codes only) |
| Pack versions | 🚩 not captured — only codes, no version strings |
| Composition summary / Behaviour summary | 🚩 not distinct fields — only raw `warnings`/`conflicts` arrays |
| Warnings, Errors (Validation) | ⚠️ `validation.errors` exists but is hardcoded to `[]` at `commissioning.ts:264` — nothing ever populates it; warnings actually live under `composition`, not `validation` as this section implies |
| Manual resolutions, Outstanding recommendations | 🚩 no such fields |
| Participants recruited | 🚩 no such field (consistent with 22.11) |
| Runtime services allocated | 🚩 no such field (consistent with 22.9) |
| Initial Deliverables | ✅ `runtime.initialDeliverables` |
| Initial Obligations | 🚩 no such field (consistent with 22.12) |
| Commissioning decisions, Composition traceability, Behaviour provenance (Traceability) | 🚩 the whole section is absent from the real type |

### 22.14 ⚠️ Events — 6 of 10 named events real as of 2026-09-07, up from 2 of 10 (§18)

CR-092 Part 9 renamed the two events that already existed under an `SEU`-prefixed name to their exact chapter names, and built four genuinely new ones for real, publishing from `commissionSeu`, `ebmComposer.ts`, and `transitionEbm`:

| Chapter name | Real? |
|---|---|
| CommissionRequested | ✅ **exact match now** (`commissioning.ts`) — renamed from `SEUCommissionRequested` |
| CommissionValidated | ✅ **new** — published once the shallow "Validate Request" gate (existence, Authority, Pack/Ontology liveness) passes |
| CompositionStarted | ✅ **new** — published by `ebmComposer.ts` on consuming `CommissionValidated`, before the deep composition/conflict pass runs |
| CompositionCompleted | ✅ **new** — published by `transitionEbm` once a human Activates a Validated EBM, immediately before handing off to `finalizeCommissioning` |
| RuntimeAllocated | 🚩 no event, unchanged — Runtime Allocation itself stays out of scope (headline finding) |
| KnowledgeInitialised | 🚩 no event, unchanged (consistent with 22.12) |
| ParticipantsRecruited | 🚩 no event, unchanged (consistent with 22.11) |
| SEUActivated | ✅ exact match, unchanged — still fired from the `AUTOMATIC_STEPS` cascade, now inside `finalizeCommissioning` rather than `commissionSeu` directly |
| CommissionCompleted | 🚩 **still no distinct terminal event, unchanged** — not to be confused with the new `CompositionCompleted` above, a different, earlier-firing event this chapter also names; the pipeline's own last event is still `SEUOperational` |
| CommissionFailed | ✅ **exact match now** (`commissioning.ts`, `ebmComposer.ts`) — renamed from `SEUCommissionRejected`, and now covers three real rejection points instead of two: the Authority gate, the new Pack/Ontology liveness check, and Compose EBM's own conflict detection (all three transition the SEU to a real terminal `Failed` state, migration 177). A failure in the `AUTOMATIC_STEPS` loop still publishes nothing, unchanged. |

### 22.15 ⚠️ Non-Functional Requirements (§19)

| NFR | Verdict | Basis |
|---|---|---|
| deterministic | ✅ | No randomness in the pipeline itself |
| repeatable | ✅ | Same inputs produce the same composition, modulo live Pack/Ontology state |
| fully auditable | ⚠️ | Via `events` + `commissioning_report`, both thinner than "full" implies (22.13/22.14) |
| preserve complete traceability | ⚠️ | Same basis as FR-8.11 |
| support concurrent commissioning | ✅ | No shared mutable state between commissioning calls |
| support rollback upon failure | 🚩 | No compensating/rollback logic exists — a failure partway through (e.g. the `AUTOMATIC_STEPS` loop) leaves the SEU row and whatever Deliverables/Capabilities were already created in place, not rolled back |

### 22.16 ⚠️ Acceptance Criteria (§20)

| Criterion | Verdict |
|---|---|
| An authorised user can commission an SEU | ✅ (22.5 FR-8.1) |
| The EBM is successfully composed | ✅ (22.8) |
| Runtime resources are allocated only after successful composition | 🚩 (headline finding) |
| Initial engineering assets are created | ⚠️ (22.10 — Deliverables/Capabilities yes, Role/Knowledge/Obligation/Traceability no) |
| Participants are recruited | 🚩 (22.11) |
| The Commissioning Report is generated | ⚠️ (22.13 — generated, but thinner than specified) |
| The SEU enters the Ready for Execution state | ⚠️ (22.6 — reaches `Operational`, never a state literally named this) |

### 22.17 ⚠️ Deliverables (§21)

| Named Deliverable | Real artifact | Verdict |
|---|---|---|
| Commissioning Service | `commissioning.ts` (`commissionSeu` + two entry-point wrappers +, as of 2026-09-07, `finalizeCommissioning`/`transitionEbm`) | ✅ |
| Commissioning Workflow | No longer one linear pipeline (22.6) — **updated 2026-09-07**: split across `commissionSeu` (shallow gate), the event-driven `ebmComposer.ts` (Compose EBM), and `transitionEbm` (Validate/Activate) | ⚠️ real, still reordered on Allocate Runtime; Validate Engineering Model no longer collapsed |
| Commissioning Validation Service | `checkRequestLiveness` (`commissioning.ts`) — **updated 2026-09-07**: a real, named, distinct function now, not just inline checks, though still not a standalone service/module | ⚠️ |
| Runtime Allocation Service | `seusDB.create` only | 🚩 (22.9) |
| Participant Recruitment Service | Does not exist | 🚩 (22.11) |
| Commissioning Report Generator | `CommissioningReport` construction, `commissioning.ts:261-270` | ⚠️ (22.13) |
| Commissioning APIs | `src/routes/seu/api/*` (objectives/commission endpoints) | ✅ |
| Commissioning Events | 6 of 10 named events real, up from 2 (22.14) — **updated 2026-09-07** | ⚠️