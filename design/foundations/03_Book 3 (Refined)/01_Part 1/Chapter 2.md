## Chapter 2 – Software Engineering Unit (SEU)

[Remarks: What is the relationship between **Deliverables** and **Work Items**? Deliverables are the primary concept and Work Items subordinate to them because it aligns with the dependency-driven execution model. 

The key question is:
> **Should Deliverables be the fundamental unit of execution, or should they simply be outcomes produced by Work Items?**

**Deliverables should remain primary**. Software engineering ultimately exists to produce engineering artefacts and outcomes. Work Items are transient execution steps, whereas Deliverables become part of the enduring engineering knowledge of the SEU. If we accept that, then the Dependency Engine naturally operates on Deliverables, and Work Items become implementation mechanics rather than the centre of the execution model. This is more consistent with the knowledge-first philosophy.
]

---

# 1. Purpose

The **Software Engineering Unit (SEU)** is the primary execution entity of the AI-Native Software Organisation Platform.

An SEU is a temporary engineering construct commissioned to achieve one or more software engineering Objectives (Chapter 1). Every SEU's required Capabilities derive from the Objective(s) it is commissioned to achieve.

Unlike a traditional software team, an SEU is an executable runtime entity whose behaviour is determined by a composed **Engineering Behavior Model (EBM)** and whose participants may be AI, human, or external systems.

The SEU is responsible for executing software engineering work while preserving knowledge, governance, traceability and engineering practices independently of individual participants.

# 2. Scope

This chapter defines:

- the SEU lifecycle;
- the SEU runtime model;
- the SEU composition model;
- responsibilities of an SEU;
- interaction with the Runtime Kernel, Composition Engine and Packs;
- commissioning and archival.

This chapter does **not** define:

- individual capabilities;
- participant implementations;
- engineering practices;
- workflows;
- knowledge internals.

These are specified in subsequent chapters.
 

# 3. Architectural Position

Within the platform architecture, the SEU occupies the execution layer.

```
                 User/API
                     │
                     ▼
            Commission SEU
                     │
                     ▼
              SEU Runtime
                     │
        ┌────────────┼────────────┐
        │            │            │
   Work Items   Knowledge   Governance
        │            │            │
        └────────────┼────────────┘
                     │
                     ▼
         Engineering Behavior Model
                     │
                     ▼
            Composition Engine
                     │
                     ▼
          Extension Framework
                     │
                     ▼
              Runtime Kernel
```

The SEU shall not interact directly with Packs.

All engineering behaviour shall be inherited through the Engineering Behavior Model.
 

# 4. Responsibilities

The SEU is responsible for:

- executing software engineering work;
- maintaining engineering governance;
- coordinating participants;
- maintaining dependency graphs;
- managing engineering obligations;
- preserving knowledge;
- maintaining traceability;
- reporting engineering state.

The SEU is **not** responsible for:

- composing engineering practices;
- loading Packs;
- authenticating users;
- infrastructure management.
 

# 5. Functional Requirements

### FR-2.1

The platform shall permit authorised users to commission an SEU.
 
### FR-2.2

Every SEU shall execute against exactly one Engineering Behavior Model.

### FR-2.3

An Engineering Behavior Model shall exist before an SEU is commissioned.

### FR-2.4

Every runtime object shall belong to exactly one active SEU.
 
### FR-2.5

An SEU shall support human, AI and external-system participants.
 
### FR-2.6

An SEU shall maintain complete engineering traceability.
 
### FR-2.7

An SEU shall preserve organisational knowledge independently of participant lifecycle.
 
### FR-2.8

An SEU shall expose runtime state through published services.
 
### FR-2.9

An SEU shall maintain dependency relationships between deliverables.
 
### FR-2.10

Execution shall occur only when dependency conditions are satisfied.

### FR-2.11

An SEU shall manage engineering obligations.
 

### FR-2.12

An SEU shall preserve a complete audit history.
 

# 6. SEU Lifecycle

Every SEU shall transition through the following lifecycle.

```
Requested

↓

Engineering Behavior Composition

↓

Commissioned

↓

Executing

↓

Monitoring

↓

Completing

↓

Knowledge Preservation

↓

Archived
```

