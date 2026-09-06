# Chapter 8 – SEU Commissioning


[Sudha: 
> **Chapter 8 – SEU Commissioning**

That chapter will specify the end-to-end process by which a user requests an SEU, the platform validates the Template and Profile, composes the EBM, allocates runtime resources and commissions the SEU. It is the first chapter that describes an end-to-end platform workflow rather than a static architectural concept, making it the natural transition from the commissioning model to the operational lifecycle.


-------------------

While writing this chapter, one concept became very clear.

We originally described participant assignment as **recruitment**, borrowing terminology from human organisations. I now think that word should be interpreted more broadly.

An SEU doesn't "hire" participants. It **acquires capabilities**. Recruitment is simply one mechanism for satisfying those capability requirements.

For example:

- An AI participant may be instantiated on demand.
- A human participant may be assigned from a resource pool.
- An external service may be bound through an Integration Pack.
- A specialised capability may be discovered and attached dynamically.

This suggests that, internally, the platform should think in terms of **Capability Fulfilment** rather than recruitment. The user-facing terminology can remain familiar ("assign participants" or "staff the SEU"), but the architecture should remain capability-centric.

I would therefore propose an additional ADR:

> **ADR – Capability-First Commissioning**

**Decision:** During commissioning, the platform shall determine the capabilities required by the Template and fulfil those capabilities through appropriate Participants. Participants are an implementation of capability fulfilment, not the primary objective.

I believe this keeps the architecture aligned with one of our core principles: **Capabilities are stable; participants are replaceable.** It also positions the platform for future evolution where a capability might be fulfilled by a swarm of AI agents, a single human expert, or an external autonomous service without changing the commissioning model.
]

---

# 1. Purpose

SEU Commissioning is the process by which the platform creates a new Software Engineering Unit (SEU) from a defined Template and Profile.

Commissioning transforms static engineering definitions into an executable engineering environment by:

- validating the commissioning request;
- composing the Engineering Behavior Model (EBM);
- allocating runtime resources;
- establishing governance;
- creating the initial engineering state.

Commissioning is the only mechanism by which an SEU may be created.

---

# 2. Scope

This chapter defines:

- commissioning workflow;
- commissioning validation;
- engineering composition;
- runtime allocation;
- participant recruitment;
- initialisation;
- activation.

This chapter does not define:

- Pack internals;
- runtime execution;
- participant implementation;
- engineering workflows.

---

# 3. Architectural Position

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

# 4. Commissioning Objectives

Commissioning shall ensure that:

- every SEU begins from a valid engineering foundation;
- engineering behaviour is completely defined before execution;
- governance is established before work begins;
- runtime state is consistent;
- knowledge repositories are initialised;
- traceability begins at SEU creation.

---

# 5. Inputs

A commissioning request shall contain:

- Template
- Profile
- Commissioning Parameters
- Engineering Objectives
- Project Metadata
- Authorised Requestor

Optional inputs include:

- Existing Knowledge Repository
- Existing Deliverables
- Legacy Code Base
- Existing Ontology
- Existing Engineering Assets

---

# 6. Outputs

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

# 7. Functional Requirements

### FR-8.1

Only authorised users may commission an SEU.

---

### FR-8.2

Every commissioning request shall reference one Template.

---

### FR-8.3

Every commissioning request shall reference one Profile.

---

### FR-8.4

The platform shall validate all mandatory Packs before composition.

---

### FR-8.5

The Composition Engine shall produce exactly one Engineering Behavior Model.

---

### FR-8.6

Commissioning shall fail if behavioural conflicts remain unresolved.

---

### FR-8.7

The platform shall allocate runtime resources only after successful composition.

---

### FR-8.8

The platform shall initialise the Knowledge Repository.

---

### FR-8.9

The platform shall initialise the Dependency Graph.

---

### FR-8.10

The platform shall initialise the Obligation Register.

---

### FR-8.11

Commissioning shall establish complete traceability before execution begins.

---

### FR-8.12

No engineering work shall begin until commissioning completes successfully.

---

# 8. Commissioning Workflow

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

# 9. Request Validation

The platform shall validate:

- Template existence;
- Profile existence;
- user authorisation;
- Pack availability;
- version compatibility;
- commissioning parameters;
- mandatory configuration.

