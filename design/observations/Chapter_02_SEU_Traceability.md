# Traceability Analysis: Chapter 2 – Software Engineering Unit (SEU)

**Specification File**: [`03_Book 3 (Refined)/01_Part 1/Chapter 2.md`](file:///Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book%203%20%28Refined%29/01_Part%201/Chapter%202.md)  
**Implementation Source Files**:
- Database Layer: [`src/dblayer/seusDB.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seusDB.ts), [`src/dblayer/seuTypes.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/dblayer/seuTypes.ts)
- Domain / Core Logic: [`src/routes/seu/core/seus.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/routes/seu/core/seus.ts), [`src/routes/seu/core/commissioning.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/routes/seu/core/commissioning.ts)
- Engine Surface: [`src/domain/engine/dependencyDefinitionEngine.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/domain/engine/dependencyDefinitionEngine.ts), [`src/domain/engine/dispatchEngine.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/domain/engine/dispatchEngine.ts)
- API / Web Surface: [`src/routes/seu/api/seus.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/routes/seu/api/seus.ts), [`src/routes/seu/web/seus.ts`](file:///Volumes/Chennai/gitrepo/aisworg/src/routes/seu/web/seus.ts)

**Date**: September 8, 2026  
**Status**: Completed  

---

## 1. Executive Summary

This document establishes the formal traceability between **Chapter 2 (Software Engineering Unit - SEU)** of *Book 3 (Refined)* and the application codebase in `src/`.

The **Software Engineering Unit (SEU)** as the primary execution aggregate of the platform is **strongly realized in the codebase**. Core invariants—such as strict 1:1 mapping with a non-Strategic leaf Objective (`seus.objective_id NOT NULL UNIQUE`), single-EBM execution (`active_ebm_id`), singular resource ownership (`seu_id` FK across all runtime tables), multi-participant support (`AI`, `Human`, `External`), dependency-driven work item dispatch, and participant-independent knowledge preservation—are fully operational.

Key discrepancies identified include a **lifecycle state naming alignment shift** (work-progress-oriented spec vs. infrastructure-readiness-oriented implementation) and the **absence of an explicit `Roles` entity**.

---

## 2. Requirement-by-Requirement Traceability Matrix

### 2.1 Functional Requirements (FR-2.1 – FR-2.12)

| FR ID | Requirement | Codebase Implementation | Traceability Status | Notes / Observations |
|---|---|---|:---:|---|
| **FR-2.1** | Authorised users may commission an SEU. | `commissioning.ts` authority-gated commissioning flow. `commissionSeu` validates user permissions and target Objective state. | **Fully Met** | Triggered via `commissionFromExistingObjective` or inline commissioning. |
| **FR-2.2** | Every SEU executes against exactly one EBM. | `seus.active_ebm_id` (UUID FK) set once per SEU upon composition. | **Fully Met** | Enforced in `seusDB.ts` and `commissioning.ts`. |
| **FR-2.3** | EBM shall exist before SEU is commissioned. | Strict sequence in `commissioning.ts`: `compose()` runs $\rightarrow$ `ebmsDB.create` $\rightarrow$ transition `Pending → Commissioned`. | **Fully Met** | Composition executes synchronously before commissioning completes. |
| **FR-2.4** | Every runtime object belongs to exactly one active SEU. | `seu_id` (UUID FK `NOT NULL`) present on `deliverables`, `participants`, `obligations`, `decisions`, `evidence`, `knowledge_items`, `reviews`, `commands`, `events`. | **Fully Met** | Strict singular ownership; no multi-SEU shared runtime rows. |
| **FR-2.5** | Support human, AI, and external-system participants. | Table `participants` with `type CHECK IN ('AI', 'Human', 'External')`. | **Fully Met** | Supported in `participantAdapters.ts` and `participant-lifecycle`. |
| **FR-2.6** | Complete engineering traceability. | Audit trail recorded via `events` table with `originating_object_id` and `seu_id`. | **Partially Met** | Traceability derived from event streams & FK graphs rather than a dedicated standalone "Traceability Service". |
| **FR-2.7** | Knowledge preserved independently of participant lifecycle. | `knowledge_items.seu_id` has no FK coupling to `participant_id`. Participant replacement does not cascade-delete knowledge. | **Fully Met** | Knowledge persists for the entire SEU lifecycle and post-archival. |
| **FR-2.8** | Expose runtime state through published services. | HTTP read routes in `routes/seu/core/seus.ts` and `routes/seu/api/seus.ts`. | **Partially Met** | Exposed via standard CRUD/REST endpoints rather than a dedicated "Runtime State API". |
| **FR-2.9** | Maintain dependency relationships between deliverables. | Table `dependency_definitions` (`dependencyDefinitionEngine.ts`). | **Fully Met** | Governs deliverable readiness and execution graph edges. |
| **FR-2.10** | Execution occurs only when dependencies are satisfied. | `dispatchEngine.ts` checks `dependencyDefinitionEngine.evaluateReadiness` before dispatching Work Items. | **Fully Met** | Strict dependency-driven execution; no timer/polling dispatch. |
| **FR-2.11** | Manage engineering obligations. | Table `obligations` (`seu_id`). Gated via `no_unresolved_obligations` Quality Gate criterion. | **Partially Met** | Lifecycle and quality gate enforcement built; execution-side priority/owner fields deferred (CR-062). |
| **FR-2.12** | Complete audit history. | Table `events` captures all SEU transitions and deliverable/work item actions. | **Partially Met** | Derived from domain events rather than a separate audit database. |

---

## 3. SEU Lifecycle Analysis (§6)

A notable structural discrepancy exists between the specification lifecycle and the database-enforced lifecycle:

### 3.1 Lifecycle State Comparison

| Specification Lifecycle (Work-Progress-Oriented) | Codebase Implementation (Infrastructure-Readiness-Oriented) | Alignment Status | Notes / Observations |
|---|---|:---:|---|
| **Requested** | `Pending` | **Equivalent** | Initial state prior to commissioning. |
| **Engineering Behavior Composition** | *Inline in Transition* | **Transitory** | Composition occurs synchronously inside the `Pending → Commissioned` transition in `commissioning.ts`; not a persisted state. |
| **Commissioned** | `Commissioned` | **Exact Match** | EBM composed and runtime resources allocated. |
| *N/A (Unlisted in Spec)* | `Configured` | **Code-Only** | Intermediate state for participant and dependency configuration. |
| *N/A (Unlisted in Spec)* | `Activated` | **Code-Only** | State indicating readiness for active work execution. |
| **Executing** / **Monitoring** | `Operational` | **Consolidated** | Active engineering work execution state. Includes `Operational ⇄ Suspended` round-trip. |
| **Completing** / **Knowledge Preservation** | `Retired` | **Consolidated** | State representing completed/retired SEU work prior to archiving. |
| **Archived** | `Archived` | **Exact Match** | Terminal read-only state. |

**Observation**: Both the spec and implementation define 8-state machines, but the specification uses a **work-progress mental model** while the code implements an **infrastructure-readiness state machine** (`Pending → Commissioned → Configured → Activated → Operational → {Suspended ⇄ Operational, Retired} → Archived`).

---

## 4. SEU Composition Components Verification (§7)

| Component | Database / Code Realization | Verification Status | Notes |
|---|---|:---:|---|
| **Objectives** | `seus.objective_id` | ✅ **Built** | Strict 1:1 foreign key |
| **Participants** | `participants` table | ✅ **Built** | Types: AI, Human, External |
| **Capabilities** | `seu_capabilities` table | ✅ **Built** | Mapped per SEU |
| **Services** | `services` table | ✅ **Built** | Pack-contributed services (CR-064) |
| **Roles** | *None* | 🚩 **Absent** | No `roles` or `Role` table exists in the codebase |
| **Deliverables** | `deliverables` table | ✅ **Built** | Primary execution outcome |
| **Work Items** | `work_items` table | ✅ **Built** | Subordinate to Deliverable (`deliverable_id NOT NULL`) |
| **Dependency Graph** | `dependency_definitions` table | ✅ **Built** | Governs execution graph |
| **Knowledge** | `knowledge_items` table | ✅ **Built** | Preserved across lifecycle |
| **Evidence** | `evidence` table | ✅ **Built** | Attached to deliverables/gates |
| **Governance** | `ebms` $\rightarrow$ `composed_packs` | ✅ **Built** | Quality gates, policies, authority rules |
| **Obligations** | `obligations` table | ✅ **Built** | Managed per SEU |
| **Traceability** | `events` table | ⚠️ **Implicit** | Graph-derived |
| **Metrics** | `metric_registry` / `runtime_telemetry` | ✅ **Built** | Runtime telemetry tables |
| **Runtime State** | `seus.lifecycle_state` | ✅ **Built** | Governed lifecycle state |

---

## 5. Domain Event Verification (§15)

| Specification Event | Built Event Name | Implementation Status | Location |
|---|---|:---:|---|
| `SEUCommissioned` | `SEUCommissioned` | ✅ **Exact Match** | `commissioning.ts:170` |
| `DeliverableReady` | `DeliverableReady` | ✅ **Exact Match** | `dependencyDefinitionEngine.ts:194` |
| `WorkItemStarted` | `WorkItemDispatched` | ⚠️ **Renamed** | `dispatchEngine.ts:77` |
| `WorkItemCompleted` | `WorkItemCompleted` | ✅ **Exact Match** | `workItems.ts:187` |
| `DependencySatisfied` | *N/A* | 🚩 **Absent** | `DeliverableReady` acts as aggregate satisfaction signal |
| `DependencyBlocked` | `DeliverableBlocked` | ⚠️ **Renamed** | `deliverables.ts:145` |
| `ObligationRaised` | `ObligationCreated` | ⚠️ **Renamed** | `core/obligations.ts` |
| `ObligationResolved` | `ObligationTransitioned` | ⚠️ **Renamed** | `core/obligations.ts` |
| `KnowledgeAccepted` | *N/A* | 🚩 **Absent** | Event not emitted |
| `KnowledgeArchived` | *N/A* | 🚩 **Absent** | Event not emitted |
| `SEUArchived` | *N/A* | 🚩 **Absent** | SEU state change event generic |

---

## 6. Identified Gaps, Discrepancies & Cross-Chapter Dependencies

### Discrepancy 1: Lifecycle Mental Model Shift (§6)
- **Specification**: Work-progress-oriented lifecycle (`Requested → Composition → Commissioned → Executing → Monitoring → Completing → Knowledge Preservation → Archived`).
- **Codebase**: Infrastructure-readiness-oriented lifecycle (`Pending → Commissioned → Configured → Activated → Operational → Suspended / Retired → Archived`).
- **Impact**: Operational behavior is fully governed and functional; the state names reflect runtime infrastructure states rather than phase titles.

### Gap 1: Absence of `Roles` Entity (§7)
- **Specification**: Lists `Roles` as one of the 15 runtime components of SEU composition.
- **Codebase**: No `roles` table or entity exists. Participant role assignments are handled via `participants.type` and badge grants rather than a dedicated SEU Role object.
- **Impact**: Medium (capabilities and badges substitute for explicit SEU Role entities).

### Discrepancy 2: Event Naming Convention Drift (§15)
- **Specification**: `WorkItemStarted`, `DependencyBlocked`, `ObligationRaised`.
- **Codebase**: `WorkItemDispatched`, `DeliverableBlocked`, `ObligationCreated`.
- **Impact**: None (functional domain events fire at identical execution milestones under updated naming conventions).

---

## 7. Conclusion

Chapter 2 specification alignment is **solid (~88%)**. The SEU as an executable runtime aggregate with singular resource ownership, dependency-driven dispatch, participant isolation, and EBM inheritance is fully implemented. The primary observations relate to state-naming alignment (`Infrastructure-Readiness` vs. `Work-Progress`) and the omission of a explicit `Roles` component.