### Requested

The project objective has been defined.

No runtime resources exist.

---

### Engineering Behavior Composition

The Composition Engine constructs the Engineering Behavior Model.

No participants are active.

---

### Commissioned

Runtime resources are allocated.

Capabilities become available.

Participants may be recruited.

---

### Executing

The SEU performs engineering work.

The Dependency Engine continuously evaluates execution readiness.

---

### Monitoring

The SEU continuously evaluates:

- dependency health;
- engineering obligations;
- governance;
- knowledge completeness;
- execution flow.

---

### Completing

Outstanding work reaches a terminal state.

Knowledge is consolidated.

---

### Knowledge Preservation

Knowledge, evidence and traceability are finalised for long-term reuse.

---

### Archived

The SEU becomes read-only.

Runtime execution ceases.

Knowledge remains accessible.

---

# 7. SEU Composition

An SEU is composed of the following runtime components.

```
Software Engineering Unit

├── Objectives
├── Participants
├── Capabilities
├── Services
├── Roles
├── Deliverables
├── Work Items
├── Dependency Graph
├── Knowledge
├── Evidence
├── Governance
├── Obligations
├── Traceability
├── Metrics
└── Runtime State
```

Each component is elaborated in later chapters.

---

# 8. Execution Model

Execution within an SEU is dependency-driven.

The platform shall determine execution readiness by evaluating dependency satisfaction rather than elapsed time.

Dependencies may arise from:

- engineering deliverables;
- decisions;
- approvals;
- evidence;
- obligations;
- external systems;
- human input.

The Runtime Kernel shall execute only work items declared ready by the Dependency Engine.

---

# 9. Engineering Behavior Model

The SEU inherits all engineering behaviour from its Engineering Behavior Model.

The Engineering Behavior Model defines:

- engineering standards;
- governance;
- decision rules;
- quality gates;
- review gates;
- authority rules;
- engineering terminology;
- engineering practices.

The SEU shall not modify the Engineering Behavior Model directly.

Changes require recomposition by the Composition Engine.

---

# 10. Participants

Participants execute capabilities within assigned roles.

Participants may be:

- AI;
- Human;
- External Systems.

Participants are replaceable.

Replacement shall not invalidate knowledge, traceability or completed work.

---

# 11. Deliverables

A Deliverable represents a measurable engineering outcome.

Examples include:

- Approved Requirements Specification
- Architecture Document
- Source Code
- Test Suite
- Deployment Package
- User Documentation

Every Deliverable shall define:

- dependencies;
- producing capabilities;
- required evidence;
- acceptance criteria;
- completion status.

---

# 12. Work Items

A Work Item represents an executable unit of engineering activity.

Work Items exist solely to produce or modify Deliverables.

Every Work Item shall reference one or more Deliverables.

Work Items shall not exist independently of Deliverables.

---

# 13. Dependency Graph

The SEU shall maintain a dependency graph describing relationships between:

- Deliverables;
- Decisions;
- Obligations;
- Knowledge;
- Evidence;
- External dependencies.

Execution readiness shall be determined exclusively from this graph.

---

# 14. Engineering Obligations

An SEU shall manage engineering obligations originating from:

- risks;
- audits;
- customer observations;
- compliance;
- security reviews;
- architecture reviews;
- dependency analysis.

Every obligation shall possess:

- owner;
- severity;
- priority;
- required evidence;
- blocking conditions;
- status.

---

# 15. Events

The SEU shall publish domain events.

Examples include:

- SEUCommissioned
- DeliverableReady
- WorkItemStarted
- WorkItemCompleted
- DependencySatisfied
- DependencyBlocked
- ObligationRaised
- ObligationResolved
- KnowledgeAccepted
- KnowledgeArchived
- SEUArchived

---

# 16. Non-Functional Requirements

- Multiple SEUs shall execute concurrently.
- SEU execution shall survive runtime restarts.
- Runtime state shall be recoverable.
- All engineering decisions shall remain traceable.
- All execution shall be externally observable.
- The SEU shall remain independent of specific AI providers.

---

# 17. Acceptance Criteria

The chapter shall be considered implemented when:

- An SEU can be commissioned from an Engineering Behavior Model.
- Participants can be assigned and replaced.
- Deliverables drive execution.
- Work Items execute only when dependencies are satisfied.
- Engineering obligations influence execution.
- Knowledge survives SEU archival.
- Traceability remains complete.

---

# 18. Deliverables

Implementation of this chapter shall produce:

- SEU domain model.
- SEU lifecycle implementation.
- SEU aggregate definition.
- Dependency graph interfaces.
- Deliverable model.
- Work Item model.
- Runtime services.
- Event definitions.
- Initial API specification.

---

# 19. Implementation Status & Gaps

Code-verified audit (2026-08-25), not from memory — every claim below carries a file:line citation, cross-checked against a live query against the running Postgres instance (`aisworg` DB). Core files: `src/dblayer/seusDB.ts`, `SeuRow` (`src/dblayer/seuTypes.ts`), `src/routes/seu/core/commissioning.ts`, `seus.ts`, `deliverables.ts`, `workItems.ts`, `src/domain/engine/dependencyDefinitionEngine.ts`, `dispatchEngine.ts`. Live `seus` schema: `id, objective_id, template_id, profile_id, active_ebm_id, lifecycle_state, requested_by, commissioning_report, created_at, updated_at, tenant_id`. This chapter sits above several already-audited ones (EBM Ch.3, Composition Engine Ch.4, Obligation Ch.23) — findings that duplicate those are cross-referenced, not re-derived.

**The single strongest finding**: `idx_seus_objective_id_unique` — a real, enforced `UNIQUE` constraint on `seus.objective_id` — confirms an SEU has exactly one Objective *and* an Objective can be commissioned into at most one SEU, a strict 1:1. Directly closes the earlier open question about Ch.1's own "a specific stream of Deliverables within one [SEU]" phrasing (Ch.1 §1) — there is no mechanism for one SEU to be justified by more than one Objective, so that alternative reading has zero support in the schema, confirmed at the strongest possible level (a DB constraint, not just an absent code path).

## 19.1 Purpose / Definition (§1)

Matches closely for what's built: an SEU is commissioned against an Objective (real FK, 1:1 as above), executes against a composed EBM (real, Ch.3), and supports AI/Human/External participants (real, `participants.type CHECK`). "Required Capabilities derive from the Objective(s)" — real via `objectivesDB.getRequiredCapabilities` (Ch.10 §18.7), though templates.ts's own `getRequiredCapabilities` (used at commissioning, `commissioning.ts:176`) actually derives from the *Template's* Deliverable Catalogue producing-capability references, not from the Objective directly — a subtly different derivation path than this section implies, worth noting precisely.

## 19.2 Architectural Position (§3)

"The SEU shall not interact directly with Packs" and "all engineering behaviour shall be inherited through the EBM" — both hold, confirmed by Chapter 3's own audit (§19.10): every real runtime consumer (`governanceModel.ts`, `compliance.ts`, `dependencyDefinitionEngine.ts`, `traceability.ts`) reaches Pack-contributed governance exclusively via `seu.active_ebm_id` → `ebms.composed_packs`, never a direct Pack reference on the SEU itself.

## 19.3 Responsibilities (§4)

The "responsible for" list (execute work, maintain governance, coordinate participants, maintain dependency graphs, manage obligations, preserve knowledge, maintain traceability, report state) each map onto real, separately-audited subsystems (Dependency Engine, Obligation Ch.23, Knowledge Ch.16, Events/traceability) rather than SEU-owned logic itself — consistent with the chapter's own framing that these are "elaborated in later chapters." The "not responsible for" list holds: `seus.ts` never composes engineering practices, loads Packs, authenticates, or manages infrastructure.

## 19.4 Functional Requirements (FR-2.1–12) (§5)