Validation failures shall produce diagnostic reports.

---

# 10. Engineering Composition

The platform shall invoke the Composition Engine.

The Composition Engine shall:

- discover Packs;
- resolve dependencies;
- compose behaviour;
- validate behaviour;
- produce the Engineering Behavior Model.

No runtime resources shall be allocated before successful composition.

---

# 11. Runtime Allocation

Following successful composition, the Runtime Kernel shall allocate:

- SEU identifier;
- runtime services;
- event channels;
- configuration;
- persistence;
- security context;
- observability context.

The Runtime Kernel remains independent of engineering behaviour.

---

# 12. Engineering Asset Initialisation

Commissioning shall initialise:

- Deliverable Catalogue;
- Capability Catalogue;
- Role Catalogue;
- Knowledge Repository;
- Dependency Graph;
- Obligation Register;
- Traceability Repository.

No runtime execution shall occur during initialisation.

---

# 13. Participant Recruitment

Participant recruitment establishes the initial execution capability of the SEU.

Recruitment determines which Participants shall provide the capabilities defined by the Template.

Participants may be:

- AI;
- Human;
- External Systems.

Recruitment may occur:

- automatically;
- manually;
- through hybrid assignment.

Participant recruitment shall not modify the Engineering Behavior Model.

---

# 14. Initial Deliverable State

Every Deliverable shall begin in a defined lifecycle state.

Typical initial states include:

- Planned
- Awaiting Dependency Resolution
- Awaiting Human Input
- Awaiting External Asset
- Ready

The Dependency Engine determines subsequent state transitions.

---

# 15. Initial Knowledge State

The Knowledge Repository shall contain:

- commissioning metadata;
- Template reference;
- Profile reference;
- Engineering Behavior Model reference;
- Pack references;
- composition report;
- commissioning decisions.

This establishes the first knowledge baseline.

---

# 16. Initial Obligation State

Commissioning shall create obligations arising from:

- mandatory compliance;
- mandatory governance;
- mandatory engineering reviews;
- required approvals;
- unresolved recommendations.

Obligations shall become part of the Dependency Graph where appropriate.

---

# 17. Commissioning Report

Every commissioning operation shall produce a permanent Commissioning Report.

The report shall contain:

### Identity

- SEU Identifier
- Template
- Profile
- Engineering Behavior Model Version

---

### Composition

- Packs used
- Pack versions
- Composition summary
- Behaviour summary

---

### Validation

- Warnings
- Errors
- Manual resolutions
- Outstanding recommendations

---

### Runtime

- Participants recruited
- Runtime services allocated
- Initial Deliverables
- Initial Obligations

---

### Traceability

- Commissioning decisions
- Composition traceability
- Behaviour provenance

The Commissioning Report becomes part of the permanent engineering record.

---

# 18. Events

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

# 19. Non-Functional Requirements

Commissioning shall:

- be deterministic;
- be repeatable;
- be fully auditable;
- preserve complete traceability;
- support concurrent commissioning;
- support rollback upon failure.

---

# 20. Acceptance Criteria

The implementation shall satisfy the following criteria.

✓ An authorised user can commission an SEU.

✓ The Engineering Behavior Model is successfully composed.

✓ Runtime resources are allocated only after successful composition.

✓ Initial engineering assets are created.

✓ Participants are recruited.

✓ The Commissioning Report is generated.

✓ The SEU enters the **Ready for Execution** state.

---

# 21. Deliverables

Implementation of this chapter shall produce:

- Commissioning Service.
- Commissioning Workflow.
- Commissioning Validation Service.
- Runtime Allocation Service.
- Participant Recruitment Service.
- Commissioning Report Generator.
- Commissioning APIs.
- Commissioning Events.

---

# 22. Implementation Specifics

*Code-verified audit (2026-09-05), not from memory. This section documents how SEU Commissioning is realised in the current build, the same convention Chapter 5 §19 uses. It does not change the requirements above (FR-8.1–12, §§1–21); it records what is built, what is partial, and what is still open. Status markers: ✅ built · ⚠️ partial · 🚩 not built.*

Core file: `src/routes/seu/core/commissioning.ts` (`commissionSeu`, `commissionFromForm`, `commissionFromExistingObjective`) — one real, linear pipeline, not the three separate services (`Commissioning Validation Service`, `Runtime Allocation Service`, `Participant Recruitment Service`) §21 names. `CommissioningReport`/`SeuRow` (`src/dblayer/seuTypes.ts:613-632`). Cross-references Chapter 2's own audit (lifecycle states, event names) rather than re-deriving them.

**The single strongest finding**: FR-8.7 ("The platform shall allocate runtime resources only after successful composition") and §10's own "No runtime resources shall be allocated before successful composition" are both violated by the real code's own ordering — `seusDB.create()` (`commissioning.ts:105`) runs *before* `compositionEngine.compose()` is ever called (`commissioning.ts:150`), not after. The chapter's own Workflow (§8) lists "Compose EBM" ahead of "Allocate Runtime"; the real pipeline does the opposite for the one thing it actually allocates up front (the SEU's own identity row).

## 22.1 ✅ Purpose (§1)

The core claim holds: commissioning is the only path that creates a `seus` row (no other code path calls `seusDB.create`), and it does validate the request, compose the EBM, and create initial engineering state, all for real. "Allocating runtime resources" and "establishing governance" are real in a much thinner sense than the prose implies — see 22.9/22.6 below.

## 22.2 ✅ Architectural Position (§3)

The real call graph matches: `commissionSeu` resolves Template + Profile, calls `compositionEngine.compose()`, creates the EBM (`ebmsDB.create`), then the SEU row transitions through its own lifecycle. No step is skipped or reordered relative to this diagram except the one already flagged in the headline finding.

## 22.3 ⚠️ Commissioning Objectives (§4)

"Every SEU begins from a valid engineering foundation" and "governance is established before work begins" hold in the sense that a Composition conflict or Authority rejection blocks commissioning outright (`commissioning.ts:136-147`, `156-167`). "Knowledge repositories are initialised" and "traceability begins at SEU creation" do not — no `knowledge_items` row is ever created by this pipeline (22.14), and traceability is only as real as the event trail (22.17), which is itself thin.

## 22.4 🚩 Inputs / Outputs — mostly narrower than named (§5–6)

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

## 22.5 ⚠️ Functional Requirements — half hold cleanly (§7)

| FR | Verdict | Note |
|---|---|---|
| FR-8.1 only authorised users may commission | ✅ | Real Authority-gated `transitionEngine.evaluate` (`commissioning.ts:128-135`) |
| FR-8.2 references one Template | ✅ | Required param, resolved and existence-checked |
| FR-8.3 references one Profile | ✅ | Required param; also checked against the Template (`profile.base_template_id !== template.id`) |
| FR-8.4 validate mandatory Packs before composition | ⚠️ | No distinct pre-composition Pack-availability check — Pack resolution happens *inside* `compositionEngine.compose()` itself, which warns on a missing Pack rather than failing commissioning outright |
| FR-8.5 exactly one EBM produced | ✅ | One `ebmsDB.create` call, no loop |
| FR-8.6 fail on unresolved conflicts | ✅ | `compositionReport.conflicts.length > 0` blocks commissioning (`commissioning.ts:156-167`) |
| FR-8.7 allocate runtime only after composition | 🚩 | Violated — see headline finding |
| FR-8.8 initialise Knowledge Repository | 🚩 | No `knowledge_items` write anywhere in this pipeline |
| FR-8.9 initialise Dependency Graph | ⚠️ | Deliberately *not* freshly initialised — reuses the Template's own pre-materialised graph (design decision, not an oversight) |
| FR-8.10 initialise Obligation Register | 🚩 | No obligation-creation code in this pipeline at all |
| FR-8.11 complete traceability before execution | ⚠️ | Same basis as Ch.2's own FR-2.6/2.12 — real via `events`, not a dedicated traceability service |
| FR-8.12 no work before commissioning completes | ✅ | Deliverables/Capabilities are only created once validation and composition both succeed; a rejected commission creates neither |

## 22.6 ⚠️ Commissioning Workflow — real, but reordered and partly collapsed (§8)