| FR | Verdict | Note |
|---|---|---|
| FR-2.1 authorised users may commission an SEU | ✅ | `commissioning.ts`'s own authority-gated flow (Ch.22 governed transition). |
| FR-2.2 every SEU executes against exactly one EBM | ✅ | `active_ebm_id`, set once (Ch.3 §19.3 FR-3.1). |
| FR-2.3 EBM shall exist before SEU is commissioned | ✅ | `compose()` runs, then `ebmsDB.create`, then `Pending→Commissioned` — strict order in `commissioning.ts:139-168`. |
| FR-2.4 every runtime object belongs to exactly one active SEU | ✅ | Every runtime table's own `seu_id` FK is `NOT NULL` and singular (confirmed: `deliverables`, `participants`, `obligations`, `decisions`, `evidence`, `knowledge_items`, `reviews`, `commands`, `events`, etc. all reference exactly one `seus.id`). |
| FR-2.5 human, AI, external-system participants | ✅ | `participants.type CHECK IN ('AI','Human','External')`. |
| FR-2.6 complete engineering traceability | ⚠️ | Real via the `events` table + FK trails; not a dedicated "traceability service" of its own (same partial verdict every other chapter's own traceability claim has gotten this session). |
| FR-2.7 knowledge preserved independently of participant lifecycle | ✅ | `knowledge_items.seu_id`, no `participant_id` coupling — a Participant's replacement doesn't cascade-delete anything. |
| FR-2.8 runtime state exposed through published services | ⚠️ | Real HTTP read routes exist (`seus.ts`'s own detail/list views); no dedicated "runtime state API" beyond ordinary CRUD reads. |
| FR-2.9 dependency relationships between deliverables | ✅ | `dependency_definitions`, real (Ch.9, exercised throughout this session's own audits). |
| FR-2.10 execution only when dependencies satisfied | ✅ | `dispatchEngine.ts` gates Work Item dispatch on `dependencyDefinitionEngine`'s own readiness check. |
| FR-2.11 manage engineering obligations | ⚠️ | Real lifecycle exists (Ch.23), but "manage" overstates it slightly — no owner/priority/completion-criteria fields exist yet (Ch.23 §19.5, unresolved by CR-062, which deliberately left those execution-side). |
| FR-2.12 complete audit history | ⚠️ | Same basis as FR-2.6 — real via `events`, not a dedicated audit-history service. |

## 19.5 SEU Lifecycle — a real, governed 8-state machine, but only 2 of the chapter's own 8 named states match it (§6)

Live `transition_definitions WHERE entity_type='SEU'` confirms a real, governed graph: `Pending → Commissioned → Configured → Activated → Operational → {Suspended ⇄ Operational, Retired} → Archived` (9 real edges, `lifecycle_state CHECK` enforces the same 8 states). This is genuinely real, not aspirational — but it names and orders things differently from the chapter's own 8 stages (Requested → Engineering Behavior Composition → Commissioned → Executing → Monitoring → Completing → Knowledge Preservation → Archived):

| Chapter stage | Real equivalent |
|---|---|
| Requested | `Pending` (same meaning, different name) |
| Engineering Behavior Composition | Not a persisted state at all — composition happens synchronously *inside* the `Pending→Commissioned` transition itself (`commissioning.ts:139-168`), never independently observable |
| Commissioned | `Commissioned` ✅ exact match |
| Executing | No direct match — real has `Configured`→`Activated`→`Operational` instead, an infrastructure-readiness sequence, not a work-progress one |
| Monitoring | No match |
| Completing | No match |
| Knowledge Preservation | No match — real has `Retired` here instead |
| Archived | `Archived` ✅ exact match |

Real, extra states the chapter never names: `Configured`, `Suspended` (a genuine round-trip state, `Operational ⇄ Suspended`, absent from the chapter entirely). The chapter's own vision reads as **work-progress-oriented** (request → build → monitor → finish → preserve); the real, built lifecycle is **infrastructure-readiness-oriented** (commission → configure → activate → run → suspend/retire). Both are real 8-state machines; they're just not the same 8 states.

## 19.6 SEU Composition — 15 named components, most real elsewhere, 3 genuinely absent (§7)

| Component | Real? |
|---|---|
| Objectives | ✅ `objective_id` |
| Participants | ✅ `participants` table |
| Capabilities | ✅ `seu_capabilities` |
| Services | ✅ `services` (Ch.11, CR-064 built) |
| Roles | ❌ absent — no `Role`/`roles` entity anywhere in the codebase, confirmed by direct search |
| Deliverables | ✅ `deliverables` |
| Work Items | ✅ `work_items` |
| Dependency Graph | ✅ `dependency_definitions` |
| Knowledge | ✅ `knowledge_items` |
| Evidence | ✅ `evidence` |
| Governance | ✅ (Quality Gates/Policies/Authority Rules, reached via the EBM's Pack-list, Ch.3 §19.10) |
| Obligations | ✅ `obligations` (Ch.23) |
| Traceability | ⚠️ real via `events`, no dedicated traceability entity (19.4 FR-2.6) |
| Metrics | ✅ `metric_registry`/`metric_definitions` (migration `017_metric_registry.sql`) — though not SEU-scoped specifically |
| Runtime State | ⚠️ `seus.lifecycle_state` is the closest real equivalent — no separate "Runtime State" entity beyond the SEU row's own status field |

## 19.7 Execution Model (§8)

Real and matches closely: `dispatchEngine.ts` gates dispatch on `dependencyDefinitionEngine`'s own readiness evaluation, not elapsed time — confirmed, no polling/timer-based readiness check exists anywhere in the dispatch path. Named dependency sources (deliverables, decisions, approvals, evidence, obligations, external systems, human input) are each real, individually-governed entities.

## 19.8 Engineering Behavior Model inheritance (§9)

Identical finding to Chapter 3's own audit (§19.10) — real, but indirect: the SEU never modifies its EBM directly (holds trivially, no update path exists, Ch.3 §19.3 FR-3.8), and "changes require recomposition" is aspirational in the same way Ch.3/Ch.4 both found (recomposition is never actually triggered by anything, Ch.4 §21.12).

## 19.9 Participants (§10)

Real — `participants.type CHECK IN ('AI','Human','External')`; replacement doesn't cascade-invalidate anything (19.4 FR-2.7's own basis extends here too — no FK from `knowledge_items`/`evidence`/`deliverables` to a specific Participant that would need cleanup on replacement).

## 19.10 Deliverables / Work Items / Dependency Graph (§11–13)

Each has its own governing chapter not yet audited this session (Deliverable, Work Item) — flagged here only for what's directly checkable against this chapter's own claims: "Work Items shall not exist independently of Deliverables" holds (`work_items` FK to a Deliverable is real and required); Deliverable's own named required fields (dependencies, producing capabilities, required evidence, acceptance criteria, completion status) are a mix of real columns and Dependency-Engine-derived relationships, not something this audit re-verifies field-by-field — deserves its own chapter-3-style pass if wanted.

## 19.11 Engineering Obligations (§14)

Cross-references Chapter 23's own extensive audit (CR-062). Of this section's own named required fields: `severity` ✅, `status` ✅ real columns; `owner` ❌ absent (no `assigned_to` column, Ch.23 §18.4 confirmed, and CR-062 deliberately left this execution-side); `priority` ❌ absent (same CR-062 deferral); `required evidence` ❌ (Ch.23's own "Related Evidence" field never built); `blocking conditions` ⚠️ real in spirit — an unresolved Obligation genuinely blocks a gated Deliverable transition via the real `no_unresolved_obligations` Quality Gate criteria (Ch.23 §18.8), just not as its own named field on the Obligation row.

## 19.12 Events — 5 of 11 named events real, several under different names (§15)

| Chapter name | Real? |
|---|---|
| SEUCommissioned | ✅ exact (`commissioning.ts:170`) |
| DeliverableReady | ✅ exact (`dependencyDefinitionEngine.ts:194`) |
| DependencyBlocked | ⚠️ real, but as `DeliverableBlocked` (`deliverables.ts:145`), not `DependencyBlocked` |
| DependencySatisfied | ❌ no event by this name — `DeliverableReady` is the real aggregate-satisfaction signal instead (same finding CR-040's own earlier audit made for the Dependency Engine generally) |
| WorkItemStarted | ❌ no event by this name — real equivalent is `WorkItemDispatched` (`dispatchEngine.ts:77,147`) |
| WorkItemCompleted | ✅ exact (`workItems.ts:187`) |
| ObligationRaised | ❌ — real is `ObligationCreated` (Ch.23 §19.12/CR-063) |
| ObligationResolved | ❌ — Obligation only has `ObligationCreated` + a generic `ObligationTransitioned`, neither named this; CR-063 (raised, not built) would close this |
| KnowledgeAccepted | ❌ not found |
| KnowledgeArchived | ❌ not found |
| SEUArchived | ❌ not found — no event publishes when an SEU reaches `Archived` |

## 19.13 Non-Functional Requirements (§16)

| NFR | Verdict | Basis |
|---|---|---|
| multiple SEUs execute concurrently | ✅ | No shared mutable state between SEUs; each is its own row/FK subtree |
| survive runtime restarts | ✅ | All state is DB-persisted, no in-memory-only runtime state |
| runtime state recoverable | ✅ | Same basis |
| all engineering decisions traceable | ⚠️ | 19.4 FR-2.6 |
| all execution externally observable | ⚠️ | Via `events`/HTTP reads; no dedicated observability service |
| independent of specific AI providers | ✅ | No AI-provider coupling anywhere in `seus.ts`/`participants` |

## 19.14 Acceptance Criteria (§17)

| Criterion | Verdict |
|---|---|
| An SEU can be commissioned from an EBM | ✅ (19.2/19.4 FR-2.2/2.3) |
| Participants can be assigned and replaced | ✅ (19.9) |
| Deliverables drive execution | ✅ (19.7) |
| Work Items execute only when dependencies satisfied | ✅ (19.7/19.4 FR-2.10) |
| Engineering obligations influence execution | ✅ — via the real `no_unresolved_obligations` gate (19.11) |
| Knowledge survives SEU archival | ⚠️ untested — no code path deletes `knowledge_items` on archival, but "survives" as a deliberate guarantee isn't separately verified |
| Traceability remains complete | ⚠️ (19.4 FR-2.6) |

## 19.15 Deliverables (§18)

| Named Deliverable | Real artifact | Verdict |
|---|---|---|
| SEU domain model | `SeuRow` (`seuTypes.ts`), `seus` table | ✅ |
| SEU lifecycle implementation | Real 8-state governed graph (19.5) | ✅ (different names than the chapter's own) |
| SEU aggregate definition | `seus.ts` | ✅ |
| Dependency graph interfaces | `dependencyDefinitionEngine.ts` | ✅ |
| Deliverable model | `deliverables` table | ✅ (19.10) |
| Work Item model | `work_items` table | ✅ |
| Runtime services | Scattered across `core/*.ts` | ⚠️ no single "SEU runtime service," logic lives per-concern |
| Event definitions | 5 of 11 named (19.12) | ⚠️ |
| Initial API specification | `src/routes/seu/api/*` | ✅ |

## Summary — ranked

1. **[Data model — resolves an earlier open question decisively]** `seus.objective_id` is `UNIQUE` — a real, enforced 1:1 between SEU and Objective. Closes Ch.1's own "or a specific stream of Deliverables within one [SEU]" phrasing as unsupported by the schema at the strongest possible level (19's own preamble).
2. **[Architecture]** The real SEU lifecycle is a genuine, governed 8-state machine — but only 2 of the chapter's own 8 named stages match it by name, and the underlying *shape* differs: the chapter is work-progress-oriented (Executing/Monitoring/Completing), the real one is infrastructure-readiness-oriented (Configured/Activated/Operational/Suspended) (19.5).
3. **[Code]** Several named events are real but under different names than the chapter uses (`DeliverableReady` not `DependencySatisfied`, `WorkItemDispatched` not `WorkItemStarted`, `DeliverableBlocked` not `DependencyBlocked`) — a naming-convention drift, not a functional gap, for 3 of the 11 (19.12).
4. **[Data model]** "Roles" (§7) has zero real entity anywhere in the codebase — the one SEU Composition component with no partial credit at all (19.6).
5. **[Code]** Obligation-related events (`ObligationRaised`/`Resolved`) and Knowledge-related events (`KnowledgeAccepted`/`Archived`) are entirely unbuilt — consistent with, and reinforcing, Chapter 23's own separately-audited event gap (CR-063, raised not built) (19.12).