| Chapter stage | Real equivalent |
|---|---|
| Commission Request | ✅ the function call itself |
| Validate Request | ✅ existence + status + Authority gate (`commissioning.ts:47-147`) |
| Resolve Template / Resolve Profile | ✅ both, before the gate check |
| Resolve Packs | ⚠️ not an independent step — happens inside "Compose EBM" |
| Compose EBM | ✅ `compositionEngine.compose()` |
| Validate Engineering Model | ⚠️ folded into composition — only a conflict-count check, no separate "model validation" |
| Allocate Runtime | 🚩 out of order — the SEU row (the one thing resembling "runtime allocation" here) is created *before* Resolve Template/Compose EBM, not after (headline finding) |
| Create Engineering Assets | ✅ Capabilities + Deliverables, but no Role Catalogue (Chapter 2 §19.6: `Role` doesn't exist anywhere in the codebase) |
| Recruit Participants | 🚩 no participant-recruitment code anywhere in `commissionSeu` |
| Activate SEU | ✅ the `AUTOMATIC_STEPS` cascade (Commissioned→Configured→Activated→Operational) |
| Ready for Execution | ⚠️ real lifecycle ends at `Operational` (Chapter 2 §19.5), never literally named "Ready for Execution" |

## 22.7 ⚠️ Request Validation (§9)

Real: Template existence, Profile existence, user authorisation (Authority gate), and the Profile↔Template match are all checked (`commissioning.ts:47-84`, `128-147`). Not real as named: "Pack availability" and "version compatibility" as *pre*-composition checks (folded into composition itself, see FR-8.4 above); "commissioning parameters" and "mandatory configuration" — neither concept is validated here since neither is an input at all (22.4). "Validation failures shall produce diagnostic reports" — real in a thin sense: a rejection returns a `reason` string (`describeRejection`, `commissioning.ts:281-287`), not a structured report.

## 22.8 ✅ Engineering Composition (§10)

Matches closely: `compositionEngine.compose()` discovers/resolves Packs and produces the EBM; conflicts block commissioning. The one real deviation is the ordering claim already covered in the headline finding — composition itself, once invoked, behaves exactly as described.

## 22.9 🚩 Runtime Allocation — mostly not built as named (§11)

Of the seven named resources (SEU identifier, runtime services, event channels, configuration, persistence, security context, observability context), only **SEU identifier** is real (the `seus.id` UUID, created at `commissioning.ts:105`) — and it's created *before* composition, not "following successful composition" as this section claims. No code anywhere provisions a distinct "runtime service," "event channel," "security context," or "observability context" per SEU; the platform's actual services/events/persistence are shared infrastructure, not per-SEU allocated resources. "The Runtime Kernel remains independent of engineering behaviour" holds only in that there's no dedicated Runtime Kernel module to couple anything to in the first place.

## 22.10 ⚠️ Engineering Asset Initialisation (§12)

| Named asset | Real? |
|---|---|
| Deliverable Catalogue | ✅ `deliverablesDB.create` per catalogue entry, with producing-Capability resolved from Service Definition outputs (`commissioning.ts:203-239`) |
| Capability Catalogue | ✅ `seuCapabilitiesDB.createMany` |
| Role Catalogue | 🚩 no `Role` entity exists anywhere (Chapter 2 §19.6) |
| Knowledge Repository | 🚩 not initialised |
| Dependency Graph | ⚠️ reused, not initialised fresh (FR-8.9 above) |
| Obligation Register | 🚩 not initialised |
| Traceability Repository | 🚩 no distinct entity, only the event trail |

## 22.11 🚩 Participant Recruitment (§13)

Entirely unbuilt within commissioning — `commissionSeu` never creates a `participants` row, and no recruitment logic (automatic, manual, or hybrid) exists in this pipeline. Participants are attached to an SEU later, through a separate mechanism (`fulfilCapability`, exercised in `tests/service-dependency.test.ts`) — commissioning produces the *requirement* (via `seuCapabilitiesDB.createMany`), never the fulfilment.

## 22.12 ⚠️ Initial Deliverable / Knowledge / Obligation State — one of three real (§14–16)

- **Initial Deliverable State (§14)**: ⚠️ partial — Deliverables are created (22.10), but none of the five named initial states (Planned, Awaiting Dependency Resolution, Awaiting Human Input, Awaiting External Asset, Ready) are asserted here; whatever `deliverablesDB.create`'s own default status is applies uniformly, not a state chosen per-Deliverable at commissioning time.
- **Initial Knowledge State (§15)**: 🚩 not built — no `knowledge_items` row is created carrying commissioning metadata, Template/Profile/EBM references, the composition report, or commissioning decisions. The equivalent information exists only in the `CommissioningReport` (22.13) and the `seus` row's own FK columns, never copied into Knowledge.
- **Initial Obligation State (§16)**: 🚩 not built — no obligation is created from mandatory compliance/governance/review/approval sources at commissioning time; Obligations arise later, through Chapter 23's own separately-audited mechanisms, never from this pipeline.

## 22.13 ⚠️ Commissioning Report — real but four of five sections, several fields missing (§17)

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

## 22.14 🚩 Events — 2 of 10 named events real, most entirely missing (§18)

| Chapter name | Real? |
|---|---|
| CommissionRequested | ⚠️ real as `SEUCommissionRequested` (`commissioning.ts:118`) — differently prefixed |
| CommissionValidated | 🚩 no event — validation is inline, never announced |
| CompositionStarted | 🚩 no event |
| CompositionCompleted | 🚩 no event |
| RuntimeAllocated | 🚩 no event |
| KnowledgeInitialised | 🚩 no event (consistent with 22.12 — nothing to announce) |
| ParticipantsRecruited | 🚩 no event (consistent with 22.11) |
| SEUActivated | ✅ exact match — fired from the `AUTOMATIC_STEPS` cascade (`commissioning.ts:255-258`) |
| CommissionCompleted | 🚩 no distinct terminal event — the pipeline just returns `{ok:true}`; the last event actually published is `SEUOperational` |
| CommissionFailed | ⚠️ real as `SEUCommissionRejected` (`commissioning.ts:138`, `158`) — differently named, and only covers the Authority-rejection and composition-conflict paths; a failure in the `AUTOMATIC_STEPS` loop or the final reload (`commissioning.ts:247-249`, `272-276`) publishes nothing at all |

## 22.15 ⚠️ Non-Functional Requirements (§19)

| NFR | Verdict | Basis |
|---|---|---|
| deterministic | ✅ | No randomness in the pipeline itself |
| repeatable | ✅ | Same inputs produce the same composition, modulo live Pack/Ontology state |
| fully auditable | ⚠️ | Via `events` + `commissioning_report`, both thinner than "full" implies (22.13/22.14) |
| preserve complete traceability | ⚠️ | Same basis as FR-8.11 |
| support concurrent commissioning | ✅ | No shared mutable state between commissioning calls |
| support rollback upon failure | 🚩 | No compensating/rollback logic exists — a failure partway through (e.g. the `AUTOMATIC_STEPS` loop) leaves the SEU row and whatever Deliverables/Capabilities were already created in place, not rolled back |

## 22.16 ⚠️ Acceptance Criteria (§20)

| Criterion | Verdict |
|---|---|
| An authorised user can commission an SEU | ✅ (22.5 FR-8.1) |
| The EBM is successfully composed | ✅ (22.8) |
| Runtime resources are allocated only after successful composition | 🚩 (headline finding) |
| Initial engineering assets are created | ⚠️ (22.10 — Deliverables/Capabilities yes, Role/Knowledge/Obligation/Traceability no) |
| Participants are recruited | 🚩 (22.11) |
| The Commissioning Report is generated | ⚠️ (22.13 — generated, but thinner than specified) |
| The SEU enters the Ready for Execution state | ⚠️ (22.6 — reaches `Operational`, never a state literally named this) |

## 22.17 ⚠️ Deliverables (§21)

| Named Deliverable | Real artifact | Verdict |
|---|---|---|
| Commissioning Service | `commissioning.ts` (`commissionSeu` + two entry-point wrappers) | ✅ |
| Commissioning Workflow | The linear pipeline itself (22.6) | ⚠️ real, reordered relative to spec |
| Commissioning Validation Service | Inline checks in `commissionSeu`, not a separate service | ⚠️ |
| Runtime Allocation Service | `seusDB.create` only | 🚩 (22.9) |
| Participant Recruitment Service | Does not exist | 🚩 (22.11) |
| Commissioning Report Generator | `CommissioningReport` construction, `commissioning.ts:261-270` | ⚠️ (22.13) |
| Commissioning APIs | `src/routes/seu/api/*` (objectives/commission endpoints) | ✅ |
| Commissioning Events | 2 of 10 named events real (22.14) | 🚩